'use server'

/**
 * Organization server actions
 *
 * These functions MUTATE data (INSERT/UPDATE/DELETE operations)
 * For read-only queries, see lib/db/organizations.ts
 */

import { createClient } from '@/utils/supabase/server'
import { getUser, getSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { storeOAuthTokens } from './oauthTokens'
import { startGmailWatch } from '@/lib/gmail/watch'

/**
 * Create a new organization and assign the current user as owner
 * Returns the organization ID on success instead of redirecting
 */
export async function createOrganization(organizationName: string): Promise<{ organizationId: string }> {
  const user = await getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const supabase = await createClient()

  // Check if user already has an organization
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (existingProfile?.organization_id) {
    // User already has an organization, return it
    return { organizationId: existingProfile.organization_id }
  }

  // Create new organization with Gmail email set to user's email
  const { data: newOrg, error: orgError } = await supabase
    .from('organizations')
    .insert({
      name: organizationName.trim(),
      gmail_email: user.email
    })
    .select()
    .single()

  if (orgError) {
    console.error('Organization creation error:', orgError)
    throw new Error('Failed to create organization: ' + orgError.message)
  }

  console.log('Organization created:', newOrg)

  // Upsert user's profile with organization_id as owner
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || user.user_metadata?.name,
      organization_id: newOrg.id,
      role: 'owner'
    })

  if (profileError) {
    throw new Error('Failed to update user profile: ' + profileError.message)
  }

  console.log('✅ Profile updated with organization_id:', newOrg.id)

  // Store OAuth tokens for the new organization
  const session = await getSession()
  if (session?.provider_token && session?.provider_refresh_token) {
    try {
      const expiresIn = session.expires_in || 3600
      const expiresAt = new Date(Date.now() + expiresIn * 1000)

      await storeOAuthTokens(newOrg.id, {
        accessToken: session.provider_token,
        refreshToken: session.provider_refresh_token,
        expiresAt,
      })

      console.log('✅ OAuth tokens stored successfully for organization:', newOrg.id)

      // Start Gmail watch for real-time notifications via Pub/Sub
      const watchResult = await startGmailWatch(newOrg.id)
      if (watchResult) {
        console.log('✅ Gmail watch started for organization:', newOrg.id)
      } else {
        console.error('⚠️ Failed to start Gmail watch - emails will not sync in real-time')
      }
    } catch (error) {
      // CRITICAL: Token storage failed - this will prevent email sync from working
      console.error('❌ CRITICAL: Failed to store OAuth tokens for new organization')
      console.error('Organization:', newOrg.name, '(', newOrg.id, ')')
      console.error('Error:', error)
      console.error('ACTION REQUIRED: User needs to log out and log back in to fix this')

      // Fail the organization creation if tokens can't be stored
      // This prevents silent failures that lose customers
      throw new Error(
        'Failed to store authentication tokens. Please ensure TOKEN_ENCRYPTION_KEY is set in .env.local and restart the dev server.'
      )
    }
  } else {
    // No OAuth tokens in session - this shouldn't happen with Google OAuth
    console.error('❌ CRITICAL: No OAuth tokens in session after login')
    console.error('This indicates a problem with the Google OAuth flow')
    throw new Error('Authentication failed: No OAuth tokens received from Google')
  }

  // Revalidate routes to ensure profile/org changes propagate
  revalidatePath('/', 'layout')
  revalidatePath('/orders')

  // Return organization ID - client will handle navigation
  // This ensures the database transaction is fully committed before redirect
  return { organizationId: newOrg.id }
}
