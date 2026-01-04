/**
 * Embedding Generation & RAG Retrieval
 *
 * Uses OpenAI text-embedding-3-small for semantic similarity search.
 * Retrieves similar past orders from order_examples table via pgvector.
 *
 * This module is MEDIUM-AGNOSTIC - it doesn't know or care whether the input
 * came from email, voicemail, SMS, or any other channel. Callers are responsible
 * for pre-processing and extracting relevant metadata before calling these functions.
 */

import { openai } from '@/lib/openai'
import { createClient } from '@/utils/supabase/server'

/**
 * Generate an embedding vector for text using OpenAI
 * Uses text-embedding-3-small (1536 dimensions)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })

  return response.data[0].embedding
}

/**
 * Order example retrieved from RAG search
 */
export interface OrderExample {
  id: string
  raw_input: string
  extracted_order: Record<string, unknown>
  was_edited: boolean
  sender_domain: string | null
  similarity: number
}

/**
 * Retrieve similar order examples from the database using semantic search
 *
 * @param queryText - The raw input text to find similar examples for
 * @param organizationId - Only search within this organization's examples
 * @param matchCount - Maximum number of examples to return (default: 3)
 * @param matchThreshold - Minimum similarity score 0-1 (default: 0.7)
 */
export async function retrieveSimilarExamples(
  queryText: string,
  organizationId: string,
  matchCount: number = 3,
  matchThreshold: number = 0.7
): Promise<OrderExample[]> {
  try {
    // Generate embedding for the query
    const embedding = await generateEmbedding(queryText)

    const supabase = await createClient()

    // Call the match_order_examples function we created in pgvector
    const { data, error } = await supabase.rpc('match_order_examples', {
      query_embedding: embedding,
      match_org_id: organizationId,
      match_count: matchCount,
      match_threshold: matchThreshold,
    })

    if (error) {
      console.error('Error retrieving similar examples:', error)
      return []
    }

    return (data || []) as OrderExample[]
  } catch (error) {
    console.error('Error in RAG retrieval:', error)
    return []
  }
}

/**
 * Format order examples for injection into the AI prompt
 * Creates a compact but informative representation
 */
export function formatExamplesForPrompt(examples: OrderExample[]): string {
  if (examples.length === 0) return ''

  const formatted = examples.map((ex, i) => {
    const order = ex.extracted_order as Record<string, unknown>
    const items = (order.items as Array<Record<string, unknown>>) || []

    // Format items compactly
    const itemsStr = items.map(item =>
      `- ${item.name}${item.sku ? ` (${item.sku})` : ''}: ${item.quantity} ${item.quantityUnit}${item.unitPrice ? ` @ $${item.unitPrice}` : ''}`
    ).join('\n')

    // Build compact example
    return `--- Example ${i + 1}${ex.was_edited ? ' (human-corrected)' : ''} ---
INPUT:
${truncateText(ex.raw_input, 500)}

EXTRACTED:
Company: ${order.companyName || 'Unknown'}
Items:
${itemsStr}
Order Value: $${order.orderValue || 0}
${order.shipVia ? `Ship Via: ${order.shipVia}` : ''}
${order.notes ? `Notes: ${truncateText(order.notes as string, 100)}` : ''}`
  }).join('\n\n')

  return `
--- SIMILAR PAST ORDERS (Learn from these examples) ---
These are real orders this organization has processed. Use them to understand:
- How to extract customer names from this sender
- Common item formats and SKU patterns
- Typical order structure

${formatted}
--- END EXAMPLES ---`
}

/**
 * Truncate text to a maximum length with ellipsis
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

/**
 * Metadata about the input source (pre-processed by caller)
 * This keeps the embeddings module medium-agnostic
 */
export interface InputMetadata {
  /** Domain of sender (e.g., "restaurant.com") - extracted by caller */
  senderDomain?: string | null
  /** Type of document/input (e.g., "email", "voicemail", "sms") */
  docType?: string
}

/**
 * Save an approved order as an example for future RAG retrieval
 *
 * @param input - The raw input text (email body, transcript, etc.)
 * @param extractedOrder - The final extracted order data (after any human edits)
 * @param organizationId - The organization this example belongs to
 * @param sourceOrderId - The order ID this example was created from
 * @param wasEdited - Whether a human made corrections to the AI extraction
 * @param metadata - Pre-processed metadata about the input source
 * @param editDiff - Optional diff of what was changed (for analysis)
 */
export async function saveOrderExample(
  input: string,
  extractedOrder: Record<string, unknown>,
  organizationId: string,
  sourceOrderId: string,
  wasEdited: boolean,
  metadata?: InputMetadata,
  editDiff?: Record<string, unknown>
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    // Generate embedding for the input
    const embedding = await generateEmbedding(input)

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('order_examples')
      .insert({
        organization_id: organizationId,
        sender_domain: metadata?.senderDomain || null,
        doc_type: metadata?.docType || 'email',
        raw_input: input,
        embedding: embedding,
        extracted_order: extractedOrder,
        was_edited: wasEdited,
        edit_diff: editDiff || null,
        source_order_id: sourceOrderId,
      })
      .select('id')
      .single()

    if (error) {
      console.error('Error saving order example:', error)
      return { success: false, error: error.message }
    }

    return { success: true, id: data.id }
  } catch (error) {
    console.error('Error in saveOrderExample:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
