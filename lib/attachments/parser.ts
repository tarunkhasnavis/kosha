import * as XLSX from 'xlsx'
import { pdf } from 'pdf-to-img'
import type { EmailAttachment } from '@/lib/gmail/client'

/**
 * Supported attachment types for processing
 */
export type AttachmentType = 'image' | 'pdf' | 'excel' | 'unsupported'

/**
 * Processed attachment content ready for AI
 */
export interface ProcessedAttachment {
  filename: string
  type: AttachmentType
  // For images and PDF pages: base64 encoded image data
  images?: string[]
  // For Excel: JSON representation of spreadsheet data
  excelData?: string
}

/**
 * MIME types we support for processing
 */
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp', 'image/gif']
const PDF_MIME_TYPES = ['application/pdf']
const EXCEL_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'application/vnd.oasis.opendocument.spreadsheet', // .ods
]

/**
 * Determine the type of attachment based on MIME type
 */
export function getAttachmentType(mimeType: string): AttachmentType {
  if (IMAGE_MIME_TYPES.includes(mimeType)) return 'image'
  if (PDF_MIME_TYPES.includes(mimeType)) return 'pdf'
  if (EXCEL_MIME_TYPES.includes(mimeType)) return 'excel'
  return 'unsupported'
}

/**
 * Check if an attachment is a type we can process
 */
export function isSupportedAttachment(attachment: EmailAttachment): boolean {
  return getAttachmentType(attachment.mimeType) !== 'unsupported'
}

/**
 * Process an image attachment
 * Images are already in base64 format from Gmail, ready for OpenAI vision
 */
function processImage(attachment: EmailAttachment): ProcessedAttachment {
  if (!attachment.data) {
    console.warn(`Image attachment ${attachment.filename} has no data`)
    return { filename: attachment.filename, type: 'image', images: [] }
  }

  return {
    filename: attachment.filename,
    type: 'image',
    images: [attachment.data],
  }
}

/**
 * Process a PDF attachment by converting pages to images
 * Uses pdf-to-img to render PDF pages as PNG images
 */
async function processPdf(attachment: EmailAttachment): Promise<ProcessedAttachment> {
  if (!attachment.data) {
    console.warn(`PDF attachment ${attachment.filename} has no data`)
    return { filename: attachment.filename, type: 'pdf', images: [] }
  }

  try {
    // Convert base64 to Buffer
    const pdfBuffer = Buffer.from(attachment.data, 'base64')

    // Convert PDF pages to images using async iterator
    const pdfDocument = await pdf(pdfBuffer, { scale: 2.0 })
    const base64Images: string[] = []

    // Iterate through pages and convert each to base64
    for await (const pageImage of pdfDocument) {
      base64Images.push(pageImage.toString('base64'))
    }

    console.log(`Converted PDF ${attachment.filename} to ${base64Images.length} images`)

    return {
      filename: attachment.filename,
      type: 'pdf',
      images: base64Images,
    }
  } catch (error) {
    console.error(`Failed to process PDF ${attachment.filename}:`, error)
    return { filename: attachment.filename, type: 'pdf', images: [] }
  }
}

/**
 * Process an Excel attachment by parsing to JSON
 * Extracts all sheets and their data as structured JSON
 */
function processExcel(attachment: EmailAttachment): ProcessedAttachment {
  if (!attachment.data) {
    console.warn(`Excel attachment ${attachment.filename} has no data`)
    return { filename: attachment.filename, type: 'excel', excelData: '{}' }
  }

  try {
    // Convert base64 to Buffer
    const excelBuffer = Buffer.from(attachment.data, 'base64')

    // Parse the Excel file
    const workbook = XLSX.read(excelBuffer, { type: 'buffer' })

    // Extract data from all sheets
    const sheetsData: Record<string, unknown[]> = {}
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName]
      // Convert sheet to JSON array (each row is an object with column headers as keys)
      sheetsData[sheetName] = XLSX.utils.sheet_to_json(sheet, { defval: '' })
    }

    const jsonString = JSON.stringify(sheetsData, null, 2)
    console.log(`Parsed Excel ${attachment.filename}: ${workbook.SheetNames.length} sheets`)

    return {
      filename: attachment.filename,
      type: 'excel',
      excelData: jsonString,
    }
  } catch (error) {
    console.error(`Failed to process Excel ${attachment.filename}:`, error)
    return { filename: attachment.filename, type: 'excel', excelData: '{}' }
  }
}

/**
 * Process a single attachment based on its type
 */
export async function processAttachment(attachment: EmailAttachment): Promise<ProcessedAttachment> {
  const type = getAttachmentType(attachment.mimeType)

  switch (type) {
    case 'image':
      return processImage(attachment)
    case 'pdf':
      return await processPdf(attachment)
    case 'excel':
      return processExcel(attachment)
    default:
      return { filename: attachment.filename, type: 'unsupported' }
  }
}

/**
 * Process all attachments from an email
 * Filters to supported types and processes each one
 */
export async function processAllAttachments(
  attachments: EmailAttachment[]
): Promise<ProcessedAttachment[]> {
  const supportedAttachments = attachments.filter(isSupportedAttachment)

  if (supportedAttachments.length === 0) {
    return []
  }

  console.log(`Processing ${supportedAttachments.length} supported attachments`)

  const results = await Promise.all(
    supportedAttachments.map((attachment) => processAttachment(attachment))
  )

  return results
}

/**
 * Prepare attachment content for OpenAI multimodal API
 *
 * Returns:
 * - textContent: Text to append to the message (Excel data)
 * - imageUrls: Array of base64 data URLs for images/PDFs
 */
export function prepareAttachmentsForAI(processedAttachments: ProcessedAttachment[]): {
  textContent: string
  imageUrls: string[]
} {
  const textParts: string[] = []
  const imageUrls: string[] = []

  for (const attachment of processedAttachments) {
    if (attachment.type === 'excel' && attachment.excelData) {
      textParts.push(`\n--- Excel Attachment: ${attachment.filename} ---\n${attachment.excelData}\n`)
    }

    if (attachment.images && attachment.images.length > 0) {
      for (let i = 0; i < attachment.images.length; i++) {
        const base64Data = attachment.images[i]
        // Determine the image type for the data URL
        const imageType = attachment.type === 'pdf' ? 'image/png' : 'image/jpeg'
        const label = attachment.type === 'pdf'
          ? `PDF page ${i + 1} of ${attachment.filename}`
          : attachment.filename

        // OpenAI expects data URLs in the format: data:<mime>;base64,<data>
        imageUrls.push(`data:${imageType};base64,${base64Data}`)
        console.log(`Added image for AI: ${label}`)
      }
    }
  }

  return {
    textContent: textParts.join('\n'),
    imageUrls,
  }
}
