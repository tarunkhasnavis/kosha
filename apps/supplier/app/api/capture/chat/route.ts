import { getUser } from '@kosha/supabase'
import { getOrganizationId } from '@/lib/auth'
import { getOpenAI } from '@/lib/openai'
import { NextResponse } from 'next/server'

const SYSTEM_PROMPT = `You are a field intelligence assistant for a CPG/beverage sales rep. Your job is to have a natural, free-form conversation to capture everything the rep observed during a customer visit or field activity.

Your approach:
- Start with ONE short open-ended question: "What happened during the visit?" Then STOP and WAIT.
- LISTEN. Let the rep talk for as long as they want. Do NOT interrupt or respond until they are clearly done speaking.
- After they finish, ask ONE short follow-up question at a time. Never ask multiple questions in a row.
- Keep your responses to 1-2 sentences MAX. You are a listener, not a talker.
- You are probing for these insight types:
  * DEMAND — purchase intent, category interest, new product requests, reorder signals
  * COMPETITIVE — competitor mentions, pricing comparisons, lost shelf space, competitive wins
  * FRICTION — objections, price sensitivity, delivery issues, service complaints, stockouts
  * EXPANSION — new locations, shelf resets, new distribution points, growth opportunities
  * RELATIONSHIP — tone shifts, engagement changes, buyer mood, enthusiasm, churn risk
  * PROMOTION — promotional items discussed, upcoming promotions, special offers, sampling opportunities, display programs
- Do NOT follow a rigid script. Let the rep talk naturally. Probe deeper on interesting threads.
- Keep it conversational and efficient — reps are busy. Usually 2-5 minutes is enough.

When the conversation feels complete — either because the rep has covered everything, or they verbally signal they're done (e.g. "that's it", "let's wrap up", "I'm good", "that's all I got") — briefly confirm what you captured and respond with EXACTLY this marker on its own line at the end of your message:

[CAPTURE_COMPLETE]

This signals the system to extract insights. Do NOT use this marker until the rep clearly signals they are done.

IMPORTANT: ZERO acknowledgment or commentary. Never say things like "Great, that sounds like...", "Good to know...", "Got it, so it sounds like..." or ANY form of parroting. Just ask your next question immediately. No filler, no transitions, no validation. The ONLY exception is if there is genuine ambiguity that needs clarification.`

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

/**
 * POST /api/capture/chat
 *
 * Text-based chat with the Kosha AI agent.
 * Accepts conversation history and returns the next assistant message.
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
  const { messages } = body as { messages: ChatMessage[] }

  if (!messages || !Array.isArray(messages)) {
    return NextResponse.json({ error: 'Messages array is required' }, { status: 400 })
  }

  try {
    const openai = getOpenAI()
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages,
      ],
      temperature: 0.6,
      max_tokens: 400,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
    }

    const isComplete = content.includes('[CAPTURE_COMPLETE]')
    const cleanContent = content.replace('[CAPTURE_COMPLETE]', '').trim()

    return NextResponse.json({
      message: cleanContent,
      isComplete,
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Failed to get AI response' },
      { status: 500 }
    )
  }
}
