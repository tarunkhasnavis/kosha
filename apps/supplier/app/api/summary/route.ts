import { getUser } from '@kosha/supabase'
import { getOrganizationId } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { getVisitsForDate } from '@/lib/visits/queries'
import { getInsightsForDate } from '@/lib/insights/queries'
import { getTasksForDate } from '@/lib/tasks/queries'

/**
 * GET /api/summary?date=YYYY-MM-DD
 *
 * Returns daily summary data: visits, insights, and tasks for a specific date.
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

  const [visitsResult, insightsResult, tasksResult] = await Promise.all([
    getVisitsForDate(date),
    getInsightsForDate(date),
    getTasksForDate(date),
  ])

  return NextResponse.json({
    date,
    visits: visitsResult.visits,
    insights: insightsResult.insights,
    tasks: tasksResult.tasks,
  })
}
