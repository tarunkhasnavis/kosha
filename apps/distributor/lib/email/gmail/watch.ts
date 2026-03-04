/**
 * Gmail Watch (Pub/Sub) Management
 *
 * Handles Gmail push notification subscriptions using Google Pub/Sub.
 * When a user's Gmail inbox changes, Google sends a notification to our webhook.
 */

import { getValidAccessToken } from '@/lib/organizations/oauth'
import { createServiceClient } from '@kosha/supabase/service'

const GOOGLE_PROJECT_ID = 'zoodl-474118'
const PUBSUB_TOPIC = `projects/${GOOGLE_PROJECT_ID}/topics/gmail-notifications`

interface WatchResponse {
  historyId: string
  expiration: string // Unix timestamp in milliseconds
}

/**
 * Start watching a Gmail inbox for changes
 *
 * This sets up push notifications via Pub/Sub. Gmail will notify us
 * whenever there are changes to the inbox (new emails, etc.)
 *
 * Watch subscriptions expire after ~7 days and need to be renewed.
 *
 * @param organizationId - The organization ID
 * @returns Watch response with historyId and expiration, or null if failed
 */
export async function startGmailWatch(
  organizationId: string
): Promise<WatchResponse | null> {
  const accessToken = await getValidAccessToken(organizationId)

  if (!accessToken) {
    console.error(`No valid access token for organization ${organizationId}`)
    return null
  }

  try {
    const response = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/watch',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topicName: PUBSUB_TOPIC,
          labelIds: ['INBOX'],
          labelFilterBehavior: 'INCLUDE',
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      console.error(`Failed to start Gmail watch: ${response.status} - ${error}`)
      return null
    }

    const data: WatchResponse = await response.json()

    // Store watch metadata in database
    const supabase = createServiceClient()
    await supabase
      .from('organizations')
      .update({
        gmail_watch_expiration: new Date(parseInt(data.expiration)).toISOString(),
        gmail_last_history_id: data.historyId,
      })
      .eq('id', organizationId)

    console.log(`Started Gmail watch for organization ${organizationId}, expires: ${new Date(parseInt(data.expiration)).toISOString()}`)

    return data
  } catch (error) {
    console.error(`Error starting Gmail watch for org ${organizationId}:`, error)
    return null
  }
}

/**
 * Stop watching a Gmail inbox
 *
 * Call this when an organization disconnects their Gmail or deletes their account.
 *
 * @param organizationId - The organization ID
 * @returns true if successful
 */
export async function stopGmailWatch(
  organizationId: string
): Promise<boolean> {
  const accessToken = await getValidAccessToken(organizationId)

  if (!accessToken) {
    console.error(`No valid access token for organization ${organizationId}`)
    return false
  }

  try {
    const response = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/stop',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      const error = await response.text()
      console.error(`Failed to stop Gmail watch: ${response.status} - ${error}`)
      return false
    }

    // Clear watch metadata
    const supabase = createServiceClient()
    await supabase
      .from('organizations')
      .update({
        gmail_watch_expiration: null,
      })
      .eq('id', organizationId)

    console.log(`Stopped Gmail watch for organization ${organizationId}`)
    return true
  } catch (error) {
    console.error(`Error stopping Gmail watch for org ${organizationId}:`, error)
    return false
  }
}

/**
 * Renew Gmail watch subscriptions that are about to expire
 *
 * Gmail watch subscriptions expire after ~7 days. This function should be
 * called periodically to renew expiring watches.
 *
 * @returns Summary of renewal results
 */
export async function renewExpiringWatches(): Promise<{
  renewed: number
  failed: number
  errors: string[]
}> {
  const supabase = createServiceClient()

  // Find organizations with watches expiring in the next 24 hours
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  const { data: organizations, error } = await supabase
    .from('organizations')
    .select('id, name, gmail_email, gmail_watch_expiration')
    .not('gmail_email', 'is', null)
    .not('gmail_watch_expiration', 'is', null)
    .lt('gmail_watch_expiration', tomorrow)

  if (error || !organizations || organizations.length === 0) {
    console.log('No watches need renewal')
    return { renewed: 0, failed: 0, errors: [] }
  }

  console.log(`Renewing ${organizations.length} expiring Gmail watches`)

  let renewed = 0
  let failed = 0
  const errors: string[] = []

  for (const org of organizations) {
    const result = await startGmailWatch(org.id)
    if (result) {
      renewed++
      console.log(`Renewed watch for ${org.name}`)
    } else {
      failed++
      errors.push(`Failed to renew watch for ${org.name}`)
    }
  }

  return { renewed, failed, errors }
}

/**
 * Get Gmail history (changes) since a given historyId
 *
 * This is called when we receive a Pub/Sub notification to fetch
 * the actual changes that occurred.
 *
 * @param organizationId - The organization ID
 * @param startHistoryId - The historyId to start from
 * @returns List of message IDs that were added
 */
export async function getGmailHistory(
  organizationId: string,
  startHistoryId: string
): Promise<{ messageIds: string[]; newHistoryId: string | null; rawHistoryResponse: unknown }> {
  const accessToken = await getValidAccessToken(organizationId)

  if (!accessToken) {
    console.error(`No valid access token for organization ${organizationId}`)
    return { messageIds: [], newHistoryId: null, rawHistoryResponse: { error: 'no_access_token' } }
  }

  try {
    const params = new URLSearchParams({
      startHistoryId,
      historyTypes: 'messageAdded',
      labelId: 'INBOX',
    })

    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/history?${params}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      // 404 means historyId is too old, need to do full sync
      if (response.status === 404) {
        console.log(`History ID ${startHistoryId} expired for org ${organizationId}, need full sync`)
        return { messageIds: [], newHistoryId: null, rawHistoryResponse: { error: 'history_expired', status: 404 } }
      }

      const error = await response.text()
      console.error(`Failed to get Gmail history: ${response.status} - ${error}`)
      return { messageIds: [], newHistoryId: null, rawHistoryResponse: { error, status: response.status } }
    }

    const data = await response.json()

    // Extract message IDs from history records
    const messageIds: string[] = []
    if (data.history) {
      for (const record of data.history) {
        if (record.messagesAdded) {
          for (const added of record.messagesAdded) {
            // Only include messages that are in INBOX
            if (added.message?.labelIds?.includes('INBOX')) {
              messageIds.push(added.message.id)
            }
          }
        }
      }
    }

    return {
      messageIds,
      newHistoryId: data.historyId || null,
      rawHistoryResponse: data,
    }
  } catch (error) {
    console.error(`Error getting Gmail history for org ${organizationId}:`, error)
    return { messageIds: [], newHistoryId: null, rawHistoryResponse: { error: String(error) } }
  }
}

/**
 * Find organization by Gmail email address
 *
 * Used when processing Pub/Sub notifications to find which
 * organization the notification belongs to.
 *
 * @param email - Gmail email address
 * @returns Organization data or null
 */
export async function findOrganizationByGmailEmail(
  email: string
): Promise<{ id: string; name: string; gmail_email: string; gmail_last_history_id: string | null } | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, gmail_email, gmail_last_history_id')
    .eq('gmail_email', email)
    .single()

  if (error || !data) {
    return null
  }

  return data
}

/**
 * Update organization's last history ID
 *
 * @param organizationId - The organization ID
 * @param historyId - New history ID from Gmail
 */
export async function updateHistoryId(
  organizationId: string,
  historyId: string
): Promise<void> {
  const supabase = createServiceClient()

  await supabase
    .from('organizations')
    .update({
      gmail_last_history_id: historyId,
      gmail_last_synced_at: new Date().toISOString(),
    })
    .eq('id', organizationId)
}
