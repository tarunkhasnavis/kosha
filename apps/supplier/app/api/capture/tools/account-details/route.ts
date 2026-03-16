import { getUser } from '@kosha/supabase'
import { getOrganizationId } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { getAccounts, getAccountContacts, getAccountNotes } from '@/lib/accounts/queries'
import { getTasksForAccount } from '@/lib/tasks/queries'
import { getVisitsForAccount } from '@/lib/visits/queries'
import { getInsightsForAccount } from '@/lib/insights/queries'
import { formatAccountContext } from '@/lib/ai/compose-prompt'

/**
 * POST /api/capture/tools/account-details
 *
 * Called by the voice agent when the LLM invokes the get_account_details tool.
 * Finds a managed account by name and returns full context.
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

  const body = await request.json().catch(() => ({}))
  const { account_name } = body as { account_name?: string }

  if (!account_name) {
    return NextResponse.json({ error: 'account_name is required' }, { status: 400 })
  }

  // Search for matching account by name
  const { accounts } = await getAccounts({ search: account_name })

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({
      error: `No account found matching "${account_name}". Ask the rep to clarify the account name.`,
    })
  }

  const account = accounts[0]

  // Fetch full context in parallel
  const [contacts, notes, tasks, visits, insights] = await Promise.all([
    getAccountContacts(account.id),
    getAccountNotes(account.id),
    getTasksForAccount(account.id),
    getVisitsForAccount(account.id),
    getInsightsForAccount(account.id),
  ])

  const context = formatAccountContext({
    name: account.name,
    address: account.address,
    contacts: contacts.contacts?.slice(0, 5) || [],
    recentInsights: insights.insights?.slice(0, 5) || [],
    openTasks: tasks.tasks?.filter((t) => !t.completed).slice(0, 5) || [],
    recentNotes: notes.notes?.slice(0, 5) || [],
    lastVisit: visits.visits?.[0] || null,
  })

  return NextResponse.json({ account_id: account.id, context })
}
