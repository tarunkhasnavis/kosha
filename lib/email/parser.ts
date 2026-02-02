/**
 * Email Processing Service
 *
 * Uses OpenAI to extract order information from emails.
 * Called by handler.ts
 */

import type { ParsedEmail } from './gmail/client'
import type { ProcessedAttachment } from './attachments'
import { prepareAttachmentsForAI } from './attachments'
import { getOpenAI } from '@/lib/openai'
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
  expectedDate?: string            // OPTIONAL - when customer wants pickup OR delivery (null/empty = ASAP)
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
  expectedDate?: string            // When customer wants pickup OR delivery (null = ASAP)
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
 * @param customerHistoryPrompt - Optional: Formatted customer order history for context
 * @param organizationName - Optional: Organization name for email signature
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
  ragExamples?: OrderExample[],
  customerHistoryPrompt?: string,
  organizationName?: string | null
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

    const openai = getOpenAI()
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You extract order information from emails received by a food distributor.

CUSTOMER IDENTIFICATION:
- The CUSTOMER is placing the order, NOT the email recipient (that's the vendor)
- Greetings like "Hello, [Name]!" address the vendor - NEVER use as customer name
- Find customer in: attachments (Bill To/Ship To/Customer), subject line, or sender info

EXTRACTION:
- Search EVERYWHERE: email body, Note: field, attachments, subject line

NOTES FIELD - VERY IMPORTANT:
- The "notes" output should ONLY contain special instructions, comments, or the "Note:" field from the email
- DO NOT put the entire email body in notes - that's wrong
- Look for explicit "Note:", "Notes:", "Special Instructions:", "Comments:" labels
- Example: If email has "Note: 3400347 – Richard Jacob will be picking this up 12/9 if possible!"
  → notes: "3400347 – Richard Jacob will be picking this up 12/9 if possible!"
- If no explicit notes/comments section exists, leave notes as null

PARSING NOTE CONTENT:
- The Note: field often contains MULTIPLE pieces of info - parse ALL of them:
  - Example: "3400347 – Richard Jacob will be picking this up 12/9 if possible!"
    → orgFields.liquor_license: "3400347" (the number at the start)
    → expectedDate: "2025-12-09" (from "12/9" - this is the pickup/delivery date!)
    → shipVia: "Customer Pickup" (from "picking this up")
    → contactName: "Richard Jacob" (person picking up)
    → notes: "3400347 – Richard Jacob will be picking this up 12/9 if possible!" (preserve original)
  - Numbers at start of notes are often license/account numbers → extract to org fields
  - "pickup/picking up/will pick up" → shipVia: "Customer Pickup"
  - Ship via: "delivery/deliver to/ship to" → "Delivery"

EXPECTED DATE - CRITICAL:
- expectedDate is when the customer WANTS their order (pickup OR delivery date)
- Look for dates in notes like "picking up 12/9" or "deliver by Friday"
- Parse ANY date mentioned for pickup/delivery: "12/9", "tomorrow", "Monday", "next week"
- Use the email's year context (if email is from Dec 2025, "12/9" means 2025-12-09)
- IMPORTANT: The date in the email header (e.g., "December 8, 2025" or "[Order #123] (December 8, 2025)") is the RECEIVED DATE, NOT the expected date!
- If the Note says "picking this up 12/9" and email date is Dec 8, then expectedDate = 12/9 (one day AFTER received date)
- Only leave expectedDate as null if NO pickup/delivery date info exists anywhere in notes or body

THREADS: Combine info from all emails. Latest email has most recent updates.

ATTACHMENTS: Often contain the item list - extract ALL items. Prioritize over email body. Excel data provided as JSON.

ITEMS:
- Split "10 lbs" → quantity: 10, quantityUnit: "lbs"
- No unit specified → quantityUnit: "each"
- If quantity missing but has total price + SKU in catalog: calculate quantity = total ÷ catalog unit_price, add "items[N].quantity" to inferredFields
- If quantity cannot be determined → quantity: 0, quantityUnit: "unknown", add to missingInfo, isComplete = false
- IMPORTANT: "Case of 12" or "Pack of 6" in a product NAME is NOT the quantity - it describes the product packaging
- When quantity is missing/0, set unitPrice to the total (treat as 1 unit) rather than inventing a price${generateOrgFieldPromptInstructions(orgRequiredFields || [])}${productCatalog && productCatalog.length > 0 ? `

PRODUCT CATALOG:
${productCatalog.map(p => `${p.sku} | ${p.name} | $${p.unit_price.toFixed(2)}`).join('\n')}

When matching products:
- Look up items by SKU or name against the catalog above
- Include the SKU in your response when you find a match
- The system will automatically normalize names and prices from the catalog` : ''}

INFERENCE TRACKING (inferredFields array) - UI highlights these in purple:
ADD to inferredFields when you:
- CALCULATE a value (e.g., quantity from price ÷ catalog unit price)
- DERIVE information not explicitly stated (e.g., shipVia from "I'll pick it up")
- GUESS/INFER from patterns without explicit labels (e.g., matching "chicken breast" to SKU-001)
- Make ASSUMPTIONS (e.g., assuming billing address from signature)

DO NOT add when you:
- EXTRACT text exactly as written (e.g., "10 lbs" → quantity: 10, quantityUnit: "lbs")
- FORMAT visible text (e.g., parsing "12/9" into a full date using the email's year)
- COPY exact catalog values for matched products (SKU, unit_price from catalog lookup)
- READ explicit labeled fields (e.g., "PO#: 12345" → orderNumber: "12345")

IMPORTANT: inferredFields and missingInfo are MUTUALLY EXCLUSIVE for any field:
- If you INFER a value → add to inferredFields, NOT to missingInfo (you populated it)
- If you CANNOT determine a value → add to missingInfo, NOT to inferredFields (it's empty/missing)

RESPONSE FORMAT (JSON):
{
  "isOrder": true/false,
  "companyName": "Company Name" or null,
  "contactName": "Chef John" or null,
  "contactEmail": "chef@restaurant.com" or null,
  "orderNumber": "PO-12345" or null,
  "orderValue": 150.50,
  "receivedDate": "YYYY-MM-DD" or null,  // When order was PLACED (email date/header date)
  "expectedDate": "YYYY-MM-DD" or null,  // When customer WANTS pickup/delivery - from notes like "12/9" or "Friday" (NOT the email header date!)
  "shipVia": "Customer Pickup" or "Delivery",  // REQUIRED - infer if not explicit
  "notes": "Only explicit Note:/Comments: content here, NOT the email body" or null,
  "billingAddress": "123 Main St, City, State" or null,
  "phone": "555-1234" or null,
  "paymentMethod": "Net 30" or null,
  "orgFields": {} or null,
  "items": [{"name": "Product", "sku": "SKU-001" or null, "quantity": 10, "quantityUnit": "lbs", "unitPrice": 5.99 or null, "total": 59.90 or null}],
  "isComplete": true/false,
  "missingInfo": ["Quantity for Item X", "Unit price for Y"],
  "clarificationEmail": "Thanks for your order! Could you please confirm..." or null,
  "inferredFields": ["items[0].sku", "ship_via"]
}

RULES:
- Not an order (question, complaint, inquiry) → {"isOrder": false}
- isComplete = true only if ALL items have name + quantity > 0 AND shipVia is filled
- shipVia is REQUIRED: must be "Customer Pickup" or "Delivery". Infer from context if not explicit (e.g., "I'll pick it up" → "Customer Pickup", delivery address mentioned → "Delivery"). If truly cannot determine, add "Delivery method (pickup or delivery)" to missingInfo.
- If isComplete = false, generate clarificationEmail asking for the missing info

CLARIFICATION EMAIL FORMAT (only if isComplete = false):
The clarificationEmail MUST follow this EXACT format:
1. Start with greeting: "Hi [contactName from email or 'there']!"
2. Thank them for their order
3. List ALL missing required information (item details AND org-specific fields)
4. Ask them to reply with the details
5. End with: "Thank you,\\n${organizationName || 'Our Team'}"

Example:
"Hi [Name]!

Thanks for your order! To process it, we need the following information:

- Unit price for Salmon Fillet
- Quantity unit for Chicken Breast
- Your liquor license number

Could you please reply with these details?

Thank you,
${organizationName || 'Our Team'}"${orgSystemPrompt ? `\n\n--- ORGANIZATION INSTRUCTIONS ---\n${orgSystemPrompt}` : ''}${customerHistoryPrompt || ''}${ragExamples && ragExamples.length > 0 ? formatExamplesForPrompt(ragExamples) : ''}`,
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
    let items = (parsed.items as ParsedOrderItem[]) || []

    // If no items at all, this is likely not a real order attempt
    if (items.length === 0) {
      console.log('Order detected but no items found:', email.subject)
      return null
    }

    // Post-process items: normalize names and prices against the product catalog
    // This ensures we always use exact catalog values when SKU matches
    if (productCatalog && productCatalog.length > 0) {
      items = items.map(item => {
        if (!item.sku) return item

        // Find matching product by SKU (case-insensitive)
        const catalogProduct = productCatalog.find(
          p => p.sku.toLowerCase() === item.sku!.toLowerCase()
        )

        if (catalogProduct) {
          // Replace with exact catalog values
          return {
            ...item,
            sku: catalogProduct.sku, // Use exact casing from catalog
            name: catalogProduct.name, // Use exact name from catalog
            unitPrice: catalogProduct.unit_price, // Use catalog price
            total: item.quantity * catalogProduct.unit_price,
          }
        }

        return item
      })
    }

    return {
      companyName: parsed.companyName || undefined, // Can be missing - we'll ask for it
      orderNumber: parsed.orderNumber || undefined,
      orderValue: parsed.orderValue ?? 0,
      itemCount: items.length,
      receivedDate: parsed.receivedDate || undefined,
      expectedDate: parsed.expectedDate || undefined,
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
 * @param contactName - Customer contact name for email greeting
 * @param organizationName - Organization name for email signature
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
  orgSystemPrompt?: string | null,
  contactName?: string,
  organizationName?: string
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

    // Build greeting and signature for the clarification email
    const greetingName = contactName || 'there'
    const signatureName = organizationName || 'Our Team'

    const openai = getOpenAI()
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
  "clarificationEmail": "The full email body (only if incomplete)"
}

The clarificationEmail MUST follow this EXACT format:
1. Start with a greeting: "Hi ${greetingName}!"
2. Thank them for their order
3. Clearly list ALL missing required information (including any organization-specific required fields like liquor license, etc.)
4. Ask them to reply with the missing details
5. End with: "Thank you,\\n${signatureName}"

Example format:
"Hi ${greetingName}!

Thanks for your order! To process it, we need the following information:

- Unit price for Salmon Fillet
- Quantity unit for Chicken Breast (lbs, cases, etc.)
- Your liquor license number

Could you please reply with these details?

Thank you,
${signatureName}"

Keep the email friendly, professional, and concise.${orgSystemPrompt ? `\n\n--- ORGANIZATION-SPECIFIC INSTRUCTIONS ---\n${orgSystemPrompt}` : ''}`,
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
