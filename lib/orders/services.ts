/**
 * Order Services
 *
 * Business logic and helper operations for orders.
 * Used by actions.ts and email handlers.
 */

import { createClient } from '@/utils/supabase/server'

// ============================================
// ORDER ITEMS
// ============================================

/**
 * Input type for creating/updating order items
 */
export interface OrderItemInput {
  id?: string  // If provided, update existing item; if not, create new
  name: string
  sku?: string
  quantity: number
  quantity_unit: string
  unit_price: number
  total: number
}

/**
 * Create multiple order items for a given order
 */
export async function createOrderItems(
  orderId: string,
  items: OrderItemInput[],
  organizationId: string
) {
  if (items.length === 0) {
    return []
  }

  const supabase = await createClient()

  const orderItems = items.map(item => ({
    order_id: orderId,
    organization_id: organizationId,
    name: item.name,
    sku: item.sku || null,
    quantity: item.quantity,
    quantity_unit: item.quantity_unit,
    unit_price: item.unit_price,
    total: item.total,
    deleted: false,
  }))

  const { data, error } = await supabase
    .from('order_items')
    .insert(orderItems)
    .select()

  if (error) {
    console.error('Failed to create order items:', error)
    throw new Error(`Failed to create order items: ${error.message}`)
  }

  return data
}

/**
 * Hard delete all order items for a given order
 * @deprecated Use softDeleteOrderItems instead for audit trail
 */
export async function deleteOrderItems(orderId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('order_items')
    .delete()
    .eq('order_id', orderId)

  if (error) {
    console.error('Failed to delete order items:', error)
    throw new Error(`Failed to delete order items: ${error.message}`)
  }
}

/**
 * Soft delete order items by marking them as deleted
 */
export async function softDeleteOrderItems(itemIds: string[]) {
  if (itemIds.length === 0) return

  const supabase = await createClient()

  const { error } = await supabase
    .from('order_items')
    .update({ deleted: true })
    .in('id', itemIds)

  if (error) {
    console.error('Failed to soft delete order items:', error)
    throw new Error(`Failed to soft delete order items: ${error.message}`)
  }
}

/**
 * Restore soft-deleted order items
 */
export async function restoreOrderItems(itemIds: string[]) {
  if (itemIds.length === 0) return

  const supabase = await createClient()

  const { error } = await supabase
    .from('order_items')
    .update({ deleted: false })
    .in('id', itemIds)

  if (error) {
    console.error('Failed to restore order items:', error)
    throw new Error(`Failed to restore order items: ${error.message}`)
  }
}

/**
 * Replace order items with smart handling:
 * - Items with existing IDs are updated
 * - Items without IDs are created
 * - Existing items not in the list are soft-deleted
 * - Items in deletedItemIds are soft-deleted
 */
export async function replaceOrderItems(
  orderId: string,
  items: OrderItemInput[],
  organizationId: string,
  deletedItemIds?: string[]
) {
  const supabase = await createClient()

  // Get current non-deleted items for this order
  const { data: existingItems, error: fetchError } = await supabase
    .from('order_items')
    .select('id')
    .eq('order_id', orderId)
    .or('deleted.is.null,deleted.eq.false')

  if (fetchError) {
    console.error('Failed to fetch existing order items:', fetchError)
    throw new Error(`Failed to fetch existing order items: ${fetchError.message}`)
  }

  const existingIds = new Set(existingItems?.map(item => item.id) || [])
  const providedIds = new Set(items.filter(item => item.id).map(item => item.id!))

  // Find items to soft-delete (existing items not in the new list)
  const idsToDelete = [...existingIds].filter(id => !providedIds.has(id))

  // Add explicitly deleted items
  if (deletedItemIds) {
    idsToDelete.push(...deletedItemIds.filter(id => !idsToDelete.includes(id)))
  }

  // Soft delete items that are no longer in the list
  if (idsToDelete.length > 0) {
    await softDeleteOrderItems(idsToDelete)
  }

  // Separate items into updates and inserts
  const itemsToUpdate = items.filter(item => item.id && existingIds.has(item.id))
  const itemsToInsert = items.filter(item => !item.id || !existingIds.has(item.id))

  // Update existing items
  for (const item of itemsToUpdate) {
    const { error } = await supabase
      .from('order_items')
      .update({
        name: item.name,
        sku: item.sku || null,
        quantity: item.quantity,
        quantity_unit: item.quantity_unit,
        unit_price: item.unit_price,
        total: item.total,
        deleted: false,  // Ensure it's not deleted
      })
      .eq('id', item.id!)

    if (error) {
      console.error('Failed to update order item:', error)
      throw new Error(`Failed to update order item: ${error.message}`)
    }
  }

  // Insert new items
  if (itemsToInsert.length > 0) {
    const newItems = itemsToInsert.map(item => ({
      order_id: orderId,
      organization_id: organizationId,
      name: item.name,
      sku: item.sku || null,
      quantity: item.quantity,
      quantity_unit: item.quantity_unit,
      unit_price: item.unit_price,
      total: item.total,
      deleted: false,
    }))

    const { error } = await supabase
      .from('order_items')
      .insert(newItems)

    if (error) {
      console.error('Failed to insert order items:', error)
      throw new Error(`Failed to insert order items: ${error.message}`)
    }
  }

  // Return all active items
  const { data: finalItems, error: finalError } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId)
    .or('deleted.is.null,deleted.eq.false')

  if (finalError) {
    console.error('Failed to fetch final order items:', finalError)
    throw new Error(`Failed to fetch final order items: ${finalError.message}`)
  }

  return finalItems
}
