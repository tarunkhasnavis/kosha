import { getUser } from '@kosha/supabase'
import { getOrganizationId } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createClient } from '@kosha/supabase/server'
import { createAccountNote, updateAccountNote, deleteAccountNote } from '@/lib/accounts/actions'

/**
 * POST /api/capture/tools/manage-notes
 *
 * Add, update, or delete account notes.
 * Called by the voice agent when the LLM invokes the manage_notes tool.
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
  const { action, account_name, content, note_id } = body as {
    action?: 'add' | 'update' | 'delete'
    account_name?: string
    content?: string
    note_id?: string
  }

  if (!action) {
    return NextResponse.json({ error: 'action is required' }, { status: 400 })
  }

  if (!account_name) {
    return NextResponse.json({ error: 'account_name is required' }, { status: 400 })
  }

  const supabase = await createClient()

  if (action === 'add') {
    if (!content) {
      return NextResponse.json({ error: 'content is required for adding a note' }, { status: 400 })
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

    const result = await createAccountNote(accounts[0].id, content)
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      action: 'added',
      account_name: accounts[0].name,
      message: `Note added for ${accounts[0].name}.`,
    })
  }

  if (action === 'update') {
    if (!note_id) {
      return NextResponse.json({ error: 'note_id is required for update.' }, { status: 400 })
    }
    if (!content) {
      return NextResponse.json({ error: 'content is required for update.' }, { status: 400 })
    }

    const result = await updateAccountNote(note_id, content)
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      action: 'updated',
      message: 'Note updated.',
    })
  }

  if (action === 'delete') {
    if (!note_id) {
      return NextResponse.json({ error: 'note_id is required for deletion.' }, { status: 400 })
    }

    const result = await deleteAccountNote(note_id)
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      action: 'deleted',
      message: 'Note deleted.',
    })
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
}
