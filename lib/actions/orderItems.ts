'use server'

import { createClient } from '@/utils/supabase/server'

/**
 * Input type for creating order items
 */
export interface OrderItemInput {
  name: string
  sku?: string
  quantity: string
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
    unit_price: item.unit_price,
    total: item.total,
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
 * Delete all order items for a given order
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
 * Replace all order items for a given order
 * (Delete old items, insert new ones)
 */
export async function replaceOrderItems(
  orderId: string,
  items: OrderItemInput[],
  organizationId: string
) {
  // Delete old items first
  await deleteOrderItems(orderId)

  // Insert new items
  return await createOrderItems(orderId, items, organizationId)
}

/**
 * Fetch all order items for a given order
 */
export async function fetchOrderItems(orderId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Failed to fetch order items:', error)
    throw new Error(`Failed to fetch order items: ${error.message}`)
  }

  return data || []
}
