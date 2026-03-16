import { getUser } from '@kosha/supabase'
import { getOrganizationId } from '@/lib/auth'
import { getOpenAI } from '@/lib/openai'
import { NextResponse } from 'next/server'
import { composePrompt, formatAccountContext, formatOrgContext } from '@/lib/ai/compose-prompt'
import { getAccounts, getAccount, getAccountContacts, getAccountNotes } from '@/lib/accounts/queries'
import { getTasksForAccount, getAllTasks } from '@/lib/tasks/queries'
import { getVisitsForAccount, getUpcomingVisits } from '@/lib/visits/queries'
import { getInsightsForAccount } from '@/lib/insights/queries'
import { createClient } from '@kosha/supabase/server'

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
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
  const { messages, accountId } = body as { messages: ChatMessage[]; accountId?: string }

  if (!messages || !Array.isArray(messages)) {
    return NextResponse.json({ error: 'Messages array is required' }, { status: 400 })
  }

  // Build org-wide context
  const [accountsResult, visitsResult, tasksResult] = await Promise.all([
    getAccounts(),
    getUpcomingVisits(),
    getAllTasks(),
  ])

  const orgContext = formatOrgContext({
    accounts: accountsResult.accounts.map((a) => ({ name: a.name, address: a.address })),
    upcomingVisits: visitsResult.visits.slice(0, 20).map((v) => ({
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

  let accountContext: string | undefined
  if (accountId) {
    accountContext = await buildAccountContext(accountId)
  }

  const systemPrompt = composePrompt({ accountContext, orgContext })

  const chatTools = [
    {
      type: 'function' as const,
      function: {
        name: 'schedule_visit',
        description: 'Schedule a follow-up visit to an account.',
        parameters: {
          type: 'object',
          properties: {
            account_name: { type: 'string', description: 'The name of the account to visit.' },
            visit_date: { type: 'string', description: 'ISO 8601 date string for the visit.' },
            notes: { type: 'string', description: 'Optional agenda or purpose for the visit.' },
          },
          required: ['account_name', 'visit_date'],
        },
      },
    },
  ]

  try {
    const openai = getOpenAI()
    const allMessages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_call_id?: string }> = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ]

    let response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: allMessages,
      tools: chatTools,
      tool_choice: 'auto',
      temperature: 0.6,
      max_tokens: 400,
    })

    let choice = response.choices[0]
    let scheduledVisit: { account_name: string; visit_date: string } | null = null

    // Handle tool calls (schedule_visit)
    if (choice?.finish_reason === 'tool_calls' && choice.message?.tool_calls) {
      for (const toolCall of choice.message.tool_calls) {
        if (toolCall.function.name === 'schedule_visit') {
          const args = JSON.parse(toolCall.function.arguments)
          const supabase = await createClient()

          // Find account
          const { data: accounts } = await supabase
            .from('accounts')
            .select('id, name')
            .eq('organization_id', orgId)
            .ilike('name', `%${args.account_name}%`)
            .limit(1)

          let toolResult: string
          if (accounts && accounts.length > 0) {
            const account = accounts[0]
            const { error: insertError } = await supabase
              .from('visits')
              .insert({
                user_id: user.id,
                organization_id: orgId,
                account_id: account.id,
                account_name: account.name,
                visit_date: args.visit_date,
                notes: args.notes?.trim() || null,
              })

            if (insertError) {
              toolResult = JSON.stringify({ error: 'Failed to schedule visit' })
            } else {
              scheduledVisit = { account_name: account.name, visit_date: args.visit_date }
              toolResult = JSON.stringify({
                success: true,
                account_name: account.name,
                visit_date: args.visit_date,
                message: `Visit scheduled for ${account.name} on ${new Date(args.visit_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.`,
              })
            }
          } else {
            toolResult = JSON.stringify({ error: `No account found matching "${args.account_name}"` })
          }

          // Send tool result back and get final response
          allMessages.push(choice.message as { role: 'assistant'; content: string })
          allMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: toolResult,
          })
        }
      }

      // Get the follow-up response after tool execution
      response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: allMessages,
        temperature: 0.6,
        max_tokens: 400,
      })
      choice = response.choices[0]
    }

    const content = choice?.message?.content
    if (!content) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
    }

    const isComplete = content.includes('[CAPTURE_COMPLETE]') || content.includes('[NOTE_SAVED]')
    const cleanContent = content
      .replace('[CAPTURE_COMPLETE]', '')
      .replace('[NOTE_SAVED]', '')
      .trim()

    return NextResponse.json({
      message: cleanContent,
      isComplete,
      ...(scheduledVisit && { scheduledVisit }),
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Failed to get AI response' },
      { status: 500 }
    )
  }
}
