'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import type { OrderStatus } from '@/types/orders'

// ============================================
// USER-FACING SERVER ACTIONS (UI interactions)
// ============================================

export async function approveOrder(orderId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('orders')
    .update({ status: 'approved' })
    .eq('id', orderId)

  if (error) throw error

  revalidatePath('/orders')
  return { success: true }
}

export async function rejectOrder(orderId: string, reason?: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('orders')
    .delete()
    .eq('id', orderId)

  if (error) throw error

  revalidatePath('/orders')
  return { success: true }
}

export async function requestOrderInfo(orderId: string, recipientEmail: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('orders')
    .update({ status: 'info_requested' })
    .eq('id', orderId)

  if (error) throw error

  revalidatePath('/orders')
  return { success: true }
}

// ============================================
// ATOMIC DB OPERATIONS (for internal use)
// ============================================

/**
 * Input type for creating an order
 */
export interface CreateOrderInput {
  order_number: string
  company_name?: string  // Optional - can be missing for incomplete orders awaiting clarification
  source: 'email' | 'text' | 'voicemail' | 'spreadsheet' | 'pdf'
  status: OrderStatus
  order_value: number
  item_count: number
  received_date: string
  expected_delivery_date?: string
  notes?: string
  billing_address?: string
  phone?: string
  payment_method?: string
  contact_name?: string
  contact_email?: string
  organization_id: string
  email_from: string
}

/**
 * Create a new order in the database
 * Returns the created order with ID
 */
export async function createOrder(input: CreateOrderInput) {
  const supabase = await createClient()

  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      order_number: input.order_number,
      company_name: input.company_name,
      source: input.source,
      status: input.status,
      order_value: input.order_value,
      item_count: input.item_count,
      received_date: input.received_date,
      expected_delivery_date: input.expected_delivery_date || null,
      notes: input.notes || null,
      billing_address: input.billing_address || null,
      phone: input.phone || null,
      payment_method: input.payment_method || null,
      contact_name: input.contact_name || null,
      contact_email: input.contact_email || null,
      organization_id: input.organization_id,
      email_from: input.email_from,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create order:', error)
    throw new Error(`Failed to create order: ${error.message}`)
  }

  return order
}

/**
 * Update specific fields on an order
 */
export async function updateOrderFields(
  orderId: string,
  fields: {
    order_value?: number
    item_count?: number
    status?: OrderStatus
    expected_delivery_date?: string | null
    notes?: string | null
    billing_address?: string | null
    phone?: string | null
    payment_method?: string | null
    contact_name?: string | null
    contact_email?: string | null
  }
) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('orders')
    .update(fields)
    .eq('id', orderId)

  if (error) {
    console.error('Failed to update order:', error)
    throw new Error(`Failed to update order: ${error.message}`)
  }
}
