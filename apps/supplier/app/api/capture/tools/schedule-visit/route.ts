import { getUser } from '@kosha/supabase'
import { getOrganizationId } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createClient } from '@kosha/supabase/server'

/**
 * POST /api/capture/tools/schedule-visit
 *
 * Called by the voice/chat agent when the LLM invokes the schedule_visit tool.
 * Finds the account by name and creates a visit record.
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
  const { account_name, visit_date, notes } = body as {
    account_name?: string
    visit_date?: string
    notes?: string
  }

  if (!account_name) {
    return NextResponse.json({ error: 'account_name is required' }, { status: 400 })
  }

  if (!visit_date) {
    return NextResponse.json({ error: 'visit_date is required' }, { status: 400 })
  }

  const supabase = await createClient()

  // Find the account by name
  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, name')
    .eq('organization_id', orgId)
    .ilike('name', `%${account_name}%`)
    .limit(1)

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({
      error: `No account found matching "${account_name}". Ask the rep to clarify the account name.`,
    })
  }

  const account = accounts[0]

  // Create the visit
  const { data: visit, error } = await supabase
    .from('visits')
    .insert({
      user_id: user.id,
      organization_id: orgId,
      account_id: account.id,
      account_name: account.name,
      visit_date,
      notes: notes?.trim() || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create visit:', error)
    return NextResponse.json({ error: 'Failed to schedule visit' }, { status: 500 })
  }

  // Update last_contact if visit is today or past
  const visitDateObj = new Date(visit_date)
  const today = new Date()
  today.setHours(23, 59, 59, 999)

  if (visitDateObj <= today) {
    await supabase
      .from('accounts')
      .update({ last_contact: visit_date })
      .eq('id', account.id)
  }

  return NextResponse.json({
    success: true,
    visit_id: visit.id,
    account_name: account.name,
    visit_date,
    message: `Visit scheduled for ${account.name} on ${new Date(visit_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.`,
  })
}
