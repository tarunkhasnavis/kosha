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
import { createServiceClient } from '@kosha/supabase/service'
import { GmailClient } from '@/lib/email/gmail/client'
import { getValidAccessToken } from '@/lib/organizations/oauth'
import { handleEmailOrder } from '@/lib/email/handler'

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
    let skippedOwnEmails = 0
    const results: Array<{ id: string; action: string; success: boolean }> = []

    // Get org email to filter out self-sent emails
    const orgEmail = org.gmail_email?.toLowerCase()

    for (const message of response.messages) {
      try {
        // Use getEmail() to fetch message with attachment data included
        const parsedEmail = await gmailClient.getEmail(message.id)

        // Debug: Log email details
        console.log('📧 Parsed email - API ID:', parsedEmail.id)
        console.log('📧 Parsed email - Message-ID header:', parsedEmail.messageId)
        console.log('📧 Parsed email - Subject:', parsedEmail.subject)
        console.log('📧 Parsed email - From:', parsedEmail.from)
        console.log('📧 Parsed email - Attachments:', parsedEmail.attachments.length)

        // Skip emails sent FROM our own address (prevents loops)
        const fromEmail = parsedEmail.from.toLowerCase()
        if (orgEmail && fromEmail.includes(orgEmail)) {
          console.log(`[TEST] Skipping email from self: ${parsedEmail.subject}`)
          skippedOwnEmails++
          results.push({
            id: parsedEmail.id,
            action: 'skipped_self_email',
            success: false,
          })
          continue
        }

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
      skippedOwnEmails,
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
