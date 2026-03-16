import { getUser } from '@kosha/supabase'
import { getOrganizationId } from '@/lib/auth'
import { getOpenAI } from '@/lib/openai'
import { NextResponse } from 'next/server'
import { composePrompt, formatAccountContext } from '@/lib/ai/compose-prompt'
import { getAccount, getAccountContacts, getAccountNotes } from '@/lib/accounts/queries'
import { getTasksForAccount } from '@/lib/tasks/queries'
import { getVisitsForAccount } from '@/lib/visits/queries'
import { getInsightsForAccount } from '@/lib/insights/queries'

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

  let accountContext: string | undefined
  if (accountId) {
    accountContext = await buildAccountContext(accountId)
  }

  const systemPrompt = composePrompt({ accountContext })

  try {
    const openai = getOpenAI()
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      temperature: 0.6,
      max_tokens: 400,
    })

    const content = response.choices[0]?.message?.content
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
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Failed to get AI response' },
      { status: 500 }
    )
  }
}
