import { getUser } from '@kosha/supabase'
import { getOrganizationId } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createClient } from '@kosha/supabase/server'
import { createAccount, deleteAccount } from '@/lib/accounts/actions'
import { claimDiscoveredAccount } from '@/lib/discovery/actions'
import type { PremiseType } from '@kosha/types'

/**
 * POST /api/capture/tools/manage-account
 *
 * Create, delete, or claim accounts.
 * Called by the voice agent when the LLM invokes the manage_account tool.
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
  const { action, account_name, address, premise_type, phone, account_id, discovered_account_id } = body as {
    action?: 'create' | 'delete' | 'claim'
    account_name?: string
    address?: string
    premise_type?: PremiseType
    phone?: string
    account_id?: string
    discovered_account_id?: string
  }

  if (!action) {
    return NextResponse.json({ error: 'action is required' }, { status: 400 })
  }

  if (!account_name) {
    return NextResponse.json({ error: 'account_name is required' }, { status: 400 })
  }

  if (action === 'create') {
    const result = await createAccount({
      name: account_name,
      address: address || undefined,
      premise_type: premise_type || undefined,
      phone: phone || undefined,
    })

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      action: 'created',
      account_id: result.account?.id,
      account_name: result.account?.name,
      message: `Account "${result.account?.name}" has been created.`,
    })
  }

  if (action === 'delete') {
    if (!account_id) {
      // Try to find by name
      const supabase = await createClient()
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, name')
        .eq('organization_id', orgId)
        .ilike('name', `%${account_name}%`)
        .limit(1)

      if (!accounts || accounts.length === 0) {
        return NextResponse.json({ error: `No account found matching "${account_name}".` })
      }

      const result = await deleteAccount(accounts[0].id)
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        action: 'deleted',
        account_name: accounts[0].name,
        message: `Account "${accounts[0].name}" has been deleted.`,
      })
    }

    const result = await deleteAccount(account_id)
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      action: 'deleted',
      account_name,
      message: `Account "${account_name}" has been deleted.`,
    })
  }

  if (action === 'claim') {
    if (!discovered_account_id) {
      return NextResponse.json({
        error: 'discovered_account_id is required for claiming. Use search_discovery_accounts to find the ID.',
      }, { status: 400 })
    }

    const result = await claimDiscoveredAccount(discovered_account_id)
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      action: 'claimed',
      account_id: result.account?.id,
      account_name: result.account?.name,
      message: `"${result.account?.name}" has been added to your accounts.`,
    })
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
}
