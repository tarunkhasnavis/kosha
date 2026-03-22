import { getUser } from '@kosha/supabase'
import { getOrganizationId } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createClient } from '@kosha/supabase/server'
import { createVisit, deleteVisit } from '@/lib/visits/actions'

/**
 * POST /api/capture/tools/manage-visits
 *
 * Unified visit management: schedule, delete, or move visits.
 * Called by the voice agent when the LLM invokes the manage_visits tool.
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
  const { action, account_name, visit_date, visit_id, notes } = body as {
    action?: 'schedule' | 'delete' | 'move'
    account_name?: string
    visit_date?: string
    visit_id?: string
    notes?: string
  }

  if (!action) {
    return NextResponse.json({ error: 'action is required' }, { status: 400 })
  }

  if (!account_name) {
    return NextResponse.json({ error: 'account_name is required' }, { status: 400 })
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
      error: `No account found matching "${account_name}". Ask the rep to clarify.`,
    })
  }

  const account = accounts[0]

  if (action === 'schedule') {
    if (!visit_date) {
      return NextResponse.json({ error: 'visit_date is required for scheduling' }, { status: 400 })
    }

    const result = await createVisit({
      account_id: account.id,
      account_name: account.name,
      visit_date,
      notes: notes?.trim() || undefined,
    })

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      action: 'scheduled',
      visit_id: result.visit?.id,
      account_name: account.name,
      visit_date,
      message: `Visit scheduled for ${account.name} on ${new Date(visit_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.`,
    })
  }

  if (action === 'delete') {
    if (!visit_id) {
      return NextResponse.json({ error: 'visit_id is required for deletion. Use get_route_info to find the visit ID.' }, { status: 400 })
    }

    const result = await deleteVisit(visit_id)
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      action: 'deleted',
      account_name: account.name,
      message: `Visit to ${account.name} has been removed.`,
    })
  }

  if (action === 'move') {
    if (!visit_id) {
      return NextResponse.json({ error: 'visit_id is required for moving. Use get_route_info to find the visit ID.' }, { status: 400 })
    }
    if (!visit_date) {
      return NextResponse.json({ error: 'visit_date (new date) is required for moving' }, { status: 400 })
    }

    // Delete old visit
    const deleteResult = await deleteVisit(visit_id)
    if (deleteResult.error) {
      return NextResponse.json({ error: deleteResult.error }, { status: 500 })
    }

    // Create new visit
    const createResult = await createVisit({
      account_id: account.id,
      account_name: account.name,
      visit_date,
      notes: notes?.trim() || undefined,
    })

    if (createResult.error) {
      return NextResponse.json({ error: createResult.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      action: 'moved',
      visit_id: createResult.visit?.id,
      account_name: account.name,
      visit_date,
      message: `Visit to ${account.name} moved to ${new Date(visit_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.`,
    })
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
}
