'use server'

import type { ParsedEmail } from '@/lib/gmail/client'
import type { ProcessedAttachment } from '@/lib/attachments/parser'
import { prepareAttachmentsForAI } from '@/lib/attachments/parser'
import { openai } from '@/lib/openai'

/**
 * AI extracted order item
 */
export interface ParsedOrderItem {
  name: string           // REQUIRED - item name
  sku?: string           // OPTIONAL - product SKU if found in email
  quantity: string       // REQUIRED - e.g., "10 lbs", "5 cases"
  unitPrice?: number     // OPTIONAL - price per unit
  total?: number         // OPTIONAL - quantity * unitPrice (can be calculated later)
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

  // Order items
  items: ParsedOrderItem[]

  // Completeness check
  isComplete: boolean              // Do ALL items have name + quantity?
  missingInfo: string[]            // e.g., ["Unit price for Chicken", "Quantity for Beef"]

  // Clarification email (if incomplete)
  clarificationEmail?: string      // AI-generated reply asking for missing info
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
  items?: Array<{
    name: string
    sku?: string
    quantity: string
    unitPrice?: number
    total?: number
  }>
  isComplete?: boolean
  missingInfo?: string[]
  clarificationEmail?: string
}

/**
 * Process an email using OpenAI to extract order information.
 * Returns ParsedOrderData if it's an order, or null if not an order.
 *
 * @param email - The current email to process
 * @param threadContext - Optional: Previous emails in the thread for full context
 * @param processedAttachments - Optional: Processed attachments (images, PDFs, Excel)
 */
export async function processEmailWithAI(
  email: ParsedEmail,
  threadContext?: Array<{
    email_from: string
    email_subject: string
    email_date: string
    email_body: string
  }>,
  processedAttachments?: ProcessedAttachment[]
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

IMPORTANT: You may receive a single email OR an email thread (conversation). When you receive a thread:
- Previous emails provide context (original order, clarification requests, etc.)
- The LATEST email contains the most recent information
- COMBINE all information from the thread to build the complete order
- If a reply provides missing information (e.g., prices), add it to the original items

Your task:
1. Determine if this email contains an order (items with quantities)
2. Extract all order information including:
   - Company/customer name (from signature, email, or body)
   - Contact person name (WHO is placing the order - look for "Chef X needs", "for Manager Y", signature names, "this is John ordering")
   - Contact email (if the person placing the order has a different email than the sender)
   - Order number (customer's PO number if mentioned)
   - Items with name, SKU (if mentioned), quantity, unit price (if mentioned), and total
   - Order value (extract total from email OR calculate from items)
   - Received date (when the order was placed - look for phrases like "order placed on", "for Monday", etc.)
   - Expected delivery date (when they want it delivered - look for "deliver on", "need by", "for tomorrow", etc.)
   - Notes (special instructions, delivery notes, comments)
   - Billing address (if mentioned)
   - Phone number (if mentioned)
   - Payment method (if mentioned - e.g., "Net 30", "Credit Card", "COD")
3. Assess completeness: Do ALL items have name + quantity?
4. If incomplete, generate a friendly clarification email

Return JSON in this EXACT format:
{
  "isOrder": true/false,
  "companyName": "Company Name",
  "contactName": "Chef John" or null,
  "contactEmail": "chef@restaurant.com" or null,
  "orderNumber": "PO-12345" or null,
  "orderValue": 150.50,
  "receivedDate": "2024-12-09" or null,
  "expectedDeliveryDate": "2024-12-10" or null,
  "notes": "Leave at back door" or null,
  "billingAddress": "123 Main St, City, State" or null,
  "phone": "555-1234" or null,
  "paymentMethod": "Net 30" or null,
  "items": [
    {
      "name": "Chicken Breast",
      "sku": "CHK-001" or null,
      "quantity": "10 lbs",
      "unitPrice": 5.99 or null,
      "total": 59.90 or null
    }
  ],
  "isComplete": true/false,
  "missingInfo": ["Unit price for Chicken", "Delivery date"],
  "clarificationEmail": "Hi John, thanks for your order! Could you please confirm..." or null
}

Rules:
- If NOT an order (question, complaint, general inquiry) → return {"isOrder": false}
- Keep quantity units (e.g., "10 lbs", "5 cases", "2 dozen")
- Parse dates intelligently ("tomorrow" = next day, "Monday" = next Monday, etc.)
- If date mentioned is in the past, use email date
- isComplete = true only if ALL items have name + quantity
- Generate clarificationEmail only if isComplete = false
- orderValue should be the total if mentioned, or sum of item totals

Example order:
"Hi, we need 10 lbs chicken breast @ $5.99/lb and 5 lbs ground beef for delivery tomorrow. Thanks, John from Acme Restaurant"

ATTACHMENTS - IMPORTANT:
- The email may include attached files (images, PDFs, Excel spreadsheets)
- ATTACHMENTS TYPICALLY CONTAIN THE DETAILED ITEMIZED ORDER LIST - extract all items from them
- The email body often just says "please see attached order" or similar, with the actual items in the attachment
- Images/PDFs: Usually contain order forms, invoices, or itemized lists. Carefully extract EVERY line item with name, quantity, SKU, and price.
- Excel data: Provided as JSON in the text. Each row typically represents one order item - extract ALL rows.
- PRIORITIZE attachment data for items - it's usually more complete than the email body
- COMBINE information: Use email body for contact info, delivery instructions, etc. Use attachments for the itemized order list.`,
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
      items,
      isComplete: parsed.isComplete ?? false,
      missingInfo: parsed.missingInfo ?? [],
      clarificationEmail: parsed.clarificationEmail || undefined,
    }
  } catch (error) {
    console.error('Error processing email with OpenAI:', error)
    throw error
  }
}
