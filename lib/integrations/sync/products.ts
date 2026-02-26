/**
 * Product Sync Orchestration (ERP-agnostic, bidirectional)
 *
 * Products are a shared catalog — every product in the ERP should exist
 * in Kosha and vice versa. They're linked by erp_entity_id.
 *
 * Sync flow:
 * 1. Pull all ERP products → match/create in Kosha
 * 2. Push all unlinked Kosha products → create in ERP
 *
 * Matching priority: erp_entity_id > SKU > fuzzy name
 */

import { createServiceClient } from '@/utils/supabase/service'
import { getErpProvider } from '../registry'
import { calculateStringSimilarity } from '@/lib/customers/services'
import type { ErpProduct } from '../types'
import type { Product } from '@/types/products'

interface SyncResult {
  created: number
  updated: number
  pushed: number
  skipped: number
  errors: string[]
}

/**
 * Bidirectional product sync between Kosha and the ERP.
 *
 * Step 1 (Pull): For each ERP product, match to a Kosha product or create one.
 * Step 2 (Push): For each Kosha product without erp_entity_id, push to ERP.
 *
 * After sync, every product on both sides is linked by erp_entity_id.
 */
export async function pullProductsFromErp(organizationId: string): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, pushed: 0, skipped: 0, errors: [] }

  const provider = await getErpProvider(organizationId)
  if (!provider) {
    result.errors.push('No ERP provider configured')
    return result
  }

  const supabase = createServiceClient()

  // Load existing Kosha products for matching
  const { data: koshaProducts, error } = await supabase
    .from('products')
    .select('id, sku, name, erp_entity_id, unit_price, is_active')
    .eq('organization_id', organizationId)

  if (error) {
    result.errors.push(`Failed to load Kosha products: ${error.message}`)
    return result
  }

  const existingProducts = (koshaProducts || []) as MatchableProduct[]

  // ==========================================
  // Step 1: Pull ERP products into Kosha
  // ==========================================

  const erpProducts = await provider.pullProducts()

  for (const erpProduct of erpProducts) {
    try {
      const match = findBestMatch(erpProduct, existingProducts)

      if (match) {
        // Update existing product — ERP is source of truth for SKU, name, price
        const updateData: Record<string, unknown> = {
          name: erpProduct.name,
          erp_entity_id: erpProduct.erpId,
          erp_display_name: erpProduct.name,
          erp_synced_at: new Date().toISOString(),
          erp_sync_status: 'synced',
          erp_sync_error: null,
          erp_metadata: erpProduct.raw,
        }

        // Update SKU from ERP if it has one
        if (erpProduct.sku) {
          updateData.sku = erpProduct.sku
        }

        // Update price from ERP if it has one
        if (erpProduct.unitPrice !== null) {
          updateData.unit_price = erpProduct.unitPrice
        }

        const { error: updateError } = await supabase
          .from('products')
          .update(updateData)
          .eq('id', match.id)

        if (updateError) {
          result.errors.push(`Failed to update ${erpProduct.name}: ${updateError.message}`)
        } else {
          result.updated++
          match.erp_entity_id = erpProduct.erpId
        }
      } else {
        // Create new Kosha product from ERP data
        const { error: createError } = await supabase
          .from('products')
          .insert({
            organization_id: organizationId,
            sku: erpProduct.sku || erpProduct.erpId,
            name: erpProduct.name,
            unit_price: erpProduct.unitPrice ?? 0,
            is_active: erpProduct.isActive,
            erp_entity_id: erpProduct.erpId,
            erp_display_name: erpProduct.name,
            erp_synced_at: new Date().toISOString(),
            erp_sync_status: 'synced',
            erp_sync_error: null,
            erp_metadata: erpProduct.raw,
          })

        if (createError) {
          if (createError.code === '23505') {
            result.skipped++
          } else {
            result.errors.push(`Failed to create ${erpProduct.name}: ${createError.message}`)
          }
        } else {
          result.created++
        }
      }
    } catch (err) {
      result.errors.push(`Error pulling ${erpProduct.name}: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  // ==========================================
  // Step 2: Push unlinked Kosha products to ERP
  // ==========================================

  // Reload products to get updated erp_entity_id values from step 1
  const { data: refreshedProducts, error: refreshError } = await supabase
    .from('products')
    .select('*')
    .eq('organization_id', organizationId)
    .is('erp_entity_id', null)

  if (refreshError) {
    result.errors.push(`Failed to load unlinked products: ${refreshError.message}`)
    return result
  }

  const unlinkedProducts = (refreshedProducts || []) as Product[]

  for (const product of unlinkedProducts) {
    try {
      // Mark as pending
      await supabase
        .from('products')
        .update({ erp_sync_status: 'pending' })
        .eq('id', product.id)

      const pushResult = await provider.pushProduct(product)

      if (pushResult.success) {
        await supabase
          .from('products')
          .update({
            erp_entity_id: pushResult.erpEntityId,
            erp_display_name: pushResult.erpDisplayName,
            erp_synced_at: new Date().toISOString(),
            erp_sync_status: 'synced',
            erp_sync_error: null,
          })
          .eq('id', product.id)

        result.pushed++
      } else {
        await supabase
          .from('products')
          .update({
            erp_sync_status: 'error',
            erp_sync_error: pushResult.error || 'Push failed',
          })
          .eq('id', product.id)

        result.errors.push(`Failed to push ${product.name}: ${pushResult.error}`)
      }
    } catch (err) {
      result.errors.push(`Error pushing ${product.name}: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  return result
}

// ============================================
// Matching helpers
// ============================================

interface MatchableProduct {
  id: string
  sku: string
  name: string
  erp_entity_id: string | null
}

/**
 * Find the best Kosha product match for an ERP product.
 * Returns null if no match found (product should be created).
 */
function findBestMatch(
  erpProduct: ErpProduct,
  koshaProducts: MatchableProduct[]
): MatchableProduct | null {
  // 1. Exact match by erp_entity_id (already synced before)
  const byErpId = koshaProducts.find(p => p.erp_entity_id === erpProduct.erpId)
  if (byErpId) return byErpId

  // 2. Match by SKU (case-insensitive)
  if (erpProduct.sku) {
    const normalizedErpSku = erpProduct.sku.toLowerCase().trim()
    const bySku = koshaProducts.find(p =>
      p.sku.toLowerCase().trim() === normalizedErpSku
    )
    if (bySku) return bySku
  }

  // 3. Fuzzy name match (threshold 0.85 for auto-match)
  const erpName = erpProduct.name.toLowerCase().trim()
  let bestMatch: MatchableProduct | null = null
  let bestScore = 0

  for (const product of koshaProducts) {
    const koshaName = product.name.toLowerCase().trim()
    const score = calculateStringSimilarity(erpName, koshaName)
    if (score > bestScore && score >= 0.85) {
      bestScore = score
      bestMatch = product
    }
  }

  return bestMatch
}
