import { getUser } from '@kosha/supabase'
import { getOrganizationId } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createClient } from '@kosha/supabase/server'

/**
 * POST /api/capture/tools/set-active-account
 *
 * Called by the voice agent when the LLM invokes set_active_account.
 * Resolves an account name to an ID so the client can associate the conversation.
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

  const supabase = await createClient()

  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, name')
    .eq('organization_id', orgId)
    .ilike('name', `%${account_name}%`)
    .limit(5)

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({
      error: `No account found matching "${account_name}". Ask the rep to clarify.`,
    })
  }

  // If multiple matches, return the closest one
  const account = accounts[0]

  return NextResponse.json({
    success: true,
    account_id: account.id,
    account_name: account.name,
  })
}
