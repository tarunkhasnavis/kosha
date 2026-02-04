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
import { storeAllAttachments, linkAttachmentsToOrder } from './attachment-storage'
import { createOrder, updateOrderFields, type CreateOrderInput } from '@/lib/orders/actions'
import { createOrderItems, replaceOrderItems, type OrderItemInput } from '@/lib/orders/services'
import { claimEmailForProcessing, updateEmailClaimWithOrder, markEmailAsNotOrder, findOrderByThreadId, threadHasCompletedOrder, fetchThreadEmails, getCustomerOrderHistory, formatCustomerHistoryForPrompt, type CustomerOrderHistory } from '@/lib/orders/queries'
import { getOrgRequiredFields, validateOrgRequiredFields, validateBaseRequiredFields, type OrgRequiredField } from '@/lib/orders/field-config'
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
 * Generate a default clarification message when AI doesn't provide one
 * This ensures "Request Info" button is always available for incomplete orders
 */
function generateDefaultClarificationMessage(
  missingInfo: string[],
  contactName?: string,
  organizationName?: string
): string {
  const greeting = contactName ? `Hi ${contactName}!` : 'Hi there!'
  const signature = organizationName || 'Our Team'

  const missingList = missingInfo.length > 0
    ? missingInfo.map(info => `- ${info}`).join('\n')
    : '- Additional order details'

  return `${greeting}

Thanks for your order! To process it, we need the following information:

${missingList}

Could you please reply with these details?

Thank you,
${signature}`
}

/**
 * Fetch organization's required fields config, system prompt, and product catalog
 */
interface OrgConfig {
  requiredFields: OrgRequiredField[]
  systemPrompt: string | null
  productCatalog: ProductCatalogItem[]
  organizationName: string | null
}

// Max products to include in AI prompt (to avoid token limit issues)
const MAX_CATALOG_SIZE = 300

async function fetchOrgConfig(organizationId: string): Promise<OrgConfig> {
  const supabase = await createClient()

  // Fetch org settings and products in parallel
  const [orgResult, productsResult] = await Promise.all([
    supabase
      .from('organizations')
      .select('name, required_order_fields, system_prompt')
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
    organizationName: orgResult.data?.name || null,
  }
}

/**
 * Create a new order from email data
 * NOTE: claimId is passed in - the email claim was already made before calling this
 */
async function createNewOrder(
  email: ParsedEmail,
  aiResult: ParsedOrderData,
  organizationId: string,
  orgRequiredFields: OrgRequiredField[],
  claimId: string
): Promise<{ success: boolean; orderId: string }> {
  // Validate base required fields (apply to ALL organizations)
  const baseItemsForValidation = aiResult.items.map(item => ({
    name: item.name,
    quantity: item.quantity,
    quantity_unit: item.quantityUnit,
    unit_price: item.unitPrice ?? null,
  }))
  const baseFieldsValidation = validateBaseRequiredFields(
    { company_name: aiResult.companyName },
    baseItemsForValidation
  )

  // Validate org-specific required fields - this is the source of truth, NOT the AI
  const orgFieldsValidation = validateOrgRequiredFields(
    aiResult.orgFields || {},
    orgRequiredFields
  )

  // Order is complete if all required fields are present (don't rely on AI's isComplete flag)
  const isActuallyComplete = baseFieldsValidation.isComplete && orgFieldsValidation.isComplete

  // Determine order status based on ACTUAL completeness
  const status = isActuallyComplete ? 'waiting_review' : 'awaiting_clarification'

  // Merge missing info from AI, base fields, and org field validation
  const allMissingInfo = [
    ...aiResult.missingInfo,
    ...baseFieldsValidation.missingFields,
    ...orgFieldsValidation.missingFields.map(f => `Missing ${f}`),
  ]

  // Use AI-provided order number or generate one
  const orderNumber = aiResult.orderNumber || generateOrderNumber()

  // Always use the full email timestamp for received_date (when the order was actually received)
  // This preserves the time component so dates display correctly across timezones
  const receivedDate = email.date

  // Use AI-extracted expected date (when customer wants the order) or default to tomorrow
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowISO = tomorrow.toISOString().split('T')[0] // YYYY-MM-DD format
  const expectedDate = aiResult.expectedDate || tomorrowISO

  // Gmail web uses a different ID format than the API, so we link to a search that opens the email directly
  // Using "in:anywhere" ensures it finds the email even if archived/in other folders
  const searchQuery = `in:anywhere rfc822msgid:${email.messageId}`
  const emailUrl = `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(searchQuery)}`

  // Determine clarification message for incomplete orders BEFORE creating order
  // Use AI-generated message if available, otherwise generate a default one
  let clarificationMessage: string | null = null
  if (!isActuallyComplete) {
    clarificationMessage = aiResult.clarificationEmail || null
    if (!clarificationMessage) {
      // AI didn't generate a clarification message - create a default one
      // Fetch org name for the signature
      const supabase = await createClient()
      const { data: orgData } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', organizationId)
        .single()

      clarificationMessage = generateDefaultClarificationMessage(
        allMissingInfo,
        aiResult.contactName,
        orgData?.name || undefined
      )
      console.log('⚠️ AI did not generate clarification email, using default message')
    }
  }

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
    // Store clarification message directly on the order (source of truth for UI)
    clarification_message: clarificationMessage,
  }

  try {
    // 1. Create the order (with clarification_message already set)
    const order = await createOrder(orderInput)

    // 2. Update the email claim with the order_id
    //    The claim was already inserted before AI processing, now we link it to the order
    await updateEmailClaimWithOrder(claimId, order.id, {
      type: isActuallyComplete ? 'created_order' : 'awaiting_clarification',
      items_added: aiResult.items,
      missing_info: allMissingInfo,
      order_value: aiResult.orderValue,
      clarification_message: clarificationMessage || undefined,
    })

    // 2b. Link any stored attachments to the order
    await linkAttachmentsToOrder(claimId, order.id)

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
 * NOTE: claimId is passed in - the email claim was already made before calling this
 */
async function updateExistingOrder(
  existingOrderId: string,
  email: ParsedEmail,
  aiResult: ParsedOrderData,
  organizationId: string,
  orgRequiredFields: OrgRequiredField[],
  claimId: string
): Promise<{ success: boolean; orderId: string }> {
  // Validate base required fields (apply to ALL organizations)
  const baseItemsForValidation = aiResult.items.map(item => ({
    name: item.name,
    quantity: item.quantity,
    quantity_unit: item.quantityUnit,
    unit_price: item.unitPrice ?? null,
  }))
  const baseFieldsValidation = validateBaseRequiredFields(
    { company_name: aiResult.companyName },
    baseItemsForValidation
  )

  // Validate org-specific required fields - this is the source of truth, NOT the AI
  const orgFieldsValidation = validateOrgRequiredFields(
    aiResult.orgFields || {},
    orgRequiredFields
  )

  // Order is complete if all required fields are present (don't rely on AI's isComplete flag)
  const isActuallyComplete = baseFieldsValidation.isComplete && orgFieldsValidation.isComplete

  // Determine new status based on ACTUAL completeness
  const newStatus = isActuallyComplete ? 'waiting_review' : 'awaiting_clarification'

  // Merge missing info from AI, base fields, and org field validation
  const allMissingInfo = [
    ...aiResult.missingInfo,
    ...baseFieldsValidation.missingFields,
    ...orgFieldsValidation.missingFields.map(f => `Missing ${f}`),
  ]

  // Use AI-extracted expected date or default to tomorrow
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowISO = tomorrow.toISOString().split('T')[0] // YYYY-MM-DD format
  const expectedDate = aiResult.expectedDate || tomorrowISO

  // Determine clarification message for incomplete orders BEFORE updating order
  // Use AI-generated message if available, otherwise generate a default one
  let clarificationMessage: string | null = null
  if (!isActuallyComplete) {
    clarificationMessage = aiResult.clarificationEmail || null
    if (!clarificationMessage) {
      // AI didn't generate a clarification message - create a default one
      const supabase = await createClient()
      const { data: orgData } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', organizationId)
        .single()

      clarificationMessage = generateDefaultClarificationMessage(
        allMissingInfo,
        aiResult.contactName,
        orgData?.name || undefined
      )
      console.log('⚠️ AI did not generate clarification email for update, using default message')
    }
  }

  try {
    // 1. Update order fields (including clarification_message on the order)
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
      clarification_message: clarificationMessage,
    })

    // 2. Update the email claim with the order_id
    //    The claim was already inserted before AI processing, now we link it to the order
    await updateEmailClaimWithOrder(claimId, existingOrderId, {
      type: 'updated_order',
      items_updated: aiResult.items,
      missing_info: allMissingInfo,
      order_value: aiResult.orderValue,
      status_changed_to: newStatus,
      clarification_message: clarificationMessage || undefined,
    })

    // 2b. Link any stored attachments to the order
    await linkAttachmentsToOrder(claimId, existingOrderId)

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
  // Debug: log each attachment's supported status
  for (const att of email.attachments) {
    const isSupported = isSupportedAttachment(att)
    console.log(`[ATTACH-DEBUG] isSupportedAttachment("${att.filename}", mime="${att.mimeType}"): ${isSupported}, hasData=${!!att.data}`)
  }

  // Check if there are any supported attachments with data
  const supportedAttachments = email.attachments.filter(
    (att) => isSupportedAttachment(att) && att.data
  )

  console.log(`[ATTACH-DEBUG] supportedAttachments after filter: ${supportedAttachments.length}`)

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
 * IDEMPOTENCY: Uses claim-first approach where we INSERT into order_emails
 * BEFORE any processing. If the insert fails (duplicate), we return immediately.
 * This prevents duplicate orders from race conditions or Pub/Sub retries.
 *
 * Flow:
 * 1. CLAIM the email (INSERT ... ON CONFLICT DO NOTHING) - this is the idempotency gate
 * 2. If claim failed → return immediately (already processed)
 * 3. Process attachments for AI (PDFs, Excel, images)
 * 4. Run AI extraction on email body + attachments
 * 5. Check if email is a reply to existing order
 * 6. Create new order OR update existing order
 * 7. Update the claim record with order_id
 *
 * @param email - Parsed email to process (use GmailClient.getEmail() to include attachment data)
 * @param organizationId - Organization ID
 */
export async function handleEmailOrder(
  email: ParsedEmail,
  organizationId: string
): Promise<{ success: boolean; orderId: string; action: string }> {
  // Step 1: CLAIM the email - this is the idempotency gate
  // If the email was already claimed/processed, return immediately
  const claimResult = await claimEmailForProcessing(
    email.id,
    email.threadId,
    organizationId,
    email.from,
    email.subject,
    email.to,
    email.date,
    email.body,
    email.bodyHtml
  )

  if (!claimResult.claimed) {
    // Email was already processed - return immediately
    console.log(`📧 Email already processed: ${email.id}, existing order: ${claimResult.existingOrderId}`)
    return {
      success: true,
      orderId: claimResult.existingOrderId || '',
      action: 'already_processed'
    }
  }

  // We got the claim - proceed with processing
  const claimId = claimResult.claimId!
  console.log(`📧 Claimed email ${email.id} for processing (claim_id: ${claimId})`)

  try {
    // Step 2: Fetch organization's config (required fields + system prompt + product catalog + name)
    const orgConfig = await fetchOrgConfig(organizationId)
    const { requiredFields: orgRequiredFields, systemPrompt: orgSystemPrompt, productCatalog, organizationName } = orgConfig

    // Step 3: Process attachments if present (attachment data should already be in email)
    let processedAttachments: ProcessedAttachment[] = []

    console.log(`[ATTACH-DEBUG] email.attachments.length = ${email.attachments.length}`)
    for (const att of email.attachments) {
      console.log(`[ATTACH-DEBUG] attachment: "${att.filename}" mime=${att.mimeType} size=${att.size} hasData=${!!att.data} dataLen=${att.data?.length ?? 0}`)
    }

    if (email.attachments.length > 0) {
      try {
        processedAttachments = await processAttachmentsForAI(email)
        console.log(`[ATTACH-DEBUG] processedAttachments.length = ${processedAttachments.length}`)
        for (const pa of processedAttachments) {
          console.log(`[ATTACH-DEBUG] processed: "${pa.filename}" type=${pa.type} hasImages=${!!pa.images} imageCount=${pa.images?.length ?? 0} hasPdfText=${!!pa.pdfText} hasExcel=${!!pa.excelData}`)
        }

        // Store attachments in database and Supabase Storage
        if (processedAttachments.length > 0) {
          console.log(`[ATTACH-DEBUG] Calling storeAllAttachments with orderEmailId=${claimId}, orgId=${organizationId}, rawCount=${email.attachments.length}, processedCount=${processedAttachments.length}`)
          const storedResult = await storeAllAttachments({
            orderEmailId: claimId,
            organizationId,
            rawAttachments: email.attachments,
            processedAttachments,
          })
          console.log(`[ATTACH-DEBUG] storeAllAttachments returned ${storedResult.length} stored attachments`)
        } else {
          console.log(`[ATTACH-DEBUG] Skipping storeAllAttachments - no processed attachments`)
        }
      } catch (error) {
        console.error('[ATTACH-DEBUG] Error processing attachments:', error)
        // Continue without attachments - don't fail the entire order
      }
    } else {
      console.log(`[ATTACH-DEBUG] No attachments on email`)
    }

    // Step 4: Check if this is a reply to an existing order (thread_id match)
    const existingOrder = await findOrderByThreadId(email.threadId, organizationId)

    // Step 4b: If no pending order found, check if thread has a completed order
    // Skip processing if this is a reply to an already-approved/archived order thread
    // (prevents duplicates from replies that quote our confirmation emails)
    if (!existingOrder) {
      const hasCompletedOrder = await threadHasCompletedOrder(email.threadId, organizationId)
      if (hasCompletedOrder) {
        console.log(`⏭️ Skipping email - thread already has completed order: ${email.subject}`)
        await markEmailAsNotOrder(claimId)
        return { success: false, orderId: '', action: 'thread_already_completed' }
      }
    }

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

      // Process email with full thread context, attachments, org fields, org prompt, product catalog, RAG examples, customer history, and org name
      aiResult = await processEmailWithAI(email, threadEmails, processedAttachments, orgRequiredFields, orgSystemPrompt, productCatalog, ragExamples, customerHistoryPrompt, organizationName)

      if (!aiResult) {
        // If AI can't extract order from thread, mark claim as failed and skip
        console.error('AI could not extract order from thread:', email.threadId)
        await markEmailAsNotOrder(claimId)
        return { success: false, orderId: existingOrder.id, action: 'extraction_failed' }
      }

      // UPDATE existing order with full context (pass claimId to link the email)
      const result = await updateExistingOrder(existingOrder.id, email, aiResult, organizationId, orgRequiredFields, claimId)
      return { ...result, action: 'updated_order' }
    } else {
      // New email - process with AI (no thread context, but with attachments, org fields, org prompt, product catalog, RAG examples, customer history, and org name)
      aiResult = await processEmailWithAI(email, undefined, processedAttachments, orgRequiredFields, orgSystemPrompt, productCatalog, ragExamples, customerHistoryPrompt, organizationName)

      if (!aiResult) {
        // Not an order email - mark claim as "not an order" so we don't reprocess
        console.log('Email is not an order:', email.subject)
        await markEmailAsNotOrder(claimId)
        return { success: false, orderId: '', action: 'not_an_order' }
      }

      // CREATE new order (pass claimId to link the email)
      const result = await createNewOrder(email, aiResult, organizationId, orgRequiredFields, claimId)
      return { ...result, action: 'created_order' }
    }
  } catch (error) {
    // If processing fails after claim, the claim record stays with order_id=null
    // This is intentional - it prevents retries from creating duplicates
    // Admin can manually clean up orphaned claims if needed
    console.error('Error processing email after claim:', error)
    throw error
  }
}
