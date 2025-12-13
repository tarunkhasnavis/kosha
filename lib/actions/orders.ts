'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import type { OrderStatus } from '@/types/orders'
import { getOrderClarificationInfo, clearClarificationMessage } from '@/lib/services/orderEmails'
import { sendGmailReply } from '@/lib/gmail/reply'
import { replaceOrderItems, type OrderItemInput } from '@/lib/services/orderItems'
import { getOrganizationId } from '@/lib/db/organizations'

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

export async function requestOrderInfo(orderId: string) {
  // Get the stored clarification info for this order
  const clarificationInfo = await getOrderClarificationInfo(orderId)

  if (!clarificationInfo) {
    throw new Error('No clarification message found for this order. The order may not have missing information.')
  }

  // Validate that clarification message is not empty
  if (!clarificationInfo.clarificationMessage || clarificationInfo.clarificationMessage.trim() === '') {
    throw new Error('Clarification message is empty. Cannot send blank email.')
  }

  console.log(`📤 Attempting to send clarification email for order ${orderId}`)

  // Send the clarification email
  const result = await sendGmailReply(
    clarificationInfo.threadId,
    clarificationInfo.clarificationMessage,
    `Re: ${clarificationInfo.subject}`,
    clarificationInfo.organizationId
  )

  if (!result.success) {
    throw new Error(`Failed to send clarification email: ${result.error}`)
  }

  // Clear the clarification message so button shows "Request Sent"
  await clearClarificationMessage(orderId)

  console.log(`✅ Sent clarification email for order ${orderId} (messageId: ${result.messageId})`)

  revalidatePath('/orders')
  return { success: true, messageId: result.messageId }
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
  email_url?: string
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
      email_url: input.email_url || null,
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

// ============================================
// UI SAVE OPERATIONS (for order editing modal)
// ============================================

/**
 * Input type for editable items from the UI
 */
export interface EditableItemInput {
  id: string
  name: string
  sku: string
  quantity: number
  quantity_unit: string
  unit_price: string
  total: number
  isNew?: boolean
}

/**
 * Save all changes to an order (items + order fields)
 *
 * For "awaiting_clarification" orders:
 * - After saving, we need to re-evaluate if the order is now complete
 * - This will be handled by a separate AI call (TODO: implement re-evaluation)
 * - For now, we just save the changes and keep the status as-is
 *
 * @param orderId - The order to update
 * @param items - The edited items
 * @param orderFields - The edited order-level fields
 */
export async function saveOrderChanges(
  orderId: string,
  items: EditableItemInput[],
  orderFields: {
    notes?: string
    expected_delivery_date?: string
  }
) {
  const organizationId = await getOrganizationId()
  if (!organizationId) {
    throw new Error('No organization found')
  }

  // Calculate new totals from items
  const orderValue = items.reduce((sum, item) => sum + item.total, 0)
  const itemCount = items.length

  // Update order fields (but not status - that's handled separately)
  await updateOrderFields(orderId, {
    order_value: orderValue,
    item_count: itemCount,
    notes: orderFields.notes || null,
    expected_delivery_date: orderFields.expected_delivery_date || null,
  })

  // Convert editable items to order item inputs
  const orderItemInputs: OrderItemInput[] = items.map(item => ({
    name: item.name,
    sku: item.sku || undefined,
    quantity: item.quantity,
    quantity_unit: item.quantity_unit,
    unit_price: parseFloat(item.unit_price) || 0,
    total: item.total,
  }))

  // Replace all items with the edited ones
  await replaceOrderItems(orderId, orderItemInputs, organizationId)

  // TODO: For "awaiting_clarification" orders, re-evaluate completeness with AI
  // and update status + clarification_message accordingly

  revalidatePath('/orders')
  return { success: true }
}

/**
 * Save changes and approve the order
 */
export async function saveAndApproveOrder(
  orderId: string,
  items: EditableItemInput[],
  orderFields: {
    notes?: string
    expected_delivery_date?: string
  }
) {
  const organizationId = await getOrganizationId()
  if (!organizationId) {
    throw new Error('No organization found')
  }

  // Calculate new totals from items
  const orderValue = items.reduce((sum, item) => sum + item.total, 0)
  const itemCount = items.length

  const supabase = await createClient()

  // Update order fields AND status in one call
  const { error } = await supabase
    .from('orders')
    .update({
      order_value: orderValue,
      item_count: itemCount,
      notes: orderFields.notes || null,
      expected_delivery_date: orderFields.expected_delivery_date || null,
      status: 'approved',
    })
    .eq('id', orderId)

  if (error) {
    throw new Error(`Failed to save and approve order: ${error.message}`)
  }

  // Convert editable items to order item inputs
  const orderItemInputs: OrderItemInput[] = items.map(item => ({
    name: item.name,
    sku: item.sku || undefined,
    quantity: item.quantity,
    quantity_unit: item.quantity_unit,
    unit_price: parseFloat(item.unit_price) || 0,
    total: item.total,
  }))

  // Replace all items with the edited ones
  await replaceOrderItems(orderId, orderItemInputs, organizationId)

  revalidatePath('/orders')
  return { success: true }
}
