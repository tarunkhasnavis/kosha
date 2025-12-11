/**
 * Gmail authentication utilities
 *
 * These functions handle retrieving the Google OAuth access token
 * from Supabase and creating authenticated Gmail clients.
 */

import { getSession } from '@/lib/auth'
import { GmailClient } from './client'

/**
 * Get the Gmail access token for the currently logged-in user
 *
 * This retrieves the Google OAuth token from the Supabase session.
 * The token was stored when the user signed in with Google.
 *
 * @returns The Gmail access token, or null if not found
 */
export async function getGmailAccessToken(): Promise<string | null> {
  const session = await getSession()

  if (!session) {
    console.error('No active session found')
    return null
  }

  // The provider_token is the Google OAuth access token
  const providerToken = session.provider_token

  if (!providerToken) {
    console.error('No provider token found. User may need to re-authenticate with Google.')
    return null
  }

  return providerToken
}

/**
 * Create a Gmail client for the currently logged-in user
 *
 * Convenience function that:
 * 1. Gets the Gmail access token from Supabase
 * 2. Creates a GmailClient with that token
 *
 * @returns A GmailClient instance, or null if user is not authenticated with Google
 *
 * @example
 * const gmail = await createGmailClient()
 * if (gmail) {
 *   const messages = await gmail.listMessages(10)
 * }
 */
export async function createGmailClient(): Promise<GmailClient | null> {
  const accessToken = await getGmailAccessToken()

  if (!accessToken) {
    return null
  }

  return new GmailClient(accessToken)
}
