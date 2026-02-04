/**
 * Gmail Email Sync Service
 *
 * Provides functions for syncing emails from Gmail as a fallback
 * when Pub/Sub notifications are missed (e.g., watch expired, token issues).
 *
 * Key features:
 * - Idempotent: Already-processed emails are safely skipped
 * - Reuses existing handleEmailOrder() logic
 * - Supports both polling (recent emails) and catch-up (date range) scenarios
 */

import { GmailClient } from './client'
import { getValidAccessToken } from '@/lib/organizations/oauth'
import { handleEmailOrder } from '@/lib/email/handler'
import { createServiceClient } from '@/utils/supabase/service'

export interface SyncResult {
  processed: number
  skipped: number
  alreadyProcessed: number
  errors: string[]
}

interface OrgInfo {
  id: string
  name: string
  gmail_email: string
}

/**
 * Sync recent emails for a single organization
 *
 * @param organizationId - The organization ID
 * @param hoursBack - How many hours back to look (default: 1)
 * @param maxEmails - Maximum emails to process (default: 20)
 * @returns Sync results with counts
 */
export async function syncRecentEmails(
  organizationId: string,
  hoursBack: number = 1,
  maxEmails: number = 20
): Promise<SyncResult> {
  const result: SyncResult = {
    processed: 0,
    skipped: 0,
    alreadyProcessed: 0,
    errors: [],
  }

  // Get valid access token
  const accessToken = await getValidAccessToken(organizationId)
  if (!accessToken) {
    result.errors.push(`No valid access token for org ${organizationId}`)
    return result
  }

  // Get org info for email filtering
  const supabase = createServiceClient()
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id, name, gmail_email')
    .eq('id', organizationId)
    .single()

  if (orgError || !org || !org.gmail_email) {
    result.errors.push(`Could not fetch org info for ${organizationId}`)
    return result
  }

  // Build Gmail search query for recent emails
  const hoursAgoEpoch = Math.floor((Date.now() - hoursBack * 60 * 60 * 1000) / 1000)
  const query = `after:${hoursAgoEpoch}`

  const gmailClient = new GmailClient(accessToken)
  const orgEmail = org.gmail_email.toLowerCase()

  try {
    // Fetch recent emails from INBOX
    const response = await gmailClient.listMessages(maxEmails, query, ['INBOX'])

    if (!response.messages || response.messages.length === 0) {
      return result
    }

    // Process each email
    for (const message of response.messages) {
      try {
        const parsedEmail = await gmailClient.getEmail(message.id)

        // Skip emails from self (unless forwarded)
        const fromEmail = parsedEmail.from.toLowerCase()
        const emailMatch = fromEmail.match(/<([^>]+)>/)
        const extractedEmail = emailMatch ? emailMatch[1] : fromEmail.trim()
        const isFromSelf = extractedEmail === orgEmail

        const looksLikeForward =
          parsedEmail.subject.toLowerCase().includes('fwd:') ||
          parsedEmail.body.includes('Forwarded Message') ||
          parsedEmail.body.includes('---------- Forwarded message')

        if (isFromSelf && !looksLikeForward) {
          result.skipped++
          continue
        }

        // Process through standard handler (idempotent)
        const handleResult = await handleEmailOrder(parsedEmail, organizationId)

        if (handleResult.action === 'already_processed') {
          result.alreadyProcessed++
        } else if (handleResult.success) {
          result.processed++
        } else {
          result.skipped++
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        result.errors.push(`Email ${message.id}: ${errorMsg}`)
      }
    }

    return result
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    result.errors.push(`Gmail API error: ${errorMsg}`)
    return result
  }
}

/**
 * Sync emails from a date range (for catch-up after re-auth)
 *
 * @param organizationId - The organization ID
 * @param daysBack - How many days back to look (default: 7)
 * @param maxEmails - Maximum emails to process (default: 50)
 * @returns Sync results with counts
 */
export async function syncEmailsFromDaysBack(
  organizationId: string,
  daysBack: number = 7,
  maxEmails: number = 50
): Promise<SyncResult> {
  // Convert days to hours and use the same logic
  return syncRecentEmails(organizationId, daysBack * 24, maxEmails)
}

/**
 * Get all organizations with Gmail connected
 *
 * @returns Array of org IDs with Gmail configured
 */
export async function getOrgsWithGmail(): Promise<OrgInfo[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, gmail_email')
    .not('gmail_email', 'is', null)

  if (error) {
    console.error('Failed to fetch orgs with Gmail:', error)
    return []
  }

  return (data || []).filter((org): org is OrgInfo => !!org.gmail_email)
}

/**
 * Poll all organizations for recent emails
 *
 * This is the main function called by the cron job.
 * It iterates through all orgs with Gmail connected and syncs recent emails.
 *
 * @param hoursBack - How many hours back to look (default: 1)
 * @param maxEmailsPerOrg - Max emails per org (default: 20)
 * @returns Summary of all sync operations
 */
export async function pollAllOrganizations(
  hoursBack: number = 1,
  maxEmailsPerOrg: number = 20
): Promise<{
  totalOrgs: number
  successfulOrgs: number
  failedOrgs: number
  totalProcessed: number
  totalAlreadyProcessed: number
  totalSkipped: number
  errors: string[]
}> {
  const orgs = await getOrgsWithGmail()

  const summary = {
    totalOrgs: orgs.length,
    successfulOrgs: 0,
    failedOrgs: 0,
    totalProcessed: 0,
    totalAlreadyProcessed: 0,
    totalSkipped: 0,
    errors: [] as string[],
  }

  if (orgs.length === 0) {
    return summary
  }

  console.log(`[Poll] Starting poll for ${orgs.length} organizations`)

  for (const org of orgs) {
    try {
      const result = await syncRecentEmails(org.id, hoursBack, maxEmailsPerOrg)

      if (result.errors.length > 0) {
        summary.failedOrgs++
        summary.errors.push(`${org.name}: ${result.errors.join(', ')}`)
      } else {
        summary.successfulOrgs++
      }

      summary.totalProcessed += result.processed
      summary.totalAlreadyProcessed += result.alreadyProcessed
      summary.totalSkipped += result.skipped

      // Log if we actually processed any new emails
      if (result.processed > 0) {
        console.log(`[Poll] ${org.name}: processed ${result.processed} new emails`)
      }
    } catch (error) {
      summary.failedOrgs++
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      summary.errors.push(`${org.name}: ${errorMsg}`)
    }
  }

  console.log(
    `[Poll] Complete: ${summary.successfulOrgs}/${summary.totalOrgs} orgs, ` +
    `${summary.totalProcessed} new emails, ${summary.totalAlreadyProcessed} already processed`
  )

  return summary
}
