import { getUser } from '@kosha/supabase'
import { getOrganizationId } from '@/lib/auth'
import { NextResponse } from 'next/server'

const SYSTEM_PROMPT = `You are a field intelligence assistant for a CPG/beverage sales rep. Your job is to have a natural, free-form conversation to capture everything the rep observed during a customer visit or field activity.

Your approach:
- Start by asking what happened during the visit. Keep it open-ended.
- Listen actively. As they talk, mentally categorize what you hear into insight types.
- Ask targeted follow-up questions to fill gaps. You are probing for these insight types:
  * DEMAND — purchase intent, category interest, new product requests, reorder signals
  * COMPETITIVE — competitor mentions, pricing comparisons, lost shelf space, competitive wins
  * FRICTION — objections, price sensitivity, delivery issues, service complaints, stockouts
  * EXPANSION — new locations, shelf resets, new distribution points, growth opportunities
  * RELATIONSHIP — tone shifts, engagement changes, buyer mood, enthusiasm, churn risk
  * PROMOTION — promotional items discussed, upcoming promotions, special offers, sampling opportunities, display programs
- Do NOT follow a rigid script. Let the rep talk naturally. Probe deeper on interesting threads.
- Keep it conversational and efficient — reps are busy. Usually 2-5 minutes is enough.

Extraction rules:
- ALWAYS extract at least one insight. If the rep talked about anything, there is intelligence to capture.
- You may extract MULTIPLE insights from one conversation — capture everything meaningful.
- Keep insight descriptions super concise — short phrases, not full sentences.
- Assign a sub-category label (e.g. "reorder intent", "competitor pricing", "delivery complaint").
- Suggest one concrete next step per insight.
- Also extract follow-up TASKS — concrete actions the rep committed to or should take.
- Assign task priority: high (do within 2 days), medium (within a week), low (within 2 weeks).
- Write a 2-4 sentence summary of the entire conversation covering the key takeaways.

When the conversation feels complete — either because the rep has covered everything, or they verbally signal they're done (e.g. "that's it", "let's wrap up", "I'm good", "that's all I got", "wrap up the meeting") — briefly confirm: "Here is what I captured — [brief summary]. Sound right?"
Then call the save_capture function ONCE with ALL extracted insights and tasks. Do NOT keep asking more questions after the rep signals they want to end.

IMPORTANT: Always speak in English. Never switch to Spanish or any other language, even if the user speaks in another language. Respond in English only.

IMPORTANT: Speak at a brisk, efficient pace. Keep responses concise and avoid unnecessary pauses or filler words. Reps are busy — be snappy.

IMPORTANT: ZERO acknowledgment or commentary. Never say things like "Great, that sounds like...", "Good to know...", "Got it, so it sounds like...", "That's a good insight", "Perfect, that's a clear action item", or ANY form of parroting, summarizing, or commenting on what was said. Just ask your next question immediately. No filler, no transitions, no validation. Go straight to the next question. The ONLY exception is if there is genuine ambiguity that needs clarification.`

const SAVE_CAPTURE_TOOL = {
  type: 'function' as const,
  name: 'save_capture',
  description: 'Save all extracted insights, tasks, and a conversation summary. Call once at the end with everything.',
  parameters: {
    type: 'object',
    properties: {
      summary: {
        type: 'string',
        description: 'A 2-4 sentence summary of the entire conversation covering key takeaways.',
      },
      insights: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['demand', 'competitive', 'friction', 'expansion', 'relationship', 'promotion'],
              description: 'The insight type.',
            },
            description: {
              type: 'string',
              description: 'Concise phrase of what was observed.',
            },
            category: {
              type: 'string',
              description: 'Sub-category label within the insight type.',
            },
            suggestedAction: {
              type: 'string',
              description: 'One concrete next step for the rep.',
            },
          },
          required: ['type', 'description', 'category', 'suggestedAction'],
        },
        description: 'Array of insights extracted from the conversation.',
      },
      tasks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            task: {
              type: 'string',
              description: 'Clear description of the follow-up task.',
            },
            priority: {
              type: 'string',
              enum: ['high', 'medium', 'low'],
              description: 'Task priority level.',
            },
          },
          required: ['task', 'priority'],
        },
        description: 'Array of follow-up tasks extracted from the conversation.',
      },
    },
    required: ['summary', 'insights', 'tasks'],
  },
}

/**
 * POST /api/capture/session
 *
 * Creates an ephemeral token for the OpenAI Realtime API.
 * The client uses this token to establish a direct WebRTC connection to OpenAI.
 */
export async function POST() {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const orgId = await getOrganizationId()
  if (!orgId) {
    return NextResponse.json({ error: 'No organization found' }, { status: 403 })
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
  }

  try {
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview',
        voice: 'marin',
        instructions: SYSTEM_PROMPT,
        tools: [SAVE_CAPTURE_TOOL],
        tool_choice: 'auto',
        input_audio_transcription: {
          model: 'whisper-1',
          language: 'en',
        },
        temperature: 0.6,
        max_response_output_tokens: 400,
        turn_detection: {
          type: 'semantic_vad',
          eagerness: 'high',
          create_response: true,
          interrupt_response: true,
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to create realtime session:', response.status, errorText)
      return NextResponse.json(
        { error: `OpenAI error (${response.status}): ${errorText}` },
        { status: 500 }
      )
    }

    const data = await response.json()

    return NextResponse.json({
      client_secret: data.client_secret?.value,
      session_id: data.id,
    })
  } catch (error) {
    console.error('Error creating realtime session:', error)
    return NextResponse.json(
      { error: 'Failed to create voice session' },
      { status: 500 }
    )
  }
}
