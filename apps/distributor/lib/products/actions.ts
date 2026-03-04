'use server'

/**
 * Product Server Actions
 *
 * CRUD operations for the master product catalog.
 */

import { createClient } from '@kosha/supabase/server'
import { getUser } from '@kosha/supabase'
import { getOrganizationId } from '@/lib/organizations/queries'
import { revalidatePath } from 'next/cache'
import type { Product, CreateProductInput, UpdateProductInput, ProductCSVRow } from '@kosha/types'

/**
 * Get all products for the current organization
 */
export async function getProducts(): Promise<{ products: Product[]; error?: string }> {
  const orgId = await getOrganizationId()

  if (!orgId) {
    return { products: [], error: 'No organization found' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('organization_id', orgId)
    .order('sku', { ascending: true })

  if (error) {
    console.error('Failed to fetch products:', error)
    return { products: [], error: 'Failed to fetch products' }
  }

  return { products: data || [] }
}

/**
 * Get a single product by ID
 */
export async function getProduct(productId: string): Promise<{ product: Product | null; error?: string }> {
  const orgId = await getOrganizationId()

  if (!orgId) {
    return { product: null, error: 'No organization found' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .eq('organization_id', orgId)
    .single()

  if (error) {
    console.error('Failed to fetch product:', error)
    return { product: null, error: 'Failed to fetch product' }
  }

  return { product: data }
}

/**
 * Create a new product
 */
export async function createProduct(
  input: CreateProductInput
): Promise<{ product: Product | null; error?: string }> {
  const user = await getUser()
  if (!user) {
    return { product: null, error: 'Not authenticated' }
  }

  const orgId = await getOrganizationId()
  if (!orgId) {
    return { product: null, error: 'No organization found' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('products')
    .insert({
      organization_id: orgId,
      sku: input.sku.trim(),
      name: input.name.trim(),
      unit_price: input.unit_price,
      is_active: input.is_active ?? true,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create product:', error)
    if (error.code === '23505') {
      return { product: null, error: 'A product with this SKU already exists' }
    }
    return { product: null, error: 'Failed to create product' }
  }

  revalidatePath('/products')
  return { product: data }
}

/**
 * Update an existing product
 */
export async function updateProduct(
  productId: string,
  input: UpdateProductInput
): Promise<{ product: Product | null; error?: string }> {
  const user = await getUser()
  if (!user) {
    return { product: null, error: 'Not authenticated' }
  }

  const orgId = await getOrganizationId()
  if (!orgId) {
    return { product: null, error: 'No organization found' }
  }

  const supabase = await createClient()

  // Build update object with only provided fields
  const updateData: Record<string, unknown> = {}
  if (input.sku !== undefined) updateData.sku = input.sku.trim()
  if (input.name !== undefined) updateData.name = input.name.trim()
  if (input.unit_price !== undefined) updateData.unit_price = input.unit_price
  if (input.is_active !== undefined) updateData.is_active = input.is_active

  const { data, error } = await supabase
    .from('products')
    .update(updateData)
    .eq('id', productId)
    .eq('organization_id', orgId)
    .select()
    .single()

  if (error) {
    console.error('Failed to update product:', error)
    if (error.code === '23505') {
      return { product: null, error: 'A product with this SKU already exists' }
    }
    return { product: null, error: 'Failed to update product' }
  }

  revalidatePath('/products')
  return { product: data }
}

/**
 * Delete a product (hard delete)
 */
export async function deleteProduct(productId: string): Promise<{ success: boolean; error?: string }> {
  const user = await getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const orgId = await getOrganizationId()
  if (!orgId) {
    return { success: false, error: 'No organization found' }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId)
    .eq('organization_id', orgId)

  if (error) {
    console.error('Failed to delete product:', error)
    return { success: false, error: 'Failed to delete product' }
  }

  revalidatePath('/products')
  return { success: true }
}

/**
 * Toggle product active status
 */
export async function toggleProductActive(
  productId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  const result = await updateProduct(productId, { is_active: isActive })
  return { success: result.product !== null, error: result.error }
}

/**
 * Import products from CSV data
 * Returns count of created and updated products
 */
export async function importProducts(
  rows: ProductCSVRow[]
): Promise<{ created: number; updated: number; errors: string[]; error?: string }> {
  const user = await getUser()
  if (!user) {
    return { created: 0, updated: 0, errors: [], error: 'Not authenticated' }
  }

  const orgId = await getOrganizationId()
  if (!orgId) {
    return { created: 0, updated: 0, errors: [], error: 'No organization found' }
  }

  const supabase = await createClient()
  const errors: string[] = []
  let created = 0
  let updated = 0

  // Get existing products to check for updates vs inserts
  const { data: existingProducts } = await supabase
    .from('products')
    .select('id, sku')
    .eq('organization_id', orgId)

  const existingSkuMap = new Map(
    (existingProducts || []).map(p => [p.sku.toLowerCase(), p.id])
  )

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2 // +2 for 1-indexed and header row

    // Validate row
    if (!row.sku || !row.name) {
      errors.push(`Row ${rowNum}: SKU and Name are required`)
      continue
    }

    const unitPrice = typeof row.unit_price === 'string'
      ? parseFloat(row.unit_price.replace(/[$,]/g, ''))
      : row.unit_price

    if (isNaN(unitPrice) || unitPrice < 0) {
      errors.push(`Row ${rowNum}: Invalid unit price "${row.unit_price}"`)
      continue
    }

    const sku = row.sku.trim()
    const name = row.name.trim()
    const existingId = existingSkuMap.get(sku.toLowerCase())

    if (existingId) {
      // Update existing product
      const { error } = await supabase
        .from('products')
        .update({ name, unit_price: unitPrice })
        .eq('id', existingId)

      if (error) {
        errors.push(`Row ${rowNum}: Failed to update "${sku}"`)
      } else {
        updated++
      }
    } else {
      // Create new product
      const { error } = await supabase
        .from('products')
        .insert({
          organization_id: orgId,
          sku,
          name,
          unit_price: unitPrice,
          is_active: true,
        })

      if (error) {
        errors.push(`Row ${rowNum}: Failed to create "${sku}"`)
      } else {
        created++
      }
    }
  }

  revalidatePath('/products')
  return { created, updated, errors }
}

/**
 * Search products by SKU or name
 */
export async function searchProducts(
  query: string,
  limit: number = 10
): Promise<{ products: Product[]; error?: string }> {
  const orgId = await getOrganizationId()

  if (!orgId) {
    return { products: [], error: 'No organization found' }
  }

  const supabase = await createClient()
  const searchTerm = query.trim().toLowerCase()

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .or(`sku.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%`)
    .order('sku', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('Failed to search products:', error)
    return { products: [], error: 'Failed to search products' }
  }

  return { products: data || [] }
}
