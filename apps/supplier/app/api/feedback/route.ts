import { getUser } from '@kosha/supabase'
import { getOrganizationId } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createClient } from '@kosha/supabase/server'

/**
 * POST /api/feedback
 *
 * Stores user feedback in the feedback table with user and org context.
 */
export async function POST(request: Request) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { message } = body as { message?: string }

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  }

  const orgId = await getOrganizationId()
  const supabase = await createClient()

  // Fetch org name if we have an org
  let orgName: string | null = null
  if (orgId) {
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', orgId)
      .single()
    orgName = org?.name || null
  }

  // Fetch user profile name
  let userName: string | null = null
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()
  userName = profile?.full_name || null

  const { error } = await supabase.from('feedback').insert({
    user_id: user.id,
    user_email: user.email || null,
    user_name: userName,
    organization_id: orgId || null,
    organization_name: orgName,
    message: message.trim(),
  })

  if (error) {
    console.error('Failed to save feedback:', error)
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
