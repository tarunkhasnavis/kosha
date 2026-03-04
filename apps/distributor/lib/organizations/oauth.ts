'use server'

/**
 * OAuth Token Management
 *
 * Handles storing and retrieving encrypted OAuth tokens for organizations
 */

import { createServiceClient } from '@kosha/supabase/service'
import { encryptToken, decryptToken } from '@/lib/tokenEncryption'

interface OAuthTokens {
  accessToken: string
  refreshToken: string
  expiresAt: Date
}

/**
 * Store OAuth tokens for an organization (encrypted)
 *
 * @param organizationId - The organization ID
 * @param tokens - OAuth tokens from Google
 */
export async function storeOAuthTokens(
  organizationId: string,
  tokens: OAuthTokens
): Promise<void> {
  const supabase = createServiceClient()

  // Encrypt tokens before storing
  const encryptedAccessToken = encryptToken(tokens.accessToken)
  const encryptedRefreshToken = encryptToken(tokens.refreshToken)

  const { error } = await supabase
    .from('organizations')
    .update({
      gmail_access_token: encryptedAccessToken,
      gmail_refresh_token: encryptedRefreshToken,
      gmail_token_expires_at: tokens.expiresAt.toISOString(),
    })
    .eq('id', organizationId)

  if (error) {
    console.error('Failed to store OAuth tokens:', error)
    throw new Error('Failed to store OAuth tokens')
  }

  console.log(`Stored OAuth tokens for organization ${organizationId}`)
}

/**
 * Retrieve decrypted OAuth tokens for an organization
 *
 * @param organizationId - The organization ID
 * @returns Decrypted tokens or null if not found
 */
export async function getOAuthTokens(
  organizationId: string
): Promise<OAuthTokens | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('organizations')
    .select('gmail_access_token, gmail_refresh_token, gmail_token_expires_at')
    .eq('id', organizationId)
    .single()

  if (error || !data) {
    console.error('Failed to retrieve OAuth tokens:', error)
    return null
  }

  if (!data.gmail_access_token || !data.gmail_refresh_token) {
    return null
  }

  try {
    // Decrypt tokens
    const accessToken = decryptToken(data.gmail_access_token)
    const refreshToken = decryptToken(data.gmail_refresh_token)
    const expiresAt = new Date(data.gmail_token_expires_at)

    return {
      accessToken,
      refreshToken,
      expiresAt,
    }
  } catch (error) {
    console.error('Failed to decrypt OAuth tokens:', error)
    return null
  }
}

/**
 * Check if access token is expired or about to expire (within 5 minutes)
 * Internal helper - not exported as a Server Action
 */
function isTokenExpired(expiresAt: Date): boolean {
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000)
  return expiresAt <= fiveMinutesFromNow
}

/**
 * Refresh an expired access token using the refresh token
 *
 * @param organizationId - The organization ID
 * @returns New access token or null if refresh fails
 */
export async function refreshAccessToken(
  organizationId: string
): Promise<string | null> {
  const tokens = await getOAuthTokens(organizationId)

  if (!tokens) {
    console.error('No tokens found for organization')
    return null
  }

  // If token is still valid, return it
  if (!isTokenExpired(tokens.expiresAt)) {
    return tokens.accessToken
  }

  // Refresh the token using Google OAuth
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        refresh_token: tokens.refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to refresh token:', errorText)

      // If refresh token is permanently invalid, clear it so UI can detect
      if (errorText.includes('invalid_grant')) {
        const supabase = createServiceClient()
        await supabase
          .from('organizations')
          .update({ gmail_refresh_token: null })
          .eq('id', organizationId)
      }

      return null
    }

    const data = await response.json()

    // Store new tokens - Google may rotate the refresh token
    const newExpiresAt = new Date(Date.now() + data.expires_in * 1000)
    await storeOAuthTokens(organizationId, {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? tokens.refreshToken,
      expiresAt: newExpiresAt,
    })

    console.log(`Refreshed access token for organization ${organizationId}`)
    return data.access_token
  } catch (error) {
    console.error('Error refreshing access token:', error)
    return null
  }
}

/**
 * Get a valid access token (refreshes if expired)
 *
 * @param organizationId - The organization ID
 * @returns Valid access token or null
 */
export async function getValidAccessToken(
  organizationId: string
): Promise<string | null> {
  const tokens = await getOAuthTokens(organizationId)

  if (!tokens) {
    return null
  }

  // Check if token needs refresh
  if (isTokenExpired(tokens.expiresAt)) {
    return await refreshAccessToken(organizationId)
  }

  return tokens.accessToken
}

// =============================================================================
// DEPRECATED: Pending OAuth Tokens
// =============================================================================
// The pending token system has been removed in favor of creating organizations
// immediately during the OAuth callback. This ensures tokens are never lost.
//
// Old flow (fragile):
//   Callback → store tokens in profile → Onboarding → create org → retrieve tokens
//
// New flow (robust):
//   Callback → create org immediately → store tokens directly in org → Onboarding updates org name
// =============================================================================
