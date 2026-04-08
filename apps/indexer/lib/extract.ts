import type { CallExtraction } from './types'

const EXTRACTION_PROMPT = `You are analyzing a phone call transcript between an AI agent and a store employee. The agent called to ask about seltzer pricing for three products:

1. White Claw 12-pack variety pack
2. High Noon 8-pack
3. Truly 12-pack

Extract the following structured data from the transcript.

For each product, determine:
- product_name: exact product name
- found: did the store carry this product? (boolean)
- price: quoted price as a number (e.g. 21.99). null if not given
- before_tax: was the price before tax? (boolean, default true)
- pack_size: pack size if mentioned (e.g. "12-pack")
- notes: any relevant context (e.g. "on sale", "employee unsure", "only had slim cans")
- confidence: "high" if clearly stated and confirmed, "medium" if stated but not confirmed, "low" if vague

Also determine:
- store_carries_seltzers: does the store carry seltzers at all? (boolean)
- call_quality: "good" if the agent got clear answers, "partial" if some info was unclear, "poor" if the call was unhelpful
- notes: any overall call notes

IMPORTANT: Always return all three products in the products array, even if the product was not discussed or not found. Set found=false and price=null for products not discussed.

Return ONLY valid JSON matching this schema:
{
  "store_carries_seltzers": boolean,
  "products": [
    {
      "product_name": string,
      "found": boolean,
      "price": number | null,
      "before_tax": boolean,
      "pack_size": string | null,
      "notes": string | null,
      "confidence": "low" | "medium" | "high"
    }
  ],
  "call_quality": "good" | "partial" | "poor",
  "notes": string | null
}`

const DEFAULT_EXTRACTION: CallExtraction = {
  store_carries_seltzers: false,
  products: [
    { product_name: 'White Claw 12-pack', found: false, before_tax: true, confidence: 'low' },
    { product_name: 'High Noon 8-pack', found: false, before_tax: true, confidence: 'low' },
    { product_name: 'Truly 12-pack', found: false, before_tax: true, confidence: 'low' },
  ],
  call_quality: 'poor',
  notes: 'Extraction failed',
}

export async function extractFromTranscript(
  transcript: string,
): Promise<CallExtraction> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.error('[extract] Missing OPENAI_API_KEY')
    return { ...DEFAULT_EXTRACTION, notes: 'Missing OpenAI API key' }
  }

  if (!transcript || transcript.trim().length < 10) {
    console.log('[extract] Transcript too short, skipping')
    return { ...DEFAULT_EXTRACTION, notes: 'Transcript too short or empty' }
  }

  // Retry up to 3 times
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: EXTRACTION_PROMPT },
            { role: 'user', content: `Transcript:\n\n${transcript}` },
          ],
        }),
      })

      if (!res.ok) {
        const err = await res.text()
        console.error(`[extract] OpenAI error (attempt ${attempt + 1}):`, err)
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)))
          continue
        }
        return { ...DEFAULT_EXTRACTION, notes: `OpenAI API error: ${res.status}` }
      }

      const data = await res.json()
      const content = data.choices?.[0]?.message?.content

      if (!content) {
        console.error('[extract] No content in OpenAI response')
        if (attempt < 2) continue
        return { ...DEFAULT_EXTRACTION, notes: 'Empty OpenAI response' }
      }

      const raw = JSON.parse(content)

      const result: CallExtraction = {
        store_carries_seltzers: Boolean(raw.store_carries_seltzers),
        products: (raw.products ?? []).map((p: Record<string, unknown>) => ({
          product_name: String(p.product_name ?? ''),
          found: Boolean(p.found),
          price: p.price != null ? Number(p.price) : undefined,
          before_tax: p.before_tax !== false,
          pack_size: p.pack_size ? String(p.pack_size) : undefined,
          notes: p.notes ? String(p.notes) : undefined,
          confidence: (p.confidence as string) ?? 'low',
        })),
        call_quality: (raw.call_quality as string) ?? 'poor',
        notes: raw.notes ? String(raw.notes) : undefined,
      }

      console.log(`[extract] Success: ${result.products.filter((p) => p.found).length} products found`)
      return result
    } catch (err) {
      console.error(`[extract] Error (attempt ${attempt + 1}):`, err)
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)))
        continue
      }
    }
  }

  return { ...DEFAULT_EXTRACTION, notes: 'All extraction attempts failed' }
}
