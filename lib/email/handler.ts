/**
 * Email Order Handler Service
 *
 * Orchestrates the email-to-order flow:
 * 1. Checks idempotency
 * 2. Processes attachments
 * 3. Runs AI extraction
 * 4. Creates/updates orders in database
 *
 * Called by API webhook routes.
 */

import type { ParsedEmail } from './gmail/client'
import type { ParsedOrderData, ProductCatalogItem } from './parser'
import type { ProcessedAttachment } from './attachments'
import { processEmailWithAI } from './parser'
import { processAllAttachments, isSupportedAttachment } from './attachments'
import { createOrder, updateOrderFields, type CreateOrderInput } from '@/lib/orders/actions'
import { createOrderItems, replaceOrderItems, type OrderItemInput } from '@/lib/orders/services'
import { saveEmailAuditLog, checkEmailAlreadyProcessed, findOrderByThreadId, fetchThreadEmails, getCustomerOrderHistory, formatCustomerHistoryForPrompt, type CustomerOrderHistory } from '@/lib/orders/queries'
import { getOrgRequiredFields, validateOrgRequiredFields, type OrgRequiredField } from '@/lib/orders/field-config'
import { createClient } from '@/utils/supabase/server'
import { retrieveSimilarExamples, type OrderExample } from '@/lib/ai/embeddings'

/**
 * Generate a unique order number (fallback if email doesn't have one)
 */
function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `ORD-${timestamp}-${random}`
}

/**
 * Fetch organization's required fields config, system prompt, and product catalog
 */
interface OrgConfig {
  requiredFields: OrgRequiredField[]
  systemPrompt: string | null
  productCatalog: ProductCatalogItem[]
}

// Max products to include in AI prompt (to avoid token limit issues)
const MAX_CATALOG_SIZE = 300

async function fetchOrgConfig(organizationId: string): Promise<OrgConfig> {
  const supabase = await createClient()

  // Fetch org settings and products in parallel
  const [orgResult, productsResult] = await Promise.all([
    supabase
      .from('organizations')
      .select('required_order_fields, system_prompt')
      .eq('id', organizationId)
      .single(),
    supabase
      .from('products')
      .select('sku, name, unit_price')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('sku', { ascending: true })
  ])

  const allProducts = (productsResult.data || []) as ProductCatalogItem[]

  // If catalog is too large, don't pass it to AI (user will manually assign SKUs)
  const productCatalog = allProducts.length <= MAX_CATALOG_SIZE ? allProducts : []

  if (allProducts.length > MAX_CATALOG_SIZE) {
    console.log(`⚠️ Product catalog too large (${allProducts.length} products), skipping AI catalog matching`)
  }

  return {
    requiredFields: getOrgRequiredFields(orgResult.data?.required_order_fields),
    systemPrompt: orgResult.data?.system_prompt || null,
    productCatalog,
  }
}

/**
 * Create a new order from email data
 */
async function createNewOrder(
  email: ParsedEmail,
  aiResult: ParsedOrderData,
  organizationId: string,
  orgRequiredFields: OrgRequiredField[]
): Promise<{ success: boolean; orderId: string }> {
  // Validate org-specific required fields - this is the source of truth, NOT the AI
  const orgFieldsValidation = validateOrgRequiredFields(
    aiResult.orgFields || {},
    orgRequiredFields
  )

  // Order is only complete if AI says complete AND all required org fields are present
  const isActuallyComplete = aiResult.isComplete && orgFieldsValidation.isComplete

  // Determine order status based on ACTUAL completeness
  const status = isActuallyComplete ? 'waiting_review' : 'awaiting_clarification'

  // Merge missing info from AI and org field validation
  const allMissingInfo = [
    ...aiResult.missingInfo,
    ...orgFieldsValidation.missingFields.map(f => `Missing ${f}`),
  ]

  // Use AI-provided order number or generate one
  const orderNumber = aiResult.orderNumber || generateOrderNumber()

  // Use AI-extracted received date or fallback to email date
  const receivedDate = aiResult.receivedDate || email.date

  // Use AI-extracted expected date or fallback to received date (ASAP = same day)
  const expectedDate = aiResult.expectedDate || receivedDate

  // Gmail web uses a different ID format than the API, so we link to a search that opens the email directly
  // Using "in:anywhere" ensures it finds the email even if archived/in other folders
  const searchQuery = `in:anywhere rfc822msgid:${email.messageId}`
  const emailUrl = `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(searchQuery)}`

  // Build order input with org-specific fields in custom_fields JSONB
  const orderInput: CreateOrderInput = {
    order_number: orderNumber,
    company_name: aiResult.companyName,
    source: 'email',
    status,
    order_value: aiResult.orderValue,
    item_count: aiResult.itemCount,
    received_date: receivedDate,
    expected_date: expectedDate,
    notes: aiResult.notes,
    billing_address: aiResult.billingAddress,
    phone: aiResult.phone,
    payment_method: aiResult.paymentMethod,
    contact_name: aiResult.contactName,
    contact_email: aiResult.contactEmail,
    ship_via: aiResult.shipVia,
    organization_id: organizationId,
    email_from: email.from,
    email_url: emailUrl,
    // Store org-specific fields in custom_fields JSONB column
    custom_fields: aiResult.orgFields || {},
    // Store fields where AI made logical leaps for UI highlighting
    inferred_fields: aiResult.inferredFields || [],
  }

  try {
    // 1. Create the order
    const order = await createOrder(orderInput)

    // 2. Save email to audit log IMMEDIATELY after order creation
    //    This is critical for idempotency - if this fails, we'll have an orphan order
    //    but at least we won't create duplicates on retry
    try {
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
          type: isActuallyComplete ? 'created_order' : 'awaiting_clarification',
          items_added: aiResult.items,
          missing_info: allMissingInfo,
          order_value: aiResult.orderValue,
          clarification_message: aiResult.clarificationEmail,
        },
      })
    } catch (emailLogError) {
      // If email log fails with duplicate key, the email was already processed
      // This shouldn't happen often since we check first, but handles race conditions
      console.error('Email audit log failed (possible duplicate):', emailLogError)
      // Don't throw - the order was created successfully
    }

    // 3. Create order items
    if (aiResult.items.length > 0) {
      const itemInputs: OrderItemInput[] = aiResult.items.map(item => ({
        name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        quantity_unit: item.quantityUnit,
        unit_price: item.unitPrice || 0,
        total: item.total || 0,
      }))

      await createOrderItems(order.id, itemInputs, organizationId)
    }

    // NOTE: Clarification emails are now sent manually via the "Request Info" button
    // The clarification_message is stored in order_emails.changes_made for later use

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
  organizationId: string,
  orgRequiredFields: OrgRequiredField[]
): Promise<{ success: boolean; orderId: string }> {
  // Validate org-specific required fields - this is the source of truth, NOT the AI
  const orgFieldsValidation = validateOrgRequiredFields(
    aiResult.orgFields || {},
    orgRequiredFields
  )

  // Order is only complete if AI says complete AND all required org fields are present
  const isActuallyComplete = aiResult.isComplete && orgFieldsValidation.isComplete

  // Determine new status based on ACTUAL completeness
  const newStatus = isActuallyComplete ? 'waiting_review' : 'awaiting_clarification'

  // Merge missing info from AI and org field validation
  const allMissingInfo = [
    ...aiResult.missingInfo,
    ...orgFieldsValidation.missingFields.map(f => `Missing ${f}`),
  ]

  // Use AI-extracted expected date or fallback to email date (ASAP = same day)
  const expectedDate = aiResult.expectedDate || email.date

  try {
    // 1. Update order fields (including org-specific fields in custom_fields)
    await updateOrderFields(existingOrderId, {
      order_value: aiResult.orderValue,
      item_count: aiResult.itemCount,
      status: newStatus,
      expected_date: expectedDate,
      notes: aiResult.notes || null,
      billing_address: aiResult.billingAddress || null,
      phone: aiResult.phone || null,
      payment_method: aiResult.paymentMethod || null,
      contact_name: aiResult.contactName || null,
      contact_email: aiResult.contactEmail || null,
      ship_via: aiResult.shipVia || null,
      custom_fields: aiResult.orgFields || {},
      inferred_fields: aiResult.inferredFields || [],
    })

    // 2. Save email to audit log IMMEDIATELY after order update
    //    This is critical for idempotency
    try {
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
          missing_info: allMissingInfo,
          order_value: aiResult.orderValue,
          status_changed_to: newStatus,
          clarification_message: aiResult.clarificationEmail,
        },
      })
    } catch (emailLogError) {
      // If email log fails with duplicate key, the email was already processed
      console.error('Email audit log failed (possible duplicate):', emailLogError)
      // Don't throw - the order was updated successfully
    }

    // 3. Replace order items
    if (aiResult.items.length > 0) {
      const itemInputs: OrderItemInput[] = aiResult.items.map(item => ({
        name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        quantity_unit: item.quantityUnit,
        unit_price: item.unitPrice || 0,
        total: item.total || 0,
      }))

      await replaceOrderItems(existingOrderId, itemInputs, organizationId)
    }

    // NOTE: Clarification emails are now sent manually via the "Request Info" button
    // The clarification_message is stored in order_emails.changes_made for later use

    return { success: true, orderId: existingOrderId }
  } catch (error) {
    console.error('Error updating order:', error)
    throw error
  }
}

/**
 * Process attachments from an email (attachment data should already be populated)
 *
 * @param email - Parsed email with attachment data already fetched
 * @returns Processed attachments ready for AI
 */
async function processAttachmentsForAI(
  email: ParsedEmail
): Promise<ProcessedAttachment[]> {
  // Check if there are any supported attachments with data
  const supportedAttachments = email.attachments.filter(
    (att) => isSupportedAttachment(att) && att.data
  )

  if (supportedAttachments.length === 0) {
    return []
  }

  console.log(`📎 Processing ${supportedAttachments.length} supported attachments`)

  // Process attachments (convert PDFs to images, parse Excel, etc.)
  const processed = await processAllAttachments(supportedAttachments)

  console.log(`✅ Processed ${processed.length} attachments for AI`)
  return processed
}

/**
 * Main handler: Process email and create/update order in database
 *
 * This is a high-level orchestrator that:
 * 1. Checks for idempotency (already processed) - BEFORE AI processing to save costs
 * 2. Processes attachments for AI (PDFs, Excel, images)
 * 3. Runs AI extraction on email body + attachments
 * 4. Checks if email is a reply to existing order
 * 5. Creates new order OR updates existing order
 * 6. Uses atomic DB operations from orders.ts, orderItems.ts, orderEmails.ts
 *
 * @param email - Parsed email to process (use GmailClient.getEmail() to include attachment data)
 * @param organizationId - Organization ID
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

  // Step 2: Fetch organization's config (required fields + system prompt + product catalog)
  const orgConfig = await fetchOrgConfig(organizationId)
  const { requiredFields: orgRequiredFields, systemPrompt: orgSystemPrompt, productCatalog } = orgConfig

  // Step 3: Process attachments if present (attachment data should already be in email)
  let processedAttachments: ProcessedAttachment[] = []

  if (email.attachments.length > 0) {
    try {
      processedAttachments = await processAttachmentsForAI(email)
    } catch (error) {
      console.error('Error processing attachments:', error)
      // Continue without attachments - don't fail the entire order
    }
  }

  // Step 4: Check if this is a reply to an existing order (thread_id match)
  const existingOrder = await findOrderByThreadId(email.threadId, organizationId)

  // Step 5: Retrieve similar past orders for RAG (few-shot learning)
  // Build raw input text for embedding search
  const rawInputForRAG = `Subject: ${email.subject}\nFrom: ${email.from}\n\n${email.body}`
  let ragExamples: OrderExample[] = []
  try {
    ragExamples = await retrieveSimilarExamples(rawInputForRAG, organizationId)
    if (ragExamples.length > 0) {
      console.log(`📚 Found ${ragExamples.length} similar past orders for RAG`)
    }
  } catch (error) {
    console.error('RAG retrieval failed (continuing without examples):', error)
    ragExamples = []
  }

  // Step 6: Fetch customer order history (last 2 approved orders from this sender)
  let customerHistory: CustomerOrderHistory[] = []
  try {
    customerHistory = await getCustomerOrderHistory(email.from, organizationId, 2)
    if (customerHistory.length > 0) {
      console.log(`📋 Found ${customerHistory.length} previous orders from this customer`)
    }
  } catch (error) {
    console.error('Customer history fetch failed (continuing without history):', error)
    customerHistory = []
  }

  // Format customer history for prompt injection
  const customerHistoryPrompt = formatCustomerHistoryForPrompt(customerHistory)

  let aiResult: ParsedOrderData | null

  if (existingOrder) {
    // This is a reply to an existing order - fetch thread context
    const threadEmails = await fetchThreadEmails(email.threadId, organizationId)

    // Process email with full thread context, attachments, org fields, org prompt, product catalog, RAG examples, and customer history
    aiResult = await processEmailWithAI(email, threadEmails, processedAttachments, orgRequiredFields, orgSystemPrompt, productCatalog, ragExamples, customerHistoryPrompt)

    if (!aiResult) {
      // If AI can't extract order from thread, log and skip
      console.error('AI could not extract order from thread:', email.threadId)
      return { success: false, orderId: existingOrder.id, action: 'extraction_failed' }
    }

    // UPDATE existing order with full context
    const result = await updateExistingOrder(existingOrder.id, email, aiResult, organizationId, orgRequiredFields)
    return { ...result, action: 'updated_order' }
  } else {
    // New email - process with AI (no thread context, but with attachments, org fields, org prompt, product catalog, RAG examples, and customer history)
    aiResult = await processEmailWithAI(email, undefined, processedAttachments, orgRequiredFields, orgSystemPrompt, productCatalog, ragExamples, customerHistoryPrompt)

    if (!aiResult) {
      // Not an order email, skip
      console.log('Email is not an order:', email.subject)
      return { success: false, orderId: '', action: 'not_an_order' }
    }

    // CREATE new order
    const result = await createNewOrder(email, aiResult, organizationId, orgRequiredFields)
    return { ...result, action: 'created_order' }
  }
}
