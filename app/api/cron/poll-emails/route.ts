/**
 * Cron Job: Poll Emails Fallback
 *
 * This cron job acts as a safety net for Gmail Pub/Sub notifications.
 * It polls recent emails for all organizations to catch any that were
 * missed due to:
 * - Watch expiration
 * - Pub/Sub delivery failures
 * - historyId gaps
 *
 * The email processing is idempotent - already-processed emails are
 * safely skipped, so this can run frequently without creating duplicates.
 *
 * Recommended schedule: Every 30 minutes
 */

import { NextRequest, NextResponse } from 'next/server'
import { pollAllOrganizations } from '@/lib/email/gmail/sync'

// How many hours back to look for emails (overlap ensures no gaps)
const HOURS_BACK = 1

// Max emails to process per organization per poll
const MAX_EMAILS_PER_ORG = 20

/**
 * GET /api/cron/poll-emails
 *
 * Called by Vercel Cron to poll for missed emails
 */
export async function GET(request: NextRequest) {
  // Verify cron secret (optional but recommended)
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.log('[Poll] Unauthorized cron request')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('[Poll] Starting email poll fallback...')

  try {
    const result = await pollAllOrganizations(HOURS_BACK, MAX_EMAILS_PER_ORG)

    // Only log details if something interesting happened
    if (result.totalProcessed > 0 || result.errors.length > 0) {
      console.log('[Poll] Summary:', JSON.stringify(result, null, 2))
    }

    return NextResponse.json({
      success: result.failedOrgs === 0,
      summary: {
        organizations: {
          total: result.totalOrgs,
          successful: result.successfulOrgs,
          failed: result.failedOrgs,
        },
        emails: {
          newlyProcessed: result.totalProcessed,
          alreadyProcessed: result.totalAlreadyProcessed,
          skipped: result.totalSkipped,
        },
      },
      errors: result.errors.length > 0 ? result.errors : undefined,
    })
  } catch (error) {
    console.error('[Poll] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/cron/poll-emails
 *
 * Allow manual triggering via POST as well
 */
export async function POST(request: NextRequest) {
  return GET(request)
}
