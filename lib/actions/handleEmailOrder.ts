'use server'

import type { ParsedEmail } from '@/lib/gmail/client'
import type { ParsedOrderData, ExistingOrderData } from './processEmail'
import { processEmailWithAI } from './processEmail'
import { createOrder, updateOrderFields, type CreateOrderInput } from './orders'
import { replaceOrderItems, fetchOrderItems, type OrderItemInput } from './orderItems'
import { saveEmailAuditLog, checkEmailAlreadyProcessed, findOrderByThreadId, fetchThreadEmails } from './orderEmails'
import { sendGmailReply } from '@/lib/gmail/reply'

/**
 * Generate a unique order number (fallback if email doesn't have one)
 */
function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `ORD-${timestamp}-${random}`
}

/**
 * Create a new order from email data
 */
async function createNewOrder(
  email: ParsedEmail,
  aiResult: ParsedOrderData,
  organizationId: string
): Promise<{ success: boolean; orderId: string }> {
  // Determine order status based on completeness
  const status = aiResult.isComplete ? 'waiting_review' : 'awaiting_clarification'

  // Use AI-provided order number or generate one
  const orderNumber = aiResult.orderNumber || generateOrderNumber()

  // Use AI-extracted received date or fallback to email date
  const receivedDate = aiResult.receivedDate || email.date

  // Gmail web uses a different ID format than the API, so we link to a search that opens the email directly
  // Using "in:anywhere" ensures it finds the email even if archived/in other folders
  const searchQuery = `in:anywhere rfc822msgid:${email.messageId}`
  const emailUrl = `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(searchQuery)}`

  // Build order input
  const orderInput: CreateOrderInput = {
    order_number: orderNumber,
    company_name: aiResult.companyName,
    source: 'email',
    status,
    order_value: aiResult.orderValue,
    item_count: aiResult.itemCount,
    received_date: receivedDate,
    expected_delivery_date: aiResult.expectedDeliveryDate,
    notes: aiResult.notes,
    billing_address: aiResult.billingAddress,
    phone: aiResult.phone,
    payment_method: aiResult.paymentMethod,
    contact_name: aiResult.contactName,
    contact_email: aiResult.contactEmail,
    organization_id: organizationId,
    email_from: email.from,
    email_url: emailUrl,
  }

  try {
    // 1. Create the order
    const order = await createOrder(orderInput)

    // 2. Create order items
    if (aiResult.items.length > 0) {
      const itemInputs: OrderItemInput[] = aiResult.items.map(item => ({
        name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        unit_price: item.unitPrice || 0,
        total: item.total || 0,
      }))

      await replaceOrderItems(order.id, itemInputs, organizationId)
    }

    // 3. Save email to audit log
    await saveEmailAuditLog({
      order_id: order.id,
      organization_id: organizationId,
      gmail_message_id: email.id,
      gmail_thread_id: email.threadId,
      email_from: email.from,
      email_subject: email.subject,
      email_to: email.to,
      email_date: email.date,
      email_body: email.body,
      changes_made: {
        type: aiResult.isComplete ? 'created_order' : 'awaiting_clarification',
        items_added: aiResult.items,
        missing_info: aiResult.missingInfo,
        order_value: aiResult.orderValue,
      },
    })

    // 4. Send clarification email if order is incomplete
    if (!aiResult.isComplete && aiResult.clarificationEmail) {
      try {
        const result = await sendGmailReply(
          email.threadId,
          aiResult.clarificationEmail,
          `Re: ${email.subject}`,
          organizationId
        )
        if (result.success) {
          console.log(`✅ Sent clarification email for order ${order.id} (messageId: ${result.messageId})`)
        } else {
          console.error(`❌ Failed to send clarification email for order ${order.id}:`, result.error)
        }
      } catch (error) {
        console.error('Failed to send clarification email:', error)
        // Don't fail the order creation if email sending fails
      }
    }

    return { success: true, orderId: order.id }
  } catch (error) {
    console.error('Error creating order:', error)
    throw error
  }
}

/**
 * Update an existing order with new information from a reply email
 */
async function updateExistingOrder(
  existingOrderId: string,
  email: ParsedEmail,
  aiResult: ParsedOrderData,
  organizationId: string
): Promise<{ success: boolean; orderId: string }> {
  // Determine new status based on completeness
  const newStatus = aiResult.isComplete ? 'waiting_review' : 'awaiting_clarification'

  try {
    // 1. Update order fields
    await updateOrderFields(existingOrderId, {
      order_value: aiResult.orderValue,
      item_count: aiResult.itemCount,
      status: newStatus,
      expected_delivery_date: aiResult.expectedDeliveryDate || null,
      notes: aiResult.notes || null,
      billing_address: aiResult.billingAddress || null,
      phone: aiResult.phone || null,
      payment_method: aiResult.paymentMethod || null,
      contact_name: aiResult.contactName || null,
      contact_email: aiResult.contactEmail || null,
    })

    // 2. Replace order items
    if (aiResult.items.length > 0) {
      const itemInputs: OrderItemInput[] = aiResult.items.map(item => ({
        name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        unit_price: item.unitPrice || 0,
        total: item.total || 0,
      }))

      await replaceOrderItems(existingOrderId, itemInputs, organizationId)
    }

    // 3. Save email to audit log
    await saveEmailAuditLog({
      order_id: existingOrderId,
      organization_id: organizationId,
      gmail_message_id: email.id,
      gmail_thread_id: email.threadId,
      email_from: email.from,
      email_subject: email.subject,
      email_to: email.to,
      email_date: email.date,
      email_body: email.body,
      changes_made: {
        type: 'updated_order',
        items_updated: aiResult.items,
        missing_info: aiResult.missingInfo,
        order_value: aiResult.orderValue,
        status_changed_to: newStatus,
      },
    })

    // 4. Send clarification email if order is still incomplete
    if (!aiResult.isComplete && aiResult.clarificationEmail) {
      try {
        await sendGmailReply(
          email.threadId,
          aiResult.clarificationEmail,
          `Re: ${email.subject}`,
          organizationId
        )
        console.log(`Sent clarification email for updated order ${existingOrderId}`)
      } catch (error) {
        console.error('Failed to send clarification email:', error)
        // Don't fail the order update if email sending fails
      }
    }

    return { success: true, orderId: existingOrderId }
  } catch (error) {
    console.error('Error updating order:', error)
    throw error
  }
}

/**
 * Main handler: Process email and create/update order in database
 *
 * This is a high-level orchestrator that:
 * 1. Checks for idempotency (already processed) - BEFORE AI processing to save costs
 * 2. Runs AI extraction only for new emails
 * 3. Checks if email is a reply to existing order
 * 4. Creates new order OR updates existing order
 * 5. Uses atomic DB operations from orders.ts, orderItems.ts, orderEmails.ts
 */
export async function handleEmailOrder(
  email: ParsedEmail,
  organizationId: string
): Promise<{ success: boolean; orderId: string; action: string }> {
  // Step 1: Check if email already processed (idempotency) - BEFORE AI call
  const { processed, orderId: existingOrderId } = await checkEmailAlreadyProcessed(email.id)

  if (processed && existingOrderId) {
    console.log('Email already processed:', email.id)
    return { success: true, orderId: existingOrderId, action: 'already_processed' }
  }

  // Step 2: Check if this is a reply to an existing order (thread_id match)
  const existingOrder = await findOrderByThreadId(email.threadId, organizationId)

  let aiResult: ParsedOrderData | null

  if (existingOrder) {
    // This is a reply to an existing order - fetch thread context and existing items
    const [threadEmails, existingItems] = await Promise.all([
      fetchThreadEmails(email.threadId, organizationId),
      fetchOrderItems(existingOrder.id)
    ])

    // Build existing order data for AI context
    const existingOrderData: ExistingOrderData = {
      companyName: existingOrder.company_name,
      orderNumber: existingOrder.order_number,
      orderValue: existingOrder.order_value,
      expectedDeliveryDate: existingOrder.expected_delivery_date,
      notes: existingOrder.notes,
      billingAddress: existingOrder.billing_address,
      phone: existingOrder.phone,
      paymentMethod: existingOrder.payment_method,
      contactName: existingOrder.contact_name,
      contactEmail: existingOrder.contact_email,
      items: existingItems.map(item => ({
        name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.total
      }))
    }

    // Process email with full thread context AND existing order data
    aiResult = await processEmailWithAI(email, threadEmails, existingOrderData)

    if (!aiResult) {
      // If AI can't extract order from thread, log and skip
      console.error('AI could not extract order from thread:', email.threadId)
      return { success: false, orderId: existingOrder.id, action: 'extraction_failed' }
    }

    // UPDATE existing order with full context
    const result = await updateExistingOrder(existingOrder.id, email, aiResult, organizationId)
    return { ...result, action: 'updated_order' }
  } else {
    // New email - process with AI (no thread context)
    aiResult = await processEmailWithAI(email)

    if (!aiResult) {
      // Not an order email, skip
      console.log('Email is not an order:', email.subject)
      return { success: false, orderId: '', action: 'not_an_order' }
    }

    // CREATE new order
    const result = await createNewOrder(email, aiResult, organizationId)
    return { ...result, action: 'created_order' }
  }
}
