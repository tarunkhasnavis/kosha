/**
 * Email Processing Service
 *
 * Uses OpenAI to extract order information from emails.
 * Called by handler.ts
 */

import type { ParsedEmail } from './gmail/client'
import type { ProcessedAttachment } from './attachments'
import { prepareAttachmentsForAI } from './attachments'
import { openai } from '@/lib/openai'
import {
  type OrgRequiredField,
  generateOrgFieldPromptInstructions,
} from '@/lib/orders/field-config'
import { type OrderExample, formatExamplesForPrompt } from '@/lib/ai/embeddings'

/**
 * AI extracted order item
 */
export interface ParsedOrderItem {
  name: string           // REQUIRED - item name
  sku?: string           // OPTIONAL - product SKU if found in email
  quantity: number       // REQUIRED - numeric quantity (e.g., 10, 5, 2.5)
  quantityUnit: string   // REQUIRED - unit of measurement (e.g., "lbs", "cases", "each")
  unitPrice?: number     // OPTIONAL - price per unit
  total?: number         // OPTIONAL - quantity * unitPrice (can be calculated later)
}

/**
 * Product catalog item for AI matching
 */
export interface ProductCatalogItem {
  sku: string
  name: string
  unit_price: number
}

/**
 * Complete AI output structure
 */
export interface ParsedOrderData {
  // Order fields
  companyName?: string             // From email signature/body (can be missing if incomplete order)
  orderNumber?: string             // Customer's PO/order number if found in email
  orderValue: number               // AI extracts from email total or calculates from items
  itemCount: number                // Number of items (we calculate: items.length)
  receivedDate?: string            // OPTIONAL - when order was placed (AI extracts, fallback to email.date)
  expectedDeliveryDate?: string    // OPTIONAL - when customer wants delivery (null/empty = ASAP)
  notes?: string                   // OPTIONAL - any special instructions or notes
  billingAddress?: string          // OPTIONAL - customer's billing/delivery address
  phone?: string                   // OPTIONAL - customer's phone number
  paymentMethod?: string           // OPTIONAL - payment method (e.g., "Credit Card", "Net 30", "COD")
  contactName?: string             // OPTIONAL - person placing the order (extracted from body/signature)
  contactEmail?: string            // OPTIONAL - contact's email if different from sender
  shipVia?: string                 // OPTIONAL - 'Delivery' or 'Customer Pickup' (inferred from context)

  // Org-specific fields (extracted dynamically based on org config)
  orgFields?: Record<string, string | number | null>

  // Order items
  items: ParsedOrderItem[]

  // Completeness check
  isComplete: boolean              // Do ALL items have name + quantity?
  missingInfo: string[]            // e.g., ["Unit price for Chicken", "Quantity for Beef"]

  // Clarification email (if incomplete)
  clarificationEmail?: string      // AI-generated reply asking for missing info

  // Inference tracking - fields where AI made logical leaps vs explicit extraction
  inferredFields?: string[]        // e.g., ["items[0].sku", "items[1].unit_price", "liquor_license"]
}

/**
 * Raw response from OpenAI (before validation)
 */
interface RawAIResponse {
  isOrder: boolean
  companyName?: string
  orderNumber?: string             // Customer's PO/order number if found
  orderValue?: number              // AI extracts or calculates
  receivedDate?: string            // When order was placed (fallback to email date if not found)
  expectedDeliveryDate?: string    // When customer wants delivery (null = ASAP)
  notes?: string                   // Special instructions
  billingAddress?: string          // Customer's address
  phone?: string                   // Customer's phone
  paymentMethod?: string           // Payment method
  contactName?: string             // Person placing the order
  contactEmail?: string            // Contact's email if different from sender
  shipVia?: string                 // 'Delivery' or 'Customer Pickup' (inferred from context)
  orgFields?: Record<string, string | number | null>  // Org-specific fields (dynamic)
  items?: Array<{
    name: string
    sku?: string
    quantity: number
    quantityUnit: string
    unitPrice?: number
    total?: number
  }>
  isComplete?: boolean
  missingInfo?: string[]
  clarificationEmail?: string
  inferredFields?: string[]        // Fields where AI made logical leaps
}

/**
 * Process an email using OpenAI to extract order information.
 * Returns ParsedOrderData if it's an order, or null if not an order.
 *
 * @param email - The current email to process
 * @param threadContext - Optional: Previous emails in the thread for full context
 * @param processedAttachments - Optional: Processed attachments (images, PDFs, Excel)
 * @param orgRequiredFields - Optional: Organization-specific required fields
 * @param orgSystemPrompt - Optional: Organization-specific AI instructions from DB
 * @param productCatalog - Optional: Organization's product catalog for SKU/price matching
 * @param ragExamples - Optional: Similar past orders retrieved via RAG for few-shot learning
 */
export async function processEmailWithAI(
  email: ParsedEmail,
  threadContext?: Array<{
    email_from: string
    email_subject: string
    email_date: string
    email_body: string
  }>,
  processedAttachments?: ProcessedAttachment[],
  orgRequiredFields?: OrgRequiredField[],
  orgSystemPrompt?: string | null,
  productCatalog?: ProductCatalogItem[],
  ragExamples?: OrderExample[]
): Promise<ParsedOrderData | null> {
  // Build email context with thread history if available
  let emailContext = ''

  if (threadContext && threadContext.length > 0) {
    // Include previous emails for context
    emailContext = threadContext.map((prevEmail, index) => `
--- Previous Email ${index + 1} ---
Subject: ${prevEmail.email_subject}
From: ${prevEmail.email_from}
Date: ${prevEmail.email_date}

${prevEmail.email_body}
`).join('\n') + `

--- Current Email (Latest) ---
Subject: ${email.subject}
From: ${email.from}
Date: ${email.date}

Email Body:
${email.body}
`
  } else {
    // Single email, no thread context
    emailContext = `
Subject: ${email.subject}
From: ${email.from}
Date: ${email.date}

Email Body:
${email.body}
`
  }

  emailContext = emailContext.trim()

  // Process attachments if provided
  let attachmentTextContent = ''
  let attachmentImageUrls: string[] = []

  if (processedAttachments && processedAttachments.length > 0) {
    const prepared = prepareAttachmentsForAI(processedAttachments)
    attachmentTextContent = prepared.textContent
    attachmentImageUrls = prepared.imageUrls
    console.log(`Prepared ${attachmentImageUrls.length} images and ${attachmentTextContent ? 'Excel data' : 'no Excel data'} for AI`)
  }

  // If we have Excel data, append it to the email context
  if (attachmentTextContent) {
    emailContext += `\n\n--- ATTACHED FILES DATA ---${attachmentTextContent}`
  }

  try {
    // Build the user message content (text + images for multimodal)
    const userMessageContent: Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } }
    > = [{ type: 'text', text: emailContext }]

    // Add images from attachments (PDFs converted to images, direct image attachments)
    for (const imageUrl of attachmentImageUrls) {
      userMessageContent.push({
        type: 'image_url',
        image_url: { url: imageUrl, detail: 'high' },
      })
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an AI assistant that extracts order information from emails sent by restaurant/food service customers.

CRITICAL - IDENTIFYING THE CUSTOMER:
- You are processing emails received by a food distributor/vendor (the recipient of the email)
- The CUSTOMER is the person/company PLACING THE ORDER, NOT the recipient/vendor
- Email greetings like "Hello, [Name]!" or "Dear [Name]" address the VENDOR - this is NEVER the customer
- Many emails come from automated ordering systems - the vendor name in greetings is YOUR organization

WHERE TO FIND THE CUSTOMER NAME (priority order):
  1. ATTACHMENTS: Look for "Bill To:", "Sold To:", "Ship To:", "Customer:", "Buyer:", or company letterhead - THIS IS PRIMARY
  2. Email subject line: Often contains the customer/store name (e.g., "PO from Acme Foods")
  3. Email sender info if from customer directly (not an automated system)

DO NOT use as customer name:
- Names in greetings ("Hello, [Name]!")
- The vendor's own organization name
- Generic system/gateway names

EMAIL THREADS:
- Previous emails provide context (original order, clarification requests)
- The LATEST email contains the most recent information
- COMBINE all information from the thread to build the complete order
- If a reply provides missing information, add it to the original items

EXTRACTION TASK:
1. Determine if this email contains an order (items with quantities)
2. Extract: company name, contact person, contact email, order/PO number, items (name, SKU, quantity, unit, price, total), order value, received date, expected delivery date, ship via, notes, billing address, phone, payment method
3. Assess completeness: Do ALL items have name + quantity?
4. If incomplete, generate a friendly clarification email

SHIP VIA DETECTION:
- "pickup", "picking up", "will pick up" → "Customer Pickup"
- "delivery", "deliver to", "ship to" → "Delivery"
- If unclear → null

RESPONSE FORMAT (JSON):
{
  "isOrder": true/false,
  "companyName": "Company Name",
  "contactName": "Chef John" or null,
  "contactEmail": "chef@restaurant.com" or null,
  "orderNumber": "PO-12345" or null,
  "orderValue": 150.50,
  "receivedDate": "2024-12-09" or null,
  "expectedDeliveryDate": "2024-12-10" or null,
  "shipVia": "Customer Pickup" or "Delivery" or null,
  "notes": "Leave at back door" or null,
  "billingAddress": "123 Main St, City, State" or null,
  "phone": "555-1234" or null,
  "paymentMethod": "Net 30" or null,
  "orgFields": { "field_name": "value" } or null,
  "items": [{"name": "Product", "sku": "SKU-001" or null, "quantity": 10, "quantityUnit": "lbs", "unitPrice": 5.99 or null, "total": 59.90 or null}],
  "isComplete": true/false,
  "missingInfo": ["Unit price for Product", "Delivery date"],
  "clarificationEmail": "Thanks for your order! Could you please confirm..." or null,
  "inferredFields": ["items[0].sku", "ship_via"] or []
}

RULES:
- Not an order (question, complaint, inquiry) → {"isOrder": false}
- Split quantity and unit: "10 lbs" → quantity: 10, quantityUnit: "lbs"
- No unit specified → quantityUnit: "each"
- MISSING QUANTITIES: Set quantity to 0, quantityUnit to "unknown", add to missingInfo, set isComplete = false
- NEVER assume quantity 1 - this causes order errors
- Parse dates intelligently ("tomorrow", "Monday", etc.)
- isComplete = true only if ALL items have name + quantity > 0
- Generate clarificationEmail only if isComplete = false

ATTACHMENTS:
- Often contain the detailed itemized order list - extract ALL items
- Email body may just say "see attached" with actual items in attachment
- PRIORITIZE attachment data for items over email body
- Use email body for contact info, delivery instructions
- Excel data provided as JSON - extract ALL rows${generateOrgFieldPromptInstructions(orgRequiredFields || [])}${productCatalog && productCatalog.length > 0 ? `

PRODUCT CATALOG - Use this to fill in missing SKU/price:
${productCatalog.map(p => `SKU: ${p.sku} | Name: ${p.name} | Price: $${p.unit_price.toFixed(2)}`).join('\n')}

CATALOG MATCHING RULES:
- If an item name closely matches a catalog product, use the catalog SKU and price
- Catalog matches are HIGH CONFIDENCE - do NOT add to inferredFields
- Only add to inferredFields when making pattern-based guesses without explicit text` : ''}

INFERENCE TRACKING:
Track which fields required logical leaps vs explicit extraction in "inferredFields" array.

ADD to inferredFields when:
- You guess a field from patterns (e.g., 6-digit number → liquor license without label)
- You infer ship_via from context clues without explicit "pickup" or "delivery" text
- You match a product name loosely (not exact match) to fill in SKU

DO NOT add to inferredFields:
- Fields with explicit text labels (e.g., "Liquor License: 123456")
- Exact catalog matches (SKU or name matches exactly)
- Prices filled from catalog (catalog is source of truth)

Format: ["items[0].sku", "items[1].unit_price", "liquor_license", "ship_via"]${orgSystemPrompt ? `\n\n--- ORGANIZATION-SPECIFIC INSTRUCTIONS ---\n${orgSystemPrompt}` : ''}${ragExamples && ragExamples.length > 0 ? formatExamplesForPrompt(ragExamples) : ''}`,
        },
        {
          role: 'user',
          content: userMessageContent,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      console.error('No content in OpenAI response')
      return null
    }

    let parsed: RawAIResponse
    try {
      parsed = JSON.parse(content)
    } catch (err) {
      console.error('Failed to parse OpenAI JSON:', err, content)
      return null
    }

    // If not an order, bail out
    if (!parsed.isOrder) {
      console.log('Email is not an order:', email.subject)
      return null
    }

    // Accept partial orders (even without companyName or items)
    // We'll save them as awaiting_clarification
    const items = (parsed.items as ParsedOrderItem[]) || []

    // If no items at all, this is likely not a real order attempt
    if (items.length === 0) {
      console.log('Order detected but no items found:', email.subject)
      return null
    }

    return {
      companyName: parsed.companyName || undefined, // Can be missing - we'll ask for it
      orderNumber: parsed.orderNumber || undefined,
      orderValue: parsed.orderValue ?? 0,
      itemCount: items.length,
      receivedDate: parsed.receivedDate || undefined,
      expectedDeliveryDate: parsed.expectedDeliveryDate || undefined,
      notes: parsed.notes || undefined,
      billingAddress: parsed.billingAddress || undefined,
      phone: parsed.phone || undefined,
      paymentMethod: parsed.paymentMethod || undefined,
      contactName: parsed.contactName || undefined,
      contactEmail: parsed.contactEmail || undefined,
      shipVia: parsed.shipVia || undefined,
      orgFields: parsed.orgFields || undefined,
      items,
      isComplete: parsed.isComplete ?? false,
      missingInfo: parsed.missingInfo ?? [],
      clarificationEmail: parsed.clarificationEmail || undefined,
      inferredFields: parsed.inferredFields || [],
    }
  } catch (error) {
    console.error('Error processing email with OpenAI:', error)
    throw error
  }
}

/**
 * Result of analyzing order completeness
 */
export interface OrderCompletenessResult {
  isComplete: boolean
  missingInfo: string[]
  clarificationEmail?: string
}

/**
 * Analyze if an order is complete based on its items.
 * Used after user edits to determine if the order can be approved or needs clarification.
 *
 * @param items - The current order items
 * @param companyName - The company name (optional, may be missing)
 * @param originalMissingInfo - Original missing info for context
 * @param orderData - Additional order fields to check (e.g., liquor_license)
 * @param orgRequiredFields - Organization-specific required fields
 * @param orgSystemPrompt - Organization-specific AI instructions from DB
 */
export async function analyzeOrderCompleteness(
  items: Array<{
    name: string
    sku?: string
    quantity: number
    quantity_unit: string
    unit_price: number
    total: number
  }>,
  companyName?: string,
  originalMissingInfo?: string[],
  orderData?: Record<string, unknown>,
  orgRequiredFields?: OrgRequiredField[],
  orgSystemPrompt?: string | null
): Promise<OrderCompletenessResult> {
  try {
    // Build the items summary for the AI
    const itemsSummary = items.map((item, i) =>
      `${i + 1}. ${item.name}${item.sku ? ` (SKU: ${item.sku})` : ''}: ${item.quantity} ${item.quantity_unit} @ $${item.unit_price.toFixed(2)} = $${item.total.toFixed(2)}`
    ).join('\n')

    // Build org-specific fields summary
    const orgFieldsInstructions = generateOrgFieldPromptInstructions(orgRequiredFields || [])

    // Build order data summary for org-specific fields (now stored in custom_fields JSONB)
    let orgFieldsSummary = ''
    if (orgRequiredFields && orgRequiredFields.length > 0 && orderData) {
      const customFields = (orderData.custom_fields as Record<string, unknown>) || {}
      const fieldValues = orgRequiredFields.map(f => {
        const value = customFields[f.field]
        return `${f.label}: ${value || 'Not provided'}`
      }).join('\n')
      orgFieldsSummary = `\nOrganization-specific fields:\n${fieldValues}`
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an AI assistant that validates food service order completeness.

Analyze the order items and determine if all required information is present for processing.

REQUIRED for EVERY item:
- Name (what is being ordered)
- Quantity (numeric amount)
- Quantity unit (lbs, cases, each, etc.)
- Unit price (price per unit - we need this to process the order)

NICE TO HAVE but not required:
- SKU
- Total (can be calculated from quantity × unit price)

An order is COMPLETE if ALL items have name, quantity, quantity unit, AND unit price.
An order is INCOMPLETE if ANY item is missing name, quantity, quantity unit, or unit price.

Also check for:
- Company name (if missing, flag it)
- Obvious errors (e.g., quantity of 0, negative prices)
${orgFieldsInstructions}
Return JSON in this format:
{
  "isComplete": true/false,
  "missingInfo": ["List of what's missing or unclear"],
  "clarificationEmail": "Friendly email asking for missing info (only if incomplete)"
}

The clarificationEmail should:
- Be friendly and professional
- Specifically mention what information is missing
- Ask them to reply with the missing details
- NOT include a greeting with recipient name (we don't know their name)
- Keep it concise (2-3 sentences max)${orgSystemPrompt ? `\n\n--- ORGANIZATION-SPECIFIC INSTRUCTIONS ---\n${orgSystemPrompt}` : ''}`,
        },
        {
          role: 'user',
          content: `Analyze this order for completeness:

Company: ${companyName || 'Unknown (missing)'}
${orgFieldsSummary}
Items:
${itemsSummary}

${originalMissingInfo && originalMissingInfo.length > 0 ? `\nOriginal missing info that we were asking about:\n- ${originalMissingInfo.join('\n- ')}` : ''}

Is this order now complete? What (if anything) is still missing?`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      console.error('No content in OpenAI response for completeness check')
      // Default to complete if AI fails - user can still send manually
      return { isComplete: true, missingInfo: [] }
    }

    const parsed = JSON.parse(content)
    return {
      isComplete: parsed.isComplete ?? true,
      missingInfo: parsed.missingInfo ?? [],
      clarificationEmail: parsed.clarificationEmail || undefined,
    }
  } catch (error) {
    console.error('Error analyzing order completeness:', error)
    // Default to complete if error - user can still send manually
    return { isComplete: true, missingInfo: [] }
  }
}
