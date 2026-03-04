import { createClient } from '@kosha/supabase/server'
import { createServiceClient } from '@kosha/supabase/service'
import { getUser } from '@kosha/supabase'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

/**
 * OAuth Callback Handler — Supplier App
 *
 * Uses supplier_profiles (separate from distributor's profiles table)
 * so the same email can be used across both apps independently.
 *
 * Flow:
 * 1. If invite_token cookie exists AND user is new → join existing org as rep
 * 2. If no invite AND user is new → create new org as admin → /onboarding
 * 3. If user already has a profile → /dashboard
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const serviceClient = createServiceClient()
    await supabase.auth.exchangeCodeForSession(code)

    const user = await getUser()

    if (user) {
      // Check if user already has a supplier profile
      const { data: profile } = await supabase
        .from('supplier_profiles')
        .select('id, organization_id')
        .eq('id', user.id)
        .single()

      if (!profile) {
        // New user — check for invite token
        const cookieStore = await cookies()
        const inviteToken = cookieStore.get('invite_token')?.value

        if (inviteToken) {
          // Invited user — join existing org as rep
          try {
            const { data: invite } = await serviceClient
              .from('org_invites')
              .select('id, organization_id, expires_at')
              .eq('token', inviteToken)
              .single()

            if (invite && new Date(invite.expires_at) > new Date()) {
              const { error: profileError } = await serviceClient
                .from('supplier_profiles')
                .upsert({
                  id: user.id,
                  email: user.email,
                  full_name: user.user_metadata?.full_name || user.user_metadata?.name,
                  organization_id: invite.organization_id,
                  role: 'rep',
                })

              if (profileError) {
                console.error('Failed to create supplier profile via invite:', profileError)
              }

              // Clear the invite token cookie
              const response = NextResponse.redirect(new URL('/dashboard', request.url))
              response.cookies.delete('invite_token')
              return response
            }

            // Invalid or expired invite — fall through to create new org
            console.error('Invite token invalid or expired:', inviteToken)
          } catch (error) {
            console.error('Error processing invite token:', error)
          }
        }

        // No invite (or invalid invite) — create new org and profile as admin
        try {
          const { data: newOrg, error: orgError } = await serviceClient
            .from('organizations')
            .insert({
              name: user.email || 'New Organization',
            })
            .select()
            .single()

          if (orgError || !newOrg) {
            console.error('Failed to create organization:', orgError)
            return NextResponse.redirect(new URL('/login?error=org_creation_failed', request.url))
          }

          const { error: profileError } = await serviceClient
            .from('supplier_profiles')
            .upsert({
              id: user.id,
              email: user.email,
              full_name: user.user_metadata?.full_name || user.user_metadata?.name,
              organization_id: newOrg.id,
              role: 'admin',
            })

          if (profileError) {
            console.error('Failed to create supplier profile:', profileError)
          }

          // New admin user — send to onboarding to set org name
          const response = NextResponse.redirect(new URL('/onboarding', request.url))
          response.cookies.delete('invite_token')
          return response
        } catch (error) {
          console.error('Error during new supplier user setup:', error)
          return NextResponse.redirect(new URL('/login?error=setup_failed', request.url))
        }
      }
    }
  }

  return NextResponse.redirect(new URL('/dashboard', request.url))
}
