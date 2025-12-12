'use server'

import { getValidAccessToken } from '@/lib/actions/oauthTokens'

/**
 * Send a reply email to a Gmail thread (Reply-All)
 *
 * @param threadId - The Gmail thread ID to reply to
 * @param replyBody - The text content of the reply
 * @param subject - Optional subject line (defaults to Re: original subject)
 * @param organizationId - Organization ID to get OAuth tokens
 * @returns Success status and message ID
 */
export async function sendGmailReply(
  threadId: string,
  replyBody: string,
  subject?: string,
  organizationId?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // SAFETY: Never send empty emails
    if (!replyBody || replyBody.trim() === '') {
      console.error('🚫 Attempted to send empty email - blocked')
      return {
        success: false,
        error: 'Cannot send empty email body'
      }
    }

    // Get access token from database (auto-refreshes if expired)
    let accessToken: string | null = null

    if (organizationId) {
      accessToken = await getValidAccessToken(organizationId)
    }

    if (!accessToken) {
      return {
        success: false,
        error: 'Gmail access token not available - organization may need to re-authenticate'
      }
    }

    // Get the original thread to extract recipient info
    const threadResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!threadResponse.ok) {
      const error = await threadResponse.text()
      return {
        success: false,
        error: `Failed to fetch thread: ${threadResponse.status} - ${error}`
      }
    }

    const threadData = await threadResponse.json()
    const lastMessage = threadData.messages[threadData.messages.length - 1]
    const headers = lastMessage.payload.headers

    // Extract recipient info from the last message
    const getHeader = (name: string) =>
      headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || ''

    const to = getHeader('From') // Reply to the sender
    const cc = getHeader('Cc')   // Include CC recipients (Reply-All)
    const originalSubject = getHeader('Subject')
    const replySubject = subject || (originalSubject.startsWith('Re:') ? originalSubject : `Re: ${originalSubject}`)
    const messageId = getHeader('Message-ID')
    const references = getHeader('References')

    // Build email in RFC 2822 format
    const emailLines = [
      `To: ${to}`,
      cc ? `Cc: ${cc}` : '',
      `Subject: ${replySubject}`,
      `In-Reply-To: ${messageId}`,
      `References: ${references ? `${references} ${messageId}` : messageId}`,
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      replyBody
    ]

    // Remove empty header lines (but keep the separator between headers and body)
    const emailHeaders = emailLines.slice(0, -2).filter(line => line !== '')
    const separator = ''
    const body = replyBody

    const email = [...emailHeaders, separator, body].join('\r\n')

    console.log('📧 Email being sent:')
    console.log('To:', to)
    console.log('Subject:', replySubject)
    console.log('Body:', replyBody)
    console.log('Full email length:', email.length)

    // Encode email in base64url format
    const encodedEmail = Buffer.from(email)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    // Send the email
    const sendResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          raw: encodedEmail,
          threadId: threadId
        })
      }
    )

    if (!sendResponse.ok) {
      const error = await sendResponse.text()
      return {
        success: false,
        error: `Failed to send email: ${sendResponse.status} - ${error}`
      }
    }

    const sentMessage = await sendResponse.json()

    return {
      success: true,
      messageId: sentMessage.id
    }

  } catch (error) {
    console.error('Error sending Gmail reply:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
