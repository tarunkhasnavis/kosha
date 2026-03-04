import { createClient } from '@kosha/supabase/server'
import { createServiceClient } from '@kosha/supabase/service'
import { getUser } from '@kosha/supabase'
import { NextResponse } from 'next/server'
import { storeOAuthTokens } from '@/lib/organizations/oauth'
import { startGmailWatch } from '@/lib/email/gmail/watch'
import { syncEmailsFromDaysBack } from '@/lib/email/gmail/sync'
import { getOnboardingSession } from '@/lib/onboarding/actions'

/**
 * OAuth Callback Handler
 *
 * ARCHITECTURE: Create organization immediately during OAuth callback
 * This ensures OAuth tokens are NEVER lost - they go directly from Google to the organization.
 *
 * Flow for NEW users:
 * 1. Exchange code for session (get OAuth tokens from Google)
 * 2. Create organization immediately (with placeholder name)
 * 3. Store OAuth tokens directly in organization
 * 4. Create profile linked to organization
 * 5. Start Gmail watch
 * 6. Redirect to onboarding (to collect org name, products, etc.)
 *
 * Flow for EXISTING users:
 * 1. Exchange code for session
 * 2. Refresh OAuth tokens in their existing organization
 * 3. Redirect to orders (or onboarding if incomplete)
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const serviceClient = createServiceClient()
    const { data: sessionData } = await supabase.auth.exchangeCodeForSession(code)

    // Debug: Check what tokens we're receiving
    console.log('=== OAuth Callback ===')
    console.log('Has provider_token:', !!sessionData?.session?.provider_token)
    console.log('Has provider_refresh_token:', !!sessionData?.session?.provider_refresh_token)
    console.log('======================')

    const user = await getUser()

    if (user) {
      // Check if user already has a profile with organization
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      // =========================================================================
      // NEW USER: Create organization immediately and store tokens
      // =========================================================================
      if (!profile || !profile.organization_id) {
        console.log('New user or user without org - creating organization immediately')

        // Verify we have OAuth tokens (required for Gmail sync)
        if (!sessionData?.session?.provider_token || !sessionData?.session?.provider_refresh_token) {
          console.error('❌ CRITICAL: No OAuth tokens received from Google')
          // Redirect to login with error - user needs to re-authenticate
          return NextResponse.redirect(new URL('/login?error=oauth_tokens_missing', request.url))
        }

        try {
          // 1. Create organization with email as temporary name
          // User MUST set proper name in onboarding Stage 1 (enforced by session state)
          const { data: newOrg, error: orgError } = await serviceClient
            .from('organizations')
            .insert({
              name: user.email || 'New Organization',
              gmail_email: user.email,
            })
            .select()
            .single()

          if (orgError || !newOrg) {
            console.error('Failed to create organization:', orgError)
            return NextResponse.redirect(new URL('/login?error=org_creation_failed', request.url))
          }

          console.log('✅ Organization created:', newOrg.id)

          // 2. Store OAuth tokens directly in organization (no pending tokens!)
          const expiresIn = sessionData.session.expires_in || 3600
          const expiresAt = new Date(Date.now() + expiresIn * 1000)

          await storeOAuthTokens(newOrg.id, {
            accessToken: sessionData.session.provider_token,
            refreshToken: sessionData.session.provider_refresh_token,
            expiresAt,
          })

          console.log('✅ OAuth tokens stored in organization')

          // 3. Create or update profile with organization_id
          const { error: profileError } = await serviceClient
            .from('profiles')
            .upsert({
              id: user.id,
              email: user.email,
              full_name: user.user_metadata?.full_name || user.user_metadata?.name,
              organization_id: newOrg.id,
              role: 'owner',
            })

          if (profileError) {
            console.error('Failed to create/update profile:', profileError)
            // Don't fail - org and tokens are stored, profile can be fixed later
          } else {
            console.log('✅ Profile created/updated with organization')
          }

          // 4. Start Gmail watch
          const watchResult = await startGmailWatch(newOrg.id)
          if (watchResult) {
            console.log('✅ Gmail watch started')
          } else {
            console.error('⚠️ Failed to start Gmail watch - emails will not sync in real-time')
          }

          // 5. Redirect to onboarding to complete setup
          return NextResponse.redirect(new URL('/onboarding', request.url))

        } catch (error) {
          console.error('Error during new user setup:', error)
          return NextResponse.redirect(new URL('/login?error=setup_failed', request.url))
        }
      }

      // =========================================================================
      // EXISTING USER: Refresh tokens and redirect appropriately
      // =========================================================================
      console.log('Existing user with org:', profile.organization_id)

      // Check if user has incomplete onboarding
      const { session: onboardingSession } = await getOnboardingSession()
      if (onboardingSession && onboardingSession.currentStage !== 'complete') {
        // Refresh tokens even for incomplete onboarding
        if (sessionData?.session?.provider_token && sessionData?.session?.provider_refresh_token) {
          try {
            const expiresIn = sessionData.session.expires_in || 3600
            const expiresAt = new Date(Date.now() + expiresIn * 1000)

            await storeOAuthTokens(profile.organization_id, {
              accessToken: sessionData.session.provider_token,
              refreshToken: sessionData.session.provider_refresh_token,
              expiresAt,
            })
            console.log('✅ Refreshed OAuth tokens for existing user')
          } catch (error) {
            console.error('Failed to refresh OAuth tokens:', error)
          }
        }
        return NextResponse.redirect(new URL('/onboarding', request.url))
      }

      // Refresh OAuth tokens for fully onboarded users
      if (sessionData?.session?.provider_token && sessionData?.session?.provider_refresh_token) {
        try {
          const expiresIn = sessionData.session.expires_in || 3600
          const expiresAt = new Date(Date.now() + expiresIn * 1000)

          await storeOAuthTokens(profile.organization_id, {
            accessToken: sessionData.session.provider_token,
            refreshToken: sessionData.session.provider_refresh_token,
            expiresAt,
          })

          // Refresh Gmail watch
          const watchResult = await startGmailWatch(profile.organization_id)
          if (watchResult) {
            console.log('✅ Gmail watch refreshed')
          }

          // Catch-up sync: Process any emails missed while token was invalid
          // Calculate actual gap from last sync instead of hardcoded 7 days
          const { data: orgData } = await serviceClient
            .from('organizations')
            .select('gmail_last_synced_at')
            .eq('id', profile.organization_id)
            .single()

          const lastSynced = orgData?.gmail_last_synced_at
            ? new Date(orgData.gmail_last_synced_at)
            : null
          const msGap = lastSynced
            ? Date.now() - lastSynced.getTime()
            : 7 * 24 * 60 * 60 * 1000
          const daysBack = Math.min(Math.ceil(msGap / (24 * 60 * 60 * 1000)), 30)

          // Await the catch-up sync before redirecting
          // Dangling promises get killed on Vercel when the response is sent
          try {
            const syncResult = await syncEmailsFromDaysBack(profile.organization_id, daysBack, 50)
            if (syncResult.processed > 0) {
              console.log(`✅ Catch-up sync: processed ${syncResult.processed} missed emails (${daysBack} days back)`)
            }
            if (syncResult.errors.length > 0) {
              console.error('⚠️ Catch-up sync errors:', syncResult.errors)
            }
          } catch (syncError) {
            console.error('⚠️ Catch-up sync failed:', syncError)
          }
        } catch (error) {
          console.error('Failed to store OAuth tokens during login:', error)
          // Don't fail the login
        }
      }
    }
  }

  // User has organization and completed onboarding - redirect to orders
  return NextResponse.redirect(new URL('/orders', request.url))
}
