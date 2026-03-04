import { getUser } from '@kosha/supabase'
import { getOrganizationId } from '@/lib/auth'
import { NextResponse } from 'next/server'

const SYSTEM_PROMPT = `You are a field intelligence assistant for a CPG/beverage sales rep. Your job is to have a natural, free-form conversation to capture everything the rep observed during a customer visit or field activity.

Your approach:
- Start by asking what happened during the visit. Keep it open-ended.
- Listen actively. As they talk, mentally categorize what you hear into signal types.
- Ask targeted follow-up questions to fill gaps. You are probing for these signal types:
  * DEMAND — purchase intent, category interest, new product requests, reorder signals
  * COMPETITIVE — competitor mentions, pricing comparisons, lost shelf space, competitive wins
  * FRICTION — objections, price sensitivity, delivery issues, service complaints, stockouts
  * EXPANSION — new locations, shelf resets, new distribution points, growth opportunities
  * RELATIONSHIP — tone shifts, engagement changes, buyer mood, enthusiasm, churn risk
- Do NOT follow a rigid script. Let the rep talk naturally. Probe deeper on interesting threads.
- Keep it conversational and efficient — reps are busy. Usually 2-5 minutes is enough.

Extraction rules:
- ALWAYS extract at least one signal. If the rep talked about anything, there is intelligence to capture.
- You may extract MULTIPLE signals from one conversation — capture everything meaningful.
- For each signal, assess confidence (0.0 to 1.0) based on how specific and actionable the intel is.
- Assign a sub-category label (e.g. "reorder intent", "competitor pricing", "delivery complaint").
- Suggest one concrete next step per signal.
- Also extract follow-up TASKS — concrete actions the rep committed to or should take.
- Assign task priority: high (do within 2 days), medium (within a week), low (within 2 weeks).

When the conversation feels complete, briefly confirm: "Here is what I captured — [brief summary]. Sound right?"
Then call the save_capture function ONCE with ALL extracted signals and tasks.

IMPORTANT: Always speak in English. Never switch to Spanish or any other language, even if the user speaks in another language. Respond in English only.`

const SAVE_CAPTURE_TOOL = {
  type: 'function' as const,
  name: 'save_capture',
  description: 'Save all extracted signals and follow-up tasks from the conversation. Call once at the end with everything.',
  parameters: {
    type: 'object',
    properties: {
      signals: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['demand', 'competitive', 'friction', 'expansion', 'relationship'],
              description: 'The signal type.',
            },
            description: {
              type: 'string',
              description: 'What was specifically observed (1-2 sentences).',
            },
            confidence: {
              type: 'number',
              description: 'Confidence level from 0.0 to 1.0.',
            },
            category: {
              type: 'string',
              description: 'Sub-category label within the signal type.',
            },
            suggestedAction: {
              type: 'string',
              description: 'One concrete next step for the rep.',
            },
          },
          required: ['type', 'description', 'confidence', 'category', 'suggestedAction'],
        },
        description: 'Array of signals extracted from the conversation.',
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
    required: ['signals', 'tasks'],
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
        voice: 'verse',
        instructions: SYSTEM_PROMPT,
        tools: [SAVE_CAPTURE_TOOL],
        tool_choice: 'auto',
        input_audio_transcription: {
          model: 'whisper-1',
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
