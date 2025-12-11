/**
 * Email Sync Worker
 *
 * Polls Gmail for new emails and processes them into orders.
 * This will eventually be replaced by Gmail Pub/Sub for real-time updates.
 *
 * Usage:
 * - Run as a background job (cron, Vercel Cron, etc.)
 * - Recommended: Every 5-10 minutes
 */

import { createServiceClient } from '@/utils/supabase/service'
import { handleEmailOrder } from '@/lib/actions/handleEmailOrder'
import { getValidAccessToken } from '@/lib/actions/oauthTokens'
import { GmailClient } from '@/lib/gmail/client'
import type { ParsedEmail } from '@/lib/gmail/client'

/**
 * Sync emails for a specific organization
 */
async function syncOrganizationEmails(
  organizationId: string,
  gmailEmail: string,
  lastHistoryId?: string
): Promise<{
  success: boolean
  processedCount: number
  newHistoryId?: string
  error?: string
}> {
  try {
    // Get valid access token from database (auto-refreshes if expired)
    const accessToken = await getValidAccessToken(organizationId)

    if (!accessToken) {
      return {
        success: false,
        processedCount: 0,
        error: 'Gmail access token not available - user may need to re-authenticate'
      }
    }

    // Create Gmail client with stored token
    const gmailClient = new GmailClient(accessToken)

    // Fetch new messages
    // TODO: Use historyId for incremental sync (more efficient)
    // For now, just fetch recent emails
    const response = await gmailClient.listMessages(50) // Last 50 emails

    if (!response.messages || response.messages.length === 0) {
      console.log(`No emails found for organization ${organizationId}`)
      return {
        success: true,
        processedCount: 0,
      }
    }

    console.log(`Found ${response.messages.length} emails for organization ${organizationId}`)

    let processedCount = 0
    const errors: string[] = []

    // Process each email
    for (const message of response.messages) {
      try {
        // Fetch full email content
        const fullMessage = await gmailClient.getMessage(message.id)
        const parsedEmail: ParsedEmail = gmailClient.parseMessage(fullMessage)

        // Process email into order
        const result = await handleEmailOrder(parsedEmail, organizationId)

        if (result.success) {
          processedCount++
          console.log(`Processed email ${parsedEmail.id}: ${result.action}`)
        } else {
          console.log(`Skipped email ${parsedEmail.id}: ${result.action}`)
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`Email ${message.id}: ${errorMsg}`)
        console.error(`Error processing email ${message.id}:`, error)
        // Continue processing other emails
      }
    }

    if (errors.length > 0) {
      console.error(`Errors during sync for org ${organizationId}:`, errors)
    }

    return {
      success: true,
      processedCount,
      // TODO: Get new historyId from Gmail API for next sync
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    console.error(`Fatal error syncing emails for org ${organizationId}:`, errorMsg)
    return {
      success: false,
      processedCount: 0,
      error: errorMsg,
    }
  }
}

/**
 * Update organization's last sync metadata
 */
async function updateOrganizationSyncStatus(
  organizationId: string,
  historyId?: string
) {
  const supabase = createServiceClient()

  await supabase
    .from('organizations')
    .update({
      gmail_last_synced_at: new Date().toISOString(),
      ...(historyId && { gmail_last_history_id: historyId }),
    })
    .eq('id', organizationId)
}

/**
 * Main sync function: Process emails for all organizations
 */
export async function syncAllOrganizationEmails(): Promise<{
  success: boolean
  totalProcessed: number
  organizationsProcessed: number
  errors: string[]
}> {
  const supabase = createServiceClient()

  // Find all organizations with Gmail connected
  const { data: organizations, error } = await supabase
    .from('organizations')
    .select('id, name, gmail_email, gmail_last_history_id')
    .not('gmail_email', 'is', null)

  if (error || !organizations || organizations.length === 0) {
    console.log('No organizations with Gmail configured')
    return {
      success: true,
      totalProcessed: 0,
      organizationsProcessed: 0,
      errors: [],
    }
  }

  console.log(`Starting email sync for ${organizations.length} organizations`)

  let totalProcessed = 0
  let organizationsProcessed = 0
  const errors: string[] = []

  for (const org of organizations) {
    try {
      console.log(`Syncing emails for organization: ${org.name} (${org.id})`)

      const result = await syncOrganizationEmails(
        org.id,
        org.gmail_email,
        org.gmail_last_history_id || undefined
      )

      if (result.success) {
        totalProcessed += result.processedCount
        organizationsProcessed++

        // Update sync status
        await updateOrganizationSyncStatus(org.id, result.newHistoryId)

        console.log(`Completed sync for ${org.name}: ${result.processedCount} emails processed`)
      } else {
        errors.push(`${org.name}: ${result.error}`)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      errors.push(`${org.name}: ${errorMsg}`)
      console.error(`Error syncing organization ${org.name}:`, error)
    }
  }

  console.log(`Email sync complete: ${totalProcessed} emails processed across ${organizationsProcessed} organizations`)

  return {
    success: errors.length === 0,
    totalProcessed,
    organizationsProcessed,
    errors,
  }
}
