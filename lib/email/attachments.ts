/**
 * Attachment Processor
 *
 * Processes email attachments (images, PDFs, Excel files, HTML) into formats
 * suitable for AI processing via OpenAI's multimodal API.
 *
 * - Images: Pass through as base64
 * - PDFs: Convert pages to images (or extract text in serverless)
 * - Excel: Parse to JSON
 * - HTML: Extract text content using jsdom
 */

import * as XLSX from 'xlsx'
import type { EmailAttachment } from './gmail/client'

// Dynamic import for pdf-to-img to prevent import-time crashes in serverless environments
// The library uses pdfjs-dist which requires browser APIs (DOMMatrix, canvas) that don't exist in Node.js
let pdfToImg: typeof import('pdf-to-img') | null = null
let pdfImportError: Error | null = null

// Try to import pdf-to-img, but don't crash if it fails
const loadPdfToImg = async () => {
  if (pdfToImg !== null || pdfImportError !== null) {
    return pdfToImg
  }
  try {
    pdfToImg = await import('pdf-to-img')
    return pdfToImg
  } catch (error) {
    pdfImportError = error instanceof Error ? error : new Error(String(error))
    console.warn('⚠️ pdf-to-img library could not be loaded (likely serverless environment):', pdfImportError.message)
    return null
  }
}

/**
 * Supported attachment types for processing
 */
export type AttachmentType = 'image' | 'pdf' | 'excel' | 'html' | 'unsupported'

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
  // For PDFs: extracted text content (fallback when image conversion fails)
  pdfText?: string
  // For HTML: extracted text content from HTML
  htmlContent?: string
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
const HTML_MIME_TYPES = ['text/html']

/**
 * Determine the type of attachment based on MIME type
 * Handles charset suffixes (e.g., "text/html; charset=utf-8") and case variations
 */
export function getAttachmentType(mimeType: string): AttachmentType {
  // Normalize: lowercase and strip charset/parameters
  const normalizedMime = mimeType.toLowerCase().split(';')[0].trim()

  if (IMAGE_MIME_TYPES.includes(normalizedMime)) return 'image'
  if (PDF_MIME_TYPES.includes(normalizedMime)) return 'pdf'
  if (EXCEL_MIME_TYPES.includes(normalizedMime)) return 'excel'
  if (HTML_MIME_TYPES.includes(normalizedMime)) return 'html'
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
 * Extract text from PDF using unpdf (serverless-compatible)
 * unpdf is specifically designed for serverless/edge environments
 * and ships with a serverless build of PDF.js that doesn't require DOMMatrix
 */
async function extractPdfText(pdfBuffer: Buffer, filename: string): Promise<string | null> {
  try {
    // Dynamic import for unpdf
    const { extractText, getDocumentProxy } = await import('unpdf')

    // Convert Buffer to Uint8Array for unpdf
    const uint8Array = new Uint8Array(pdfBuffer)

    // Get document proxy and extract text
    const pdf = await getDocumentProxy(uint8Array)
    const { text } = await extractText(pdf, { mergePages: true })

    if (text && text.trim().length > 0) {
      console.log(`📄 Extracted ${text.length} chars of text from PDF ${filename}`)
      return text
    }
    return null
  } catch (error) {
    console.warn(`⚠️ PDF text extraction failed for ${filename}:`, error)
    return null
  }
}

/**
 * Process a PDF attachment by converting pages to images
 * Uses pdf-to-img to render PDF pages as PNG images
 *
 * NOTE: pdf-to-img uses pdfjs-dist which requires browser APIs (DOMMatrix, canvas).
 * In serverless environments like Vercel, these APIs don't exist, so we fall back
 * to text extraction using pdf-parse which works in pure Node.js.
 */
async function processPdf(attachment: EmailAttachment): Promise<ProcessedAttachment> {
  if (!attachment.data) {
    console.warn(`PDF attachment ${attachment.filename} has no data`)
    return { filename: attachment.filename, type: 'pdf', images: [] }
  }

  // Convert base64 to Buffer (needed for both methods)
  const pdfBuffer = Buffer.from(attachment.data, 'base64')

  // First, try image conversion (better for visual PDFs like scanned orders)
  try {
    // Dynamically load pdf-to-img to prevent import-time crashes
    const pdfModule = await loadPdfToImg()
    if (pdfModule) {
      // Convert PDF pages to images using async iterator
      const pdfDocument = await pdfModule.pdf(pdfBuffer, { scale: 2.0 })
      const base64Images: string[] = []

      // Iterate through pages and convert each to base64
      for await (const pageImage of pdfDocument) {
        base64Images.push(pageImage.toString('base64'))
      }

      if (base64Images.length > 0) {
        console.log(`✅ Converted PDF ${attachment.filename} to ${base64Images.length} images`)
        return {
          filename: attachment.filename,
          type: 'pdf',
          images: base64Images,
        }
      }
    }
  } catch (error) {
    // Handle DOMMatrix/canvas errors in serverless environments
    const errorMessage = error instanceof Error ? error.message : String(error)
    const isDOMError = errorMessage.includes('DOMMatrix') ||
                       errorMessage.includes('canvas') ||
                       errorMessage.includes('is not defined')

    if (isDOMError) {
      console.log(`📄 PDF image conversion not available in serverless, falling back to text extraction for ${attachment.filename}`)
    } else {
      console.warn(`⚠️ PDF image conversion failed for ${attachment.filename}, trying text extraction:`, errorMessage)
    }
  }

  // Fallback: Extract text from PDF (works in serverless)
  const extractedText = await extractPdfText(pdfBuffer, attachment.filename)

  if (extractedText) {
    return {
      filename: attachment.filename,
      type: 'pdf',
      pdfText: extractedText,
    }
  }

  // If both methods fail, return empty
  console.warn(`⚠️ Could not process PDF ${attachment.filename}: both image conversion and text extraction failed`)
  return { filename: attachment.filename, type: 'pdf', images: [] }
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
 * Process an HTML attachment by extracting text content
 * HTML files often contain order information in a structured format
 * Uses jsdom for proper HTML parsing
 */
async function processHtml(attachment: EmailAttachment): Promise<ProcessedAttachment> {
  if (!attachment.data) {
    console.warn(`HTML attachment ${attachment.filename} has no data`)
    return { filename: attachment.filename, type: 'html', htmlContent: '' }
  }

  try {
    // Decode base64 to UTF-8 text
    const htmlString = Buffer.from(attachment.data, 'base64').toString('utf-8')

    // Use jsdom to parse HTML and extract text content
    const { JSDOM } = await import('jsdom')
    const dom = new JSDOM(htmlString)
    const document = dom.window.document

    // Remove script and style elements (not useful for order extraction)
    document.querySelectorAll('script, style').forEach((el: Element) => el.remove())

    // Get text content - jsdom handles whitespace normalization
    const textContent = document.body?.textContent || ''

    // Clean up excessive whitespace while preserving structure
    const cleanedText = textContent
      .replace(/\s+/g, ' ')
      .replace(/ +/g, ' ')
      .trim()

    console.log(`📄 Processed HTML ${attachment.filename}: ${cleanedText.length} chars extracted`)

    return {
      filename: attachment.filename,
      type: 'html',
      htmlContent: cleanedText,
    }
  } catch (error) {
    console.error(`Failed to process HTML ${attachment.filename}:`, error)
    return { filename: attachment.filename, type: 'html', htmlContent: '' }
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
    case 'html':
      return await processHtml(attachment)
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

    // Handle PDF text content (fallback when image conversion fails in serverless)
    if (attachment.type === 'pdf' && attachment.pdfText) {
      textParts.push(`\n--- PDF Attachment: ${attachment.filename} ---\n${attachment.pdfText}\n`)
      console.log(`Added PDF text for AI: ${attachment.filename}`)
    }

    // Handle HTML content
    if (attachment.type === 'html' && attachment.htmlContent) {
      textParts.push(`\n--- HTML Attachment: ${attachment.filename} ---\n${attachment.htmlContent}\n`)
      console.log(`Added HTML text for AI: ${attachment.filename}`)
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
