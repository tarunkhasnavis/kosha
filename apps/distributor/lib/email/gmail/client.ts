/// <reference types="node" />

/**
 * Types for Gmail API responses
 */
export interface GmailMessagePart {
  partId?: string
  mimeType: string
  filename?: string
  headers?: Array<{ name: string; value: string }>
  body?: {
    attachmentId?: string
    data?: string
    size?: number
  }
  parts?: GmailMessagePart[]
}

export interface GmailMessage {
  id: string
  threadId: string
  snippet: string
  internalDate: string
  payload: {
    headers: Array<{ name: string; value: string }>
    body?: { data?: string; size?: number }
    parts?: GmailMessagePart[]
  }
}

/**
 * Attachment metadata extracted from email
 */
export interface EmailAttachment {
  attachmentId: string
  filename: string
  mimeType: string
  size: number
  data?: string // base64 encoded content (populated after fetching)
}

export interface ParsedEmail {
  id: string
  threadId: string
  messageId: string // RFC822 Message-ID header (unique identifier for Gmail search)
  subject: string
  from: string
  to: string
  date: string
  body: string // Plain text body (preferred for AI processing)
  bodyHtml?: string // HTML body (for visual display, may not be present)
  snippet: string
  attachments: EmailAttachment[]
}

/**
 * Gmail API Client
 *
 * This class handles communication with the Gmail API to read user emails.
 * It requires a valid Google OAuth access token.
 *
 * For creating an authenticated client, see lib/email/gmail/auth.ts
 */
export class GmailClient {
  private accessToken: string

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  /**
   * List messages from the user's Gmail inbox
   *
   * @param maxResults - Maximum number of messages to return (default: 10)
   * @param query - Gmail search query (e.g., "is:unread", "from:example@gmail.com")
   * @param labelIds - Label IDs to filter by (default: ["INBOX"] - only inbox emails)
   * @returns List of message IDs and thread IDs
   */
  async listMessages(
    maxResults: number = 10,
    query?: string,
    labelIds: string[] = ['INBOX']
  ) {
    const params = new URLSearchParams({
      maxResults: String(maxResults),
    })

    if (query) {
      params.append('q', query)
    }

    // Add label filters (e.g., INBOX, SENT, TRASH, DRAFT)
    if (labelIds && labelIds.length > 0) {
      labelIds.forEach(labelId => {
        params.append('labelIds', labelId)
      })
    }

    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Gmail API error: ${response.status} - ${error}`)
    }

    const data = await response.json()
    return data
  }

  /**
   * Get raw Gmail message by ID (metadata only, no attachment data)
   *
   * @param messageId - The Gmail message ID
   * @returns Raw Gmail API response
   */
  async getMessage(messageId: string): Promise<GmailMessage> {
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Gmail API error: ${response.status} - ${error}`)
    }

    const data = await response.json()
    return data
  }

  /**
   * Get a fully parsed email with attachment data included
   *
   * This is the main method for fetching emails. It:
   * 1. Fetches the raw message from Gmail API
   * 2. Parses headers, body, and attachment metadata
   * 3. Fetches attachment binary data for all attachments
   *
   * @param messageId - The Gmail message ID
   * @returns Fully parsed email with attachment data ready for processing
   */
  async getEmail(messageId: string): Promise<ParsedEmail> {
    const message = await this.getMessage(messageId)
    const parsedEmail = this.parseMessage(message)

    // Fetch attachment data if there are any attachments
    if (parsedEmail.attachments.length > 0) {
      return await this.fetchAttachments(parsedEmail)
    }

    return parsedEmail
  }

  /**
   * Get attachment content by ID
   *
   * Gmail stores large attachments separately and returns an attachmentId.
   * This method fetches the actual attachment data.
   *
   * @param messageId - The Gmail message ID
   * @param attachmentId - The attachment ID from the message parts
   * @returns Base64 encoded attachment data
   */
  async getAttachment(messageId: string, attachmentId: string): Promise<string> {
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Gmail API error fetching attachment: ${response.status} - ${error}`)
    }

    const data = await response.json()
    // Gmail returns base64url encoded data, convert to standard base64
    return data.data.replace(/-/g, '+').replace(/_/g, '/')
  }

  /**
   * Fetch all attachment data for a parsed email
   *
   * Populates the `data` field for each attachment with base64 content
   *
   * @param email - The parsed email with attachment metadata
   * @returns The email with attachment data populated
   */
  async fetchAttachments(email: ParsedEmail): Promise<ParsedEmail> {
    const attachmentsWithData = await Promise.all(
      email.attachments.map(async (attachment) => {
        try {
          const data = await this.getAttachment(email.id, attachment.attachmentId)
          return { ...attachment, data }
        } catch (error) {
          console.error(`Failed to fetch attachment ${attachment.filename}:`, error)
          return attachment // Return without data if fetch fails
        }
      })
    )

    return { ...email, attachments: attachmentsWithData }
  }

  /**
   * Parse a Gmail message into a readable format
   *
   * Extracts headers (subject, from, to, date) and email body from the complex Gmail API response
   *
   * @param message - The raw Gmail message from the API
   * @returns Parsed email with extracted fields
   */
  parseMessage(message: GmailMessage): ParsedEmail {
    const headers = message.payload.headers
    const getHeader = (name: string) =>
      headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || ''

    // Normalize the email date to ISO format for consistent storage and display
    // Gmail Date header is RFC 2822 format (e.g., "Tue, 7 Jan 2025 10:30:00 -0800")
    const rawDate = getHeader('Date')
    let normalizedDate = rawDate
    if (rawDate) {
      try {
        const parsed = new Date(rawDate)
        if (!isNaN(parsed.getTime())) {
          normalizedDate = parsed.toISOString()
        }
      } catch {
        // Keep raw date if parsing fails
      }
    }

    // Extract both plain text and HTML bodies
    const { text, html } = this.extractBodies(message.payload)

    return {
      id: message.id,
      threadId: message.threadId,
      messageId: getHeader('Message-ID') || getHeader('Message-Id'),
      subject: getHeader('Subject'),
      from: getHeader('From'),
      to: getHeader('To'),
      date: normalizedDate,
      body: text,
      bodyHtml: html,
      snippet: message.snippet,
      attachments: this.extractAttachments(message.payload),
    }
  }

  /**
   * Extract attachment metadata from email parts
   *
   * Recursively searches through MIME parts to find attachments
   * (parts with filename and attachmentId)
   */
  private extractAttachments(payload: GmailMessage['payload']): EmailAttachment[] {
    const attachments: EmailAttachment[] = []

    const processparts = (parts: GmailMessagePart[] | undefined) => {
      if (!parts) return

      for (const part of parts) {
        // Check if this part is an attachment (has filename and attachmentId)
        if (part.filename && part.filename.length > 0 && part.body?.attachmentId) {
          attachments.push({
            attachmentId: part.body.attachmentId,
            filename: part.filename,
            mimeType: part.mimeType,
            size: part.body.size || 0,
          })
        }

        // Recursively check nested parts
        if (part.parts) {
          processparts(part.parts)
        }
      }
    }

    processparts(payload.parts)
    return attachments
  }

  /**
   * Extract both plain text and HTML bodies from Gmail message payload
   *
   * Gmail stores email bodies in a nested structure. This method extracts both:
   * - text/plain for AI processing
   * - text/html for visual display
   *
   * @param payload - The message payload from Gmail API
   * @returns Object with text and html bodies
   */
  private extractBodies(payload: GmailMessage['payload']): { text: string; html?: string } {
    let text = ''
    let html: string | undefined

    // Try direct body first (simple emails)
    if (payload.body?.data) {
      const decoded = this.decodeBase64Url(payload.body.data)
      // Can't determine type from direct body, assume text
      return { text: decoded }
    }

    // Search through parts for text/plain and text/html
    const findBodies = (parts: GmailMessagePart[] | undefined) => {
      if (!parts) return

      for (const part of parts) {
        if (part.mimeType === 'text/plain' && part.body?.data && !text) {
          text = this.decodeBase64Url(part.body.data)
        }

        if (part.mimeType === 'text/html' && part.body?.data && !html) {
          html = this.decodeBase64Url(part.body.data)
        }

        // Recursively check nested parts (for multipart messages)
        if (part.parts) {
          findBodies(part.parts)
        }
      }
    }

    if (payload.parts) {
      findBodies(payload.parts)
    }

    // If no plain text found, fall back to HTML (strip tags for AI)
    if (!text && html) {
      // Simple HTML tag stripping for fallback
      text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    }

    return { text, html }
  }

  /**
   * Decode base64url encoded string to UTF-8 text
   *
   * Gmail encodes email content using base64url (URL-safe base64).
   * This converts it back to readable text.
   *
   * @param data - Base64url encoded string
   * @returns Decoded UTF-8 text
   */
  private decodeBase64Url(data: string): string {
    try {
      // Convert base64url to standard base64
      const base64 = data.replace(/-/g, '+').replace(/_/g, '/')

      // Add padding if needed
      const padding = base64.length % 4
      const padded = padding ? base64 + '='.repeat(4 - padding) : base64

      // Decode to UTF-8
      return Buffer.from(padded, 'base64').toString('utf-8')
    } catch (error) {
      console.error('Error decoding base64url:', error)
      return ''
    }
  }
}
