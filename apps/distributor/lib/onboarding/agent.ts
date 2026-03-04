/**
 * Onboarding Agent
 *
 * AI-powered conversational agent for onboarding stages 2 & 3.
 * - Stage 2: Product catalog import (multi-format: CSV, Excel, images, text)
 * - Stage 3: Order example extraction for RAG training
 */

import { getOpenAI } from '@/lib/openai'
import {
  OnboardingStage,
  ChatMessage,
  AIOnboardingResponse,
  AIOnboardingResponseSchema,
  ExtractedProduct,
  ExtractedOrder,
} from './types'

// =============================================================================
// Model Selection
// =============================================================================

/**
 * Select the appropriate model based on stage and content type
 * - gpt-4o for vision (images/PDFs with visual content)
 * - gpt-4o-mini for text-only (faster, cheaper)
 */
export function getModelForRequest(
  stage: OnboardingStage,
  hasImages: boolean
): 'gpt-4o' | 'gpt-4o-mini' {
  // Stage 2 with images needs vision
  if (stage === 'products' && hasImages) {
    return 'gpt-4o'
  }
  // Everything else uses the faster/cheaper model
  return 'gpt-4o-mini'
}

// =============================================================================
// System Prompts
// =============================================================================

const BASE_INSTRUCTIONS = `You are a friendly onboarding assistant for Kosha, an order management system for food & beverage distributors.

CRITICAL RULES:
1. Be warm but concise (2-3 sentences max per response)
2. ALWAYS respond with valid JSON in this exact format:
{
  "message": "your friendly message to the user",
  "extractedData": { ... },  // optional, only when you've extracted data
  "stageComplete": false,    // true only when stage is done
  "suggestedActions": [...]  // optional action buttons to show
}
3. Never use markdown code blocks. Return pure JSON only.
4. If you extract data, show a brief summary in your message.`

const STAGE_2_PRODUCTS_PROMPT = `${BASE_INSTRUCTIONS}

CURRENT STAGE: Product Catalog Import

Your job is to help the user import their product catalog. They can:
- Upload a CSV, Excel (.xlsx), or PDF file
- Upload an image of a price list
- Paste raw text of their products
- Skip this step for now

When extracting products:
- Look for: product name, SKU (if available), unit price
- If unit price isn't clear, set to 0 and mention in your message
- Be generous - extract what you can, user can correct

IMPORTANT - Handling Corrections:
When "PREVIOUSLY EXTRACTED PRODUCTS" are provided in the context:
- The user is making a correction to those products
- Apply ONLY the specific changes the user mentions
- Keep ALL other products unchanged
- Return the COMPLETE merged list in extractedData.products
- For example, if user says "change X to $10" - update X's price and keep all other products as-is

Available actions to suggest:
- { "id": "confirm_products_import", "label": "Import & Confirm" }
- { "id": "edit_products", "label": "Let me correct that" }
- { "id": "skip_products", "label": "Skip for now" }
- { "id": "add_more_products", "label": "Add more products" }

Example response when products are extracted:
{
  "message": "I found 12 products in your file! Here's what I extracted: Wine selections with SKUs like WR-001 starting at $18.99. Ready to import?",
  "extractedData": {
    "products": [
      { "sku": "WR-001", "name": "Cabernet Sauvignon Reserve", "unit_price": 24.99 },
      { "sku": "WR-002", "name": "Pinot Noir", "unit_price": 18.99 }
    ]
  },
  "stageComplete": false,
  "suggestedActions": [
    { "id": "confirm_products_import", "label": "Import & Confirm" },
    { "id": "edit_products", "label": "Let me correct that" },
    { "id": "add_more_products", "label": "Add more products" }
  ]
}

Example response for correction (when PREVIOUSLY EXTRACTED PRODUCTS has 19 products and user corrects one price):
{
  "message": "Got it! I've updated Pinot Noir to $22.99. All 19 products are ready to import.",
  "extractedData": {
    "products": [... all 19 products with the correction applied ...]
  },
  "stageComplete": false,
  "suggestedActions": [
    { "id": "confirm_products_import", "label": "Import & Confirm" },
    { "id": "edit_products", "label": "Let me correct that" },
    { "id": "add_more_products", "label": "Add more products" }
  ]
}

Example response for skip:
{
  "message": "No problem! You can always add products later from the Products page. Let's move on to the final step.",
  "stageComplete": true,
  "suggestedActions": []
}`

/**
 * Get the system prompt for the current stage
 */
export function getSystemPrompt(stage: OnboardingStage): string {
  switch (stage) {
    case 'products':
      return STAGE_2_PRODUCTS_PROMPT
    default:
      return BASE_INSTRUCTIONS
  }
}

// =============================================================================
// Message Building
// =============================================================================

export interface OnboardingMessageContent {
  type: 'text' | 'image_url'
  text?: string
  image_url?: {
    url: string
    detail?: 'auto' | 'low' | 'high'
  }
}

/**
 * Build the messages array for the OpenAI API call
 */
export function buildMessages(
  stage: OnboardingStage,
  userMessage: string,
  chatSummary: string | null,
  recentMessages: ChatMessage[],
  imageBase64?: string,
  imageMimeType?: string
): Array<{
  role: 'system' | 'user' | 'assistant'
  content: string | OnboardingMessageContent[]
}> {
  const messages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string | OnboardingMessageContent[]
  }> = []

  // System prompt
  messages.push({
    role: 'system',
    content: getSystemPrompt(stage),
  })

  // Add chat summary for context if available
  if (chatSummary) {
    messages.push({
      role: 'system',
      content: `CONTEXT FROM EARLIER IN CONVERSATION:\n${chatSummary}`,
    })
  }

  // Add recent messages for tone/continuity (last 6-8)
  const recentToInclude = recentMessages.slice(-8)
  for (const msg of recentToInclude) {
    messages.push({
      role: msg.role,
      content: msg.content,
    })
  }

  // Add the current user message (with image if present)
  if (imageBase64 && imageMimeType) {
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: userMessage || 'Here is my file:' },
        {
          type: 'image_url',
          image_url: {
            url: `data:${imageMimeType};base64,${imageBase64}`,
            detail: 'high',
          },
        },
      ],
    })
  } else {
    messages.push({
      role: 'user',
      content: userMessage,
    })
  }

  return messages
}

// =============================================================================
// API Call
// =============================================================================

export interface OnboardingAgentResult {
  success: boolean
  response?: AIOnboardingResponse
  error?: string
  model: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
}

/**
 * Call the onboarding agent with the current context
 */
export async function callOnboardingAgent(params: {
  stage: OnboardingStage
  userMessage: string
  chatSummary: string | null
  recentMessages: ChatMessage[]
  imageBase64?: string
  imageMimeType?: string
  parsedData?: {
    products?: ExtractedProduct[]
    excelJson?: Record<string, unknown>
    pdfText?: string
  }
  previouslyExtractedProducts?: ExtractedProduct[]
}): Promise<OnboardingAgentResult> {
  const startTime = Date.now()
  const hasImages = !!params.imageBase64
  const model = getModelForRequest(params.stage, hasImages)

  try {
    // If we have pre-parsed data (CSV/Excel), include it in the user message
    let enhancedMessage = params.userMessage

    // Include previously extracted products for corrections/merging
    if (params.previouslyExtractedProducts && params.previouslyExtractedProducts.length > 0) {
      enhancedMessage = `PREVIOUSLY EXTRACTED PRODUCTS (keep these and apply user's corrections):\n${JSON.stringify(params.previouslyExtractedProducts, null, 2)}\n\nUSER'S MESSAGE:\n${enhancedMessage}`
    }

    if (params.parsedData?.products && params.parsedData.products.length > 0) {
      enhancedMessage += `\n\nPre-parsed products from file:\n${JSON.stringify(params.parsedData.products, null, 2)}`
    } else if (params.parsedData?.excelJson) {
      enhancedMessage += `\n\nPre-parsed Excel data:\n${JSON.stringify(params.parsedData.excelJson, null, 2)}`
    } else if (params.parsedData?.pdfText) {
      enhancedMessage += `\n\nExtracted text from PDF:\n${params.parsedData.pdfText}`
    }

    const messages = buildMessages(
      params.stage,
      enhancedMessage,
      params.chatSummary,
      params.recentMessages,
      params.imageBase64,
      params.imageMimeType
    )

    const openai = getOpenAI()
    const completion = await openai.chat.completions.create({
      model,
      messages: messages as Parameters<typeof openai.chat.completions.create>[0]['messages'],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 2000,
    })

    const latencyMs = Date.now() - startTime
    const content = completion.choices[0]?.message?.content || '{}'

    // Parse and validate with Zod
    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch {
      return {
        success: false,
        error: 'Failed to parse AI response as JSON',
        model,
        inputTokens: completion.usage?.prompt_tokens || 0,
        outputTokens: completion.usage?.completion_tokens || 0,
        latencyMs,
      }
    }

    const validated = AIOnboardingResponseSchema.safeParse(parsed)
    if (!validated.success) {
      console.error('Zod validation failed:', validated.error.issues)
      return {
        success: false,
        error: `Invalid AI response: ${validated.error.issues.map(i => i.message).join(', ')}`,
        model,
        inputTokens: completion.usage?.prompt_tokens || 0,
        outputTokens: completion.usage?.completion_tokens || 0,
        latencyMs,
      }
    }

    return {
      success: true,
      response: validated.data,
      model,
      inputTokens: completion.usage?.prompt_tokens || 0,
      outputTokens: completion.usage?.completion_tokens || 0,
      latencyMs,
    }
  } catch (error) {
    const latencyMs = Date.now() - startTime
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      model,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs,
    }
  }
}

// =============================================================================
// Chat Summary Management
// =============================================================================

/**
 * Update the rolling chat summary with new information
 * Keeps the summary concise to stay within token limits
 */
export function updateChatSummary(
  existingSummary: string | null,
  stage: OnboardingStage,
  productsImported: number
): string {
  const parts: string[] = []

  if (productsImported > 0) {
    parts.push(`User has imported ${productsImported} products.`)
  }

  // Keep any other context from existing summary
  if (existingSummary) {
    // Extract any custom notes (not the auto-generated parts)
    const customParts = existingSummary
      .split('.')
      .filter(p => !p.includes('imported'))
      .map(p => p.trim())
      .filter(Boolean)

    if (customParts.length > 0) {
      parts.push(...customParts)
    }
  }

  return parts.join(' ')
}

/**
 * Generate initial greeting message for a stage
 * Returns a single message for backward compatibility
 */
export function getStageGreeting(
  stage: OnboardingStage,
  userName?: string,
  orgName?: string
): ChatMessage {
  // Return the first message of the sequence for backward compatibility
  const messages = getStageGreetingSequence(stage, userName, orgName)
  return messages[0]
}

/**
 * Generate a sequence of greeting messages for a stage
 * Used for the multi-message animated greeting flow
 */
export function getStageGreetingSequence(
  stage: OnboardingStage,
  userName?: string,
  orgName?: string
): ChatMessage[] {
  const userFirstName = userName ? userName.split(' ')[0] : ''
  const now = Date.now()

  switch (stage) {
    case 'products':
      return [
        {
          id: `greeting-1-${now}`,
          role: 'assistant',
          content: orgName ? `Welcome, ${orgName}!` : 'Welcome!',
          timestamp: new Date(),
          isGreeting: true,
          actions: [], // Explicitly no actions - skip button is in ChatInput
        },
        {
          id: `greeting-2-${now}`,
          role: 'assistant',
          content: "Let's set up your product catalog. You can upload a file (CSV, Excel, PDF, or even a photo of your price list), paste your products as text, or skip this for now.",
          timestamp: new Date(),
          isGreeting: true,
          hideAvatar: true, // Don't show avatar for continuation messages
          actions: [],
        },
      ]
    default:
      return [
        {
          id: `greeting-${now}`,
          role: 'assistant',
          content: `Welcome${userFirstName ? `, ${userFirstName}` : ''}! Let's get your account set up.`,
          timestamp: new Date(),
          isGreeting: true,
          actions: [],
        },
      ]
  }
}
