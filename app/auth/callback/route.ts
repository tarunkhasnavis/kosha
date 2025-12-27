import { createClient } from '@/utils/supabase/server'
import { getUser } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { storeOAuthTokens } from '@/lib/organizations/oauth'
import { startGmailWatch } from '@/lib/email/gmail/watch'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { data: sessionData } = await supabase.auth.exchangeCodeForSession(code)

    // Debug: Check what tokens we're receiving
    console.log('=== OAuth Debug ===')
    console.log('Has provider_token:', !!sessionData?.session?.provider_token)
    console.log('Has provider_refresh_token:', !!sessionData?.session?.provider_refresh_token)
    console.log('Provider token length:', sessionData?.session?.provider_token?.length)
    console.log('Provider refresh token length:', sessionData?.session?.provider_refresh_token?.length)
    console.log('==================')

    // Check if user has an organization
    const user = await getUser()

    if (user) {
      // Get or create user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      // If no profile exists, create one
      if (!profile) {
        await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || user.user_metadata?.name
          })

        // New user without organization - redirect to onboarding
        return NextResponse.redirect(new URL('/onboarding/create-organization', request.url))
      }

      // If profile exists but no organization - redirect to onboarding
      if (!profile.organization_id) {
        return NextResponse.redirect(new URL('/onboarding/create-organization', request.url))
      }

      // Store OAuth tokens if available (for existing users with organizations)
      if (sessionData?.session?.provider_token && sessionData?.session?.provider_refresh_token) {
        try {
          // Calculate token expiry (Google tokens typically expire in 1 hour)
          const expiresIn = sessionData.session.expires_in || 3600
          const expiresAt = new Date(Date.now() + expiresIn * 1000)

          await storeOAuthTokens(profile.organization_id, {
            accessToken: sessionData.session.provider_token,
            refreshToken: sessionData.session.provider_refresh_token,
            expiresAt,
          })

          // Start Gmail watch for real-time notifications via Pub/Sub
          const watchResult = await startGmailWatch(profile.organization_id)
          if (watchResult) {
            console.log(`Started Gmail watch for org ${profile.organization_id}`)
          } else {
            console.error('Failed to start Gmail watch')
          }
        } catch (error) {
          console.error('Failed to store OAuth tokens during login:', error)
          // Don't fail the login if token storage fails
        }
      }
    }
  }

  // User has organization - redirect to orders
  return NextResponse.redirect(new URL('/orders', request.url))
}
