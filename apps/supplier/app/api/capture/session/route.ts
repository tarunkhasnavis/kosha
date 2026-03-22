import { getUser } from '@kosha/supabase'
import { createClient } from '@kosha/supabase/server'
import { getOrganizationId } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { composePrompt, formatAccountContext, formatOrgContext } from '@/lib/ai/compose-prompt'
import { getAccounts, getAccountContacts, getAccountNotes, getAccount } from '@/lib/accounts/queries'
import { getTasksForAccount } from '@/lib/tasks/queries'
import { getAllTasks } from '@/lib/tasks/queries'
import { getVisitsForAccount } from '@/lib/visits/queries'
import { getUpcomingVisits } from '@/lib/visits/queries'
import { getVisitsForDate } from '@/lib/visits/queries'
import { getInsightsForAccount } from '@/lib/insights/queries'

const SET_SKILL_MODE_TOOL = {
  type: 'function' as const,
  name: 'set_skill_mode',
  description:
    'Lock in the conversation skill mode. Call this IMMEDIATELY in your first response after determining what the rep wants to do. This controls the UI behavior (banners, save flow, review screen). You MUST call this before doing anything else.',
  parameters: {
    type: 'object',
    properties: {
      mode: {
        type: 'string',
        enum: ['prep', 'note', 'debrief', 'discovery'],
        description: 'The skill mode: prep (pre-visit briefing), note (quick facts), debrief (post-visit structured capture), discovery (prospecting/research).',
      },
    },
    required: ['mode'],
  },
}

const SET_ACTIVE_ACCOUNT_TOOL = {
  type: 'function' as const,
  name: 'set_active_account',
  description:
    'Set the active account for this conversation. Call this IMMEDIATELY when the rep mentions an account by name and no account was pre-selected. This links the conversation data (insights, tasks, notes) to the correct account.',
  parameters: {
    type: 'object',
    properties: {
      account_name: {
        type: 'string',
        description: 'The account name the rep mentioned. Must match a known account.',
      },
    },
    required: ['account_name'],
  },
}

const SEARCH_DISCOVERY_TOOL = {
  type: 'function' as const,
  name: 'search_discovery_accounts',
  description:
    'Search for prospective (discovered) accounts not yet in the rep\'s book. Use when the rep asks about new leads, prospects, accounts to go after, or territory expansion opportunities.',
  parameters: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        enum: ['bar', 'restaurant', 'liquor_store', 'brewery', 'hotel', 'convenience_store'],
        description: 'Filter by venue category.',
      },
      limit: {
        type: 'number',
        description: 'Max results to return. Default 10.',
      },
    },
    required: [],
  },
}

const GET_ACCOUNT_DETAILS_TOOL = {
  type: 'function' as const,
  name: 'get_account_details',
  description:
    'Fetch full details for a managed account by name — contacts, recent insights, open tasks, notes, last visit. Use when the rep asks about a specific existing account mid-conversation.',
  parameters: {
    type: 'object',
    properties: {
      account_name: {
        type: 'string',
        description: 'The account name to look up. Must match a known account.',
      },
    },
    required: ['account_name'],
  },
}

const MANAGE_VISITS_TOOL = {
  type: 'function' as const,
  name: 'manage_visits',
  description:
    'Manage visits/stops on the route. Actions: "schedule" (add a stop), "delete" (remove a stop), "move" (reschedule — deletes old, creates new). "Stops" and "visits" are synonymous. Requires explicit confirmation. For delete/move, get the visit_id from get_route_info first.',
  parameters: {
    type: 'object',
    strict: true,
    properties: {
      action: {
        type: 'string',
        enum: ['schedule', 'delete', 'move'],
        description: 'The action to perform.',
      },
      account_name: {
        type: 'string',
        description: 'Account name for the visit.',
      },
      visit_date: {
        type: 'string',
        description: 'ISO 8601 date. For "move": the NEW date. Infer from "next week", "tomorrow", etc.',
      },
      visit_id: {
        type: 'string',
        description: 'ID of existing visit (for delete/move). Get from get_route_info.',
      },
      notes: {
        type: 'string',
        description: 'Purpose of the visit. Infer from context.',
      },
    },
    required: ['action', 'account_name'],
    additionalProperties: false,
  },
}

const GET_ROUTE_INFO_TOOL = {
  type: 'function' as const,
  name: 'get_route_info',
  description:
    'Get the route (list of stops/visits) for a date. Returns visit IDs, account names, times. Use when rep asks about their route, stops, schedule, or "where am I going today?".',
  parameters: {
    type: 'object',
    strict: true,
    properties: {
      date: {
        type: 'string',
        description: 'ISO date (YYYY-MM-DD). Default to today if not specified.',
      },
    },
    required: ['date'],
    additionalProperties: false,
  },
}

const MANAGE_ACCOUNT_TOOL = {
  type: 'function' as const,
  name: 'manage_account',
  description:
    'Create, delete, or claim accounts. "claim" converts a discovered prospect into a managed account. Requires explicit confirmation.',
  parameters: {
    type: 'object',
    strict: true,
    properties: {
      action: {
        type: 'string',
        enum: ['create', 'delete', 'claim'],
      },
      account_name: {
        type: 'string',
        description: 'Name of the account.',
      },
      address: {
        type: 'string',
        description: 'Address (for create).',
      },
      premise_type: {
        type: 'string',
        enum: ['on_premise', 'off_premise', 'hybrid'],
        description: 'Venue type (for create).',
      },
      phone: {
        type: 'string',
        description: 'Phone number (for create).',
      },
      account_id: {
        type: 'string',
        description: 'ID of account to delete.',
      },
      discovered_account_id: {
        type: 'string',
        description: 'ID of discovered account to claim. Get from search_discovery_accounts.',
      },
    },
    required: ['action', 'account_name'],
    additionalProperties: false,
  },
}

const MANAGE_TASK_TOOL = {
  type: 'function' as const,
  name: 'manage_task',
  description:
    'Create, update, delete, or complete tasks for an account. For create: infer priority and due date from context. For complete: mark a task as done. Get task_id from get_account_details.',
  parameters: {
    type: 'object',
    strict: true,
    properties: {
      action: {
        type: 'string',
        enum: ['create', 'update', 'delete', 'complete'],
      },
      account_name: {
        type: 'string',
        description: 'Account the task belongs to.',
      },
      task: {
        type: 'string',
        description: 'Task description (for create/update).',
      },
      priority: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
      },
      due_date: {
        type: 'string',
        description: 'ISO date for due date.',
      },
      task_id: {
        type: 'string',
        description: 'ID of existing task (for update/delete/complete).',
      },
    },
    required: ['action', 'account_name'],
    additionalProperties: false,
  },
}

const MANAGE_NOTES_TOOL = {
  type: 'function' as const,
  name: 'manage_notes',
  description:
    'Add, update, or delete notes for an account. For add: no confirmation needed. For update/delete: get note_id from get_account_details.',
  parameters: {
    type: 'object',
    strict: true,
    properties: {
      action: {
        type: 'string',
        enum: ['add', 'update', 'delete'],
      },
      account_name: {
        type: 'string',
      },
      content: {
        type: 'string',
        description: 'Note content (for add/update).',
      },
      note_id: {
        type: 'string',
        description: 'ID of note to update/delete.',
      },
    },
    required: ['action', 'account_name'],
    additionalProperties: false,
  },
}

const MANAGE_CONTACTS_TOOL = {
  type: 'function' as const,
  name: 'manage_contacts',
  description:
    'Add, update, or delete contacts for an account. For add: no confirmation needed. For update/delete: get contact_id from get_account_details.',
  parameters: {
    type: 'object',
    strict: true,
    properties: {
      action: {
        type: 'string',
        enum: ['add', 'update', 'delete'],
      },
      account_name: {
        type: 'string',
      },
      contact_name: {
        type: 'string',
        description: 'Name of the contact.',
      },
      role: {
        type: 'string',
        description: 'Job title or role.',
      },
      phone: {
        type: 'string',
        description: 'Phone number.',
      },
      email: {
        type: 'string',
        description: 'Email address.',
      },
      contact_id: {
        type: 'string',
        description: 'ID of contact to update/delete.',
      },
    },
    required: ['action', 'account_name'],
    additionalProperties: false,
  },
}

const SAVE_CAPTURE_TOOL = {
  type: 'function' as const,
  name: 'save_capture',
  description: 'Save conversation data. Call ONLY after the rep confirms ("yes", "save it", "that\'s good"). For debrief: include summary, insights, tasks. For note: include notes array. For prep: no data fields needed.',
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

  // Fetch user profile + org name for personalization
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('supplier_profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', orgId)
    .single()

  // Build org-wide context (accounts list, upcoming visits, pending tasks)
  // Use start of today (not "now") so visits earlier today aren't excluded
  const todayStr = new Date().toISOString().split('T')[0]
  const [accountsResult, todayVisitsResult, upcomingVisitsResult, tasksResult] = await Promise.all([
    getAccounts(),
    getVisitsForDate(todayStr),
    getUpcomingVisits(),
    getAllTasks(),
  ])

  // Merge today's visits with upcoming, deduplicate by id
  const seenIds = new Set<string>()
  const allVisits = [...todayVisitsResult.visits, ...upcomingVisitsResult.visits].filter((v) => {
    if (seenIds.has(v.id)) return false
    seenIds.add(v.id)
    return true
  })

  const orgContext = formatOrgContext({
    accounts: accountsResult.accounts.map((a) => ({ name: a.name, address: a.address })),
    upcomingVisits: allVisits.slice(0, 30).map((v) => ({
      account_name: v.account_name,
      visit_date: v.visit_date,
      notes: v.notes,
    })),
    pendingTasks: tasksResult.tasks
      .filter((t) => !t.completed)
      .slice(0, 20)
      .map((t) => ({
        account_name: t.account_name,
        task: t.task,
        priority: t.priority,
        due_date: t.due_date,
      })),
  })

  // Build account-specific context if an account is selected
  let accountContext: string | undefined
  if (accountId) {
    accountContext = await buildAccountContext(accountId)
  }

  // Build user context for personalization
  const firstName = profile?.full_name?.split(' ')[0] || null
  const userContext = firstName
    ? `You are speaking with ${firstName}${profile?.role ? `, a ${profile.role}` : ''}${org?.name ? ` at ${org.name}` : ''}. Address them by their first name.`
    : undefined

  const now = new Date()
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' })
  const dateStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const timeContext = `Today is ${dayOfWeek}, ${dateStr}.`

  const systemPrompt = composePrompt({ accountContext, orgContext, userContext, timeContext })

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
        tools: [SAVE_CAPTURE_TOOL, SET_SKILL_MODE_TOOL, SET_ACTIVE_ACCOUNT_TOOL, MANAGE_VISITS_TOOL, GET_ROUTE_INFO_TOOL, SEARCH_DISCOVERY_TOOL, GET_ACCOUNT_DETAILS_TOOL, MANAGE_ACCOUNT_TOOL, MANAGE_TASK_TOOL, MANAGE_NOTES_TOOL, MANAGE_CONTACTS_TOOL],
        tool_choice: 'auto',
        input_audio_transcription: {
          model: 'whisper-1',
        },
        temperature: 0.6,
        max_response_output_tokens: 1200,
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
