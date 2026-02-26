/**
 * QuickBooks Online - OAuth 2.0 Authentication
 *
 * Handles the OAuth flow with Intuit:
 * 1. Build authorization URL -> user clicks -> redirected to Intuit
 * 2. Intuit redirects back to /api/integrations/quickbooks/callback
 * 3. Exchange auth code for tokens -> store encrypted in DB
 * 4. Auto-refresh access tokens (1hr lifetime) using refresh token (100 day lifetime)
 */

import { getQBOSettings, updateQBOTokens } from './db'

// ============================================
// Intuit OAuth endpoints
// ============================================

const INTUIT_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2'
const INTUIT_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'

// Scopes we need
const SCOPES = 'com.intuit.quickbooks.accounting'

// ============================================
// Environment helpers
// ============================================

function getClientId(): string {
  const id = process.env.QUICKBOOKS_CLIENT_ID
  if (!id) throw new Error('QUICKBOOKS_CLIENT_ID is not set')
  return id
}

function getClientSecret(): string {
  const secret = process.env.QUICKBOOKS_CLIENT_SECRET
  if (!secret) throw new Error('QUICKBOOKS_CLIENT_SECRET is not set')
  return secret
}

function getRedirectUri(): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('.supabase.co', '')
  if (!baseUrl) throw new Error('NEXT_PUBLIC_APP_URL is not set')
  return `${baseUrl}/api/integrations/quickbooks/callback`
}

function isSandbox(): boolean {
  return process.env.QUICKBOOKS_ENVIRONMENT === 'sandbox'
}

// ============================================
// OAuth flow
// ============================================

/**
 * Build the Intuit OAuth authorization URL.
 * The `state` param carries the organizationId so the callback knows which org to link.
 */
export function buildAuthorizationUrl(organizationId: string): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: SCOPES,
    state: organizationId,
  })

  return `${INTUIT_AUTH_URL}?${params.toString()}`
}

/**
 * Exchange the authorization code for tokens.
 * Called from the OAuth callback route.
 */
export async function exchangeCodeForTokens(
  code: string,
  realmId: string
): Promise<{
  accessToken: string
  refreshToken: string
  expiresIn: number
  refreshTokenExpiresIn: number
}> {
  const clientId = getClientId()
  const clientSecret = getClientSecret()

  const response = await fetch(INTUIT_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: getRedirectUri(),
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('QBO token exchange failed:', errorText)
    throw new Error(`Token exchange failed: ${response.status}`)
  }

  const data = await response.json()

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,                     // ~3600 seconds (1 hour)
    refreshTokenExpiresIn: data.x_refresh_token_expires_in, // ~8726400 seconds (100 days)
  }
}

/**
 * Get a valid access token, refreshing if expired.
 * Same pattern as Gmail's getValidAccessToken().
 */
export async function getValidAccessToken(organizationId: string): Promise<string> {
  const settings = await getQBOSettings(organizationId)
  if (!settings) {
    throw new Error('QBO integration not configured')
  }

  const { credentials } = settings

  // Check if access token is expired (with 5 min buffer)
  const expiresAt = new Date(credentials.tokenExpiresAt)
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000)

  if (expiresAt > fiveMinutesFromNow) {
    return credentials.accessToken
  }

  // Refresh the token
  const clientId = getClientId()
  const clientSecret = getClientSecret()

  const response = await fetch(INTUIT_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: credentials.refreshToken,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('QBO token refresh failed:', errorText)
    throw new Error('Failed to refresh QBO access token')
  }

  const data = await response.json()

  // Store the new tokens
  await updateQBOTokens(
    organizationId,
    data.access_token,
    data.refresh_token ?? credentials.refreshToken,
    data.expires_in
  )

  return data.access_token
}

/**
 * Get the QBO API base URL based on environment.
 */
export function getQBOBaseUrl(): string {
  return isSandbox()
    ? 'https://sandbox-quickbooks.api.intuit.com'
    : 'https://quickbooks.api.intuit.com'
}
