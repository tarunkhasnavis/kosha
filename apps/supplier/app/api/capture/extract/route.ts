import { NextResponse } from 'next/server'
import { getUser } from '@kosha/supabase'
import { getOrganizationId } from '@/lib/auth'
import { getOpenAI } from '@/lib/openai'

const EXTRACTION_PROMPT = `You extract structured intelligence from sales rep conversation transcripts.

Given a transcript between a sales rep and an AI assistant, extract:

1. SIGNALS — observations and intelligence from the conversation. Each signal has:
   - type: one of "demand", "competitive", "friction", "expansion", "relationship"
   - description: 1-2 sentence summary of what was observed
   - confidence: 0.0 to 1.0 based on how specific and actionable the intel is
   - category: a sub-category label (e.g. "reorder intent", "competitor pricing", "delivery complaint")
   - suggestedAction: one concrete next step

2. TASKS — follow-up actions the rep committed to or should take. Each task has:
   - task: clear description of the action
   - priority: "high" (do within 2 days), "medium" (within a week), or "low" (within 2 weeks)

Signal type definitions:
- DEMAND — purchase intent, category interest, new product requests, reorder signals
- COMPETITIVE — competitor mentions, pricing comparisons, lost shelf space, competitive wins
- FRICTION — objections, price sensitivity, delivery issues, service complaints, stockouts
- EXPANSION — new locations, shelf resets, new distribution points, growth opportunities
- RELATIONSHIP — tone shifts, engagement changes, buyer mood, enthusiasm, churn risk

Rules:
- ALWAYS extract at least one signal if the transcript contains any substantive conversation.
- Extract MULTIPLE signals if the conversation covers different topics.
- If the transcript is too short or empty to extract anything meaningful, return empty arrays.

Respond with JSON in this exact format:
{
  "signals": [{ "type": "...", "description": "...", "confidence": 0.0, "category": "...", "suggestedAction": "..." }],
  "tasks": [{ "task": "...", "priority": "..." }]
}`

/**
 * POST /api/capture/extract
 *
 * Fallback extraction: takes a conversation transcript and uses GPT to
 * extract signals and tasks when the realtime AI didn't call save_capture.
 */
export async function POST(request: Request) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const orgId = await getOrganizationId()
  if (!orgId) {
    return NextResponse.json({ error: 'No organization found' }, { status: 403 })
  }

  const body = await request.json()
  const { transcript } = body

  if (!transcript || typeof transcript !== 'string' || transcript.trim().length === 0) {
    return NextResponse.json({ error: 'Transcript is required' }, { status: 400 })
  }

  try {
    const openai = getOpenAI()
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: EXTRACTION_PROMPT },
        { role: 'user', content: transcript },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      return NextResponse.json({ error: 'No response from extraction model' }, { status: 500 })
    }

    const extracted = JSON.parse(content) as {
      signals: Array<{
        type: string
        description: string
        confidence: number
        category: string
        suggestedAction: string
      }>
      tasks: Array<{
        task: string
        priority: string
      }>
    }

    return NextResponse.json({
      signals: extracted.signals || [],
      tasks: extracted.tasks || [],
    })
  } catch (error) {
    console.error('Failed to extract from transcript:', error)
    return NextResponse.json(
      { error: 'Failed to extract signals from transcript' },
      { status: 500 }
    )
  }
}
