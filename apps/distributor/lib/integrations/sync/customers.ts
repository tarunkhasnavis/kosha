/**
 * Customer Sync Orchestration (ERP-agnostic)
 *
 * Handles the logic of matching, creating, and updating customers
 * between Kosha and any ERP provider. The provider-specific API calls
 * are abstracted behind the ErpProvider interface.
 *
 * Matching priority: erp_entity_id > email > fuzzy name
 */

import { createServiceClient } from '@kosha/supabase/service'
import { getErpProvider } from '../registry'
import { normalizeCompanyName, calculateStringSimilarity, emailsMatch } from '@/lib/customers/services'
import type { ErpCustomer } from '../types'
import type { Customer } from '@kosha/types'

interface SyncResult {
  created: number
  updated: number
  skipped: number
  errors: string[]
}

/**
 * Pull customers from the ERP into Kosha.
 *
 * For each ERP customer:
 * 1. Match by erp_entity_id (exact - already synced before)
 * 2. Match by email (high confidence)
 * 3. Match by fuzzy name (lower confidence)
 * 4. If no match, create a new Kosha customer
 */
export async function pullCustomersFromErp(organizationId: string): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, skipped: 0, errors: [] }

  const provider = await getErpProvider(organizationId)
  if (!provider) {
    result.errors.push('No ERP provider configured')
    return result
  }

  // Pull all customers from ERP
  const erpCustomers = await provider.pullCustomers()

  if (erpCustomers.length === 0) {
    return result
  }

  // Load existing Kosha customers for matching
  const supabase = createServiceClient()
  const { data: koshaCustomers, error } = await supabase
    .from('customers')
    .select('id, name, primary_contact_email, erp_entity_id, erp_metadata, is_active')
    .eq('organization_id', organizationId)

  if (error) {
    result.errors.push(`Failed to load Kosha customers: ${error.message}`)
    return result
  }

  const existingCustomers = koshaCustomers || []

  for (const erpCustomer of erpCustomers) {
    try {
      const match = findBestMatch(erpCustomer, existingCustomers)

      if (match) {
        // Update existing customer with ERP link
        const { error: updateError } = await supabase
          .from('customers')
          .update({
            erp_entity_id: erpCustomer.erpId,
            erp_display_name: erpCustomer.displayName,
            erp_synced_at: new Date().toISOString(),
            erp_sync_status: 'synced',
            erp_sync_error: null,
            erp_metadata: erpCustomer.raw,
          })
          .eq('id', match.id)

        if (updateError) {
          result.errors.push(`Failed to update ${erpCustomer.displayName}: ${updateError.message}`)
        } else {
          result.updated++
          // Update the in-memory list so subsequent matches use the updated erp_entity_id
          match.erp_entity_id = erpCustomer.erpId
        }
      } else {
        // Create new Kosha customer from ERP data
        const { error: createError } = await supabase
          .from('customers')
          .insert({
            organization_id: organizationId,
            name: erpCustomer.companyName || erpCustomer.displayName,
            primary_contact_email: erpCustomer.email,
            primary_contact_phone: erpCustomer.phone,
            billing_address: erpCustomer.billingAddress,
            erp_entity_id: erpCustomer.erpId,
            erp_display_name: erpCustomer.displayName,
            erp_synced_at: new Date().toISOString(),
            erp_sync_status: 'synced',
            erp_sync_error: null,
            erp_metadata: erpCustomer.raw,
          })

        if (createError) {
          // Likely a unique constraint violation (name already exists)
          if (createError.code === '23505') {
            result.skipped++
          } else {
            result.errors.push(`Failed to create ${erpCustomer.displayName}: ${createError.message}`)
          }
        } else {
          result.created++
        }
      }
    } catch (err) {
      result.errors.push(`Error syncing ${erpCustomer.displayName}: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  return result
}

/**
 * Push a single Kosha customer to the ERP.
 * Updates the customer's erp_* fields after successful push.
 */
export async function pushCustomerToErp(
  organizationId: string,
  customerId: string
): Promise<{ success: boolean; error?: string }> {
  const provider = await getErpProvider(organizationId)
  if (!provider) {
    return { success: false, error: 'No ERP provider configured' }
  }

  const supabase = createServiceClient()

  // Load the customer
  const { data: customer, error: fetchError } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .eq('organization_id', organizationId)
    .single()

  if (fetchError || !customer) {
    return { success: false, error: 'Customer not found' }
  }

  // Mark as pending before push
  await supabase
    .from('customers')
    .update({ erp_sync_status: 'pending' })
    .eq('id', customerId)

  // Push to ERP
  const result = await provider.pushCustomer(customer as Customer)

  if (result.success) {
    await supabase
      .from('customers')
      .update({
        erp_entity_id: result.erpEntityId,
        erp_display_name: result.erpDisplayName,
        erp_synced_at: new Date().toISOString(),
        erp_sync_status: 'synced',
        erp_sync_error: null,
      })
      .eq('id', customerId)

    return { success: true }
  } else {
    await supabase
      .from('customers')
      .update({
        erp_sync_status: 'error',
        erp_sync_error: result.error || 'Push failed',
      })
      .eq('id', customerId)

    return { success: false, error: result.error }
  }
}

// ============================================
// Matching helpers
// ============================================

interface MatchableCustomer {
  id: string
  name: string
  primary_contact_email: string | null
  erp_entity_id: string | null
}

/**
 * Find the best Kosha customer match for an ERP customer.
 * Returns null if no match found (customer should be created).
 */
function findBestMatch(
  erpCustomer: ErpCustomer,
  koshaCustomers: MatchableCustomer[]
): MatchableCustomer | null {
  // 1. Exact match by erp_entity_id (already synced before)
  const byErpId = koshaCustomers.find(c => c.erp_entity_id === erpCustomer.erpId)
  if (byErpId) return byErpId

  // 2. Match by email
  if (erpCustomer.email) {
    const byEmail = koshaCustomers.find(c =>
      emailsMatch(c.primary_contact_email, erpCustomer.email)
    )
    if (byEmail) return byEmail
  }

  // 3. Fuzzy name match (threshold 0.85 for auto-match)
  const erpName = normalizeCompanyName(erpCustomer.companyName || erpCustomer.displayName)
  let bestMatch: MatchableCustomer | null = null
  let bestScore = 0

  for (const customer of koshaCustomers) {
    const koshaName = normalizeCompanyName(customer.name)
    const score = calculateStringSimilarity(erpName, koshaName)
    if (score > bestScore && score >= 0.85) {
      bestScore = score
      bestMatch = customer
    }
  }

  return bestMatch
}
