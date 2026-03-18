import { NextResponse } from 'next/server'
import { createServiceClient } from '@kosha/supabase/service'
import { getUser } from '@kosha/supabase'
import { getOrganizationId } from '@/lib/auth'

/**
 * POST /api/fix-visit-times
 *
 * Shifts all of today's visits to after 2pm EST so they aren't filtered out
 * by the "upcoming visits" query.
 */
export async function POST() {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const orgId = await getOrganizationId()
  if (!orgId) {
    return NextResponse.json({ error: 'No organization found' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Get today's date boundaries in UTC
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const startOfDay = `${todayStr}T00:00:00.000Z`
  const endOfDay = `${todayStr}T23:59:59.999Z`

  // Fetch today's visits
  const { data: visits, error: fetchError } = await supabase
    .from('visits')
    .select('id, visit_date, account_name')
    .eq('organization_id', orgId)
    .gte('visit_date', startOfDay)
    .lte('visit_date', endOfDay)
    .order('visit_date', { ascending: true })

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!visits || visits.length === 0) {
    return NextResponse.json({ message: 'No visits found for today', updated: 0 })
  }

  // Spread visits starting at 2pm EST (19:00 UTC) with 1-hour gaps
  const baseHourUTC = 19 // 2pm EST = 7pm UTC
  const updated: string[] = []

  for (let i = 0; i < visits.length; i++) {
    const newDate = new Date(`${todayStr}T00:00:00.000Z`)
    newDate.setUTCHours(baseHourUTC + i, 0, 0, 0)

    const { error: updateError } = await supabase
      .from('visits')
      .update({ visit_date: newDate.toISOString() })
      .eq('id', visits[i].id)

    if (!updateError) {
      updated.push(`${visits[i].account_name} → ${newDate.toISOString()}`)
    }
  }

  return NextResponse.json({
    success: true,
    updated: updated.length,
    visits: updated,
  })
}
