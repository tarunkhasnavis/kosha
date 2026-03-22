import { getUser } from '@kosha/supabase'
import { getOrganizationId } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createClient } from '@kosha/supabase/server'
import { createAccountContact, updateAccountContact, deleteAccountContact } from '@/lib/accounts/actions'

/**
 * POST /api/capture/tools/manage-contacts
 *
 * Add, update, or delete account contacts.
 * Called by the voice agent when the LLM invokes the manage_contacts tool.
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
  const { action, account_name, contact_name, role, phone, email, contact_id } = body as {
    action?: 'add' | 'update' | 'delete'
    account_name?: string
    contact_name?: string
    role?: string
    phone?: string
    email?: string
    contact_id?: string
  }

  if (!action) {
    return NextResponse.json({ error: 'action is required' }, { status: 400 })
  }

  if (!account_name) {
    return NextResponse.json({ error: 'account_name is required' }, { status: 400 })
  }

  const supabase = await createClient()

  if (action === 'add') {
    if (!contact_name) {
      return NextResponse.json({ error: 'contact_name is required for adding a contact' }, { status: 400 })
    }

    // Find the account by name
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id, name')
      .eq('organization_id', orgId)
      .ilike('name', `%${account_name}%`)
      .limit(1)

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ error: `No account found matching "${account_name}".` })
    }

    const result = await createAccountContact(accounts[0].id, {
      name: contact_name,
      role: role || undefined,
      phone: phone || undefined,
      email: email || undefined,
    })

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      action: 'added',
      account_name: accounts[0].name,
      contact_name,
      message: `Contact "${contact_name}" added to ${accounts[0].name}.`,
    })
  }

  if (action === 'update') {
    if (!contact_id) {
      return NextResponse.json({ error: 'contact_id is required for update.' }, { status: 400 })
    }

    const result = await updateAccountContact(contact_id, {
      name: contact_name || undefined,
      role: role || undefined,
      phone: phone || undefined,
      email: email || undefined,
    })

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      action: 'updated',
      message: 'Contact updated.',
    })
  }

  if (action === 'delete') {
    if (!contact_id) {
      return NextResponse.json({ error: 'contact_id is required for deletion.' }, { status: 400 })
    }

    const result = await deleteAccountContact(contact_id)
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      action: 'deleted',
      message: 'Contact deleted.',
    })
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
}
