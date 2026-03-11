import { NextResponse } from 'next/server'
import { getUser } from '@kosha/supabase'
import { getOrganizationId } from '@/lib/auth'
import { getOpenAI } from '@/lib/openai'

const EXTRACTION_PROMPT = `You extract structured intelligence from sales rep conversation transcripts.

Given a transcript between a sales rep and an AI assistant, extract:

1. SUMMARY — a 2-4 sentence summary of the entire conversation covering key takeaways.

2. INSIGHTS — observations and intelligence from the conversation. Each insight has:
   - type: one of "demand", "competitive", "friction", "expansion", "relationship"
   - description: concise phrase of what was observed (keep it short, not verbose)
   - category: a sub-category label (e.g. "reorder intent", "competitor pricing", "delivery complaint")
   - suggestedAction: one concrete next step

3. TASKS — follow-up actions the rep committed to or should take. Each task has:
   - task: clear description of the action
   - priority: "high" (do within 2 days), "medium" (within a week), or "low" (within 2 weeks)

Insight type definitions:
- DEMAND — purchase intent, category interest, new product requests, reorder signals
- COMPETITIVE — competitor mentions, pricing comparisons, lost shelf space, competitive wins
- FRICTION — objections, price sensitivity, delivery issues, service complaints, stockouts
- EXPANSION — new locations, shelf resets, new distribution points, growth opportunities
- RELATIONSHIP — tone shifts, engagement changes, buyer mood, enthusiasm, churn risk

Rules:
- ALWAYS extract at least one insight if the transcript contains any substantive conversation.
- Extract MULTIPLE insights if the conversation covers different topics.
- If the transcript is too short or empty to extract anything meaningful, return empty arrays and an empty summary.

Respond with JSON in this exact format:
{
  "summary": "...",
  "insights": [{ "type": "...", "description": "...", "category": "...", "suggestedAction": "..." }],
  "tasks": [{ "task": "...", "priority": "..." }]
}`

/**
 * POST /api/capture/extract
 *
 * Fallback extraction: takes a conversation transcript and uses GPT to
 * extract insights and tasks when the realtime AI didn't call save_capture.
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
      summary: string
      insights: Array<{
        type: string
        description: string
        category: string
        suggestedAction: string
      }>
      tasks: Array<{
        task: string
        priority: string
      }>
    }

    return NextResponse.json({
      summary: extracted.summary || '',
      insights: extracted.insights || [],
      tasks: extracted.tasks || [],
    })
  } catch (error) {
    console.error('Failed to extract from transcript:', error)
    return NextResponse.json(
      { error: 'Failed to extract insights from transcript' },
      { status: 500 }
    )
  }
}
