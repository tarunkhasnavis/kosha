/// <reference types="node" />

/**
 * Types for Gmail API responses
 */
export interface GmailMessage {
  id: string
  threadId: string
  snippet: string
  internalDate: string
  payload: {
    headers: Array<{ name: string; value: string }>
    body?: { data?: string; size?: number }
    parts?: Array<{
      mimeType: string
      body?: { data?: string; size?: number }
      parts?: Array<{
        mimeType: string
        body?: { data?: string; size?: number }
      }>
    }>
  }
}

export interface ParsedEmail {
  id: string
  threadId: string
  subject: string
  from: string
  to: string
  date: string
  body: string
  snippet: string
}

/**
 * Gmail API Client
 *
 * This class handles communication with the Gmail API to read user emails.
 * It requires a valid Google OAuth access token.
 *
 * For creating an authenticated client, see lib/gmail/auth.ts
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
   * Get a specific email message by ID
   *
   * @param messageId - The Gmail message ID
   * @returns Full message details including headers and body
   */
  async getMessage(messageId: string) {
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

    return {
      id: message.id,
      threadId: message.threadId,
      subject: getHeader('Subject'),
      from: getHeader('From'),
      to: getHeader('To'),
      date: getHeader('Date'),
      body: this.extractBody(message.payload),
      snippet: message.snippet
    }
  }

  /**
   * Extract email body from Gmail message payload
   *
   * Gmail stores email bodies in a nested structure. This method:
   * 1. Checks for direct body data
   * 2. Searches through parts for text/plain or text/html
   * 3. Decodes base64url encoded content
   *
   * @param payload - The message payload from Gmail API
   * @returns The decoded email body text
   */
  private extractBody(payload: GmailMessage['payload']): string {
    // Try direct body first
    if (payload.body?.data) {
      return this.decodeBase64Url(payload.body.data)
    }

    // Check parts for email body
    if (payload.parts) {
      for (const part of payload.parts) {
        // Prefer plain text
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return this.decodeBase64Url(part.body.data)
        }

        // Fall back to HTML
        if (part.mimeType === 'text/html' && part.body?.data) {
          return this.decodeBase64Url(part.body.data)
        }

        // Check nested parts (for multipart messages)
        if (part.parts) {
          for (const nestedPart of part.parts) {
            if (nestedPart.mimeType === 'text/plain' && nestedPart.body?.data) {
              return this.decodeBase64Url(nestedPart.body.data)
            }
          }
        }
      }
    }

    return ''
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
