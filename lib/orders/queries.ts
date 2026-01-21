/**
 * Order Queries
 *
 * Read-only database operations for orders and order-related data.
 * No mutations - those are in actions.ts
 */

import { createClient } from '@/utils/supabase/server'

// ============================================
// ORDER EMAIL QUERIES
// ============================================

/**
 * Input type for saving email audit log
 */
export interface EmailAuditInput {
  order_id: string
  organization_id: string
  gmail_message_id: string
  gmail_thread_id: string
  email_from: string
  email_subject: string
  email_to: string
  email_date: string
  email_body: string
  changes_made: {
    type: 'created_order' | 'updated_order' | 'awaiting_clarification'
    items_added?: any[]
    items_updated?: any[]
    missing_info?: string[]
    order_value?: number
    status_changed_to?: string
    clarification_message?: string
  }
}

/**
 * Save email to order_emails table (audit trail)
 */
export async function saveEmailAuditLog(input: EmailAuditInput) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('order_emails')
    .insert({
      order_id: input.order_id,
      organization_id: input.organization_id,
      gmail_message_id: input.gmail_message_id,
      gmail_thread_id: input.gmail_thread_id,
      email_from: input.email_from,
      email_subject: input.email_subject,
      email_to: input.email_to,
      email_date: input.email_date,
      email_body: input.email_body,
      changes_made: input.changes_made,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to save email audit log:', error)
    throw new Error(`Failed to save email audit log: ${error.message}`)
  }

  return data
}

/**
 * Check if an email has already been processed (idempotency check)
 *
 * @deprecated Use claimEmailForProcessing() instead for proper idempotency
 */
export async function checkEmailAlreadyProcessed(
  gmailMessageId: string
): Promise<{ processed: boolean; orderId?: string }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('order_emails')
    .select('id, order_id')
    .eq('gmail_message_id', gmailMessageId)
    .single()

  if (error || !data) {
    return { processed: false }
  }

  return { processed: true, orderId: data.order_id }
}

/**
 * Claim an email for processing using INSERT ... ON CONFLICT DO NOTHING
 * This is the idempotency gate - only proceed if we successfully inserted.
 *
 * Returns:
 * - { claimed: true, claimId } - We got the lock, proceed with processing
 * - { claimed: false, existingOrderId } - Already processed, return early
 */
export async function claimEmailForProcessing(
  gmailMessageId: string,
  gmailThreadId: string,
  organizationId: string,
  emailFrom: string,
  emailSubject: string,
  emailTo: string,
  emailDate: string,
  emailBody: string,
  emailBodyHtml?: string
): Promise<{ claimed: boolean; claimId?: string; existingOrderId?: string }> {
  const supabase = await createClient()

  // Try to insert a placeholder record. If it already exists, we'll get nothing back.
  // Using upsert with onConflict to handle the unique constraint on gmail_message_id
  const { data, error } = await supabase
    .from('order_emails')
    .insert({
      organization_id: organizationId,
      gmail_message_id: gmailMessageId,
      gmail_thread_id: gmailThreadId,
      email_from: emailFrom,
      email_subject: emailSubject,
      email_to: emailTo,
      email_date: emailDate,
      email_body: emailBody,
      email_body_html: emailBodyHtml || null,
      // order_id will be null initially - we'll update it after order creation
      order_id: null,
      changes_made: { type: 'processing' }, // Placeholder, will be updated
    })
    .select('id')
    .single()

  if (error) {
    // Check if it's a duplicate key error (23505 is PostgreSQL unique violation)
    if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('already exists')) {
      // Email already claimed - fetch the existing record
      const { data: existing } = await supabase
        .from('order_emails')
        .select('id, order_id')
        .eq('gmail_message_id', gmailMessageId)
        .single()

      console.log(`📧 Email ${gmailMessageId} already processed, order_id: ${existing?.order_id}`)
      return { claimed: false, existingOrderId: existing?.order_id || undefined }
    }

    // Some other error
    console.error('Failed to claim email for processing:', error)
    throw new Error(`Failed to claim email: ${error.message}`)
  }

  console.log(`📧 Claimed email ${gmailMessageId} for processing, claim_id: ${data.id}`)
  return { claimed: true, claimId: data.id }
}

/**
 * Update the email claim record with the order_id after order creation
 */
export async function updateEmailClaimWithOrder(
  claimId: string,
  orderId: string,
  changesMade: {
    type: 'created_order' | 'updated_order' | 'awaiting_clarification'
    items_added?: any[]
    items_updated?: any[]
    missing_info?: string[]
    order_value?: number
    status_changed_to?: string
    clarification_message?: string
  }
): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('order_emails')
    .update({
      order_id: orderId,
      changes_made: changesMade,
    })
    .eq('id', claimId)

  if (error) {
    console.error('Failed to update email claim with order:', error)
    throw new Error(`Failed to update email claim: ${error.message}`)
  }
}

/**
 * Mark an email claim as "not an order" (so we don't reprocess it)
 */
export async function markEmailAsNotOrder(claimId: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('order_emails')
    .update({
      changes_made: { type: 'not_an_order' },
    })
    .eq('id', claimId)

  if (error) {
    console.error('Failed to mark email as not order:', error)
    // Don't throw - this is cleanup, not critical
  }
}

/**
 * Find existing order by thread_id (for handling reply emails)
 * Only returns orders that are still pending (waiting_review or awaiting_clarification)
 */
export async function findOrderByThreadId(
  threadId: string,
  organizationId: string
): Promise<{ id: string; status: string } | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('order_emails')
    .select('order_id, orders!inner(id, status)')
    .eq('gmail_thread_id', threadId)
    .eq('organization_id', organizationId)
    .in('orders.status', ['waiting_review', 'awaiting_clarification'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) {
    return null
  }

  const orderData = data as any
  return {
    id: orderData.orders.id,
    status: orderData.orders.status,
  }
}

/**
 * Check if a thread has any completed orders (approved or archived)
 * Used to skip processing replies to threads where the order is already done
 */
export async function threadHasCompletedOrder(
  threadId: string,
  organizationId: string
): Promise<boolean> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('order_emails')
    .select('order_id, orders!inner(id, status)')
    .eq('gmail_thread_id', threadId)
    .eq('organization_id', organizationId)
    .in('orders.status', ['approved', 'archived'])
    .limit(1)
    .single()

  if (error || !data) {
    return false
  }

  return true
}

/**
 * Fetch all emails from a thread (for providing full context to AI)
 */
export async function fetchThreadEmails(
  threadId: string,
  organizationId: string
): Promise<Array<{
  email_from: string
  email_subject: string
  email_date: string
  email_body: string
}>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('order_emails')
    .select('email_from, email_subject, email_date, email_body')
    .eq('gmail_thread_id', threadId)
    .eq('organization_id', organizationId)
    .order('email_date', { ascending: true }) // Oldest to newest

  if (error || !data) {
    return []
  }

  return data
}

/**
 * Get clarification info for an order (thread_id, subject, clarification message)
 * Used for manually sending clarification emails from UI
 *
 * NOTE: clarification_message is now stored on the orders table as source of truth.
 * Thread info still comes from order_emails for sending replies.
 */
export async function getOrderClarificationInfo(
  orderId: string
): Promise<{
  threadId: string
  subject: string
  clarificationMessage: string
  organizationId: string
} | null> {
  const supabase = await createClient()

  // Get clarification_message from the order (source of truth)
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('clarification_message, organization_id')
    .eq('id', orderId)
    .single()

  if (orderError || !order) {
    console.error('Failed to get order for clarification info:', orderError)
    return null
  }

  // If no clarification message, return null
  if (!order.clarification_message) {
    return null
  }

  // Get thread info from order_emails for sending the reply
  const { data: emailData, error: emailError } = await supabase
    .from('order_emails')
    .select('gmail_thread_id, email_subject')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (emailError || !emailData) {
    console.error('Failed to get email thread info:', emailError)
    return null
  }

  return {
    threadId: emailData.gmail_thread_id,
    subject: emailData.email_subject,
    clarificationMessage: order.clarification_message,
    organizationId: order.organization_id,
  }
}

/**
 * Update the clarification_message on an order
 * Called after AI regenerates a new clarification message based on edits
 *
 * NOTE: clarification_message is now stored on the orders table as source of truth.
 */
export async function updateClarificationMessage(orderId: string, newMessage: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('orders')
    .update({ clarification_message: newMessage })
    .eq('id', orderId)

  if (error) {
    console.error('Failed to update clarification message:', error)
  }
}

/**
 * Get thread info for any order (not just clarification orders)
 * Used for sending approval/rejection emails
 */
export async function getOrderThreadInfo(
  orderId: string
): Promise<{
  threadId: string
  subject: string
  organizationId: string
} | null> {
  const supabase = await createClient()

  // Get the most recent email for this order
  const { data, error } = await supabase
    .from('order_emails')
    .select('gmail_thread_id, email_subject, organization_id')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) {
    console.error('Failed to get order thread info:', error)
    return null
  }

  return {
    threadId: data.gmail_thread_id,
    subject: data.email_subject,
    organizationId: data.organization_id,
  }
}

/**
 * Clear the clarification_message from an order
 * Called after successfully sending the clarification email
 *
 * NOTE: clarification_message is now stored on the orders table as source of truth.
 * Setting to null indicates the clarification has been sent.
 */
export async function clearClarificationMessage(orderId: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('orders')
    .update({ clarification_message: null })
    .eq('id', orderId)

  if (error) {
    console.error('Failed to clear clarification message:', error)
  }
}

// ============================================
// CUSTOMER ORDER HISTORY QUERIES
// ============================================

/**
 * Order item from history
 */
export interface HistoricalOrderItem {
  name: string
  sku: string | null
  quantity: number
  quantity_unit: string
  unit_price: number
}

/**
 * Recent order from customer history
 */
export interface CustomerOrderHistory {
  id: string
  order_number: string
  company_name: string
  order_value: number
  received_date: string
  items: HistoricalOrderItem[]
}

/**
 * Fetch the last N approved orders from a sender's domain
 * Used to provide customer context to AI (e.g., "same as last week")
 *
 * @param senderEmail - Full email address (e.g., "chef@restaurant.com")
 * @param organizationId - Organization to search within
 * @param limit - Max orders to return (default: 2)
 */
export async function getCustomerOrderHistory(
  senderEmail: string,
  organizationId: string,
  limit: number = 2
): Promise<CustomerOrderHistory[]> {
  const supabase = await createClient()

  // Extract domain from email
  const domainMatch = senderEmail.match(/@([^\s>]+)/)
  if (!domainMatch) {
    return []
  }
  const senderDomain = domainMatch[1].toLowerCase()

  // Find approved orders from this sender's domain
  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      company_name,
      order_value,
      received_date,
      order_items (
        name,
        sku,
        quantity,
        quantity_unit,
        unit_price
      )
    `)
    .eq('organization_id', organizationId)
    .eq('status', 'approved')
    .ilike('email_from', `%@${senderDomain}`)
    .order('received_date', { ascending: false })
    .limit(limit)

  if (error || !orders) {
    console.error('Failed to fetch customer order history:', error)
    return []
  }

  return orders.map(order => ({
    id: order.id,
    order_number: order.order_number,
    company_name: order.company_name,
    order_value: order.order_value,
    received_date: order.received_date,
    items: (order.order_items || []).map((item: any) => ({
      name: item.name,
      sku: item.sku,
      quantity: item.quantity,
      quantity_unit: item.quantity_unit,
      unit_price: item.unit_price,
    })),
  }))
}

/**
 * Format customer order history for injection into AI prompt
 * Minimal context - just the data, no instructions
 */
export function formatCustomerHistoryForPrompt(history: CustomerOrderHistory[]): string {
  if (history.length === 0) return ''

  const formatted = history.map((order, i) => {
    const itemsStr = order.items.map(item =>
      `- ${item.quantity} ${item.quantity_unit} ${item.name}${item.sku ? ` (${item.sku})` : ''} @ $${item.unit_price.toFixed(2)}`
    ).join('\n')

    return `Order ${i + 1} (${order.received_date}):
${itemsStr}
Total: $${order.order_value.toFixed(2)}`
  }).join('\n\n')

  return `
--- CUSTOMER ORDER HISTORY ---
This sender's recent approved orders:

${formatted}
--- END HISTORY ---`
}

/**
 * Data needed to save an order as a learning example
 */
export interface OrderLearningData {
  /** Raw input text (email body with context) */
  rawInput: string
  /** Sender domain for filtering */
  senderDomain: string | null
  /** Original AI extraction (from changes_made) */
  originalExtraction: Record<string, unknown> | null
  /** Organization ID */
  organizationId: string
}

/**
 * Fetch the data needed to save an approved order as a learning example
 * Returns the original email body and AI extraction for comparison
 */
export async function getOrderLearningData(orderId: string): Promise<OrderLearningData | null> {
  const supabase = await createClient()

  // Get the first email for this order (the original order email)
  const { data, error } = await supabase
    .from('order_emails')
    .select('email_from, email_subject, email_body, changes_made, organization_id')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (error || !data) {
    console.error('Failed to fetch order learning data:', error)
    return null
  }

  // Build raw input in consistent format
  const rawInput = `Subject: ${data.email_subject}\nFrom: ${data.email_from}\n\n${data.email_body}`

  // Extract sender domain
  const domainMatch = data.email_from.match(/@([^\s>]+)/)
  const senderDomain = domainMatch ? domainMatch[1].toLowerCase() : null

  return {
    rawInput,
    senderDomain,
    originalExtraction: data.changes_made as Record<string, unknown> | null,
    organizationId: data.organization_id,
  }
}
