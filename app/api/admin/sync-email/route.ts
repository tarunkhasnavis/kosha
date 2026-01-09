/**
 * Admin Endpoint: Manual Email Sync
 *
 * Use this endpoint to manually process missed emails that weren't captured
 * by the Gmail Pub/Sub webhook.
 *
 * Features:
 * - Process a specific email by Gmail message ID
 * - Process emails from a date range (e.g., "yesterday")
 * - Skips already-processed emails (idempotent)
 *
 * Protected by checking user is authenticated and belongs to the organization.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { GmailClient } from '@/lib/email/gmail/client'
import { getValidAccessToken } from '@/lib/organizations/oauth'
import { handleEmailOrder } from '@/lib/email/handler'
import { getUserOrganization } from '@/lib/organizations/queries'

/**
 * POST /api/admin/sync-email
 *
 * Manually sync emails for the authenticated user's organization
 *
 * Body options:
 * - messageId: string - Sync a specific Gmail message by ID
 * - query: string - Gmail search query (e.g., "after:2025/01/06 before:2025/01/08")
 * - maxEmails: number - Max emails to process (default: 20, max: 50)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const org = await getUserOrganization()

    if (!org?.id) {
      return NextResponse.json(
        { error: 'Unauthorized - must be logged in to an organization' },
        { status: 401 }
      )
    }

    const organizationId = org.id

    // Get request body
    const body = await request.json()
    const { messageId, query, maxEmails = 20 } = body

    if (!messageId && !query) {
      return NextResponse.json(
        {
          error: 'Missing required parameter',
          help: 'Provide either "messageId" for a specific email or "query" for a Gmail search (e.g., "after:2025/01/06")'
        },
        { status: 400 }
      )
    }

    // Verify organization has Gmail connected
    const supabase = await createClient()
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, gmail_email')
      .eq('id', organizationId)
      .single()

    if (orgError || !orgData) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    if (!orgData.gmail_email) {
      return NextResponse.json(
        { error: 'Organization has no Gmail connected' },
        { status: 400 }
      )
    }

    // Get access token
    const accessToken = await getValidAccessToken(organizationId)
    if (!accessToken) {
      return NextResponse.json(
        { error: 'No valid access token - Gmail may need to be reconnected' },
        { status: 401 }
      )
    }

    const gmailClient = new GmailClient(accessToken)
    const orgEmail = orgData.gmail_email.toLowerCase()

    // Process single message by ID
    if (messageId) {
      // Validate that messageId looks like an ID, not a query
      // Gmail message IDs are alphanumeric strings (hex), not queries with colons/spaces
      if (messageId.includes(':') || messageId.includes(' ')) {
        return NextResponse.json(
          {
            error: 'Invalid message ID format',
            help: 'It looks like you entered a search query. Use the "query" parameter instead, or enter just the Gmail message ID (e.g., "18d1234567890abc")',
            receivedValue: messageId,
          },
          { status: 400 }
        )
      }

      console.log(`[Admin Sync] Processing single email ${messageId} for ${orgData.name}`)

      try {
        const parsedEmail = await gmailClient.getEmail(messageId)

        // Skip emails from self, unless it looks like a forwarded order
        // This prevents processing outgoing emails while allowing forwards from other mailboxes
        const fromEmail = parsedEmail.from.toLowerCase()
        const emailMatch = fromEmail.match(/<([^>]+)>/) // Extract email from "Name <email>"
        const extractedEmail = emailMatch ? emailMatch[1] : fromEmail.trim()
        const isFromSelf = extractedEmail === orgEmail

        // Detect forwarded emails by standard markers added by email clients
        const looksLikeForward =
          parsedEmail.subject.toLowerCase().includes('fwd:') ||
          parsedEmail.body.includes('Forwarded Message') ||
          parsedEmail.body.includes('---------- Forwarded message')

        if (isFromSelf && !looksLikeForward) {
          return NextResponse.json({
            status: 'skipped',
            reason: 'Email is from your own address (not a forward)',
            messageId,
          })
        }

        const result = await handleEmailOrder(parsedEmail, organizationId)

        return NextResponse.json({
          status: 'success',
          messageId,
          subject: parsedEmail.subject,
          from: parsedEmail.from,
          action: result.action,
          orderId: result.orderId || null,
        })
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json(
          { error: `Failed to process email: ${errorMsg}`, messageId },
          { status: 500 }
        )
      }
    }

    // Process emails by query
    // Search ALL mail (not just INBOX) to catch emails in Spam/Promotions/Updates
    const limitedMax = Math.min(maxEmails, 50) // Cap at 50 to prevent abuse
    console.log(`[Admin Sync] Searching emails with query "${query}" (max: ${limitedMax}) for ${orgData.name}`)

    const response = await gmailClient.listMessages(limitedMax, query, [])

    if (!response.messages || response.messages.length === 0) {
      return NextResponse.json({
        status: 'success',
        message: 'No emails found matching query',
        query,
        processed: 0,
      })
    }

    console.log(`[Admin Sync] Found ${response.messages.length} emails to process`)

    // Process each email
    let processedCount = 0
    let skippedCount = 0
    let skippedOwnEmails = 0
    let alreadyProcessedCount = 0
    const results: Array<{
      id: string
      subject?: string
      from?: string
      action: string
      orderId?: string
      error?: string
    }> = []

    for (const message of response.messages) {
      try {
        const parsedEmail = await gmailClient.getEmail(message.id)

        // Skip emails from self, unless it looks like a forwarded order
        // This prevents processing outgoing emails while allowing forwards from other mailboxes
        const fromEmail = parsedEmail.from.toLowerCase()
        const emailMatch = fromEmail.match(/<([^>]+)>/) // Extract email from "Name <email>"
        const extractedEmail = emailMatch ? emailMatch[1] : fromEmail.trim()
        const isFromSelf = extractedEmail === orgEmail

        // Detect forwarded emails by standard markers added by email clients
        const looksLikeForward =
          parsedEmail.subject.toLowerCase().includes('fwd:') ||
          parsedEmail.body.includes('Forwarded Message') ||
          parsedEmail.body.includes('---------- Forwarded message')

        if (isFromSelf && !looksLikeForward) {
          skippedOwnEmails++
          results.push({
            id: parsedEmail.id,
            subject: parsedEmail.subject,
            action: 'skipped_self_email',
          })
          continue
        }

        const result = await handleEmailOrder(parsedEmail, organizationId)

        results.push({
          id: parsedEmail.id,
          subject: parsedEmail.subject,
          from: parsedEmail.from,
          action: result.action,
          orderId: result.orderId || undefined,
        })

        if (result.action === 'already_processed') {
          alreadyProcessedCount++
        } else if (result.success) {
          processedCount++
        } else {
          skippedCount++
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        results.push({
          id: message.id,
          action: 'error',
          error: errorMsg,
        })
        console.error(`[Admin Sync] Error processing email ${message.id}:`, error)
      }
    }

    return NextResponse.json({
      status: 'success',
      organization: orgData.name,
      query,
      summary: {
        total: response.messages.length,
        newlyProcessed: processedCount,
        alreadyProcessed: alreadyProcessedCount,
        skippedNotOrder: skippedCount,
        skippedOwnEmails,
      },
      results,
    })
  } catch (error) {
    console.error('[Admin Sync] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/sync-email
 *
 * Returns usage information for the endpoint
 */
export async function GET() {
  // Verify user is authenticated
  const org = await getUserOrganization()

  if (!org?.id) {
    return NextResponse.json(
      { error: 'Unauthorized - must be logged in to an organization' },
      { status: 401 }
    )
  }

  return NextResponse.json({
    endpoint: '/api/admin/sync-email',
    method: 'POST',
    description: 'Manually process missed emails',
    options: {
      messageId: {
        type: 'string',
        description: 'Gmail message ID to process a specific email',
        example: '18d1234567890abc',
      },
      query: {
        type: 'string',
        description: 'Gmail search query to find emails',
        examples: [
          'after:2025/01/06 before:2025/01/08',
          'from:customer@example.com',
          'subject:order',
          'after:2025/01/06 from:customer@example.com',
        ],
      },
      maxEmails: {
        type: 'number',
        description: 'Maximum emails to process (default: 20, max: 50)',
        default: 20,
      },
    },
    notes: [
      'Already-processed emails will be skipped (idempotent)',
      'Emails from your own Gmail address are automatically skipped',
      'Use Gmail search syntax for the query parameter',
    ],
  })
}
