import { getUser } from '@kosha/supabase'
import { getOrganizationId } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { getVisitsForDate } from '@/lib/visits/queries'
import { getInsightsForDate } from '@/lib/insights/queries'
import { getTasksForDate } from '@/lib/tasks/queries'
import { getAccounts } from '@/lib/accounts/queries'

/**
 * GET /api/summary?date=YYYY-MM-DD
 *
 * Returns daily summary data: visits, insights, and tasks for a specific date.
 * Includes distributor_name for each item (looked up from the account).
 * Used by the territory map's daily summary sheet.
 */
export async function GET(request: Request) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const orgId = await getOrganizationId()
  if (!orgId) {
    return NextResponse.json({ error: 'No organization found' }, { status: 403 })
  }

  const url = new URL(request.url)
  const date = url.searchParams.get('date')

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date query param required (YYYY-MM-DD)' }, { status: 400 })
  }

  const [visitsResult, insightsResult, tasksResult, accountsResult] = await Promise.all([
    getVisitsForDate(date),
    getInsightsForDate(date),
    getTasksForDate(date),
    getAccounts(),
  ])

  // Build distributor lookup by account name and ID
  const distributorByName = new Map<string, string>()
  const distributorById = new Map<string, string>()
  for (const a of accountsResult.accounts) {
    if (a.distributor_name) {
      distributorByName.set(a.name, a.distributor_name)
      distributorById.set(a.id, a.distributor_name)
    }
  }

  // Attach distributor to each item
  const visits = visitsResult.visits.map((v) => ({
    ...v,
    distributor_name: distributorById.get(v.account_id) || distributorByName.get(v.account_name) || null,
  }))

  const insights = insightsResult.insights.map((i) => ({
    ...i,
    distributor_name: distributorById.get(i.account_id) || distributorByName.get(i.account_name) || null,
  }))

  const tasks = tasksResult.tasks.map((t) => ({
    ...t,
    distributor_name: distributorById.get(t.account_id) || distributorByName.get(t.account_name) || null,
  }))

  return NextResponse.json({ date, visits, insights, tasks })
}
