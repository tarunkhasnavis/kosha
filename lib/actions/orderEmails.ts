'use server'

import { createClient } from '@/utils/supabase/server'

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
 * Existing order data returned by findOrderByThreadId
 */
export interface ExistingOrderFromThread {
  id: string
  status: string
  company_name: string
  order_number: string
  order_value: number
  expected_delivery_date: string | null
  notes: string | null
  billing_address: string | null
  phone: string | null
  payment_method: string | null
  contact_name: string | null
  contact_email: string | null
}

/**
 * Find existing order by thread_id (for handling reply emails)
 */
export async function findOrderByThreadId(
  threadId: string,
  organizationId: string
): Promise<ExistingOrderFromThread | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('order_emails')
    .select(`
      order_id,
      orders!inner(
        id,
        status,
        company_name,
        order_number,
        order_value,
        expected_delivery_date,
        notes,
        billing_address,
        phone,
        payment_method,
        contact_name,
        contact_email
      )
    `)
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
    company_name: orderData.orders.company_name,
    order_number: orderData.orders.order_number,
    order_value: orderData.orders.order_value,
    expected_delivery_date: orderData.orders.expected_delivery_date,
    notes: orderData.orders.notes,
    billing_address: orderData.orders.billing_address,
    phone: orderData.orders.phone,
    payment_method: orderData.orders.payment_method,
    contact_name: orderData.orders.contact_name,
    contact_email: orderData.orders.contact_email,
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
