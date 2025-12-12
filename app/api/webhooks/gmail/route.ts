/**
 * Gmail Pub/Sub Webhook Endpoint
 *
 * Receives push notifications from Google Pub/Sub when Gmail inbox changes.
 *
 * Flow:
 * 1. Gmail detects inbox change → sends to Pub/Sub topic
 * 2. Pub/Sub pushes notification to this endpoint
 * 3. We decode the notification to get email address and historyId
 * 4. Fetch new emails using Gmail History API
 * 5. Process emails through handleEmailOrder()
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  findOrganizationByGmailEmail,
  getGmailHistory,
  updateHistoryId,
} from '@/lib/gmail/watch'
import { GmailClient } from '@/lib/gmail/client'
import { getValidAccessToken } from '@/lib/actions/oauthTokens'
import { handleEmailOrder } from '@/lib/actions/handleEmailOrder'

interface PubSubMessage {
  message: {
    data: string // Base64 encoded JSON
    messageId: string
    publishTime: string
  }
  subscription: string
}

interface GmailNotification {
  emailAddress: string
  historyId: string
}

/**
 * POST /api/webhooks/gmail
 *
 * Receives Pub/Sub push notifications from Gmail
 */
export async function POST(request: NextRequest) {
  try {
    const body: PubSubMessage = await request.json()

    // Validate the request has required fields
    if (!body.message?.data) {
      console.error('Invalid Pub/Sub message: missing data')
      return NextResponse.json({ error: 'Invalid message' }, { status: 400 })
    }

    // Decode the base64 notification data
    const decodedData = Buffer.from(body.message.data, 'base64').toString('utf-8')
    const notification: GmailNotification = JSON.parse(decodedData)

    console.log(`Gmail notification received for ${notification.emailAddress}, historyId: ${notification.historyId}`)

    // Find the organization by email
    const organization = await findOrganizationByGmailEmail(notification.emailAddress)

    if (!organization) {
      console.log(`No organization found for email ${notification.emailAddress}`)
      // Return 200 to acknowledge the message (don't retry)
      return NextResponse.json({ status: 'ignored', reason: 'unknown email' })
    }

    // Get the last processed history ID
    const lastHistoryId = organization.gmail_last_history_id

    if (!lastHistoryId) {
      console.log(`No history ID stored for org ${organization.id}, skipping incremental sync`)
      // Store the new history ID for future syncs
      await updateHistoryId(organization.id, notification.historyId)
      return NextResponse.json({ status: 'initialized', historyId: notification.historyId })
    }

    // Fetch new messages since last history ID
    const { messageIds, newHistoryId } = await getGmailHistory(
      organization.id,
      lastHistoryId
    )

    if (messageIds.length === 0) {
      console.log(`No new inbox messages for org ${organization.id}`)
      // Update history ID even if no messages (to stay current)
      if (newHistoryId) {
        await updateHistoryId(organization.id, newHistoryId)
      }
      return NextResponse.json({ status: 'no_new_messages' })
    }

    console.log(`Processing ${messageIds.length} new messages for org ${organization.name}`)

    // Get access token and create Gmail client
    const accessToken = await getValidAccessToken(organization.id)
    if (!accessToken) {
      console.error(`No valid access token for org ${organization.id}`)
      return NextResponse.json({ error: 'No access token' }, { status: 500 })
    }

    const gmailClient = new GmailClient(accessToken)

    // Process each new message
    let processedCount = 0
    let skippedOwnEmails = 0
    const errors: string[] = []

    // Get the organization's Gmail email to filter out our own sent emails
    const orgEmail = organization.gmail_email?.toLowerCase()

    for (const messageId of messageIds) {
      try {
        // Fetch full message content
        const fullMessage = await gmailClient.getMessage(messageId)
        const parsedEmail = gmailClient.parseMessage(fullMessage)

        // Skip emails sent FROM our own address (prevents infinite loops when we send clarification emails)
        const fromEmail = parsedEmail.from.toLowerCase()
        if (orgEmail && fromEmail.includes(orgEmail)) {
          console.log(`Skipping email from self: ${parsedEmail.subject}`)
          skippedOwnEmails++
          continue
        }

        // Process through existing order handler
        const result = await handleEmailOrder(parsedEmail, organization.id)

        if (result.success) {
          processedCount++
          console.log(`Processed email ${parsedEmail.id}: ${result.action}`)
        } else {
          console.log(`Skipped email ${parsedEmail.id}: ${result.action}`)
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`Email ${messageId}: ${errorMsg}`)
        console.error(`Error processing email ${messageId}:`, error)
      }
    }

    // Update history ID to latest
    if (newHistoryId) {
      await updateHistoryId(organization.id, newHistoryId)
    } else {
      // Use the notification's historyId if we didn't get one from history API
      await updateHistoryId(organization.id, notification.historyId)
    }

    console.log(`Webhook complete: ${processedCount}/${messageIds.length} emails processed for ${organization.name} (${skippedOwnEmails} self-emails skipped)`)

    return NextResponse.json({
      status: 'success',
      processed: processedCount,
      skippedSelfEmails: skippedOwnEmails,
      total: messageIds.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Webhook error:', error)
    // Return 200 to prevent Pub/Sub retries on parse errors
    // Return 500 only for transient errors we want retried
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 200 }
    )
  }
}

/**
 * GET /api/webhooks/gmail
 *
 * Health check / verification endpoint
 * Pub/Sub may send GET requests to verify the endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'gmail-pubsub-webhook',
    timestamp: new Date().toISOString(),
  })
}
