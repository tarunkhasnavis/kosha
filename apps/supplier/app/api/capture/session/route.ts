import { getUser } from '@kosha/supabase'
import { getOrganizationId } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { composePrompt, formatAccountContext } from '@/lib/ai/compose-prompt'
import { getAccount, getAccountContacts, getAccountNotes } from '@/lib/accounts/queries'
import { getTasksForAccount } from '@/lib/tasks/queries'
import { getVisitsForAccount } from '@/lib/visits/queries'
import { getInsightsForAccount } from '@/lib/insights/queries'

const SAVE_CAPTURE_TOOL = {
  type: 'function' as const,
  name: 'save_capture',
  description: 'Save the conversation outputs. Call once at the end after the rep confirms.',
  parameters: {
    type: 'object',
    properties: {
      mode: {
        type: 'string',
        enum: ['debrief', 'note', 'prep'],
        description: 'The conversation mode: debrief (post-visit with insights/tasks), note (quick account notes), or prep (pre-visit briefing).',
      },
      summary: {
        type: 'string',
        description: 'A 2-4 sentence summary of the conversation. Required for debrief mode.',
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
        description: 'Array of insights extracted from the conversation. Used in debrief mode.',
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
        description: 'Array of follow-up tasks. Used in debrief mode.',
      },
      notes: {
        type: 'array',
        items: {
          type: 'string',
        },
        description: 'Array of note strings to save. Used in note mode.',
      },
    },
    required: ['mode'],
  },
}

async function buildAccountContext(accountId: string): Promise<string | undefined> {
  try {
    const [account, contacts, notes, tasks, visits, insights] = await Promise.all([
      getAccount(accountId),
      getAccountContacts(accountId),
      getAccountNotes(accountId),
      getTasksForAccount(accountId),
      getVisitsForAccount(accountId),
      getInsightsForAccount(accountId),
    ])

    if (!account) return undefined

    return formatAccountContext({
      name: account.name,
      address: account.address,
      contacts: contacts?.slice(0, 5) || [],
      recentInsights: insights?.slice(0, 5) || [],
      openTasks: tasks?.filter((t) => !t.completed).slice(0, 5) || [],
      recentNotes: notes?.slice(0, 5) || [],
      lastVisit: visits?.[0] || null,
    })
  } catch (err) {
    console.error('Failed to build account context:', err)
    return undefined
  }
}

/**
 * POST /api/capture/session
 *
 * Creates an ephemeral token for the OpenAI Realtime API.
 * The client uses this token to establish a direct WebRTC connection to OpenAI.
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

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
  }

  const body = await request.json().catch(() => ({}))
  const { accountId } = body as { accountId?: string }

  let accountContext: string | undefined
  if (accountId) {
    accountContext = await buildAccountContext(accountId)
  }

  const systemPrompt = composePrompt({ accountContext })

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
        instructions: systemPrompt,
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
          eagerness: 'medium',
          create_response: true,
          interrupt_response: false,
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
