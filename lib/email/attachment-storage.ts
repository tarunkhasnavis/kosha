/**
 * Attachment Storage Service
 *
 * Handles storing attachments:
 * - Raw files → Supabase Storage (always)
 * - Processed content → Database (PDF text, Excel JSON, image base64)
 */

import { createServiceClient } from '@/utils/supabase/service'
import type { EmailAttachment } from './gmail/client'
import type { ProcessedAttachment } from './attachments'

const STORAGE_BUCKET = 'order-attachments'

export interface StoredAttachment {
  id: string
  orderId: string | null
  orderEmailId: string
  organizationId: string
  filename: string
  mimeType: string
  fileSize: number
  storagePath: string | null
  processedContent: string | null
  processedType: string | null
  contentId: string | null
  isInline: boolean
}

/**
 * Store a processed attachment in the database and Supabase Storage
 */
export async function storeAttachment(params: {
  orderEmailId: string
  orderId?: string | null
  organizationId: string
  rawAttachment: EmailAttachment
  processedAttachment: ProcessedAttachment
}): Promise<StoredAttachment | null> {
  const { orderEmailId, orderId, organizationId, rawAttachment, processedAttachment } = params
  console.log(`[STORE-DEBUG] storeAttachment called: file="${rawAttachment.filename}" mime=${rawAttachment.mimeType} size=${rawAttachment.size} hasData=${!!rawAttachment.data} orderEmailId=${orderEmailId} orgId=${organizationId}`)

  const supabase = createServiceClient()

  // Determine processed content and type
  let processedContent: string | null = null
  let processedType: string | null = null

  if (processedAttachment.pdfText) {
    processedContent = processedAttachment.pdfText
    processedType = 'pdf_text'
  } else if (processedAttachment.excelData) {
    processedContent = processedAttachment.excelData
    processedType = 'excel_json'
  } else if (processedAttachment.images && processedAttachment.images.length > 0) {
    // Store image base64 data (join multiple pages with delimiter)
    processedContent = processedAttachment.images.join('|||')
    processedType = 'image_base64'
  }

  console.log(`[STORE-DEBUG] processedType=${processedType} processedContentLen=${processedContent?.length ?? 0}`)

  // Always store raw file in Supabase Storage
  let storagePath: string | null = null
  if (rawAttachment.data) {
    try {
      // Create path: org_id/order_email_id/filename
      const path = `${organizationId}/${orderEmailId}/${rawAttachment.filename}`

      // Convert base64 to buffer for upload
      const fileBuffer = Buffer.from(rawAttachment.data, 'base64')
      console.log(`[STORE-DEBUG] Uploading to storage bucket "${STORAGE_BUCKET}" path="${path}" bufferSize=${fileBuffer.length}`)

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, fileBuffer, {
          contentType: rawAttachment.mimeType,
          upsert: true,
        })

      if (uploadError) {
        console.error(`[STORE-DEBUG] Storage upload FAILED: ${uploadError.message}`)
      } else {
        storagePath = path
        console.log(`[STORE-DEBUG] Storage upload SUCCESS: ${path}`)
      }
    } catch (error) {
      console.error('[STORE-DEBUG] Storage upload EXCEPTION:', error)
    }
  } else {
    console.log(`[STORE-DEBUG] No raw data to upload to storage`)
  }

  // Insert into order_attachments table
  console.log(`[STORE-DEBUG] Inserting into order_attachments table...`)
  const { data, error } = await supabase
    .from('order_attachments')
    .insert({
      order_id: orderId || null,
      order_email_id: orderEmailId,
      organization_id: organizationId,
      filename: rawAttachment.filename,
      mime_type: rawAttachment.mimeType,
      file_size: rawAttachment.size,
      storage_path: storagePath,
      processed_content: processedContent,
      processed_type: processedType,
      content_id: null,
      is_inline: false,
    })
    .select()
    .single()

  if (error) {
    console.error('[STORE-DEBUG] DB insert FAILED:', error)
    return null
  }

  console.log(`[STORE-DEBUG] DB insert SUCCESS: id=${data.id}`)

  console.log(`📎 Stored attachment ${rawAttachment.filename} (${processedType || 'raw'})`)

  return {
    id: data.id,
    orderId: data.order_id,
    orderEmailId: data.order_email_id,
    organizationId: data.organization_id,
    filename: data.filename,
    mimeType: data.mime_type,
    fileSize: data.file_size,
    storagePath: data.storage_path,
    processedContent: data.processed_content,
    processedType: data.processed_type,
    contentId: data.content_id,
    isInline: data.is_inline,
  }
}

/**
 * Store multiple attachments for an email
 */
export async function storeAllAttachments(params: {
  orderEmailId: string
  orderId?: string | null
  organizationId: string
  rawAttachments: EmailAttachment[]
  processedAttachments: ProcessedAttachment[]
}): Promise<StoredAttachment[]> {
  const { orderEmailId, orderId, organizationId, rawAttachments, processedAttachments } = params
  const results: StoredAttachment[] = []

  // Match processed attachments with raw attachments by filename
  for (const processed of processedAttachments) {
    const raw = rawAttachments.find(r => r.filename === processed.filename)
    if (!raw) continue

    const stored = await storeAttachment({
      orderEmailId,
      orderId,
      organizationId,
      rawAttachment: raw,
      processedAttachment: processed,
    })

    if (stored) {
      results.push(stored)
    }
  }

  return results
}

/**
 * Update attachments with order_id after order is created
 */
export async function linkAttachmentsToOrder(
  orderEmailId: string,
  orderId: string
): Promise<void> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('order_attachments')
    .update({ order_id: orderId })
    .eq('order_email_id', orderEmailId)

  if (error) {
    console.error('Failed to link attachments to order:', error)
  }
}

/**
 * Get attachments for an order
 */
export async function getOrderAttachments(orderId: string): Promise<StoredAttachment[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('order_attachments')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })

  if (error || !data) {
    console.error('Failed to get order attachments:', error)
    return []
  }

  return data.map(row => ({
    id: row.id,
    orderId: row.order_id,
    orderEmailId: row.order_email_id,
    organizationId: row.organization_id,
    filename: row.filename,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    storagePath: row.storage_path,
    processedContent: row.processed_content,
    processedType: row.processed_type,
    contentId: row.content_id,
    isInline: row.is_inline,
  }))
}

/**
 * Get attachments for an order email (before order is created)
 */
export async function getEmailAttachments(orderEmailId: string): Promise<StoredAttachment[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('order_attachments')
    .select('*')
    .eq('order_email_id', orderEmailId)
    .order('created_at', { ascending: true })

  if (error || !data) {
    console.error('Failed to get email attachments:', error)
    return []
  }

  return data.map(row => ({
    id: row.id,
    orderId: row.order_id,
    orderEmailId: row.order_email_id,
    organizationId: row.organization_id,
    filename: row.filename,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    storagePath: row.storage_path,
    processedContent: row.processed_content,
    processedType: row.processed_type,
    contentId: row.content_id,
    isInline: row.is_inline,
  }))
}

/**
 * Convert stored attachments back to ProcessedAttachment format for retry
 */
export function storedToProcessed(stored: StoredAttachment[]): ProcessedAttachment[] {
  return stored.map(att => {
    const base: ProcessedAttachment = {
      filename: att.filename,
      type: att.mimeType.startsWith('image/') ? 'image' :
            att.mimeType === 'application/pdf' ? 'pdf' :
            att.mimeType.includes('spreadsheet') || att.mimeType.includes('excel') ? 'excel' :
            'unsupported',
    }

    if (att.processedType === 'pdf_text' && att.processedContent) {
      base.pdfText = att.processedContent
    } else if (att.processedType === 'excel_json' && att.processedContent) {
      base.excelData = att.processedContent
    } else if (att.processedType === 'image_base64' && att.processedContent) {
      // Split back multiple images if they were joined
      base.images = att.processedContent.split('|||')
    }

    return base
  })
}

/**
 * Get a signed URL for downloading an attachment from storage
 */
export async function getAttachmentDownloadUrl(
  storagePath: string,
  expiresIn: number = 3600
): Promise<string | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, expiresIn)

  if (error || !data) {
    console.error('Failed to get attachment download URL:', error)
    return null
  }

  return data.signedUrl
}
