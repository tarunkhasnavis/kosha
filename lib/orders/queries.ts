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
 * Find existing order by thread_id (for handling reply emails)
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

  // Get the most recent email for this order that has clarification info
  const { data, error } = await supabase
    .from('order_emails')
    .select('gmail_thread_id, email_subject, changes_made, organization_id')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) {
    console.error('Failed to get order clarification info:', error)
    return null
  }

  const changesMade = data.changes_made as any
  const clarificationMessage = changesMade?.clarification_message

  if (!clarificationMessage) {
    return null
  }

  return {
    threadId: data.gmail_thread_id,
    subject: data.email_subject,
    clarificationMessage,
    organizationId: data.organization_id,
  }
}

/**
 * Update the clarification_message in the most recent email for an order
 * Called after AI regenerates a new clarification message based on edits
 */
export async function updateClarificationMessage(orderId: string, newMessage: string): Promise<void> {
  const supabase = await createClient()

  // Get the most recent email for this order
  const { data: emailRecord, error: fetchError } = await supabase
    .from('order_emails')
    .select('id, changes_made')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (fetchError || !emailRecord) {
    console.error('Failed to find email record to update clarification:', fetchError)
    return
  }

  // Update the changes_made with new clarification_message
  const changesMade = (emailRecord.changes_made as Record<string, unknown>) || {}
  const updatedChanges = {
    ...changesMade,
    clarification_message: newMessage,
  }

  const { error: updateError } = await supabase
    .from('order_emails')
    .update({ changes_made: updatedChanges })
    .eq('id', emailRecord.id)

  if (updateError) {
    console.error('Failed to update clarification message:', updateError)
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
 * Clear the clarification_message from the most recent email for an order
 * Called after successfully sending the clarification email
 */
export async function clearClarificationMessage(orderId: string): Promise<void> {
  const supabase = await createClient()

  // Get the most recent email for this order
  const { data: emailRecord, error: fetchError } = await supabase
    .from('order_emails')
    .select('id, changes_made')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (fetchError || !emailRecord) {
    console.error('Failed to find email record to clear clarification:', fetchError)
    return
  }

  // Update the changes_made to remove clarification_message
  const changesMade = emailRecord.changes_made as Record<string, unknown> | null
  if (changesMade && 'clarification_message' in changesMade) {
    const { clarification_message, ...restOfChanges } = changesMade

    const { error: updateError } = await supabase
      .from('order_emails')
      .update({ changes_made: restOfChanges })
      .eq('id', emailRecord.id)

    if (updateError) {
      console.error('Failed to clear clarification message:', updateError)
    }
  }
}
