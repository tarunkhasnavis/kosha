import { getUser } from '@kosha/supabase'
import { getOrganizationId } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { getVisitsForDate } from '@/lib/visits/queries'

/**
 * POST /api/capture/tools/route-info
 *
 * Returns the route (list of stops/visits) for a given date.
 * Called by the voice agent when the LLM invokes the get_route_info tool.
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
  const { date } = body as { date?: string }

  if (!date) {
    return NextResponse.json({ error: 'date is required (YYYY-MM-DD format)' }, { status: 400 })
  }

  const result = await getVisitsForDate(date)

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  const stops = result.visits.map((v) => ({
    visit_id: v.id,
    account_name: v.account_name,
    address: v.account?.address || null,
    visit_date: v.visit_date,
    notes: v.notes,
  }))

  const dateFormatted = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return NextResponse.json({
    date,
    date_formatted: dateFormatted,
    stop_count: stops.length,
    stops,
    message: stops.length === 0
      ? `No stops scheduled for ${dateFormatted}.`
      : `${stops.length} stop${stops.length === 1 ? '' : 's'} scheduled for ${dateFormatted}: ${stops.map((s) => s.account_name).join(', ')}.`,
  })
}
