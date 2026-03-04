import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { env } from '@/lib/env'

const resend = new Resend(env.RESEND_API_KEY)

interface IssueReportRequest {
  description: string
  isBlocking: boolean
  screenshotBase64?: string | null
  screenshotFilename?: string | null
  context: {
    path: string | null
    activeOrderId?: string | null
    orderStatus?: string | null
    orgId?: string | null
    orgName?: string | null
    userId?: string | null
    userEmail?: string | null
    timestamp: string
    userAgent?: string | null
  }
}

export async function POST(request: Request) {
  try {
    const body: IssueReportRequest = await request.json()
    const { description, isBlocking, screenshotBase64, screenshotFilename, context } = body

    if (!description || description.trim() === '') {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 })
    }

    // Build the email body
    const emailBody = `
ISSUE REPORT
============

Description:
${description}

Blocked Work: ${isBlocking ? 'YES - This blocked the user\'s work' : 'No'}

CONTEXT
-------
Timestamp: ${context.timestamp}
Path: ${context.path || 'Unknown'}
User ID: ${context.userId || 'Unknown'}
User Email: ${context.userEmail || 'Unknown'}
Org ID: ${context.orgId || 'Unknown'}
Org Name: ${context.orgName || 'Unknown'}
Active Order ID: ${context.activeOrderId || 'None'}
Order Status: ${context.orderStatus || 'N/A'}

BROWSER INFO
------------
User Agent: ${context.userAgent || 'Unknown'}

${screenshotBase64 ? 'Screenshot: Attached' : 'Screenshot: Not provided'}
`.trim()

    // Prepare attachments if screenshot is provided
    const attachments = screenshotBase64 && screenshotFilename ? [
      {
        filename: screenshotFilename,
        content: screenshotBase64,
      }
    ] : undefined

    // Send email via Resend
    const { error } = await resend.emails.send({
      from: 'Kosha Issues <onboarding@resend.dev>',
      to: 'khasnavistarun@gmail.com',
      subject: `[Kosha Issue] ${isBlocking ? '🚨 BLOCKING: ' : ''}${description.slice(0, 50)}${description.length > 50 ? '...' : ''}`,
      text: emailBody,
      attachments,
    })

    if (error) {
      console.error('Failed to send issue report email:', error)
      return NextResponse.json({ error: 'Failed to send report' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error processing issue report:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
