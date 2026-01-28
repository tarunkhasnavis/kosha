/**
 * File Processor for Onboarding
 *
 * Wraps existing attachment processing utilities from lib/email/attachments.ts
 * for the onboarding context.
 *
 * Handles:
 * - CSV files → Parse to products array
 * - Excel files → Parse to products array
 * - Images → Return as base64 for vision
 * - PDFs → Extract text or convert to images
 */

import * as XLSX from 'xlsx'
import { ExtractedProduct } from './types'

// =============================================================================
// File Type Detection
// =============================================================================

export type OnboardingFileType = 'csv' | 'excel' | 'image' | 'pdf' | 'text' | 'unsupported'

const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]

const EXCEL_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'application/vnd.oasis.opendocument.spreadsheet', // .ods
]

export function detectFileType(mimeType: string, filename: string): OnboardingFileType {
  // Check MIME type first
  if (mimeType === 'text/csv' || filename.endsWith('.csv')) {
    return 'csv'
  }
  if (EXCEL_MIME_TYPES.includes(mimeType) || filename.match(/\.(xlsx?|ods)$/i)) {
    return 'excel'
  }
  if (IMAGE_MIME_TYPES.includes(mimeType)) {
    return 'image'
  }
  if (mimeType === 'application/pdf' || filename.endsWith('.pdf')) {
    return 'pdf'
  }
  if (mimeType.startsWith('text/') || filename.match(/\.(txt|text)$/i)) {
    return 'text'
  }
  return 'unsupported'
}

// =============================================================================
// CSV/Excel Parsing
// =============================================================================

export interface ParsedSpreadsheetData {
  rows: Record<string, unknown>[]
  headers: string[]
  rowCount: number
}

/**
 * Parse CSV content to structured data
 * Uses xlsx library which also handles CSV files
 */
export function parseCSV(content: string): ParsedSpreadsheetData {
  try {
    const workbook = XLSX.read(content, { type: 'string' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]

    if (!sheet) {
      return { rows: [], headers: [], rowCount: 0 }
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
    const headers = rows.length > 0 ? Object.keys(rows[0]) : []

    return {
      rows,
      headers,
      rowCount: rows.length,
    }
  } catch (error) {
    console.error('CSV parsing error:', error)
    return { rows: [], headers: [], rowCount: 0 }
  }
}

/**
 * Parse Excel buffer to structured data
 */
export function parseExcel(buffer: Buffer): ParsedSpreadsheetData {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]

    if (!sheet) {
      return { rows: [], headers: [], rowCount: 0 }
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
    const headers = rows.length > 0 ? Object.keys(rows[0]) : []

    return {
      rows,
      headers,
      rowCount: rows.length,
    }
  } catch (error) {
    console.error('Excel parsing error:', error)
    return { rows: [], headers: [], rowCount: 0 }
  }
}

/**
 * Try to extract products from parsed spreadsheet data
 * Looks for common column names: sku, name, product, price, cost, etc.
 */
export function extractProductsFromSpreadsheet(data: ParsedSpreadsheetData): ExtractedProduct[] {
  const { rows, headers } = data

  if (rows.length === 0) {
    return []
  }

  // Find column mappings (case-insensitive)
  const lowerHeaders = headers.map(h => h.toLowerCase())

  const skuCol = headers.find((_, i) =>
    ['sku', 'item_number', 'item number', 'product_code', 'product code', 'code', 'id'].some(
      name => lowerHeaders[i].includes(name)
    )
  )

  const nameCol = headers.find((_, i) =>
    ['name', 'product', 'description', 'item', 'title'].some(
      name => lowerHeaders[i].includes(name)
    )
  )

  const priceCol = headers.find((_, i) =>
    ['price', 'unit_price', 'unit price', 'cost', 'amount'].some(
      name => lowerHeaders[i].includes(name)
    )
  )

  // If we can't find a name column, return empty (AI will handle messy data)
  if (!nameCol) {
    console.log('Could not auto-detect product columns, returning raw data for AI')
    return []
  }

  return rows.map(row => {
    const name = String(row[nameCol] || '').trim()
    const sku = skuCol ? String(row[skuCol] || '').trim() : undefined
    const priceRaw = priceCol ? row[priceCol] : 0

    // Parse price - handle strings like "$24.99" or "24.99"
    let unitPrice = 0
    if (typeof priceRaw === 'number') {
      unitPrice = priceRaw
    } else if (typeof priceRaw === 'string') {
      const cleaned = priceRaw.replace(/[$,]/g, '').trim()
      unitPrice = parseFloat(cleaned) || 0
    }

    return {
      name,
      sku: sku || undefined,
      unit_price: unitPrice,
    }
  }).filter(p => p.name.length > 0)
}

// =============================================================================
// PDF Processing
// =============================================================================

/**
 * Extract text from PDF using unpdf (serverless-compatible)
 */
export async function extractPdfText(buffer: Buffer): Promise<string | null> {
  try {
    const { extractText, getDocumentProxy } = await import('unpdf')

    const uint8Array = new Uint8Array(buffer)
    const pdf = await getDocumentProxy(uint8Array)
    const { text } = await extractText(pdf, { mergePages: true })

    if (text && text.trim().length > 0) {
      return text
    }
    return null
  } catch (error) {
    console.warn('PDF text extraction failed:', error)
    return null
  }
}

// =============================================================================
// Main Processing Functions
// =============================================================================

export interface ProcessedOnboardingFile {
  type: OnboardingFileType
  filename: string
  mimeType: string

  // For deterministic parsing (CSV/Excel)
  products?: ExtractedProduct[]
  spreadsheetData?: ParsedSpreadsheetData

  // For AI processing (images, PDFs)
  base64?: string
  pdfText?: string

  // Raw text content
  textContent?: string
}

/**
 * Process an uploaded file for the onboarding flow
 *
 * @param base64Content - Base64 encoded file content
 * @param filename - Original filename
 * @param mimeType - MIME type of the file
 */
export async function processOnboardingFile(
  base64Content: string,
  filename: string,
  mimeType: string
): Promise<ProcessedOnboardingFile> {
  const fileType = detectFileType(mimeType, filename)

  const result: ProcessedOnboardingFile = {
    type: fileType,
    filename,
    mimeType,
  }

  switch (fileType) {
    case 'csv': {
      // Decode base64 and parse as text
      const textContent = Buffer.from(base64Content, 'base64').toString('utf-8')
      const spreadsheetData = parseCSV(textContent)
      const products = extractProductsFromSpreadsheet(spreadsheetData)

      result.spreadsheetData = spreadsheetData
      result.products = products.length > 0 ? products : undefined
      result.textContent = textContent
      break
    }

    case 'excel': {
      const buffer = Buffer.from(base64Content, 'base64')
      const spreadsheetData = parseExcel(buffer)
      const products = extractProductsFromSpreadsheet(spreadsheetData)

      result.spreadsheetData = spreadsheetData
      result.products = products.length > 0 ? products : undefined
      break
    }

    case 'image': {
      // Images go directly to the AI with vision
      result.base64 = base64Content
      break
    }

    case 'pdf': {
      const buffer = Buffer.from(base64Content, 'base64')
      const pdfText = await extractPdfText(buffer)

      if (pdfText) {
        result.pdfText = pdfText
      } else {
        // If text extraction fails, pass as image (if AI has vision)
        result.base64 = base64Content
      }
      break
    }

    case 'text': {
      const textContent = Buffer.from(base64Content, 'base64').toString('utf-8')
      result.textContent = textContent
      break
    }

    default:
      // Unsupported - return as-is, AI can try to make sense of it
      result.textContent = Buffer.from(base64Content, 'base64').toString('utf-8')
      break
  }

  return result
}

/**
 * Check if processed file requires vision (AI with image support)
 */
export function requiresVision(processedFile: ProcessedOnboardingFile): boolean {
  return !!processedFile.base64 && processedFile.type === 'image'
}
