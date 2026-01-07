/**
 * Admin Endpoint: Hydrate Emails
 *
 * Allows super admins to manually trigger email processing for any organization.
 * This fetches historical emails from Gmail and processes them through the AI.
 *
 * Requires super admin authentication.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { GmailClient } from '@/lib/email/gmail/client'
import { getValidAccessToken } from '@/lib/organizations/oauth'
import { handleEmailOrder } from '@/lib/email/handler'

/**
 * POST /api/admin/hydrate-emails
 *
 * Manually trigger email sync for an organization
 *
 * Body:
 * - organizationId: string (required) - The organization to sync
 * - maxEmails: number (optional) - Max emails to fetch (default: 20)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify user is authenticated and is a super admin
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_super_admin) {
      return NextResponse.json({ error: 'Forbidden - Super admin required' }, { status: 403 })
    }

    // Parse request body
    const body = await request.json()
    const { organizationId, maxEmails = 20 } = body

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
    }

    // Verify organization exists and has Gmail connected
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, gmail_email')
      .eq('id', organizationId)
      .single()

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    if (!org.gmail_email) {
      return NextResponse.json({ error: 'Organization has no Gmail connected' }, { status: 400 })
    }

    console.log(`[ADMIN] Hydrating emails for ${org.name} (${org.gmail_email})`)

    // Get access token
    const accessToken = await getValidAccessToken(organizationId)
    if (!accessToken) {
      return NextResponse.json(
        { error: 'No valid access token - user may need to re-authenticate Gmail' },
        { status: 401 }
      )
    }

    // Fetch recent emails
    const gmailClient = new GmailClient(accessToken)
    const response = await gmailClient.listMessages(maxEmails)

    if (!response.messages || response.messages.length === 0) {
      return NextResponse.json({
        status: 'success',
        message: 'No emails found in inbox',
        processed: 0,
      })
    }

    console.log(`[ADMIN] Found ${response.messages.length} emails to process`)

    // Process each email
    let processedCount = 0
    let skippedCount = 0
    let skippedOwnEmails = 0
    let errorCount = 0
    const results: Array<{
      id: string
      subject?: string
      action: string
      success: boolean
    }> = []

    // Get org email to filter out self-sent emails
    const orgEmail = org.gmail_email?.toLowerCase()

    for (const message of response.messages) {
      try {
        // Use getEmail() to fetch message with attachment data included
        const parsedEmail = await gmailClient.getEmail(message.id)

        // Skip emails sent FROM our own address (prevents loops)
        const fromEmail = parsedEmail.from.toLowerCase()
        if (orgEmail && fromEmail.includes(orgEmail)) {
          console.log(`[ADMIN] Skipping email from self: ${parsedEmail.subject}`)
          skippedOwnEmails++
          results.push({
            id: parsedEmail.id,
            subject: parsedEmail.subject,
            action: 'skipped_self_email',
            success: false,
          })
          continue
        }

        const result = await handleEmailOrder(parsedEmail, organizationId)

        results.push({
          id: parsedEmail.id,
          subject: parsedEmail.subject,
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
        errorCount++
        results.push({
          id: message.id,
          action: `error: ${errorMsg}`,
          success: false,
        })
        console.error(`[ADMIN] Error processing email ${message.id}:`, error)
      }
    }

    console.log(
      `[ADMIN] Hydration complete for ${org.name}: ${processedCount} processed, ${skippedCount} skipped, ${skippedOwnEmails} self-emails, ${errorCount} errors`
    )

    return NextResponse.json({
      status: 'success',
      organization: org.name,
      email: org.gmail_email,
      summary: {
        processed: processedCount,
        skipped: skippedCount,
        skippedOwnEmails,
        errors: errorCount,
        total: response.messages.length,
      },
      results,
    })
  } catch (error) {
    console.error('[ADMIN] Hydrate emails error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/hydrate-emails
 *
 * List organizations available for hydration (super admin only)
 */
export async function GET() {
  try {
    const supabase = await createClient()

    // Verify user is authenticated and is a super admin
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_super_admin) {
      return NextResponse.json({ error: 'Forbidden - Super admin required' }, { status: 403 })
    }

    // List all organizations with Gmail connected
    const { data: organizations, error } = await supabase
      .from('organizations')
      .select('id, name, gmail_email, gmail_last_synced_at')
      .not('gmail_email', 'is', null)
      .order('name')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      message: 'POST to this endpoint with { organizationId, maxEmails? } to hydrate emails',
      organizations: organizations || [],
    })
  } catch (error) {
    console.error('[ADMIN] List organizations error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
