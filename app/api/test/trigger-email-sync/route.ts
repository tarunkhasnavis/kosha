/**
 * Test Endpoint: Manual Email Sync Trigger
 *
 * Use this endpoint for local development to manually trigger email processing
 * without needing Pub/Sub push notifications.
 *
 * This mimics what happens in production when Gmail sends a notification.
 *
 * IMPORTANT: This endpoint should be disabled or protected in production!
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/utils/supabase/service'
import { GmailClient } from '@/lib/gmail/client'
import { getValidAccessToken } from '@/lib/actions/oauthTokens'
import { handleEmailOrder } from '@/lib/actions/handleEmailOrder'

/**
 * POST /api/test/trigger-email-sync
 *
 * Manually trigger email sync for testing
 *
 * Body:
 * - organizationId: string (required) - The organization to sync
 * - maxEmails: number (optional) - Max emails to fetch (default: 10)
 */
export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'This endpoint is disabled in production' },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    const { organizationId, maxEmails = 10 } = body

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      )
    }

    // Verify organization exists
    const supabase = createServiceClient()
    const { data: org, error } = await supabase
      .from('organizations')
      .select('id, name, gmail_email')
      .eq('id', organizationId)
      .single()

    if (error || !org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    if (!org.gmail_email) {
      return NextResponse.json(
        { error: 'Organization has no Gmail connected' },
        { status: 400 }
      )
    }

    console.log(`[TEST] Triggering email sync for ${org.name} (${org.gmail_email})`)

    // Get access token
    const accessToken = await getValidAccessToken(organizationId)
    if (!accessToken) {
      return NextResponse.json(
        { error: 'No valid access token - user may need to re-authenticate' },
        { status: 401 }
      )
    }

    // Fetch recent emails
    const gmailClient = new GmailClient(accessToken)
    const response = await gmailClient.listMessages(maxEmails)

    if (!response.messages || response.messages.length === 0) {
      return NextResponse.json({
        status: 'success',
        message: 'No emails found',
        processed: 0,
      })
    }

    console.log(`[TEST] Found ${response.messages.length} emails to process`)

    // Process each email
    let processedCount = 0
    let skippedCount = 0
    const results: Array<{ id: string; action: string; success: boolean }> = []

    for (const message of response.messages) {
      try {
        const fullMessage = await gmailClient.getMessage(message.id)
        const parsedEmail = gmailClient.parseMessage(fullMessage)

        const result = await handleEmailOrder(parsedEmail, organizationId)

        results.push({
          id: parsedEmail.id,
          action: result.action,
          success: result.success,
        })

        if (result.success) {
          processedCount++
        } else {
          skippedCount++
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        results.push({
          id: message.id,
          action: `error: ${errorMsg}`,
          success: false,
        })
        console.error(`[TEST] Error processing email ${message.id}:`, error)
      }
    }

    return NextResponse.json({
      status: 'success',
      organization: org.name,
      email: org.gmail_email,
      processed: processedCount,
      skipped: skippedCount,
      total: response.messages.length,
      results,
    })
  } catch (error) {
    console.error('[TEST] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/test/trigger-email-sync
 *
 * List organizations available for testing
 */
export async function GET() {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'This endpoint is disabled in production' },
      { status: 403 }
    )
  }

  const supabase = createServiceClient()

  const { data: organizations, error } = await supabase
    .from('organizations')
    .select('id, name, gmail_email, gmail_last_synced_at')
    .not('gmail_email', 'is', null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    message: 'POST to this endpoint with { organizationId } to trigger email sync',
    organizations: organizations || [],
  })
}
