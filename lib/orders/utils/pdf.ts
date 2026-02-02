/**
 * Order PDF Generator
 *
 * Generates professional sales order PDFs using pdf-lib.
 * Layout based on the Vinilandia NH sales order form template.
 */

import { PDFDocument, PDFPage, PDFFont, rgb, StandardFonts } from 'pdf-lib'
import * as fs from 'fs'
import * as path from 'path'
import type { Order, OrderItem } from '@/types/orders'

// ============================================
// TYPES
// ============================================

export interface OrgInfo {
  name: string
  addressLine1: string
  addressLine2?: string
  city?: string
  state?: string
  zip?: string
  phone?: string
  email?: string
  website?: string
}

export type DocumentType = 'order_form' | 'invoice'

export interface OrderPdfInput {
  order: Order
  items: OrderItem[]
  org: OrgInfo
  includeNotes?: boolean  // Whether to include notes in PDF (default: false)
  documentType?: DocumentType  // 'order_form' (default) or 'invoice'
}

// ============================================
// LAYOUT CONSTANTS
// ============================================

const PAGE = {
  WIDTH: 612, // Letter size (8.5" x 11")
  HEIGHT: 792,
  MARGIN_LEFT: 50,
  MARGIN_RIGHT: 50,
  MARGIN_TOP: 50,
  MARGIN_BOTTOM: 50,
}

const FONTS = {
  TITLE: 24,
  HEADER: 12,
  BODY: 10,
  SMALL: 8,
  TABLE_HEADER: 9,
  TABLE_BODY: 9,
}

const COLORS = {
  PRIMARY: rgb(0.2, 0.4, 0.6), // Dark blue for headers
  BLACK: rgb(0, 0, 0),
  GRAY: rgb(0.4, 0.4, 0.4),
  LIGHT_GRAY: rgb(0.7, 0.7, 0.7),
  TABLE_HEADER_BG: rgb(0.95, 0.95, 0.95),
  LINE: rgb(0.8, 0.8, 0.8),
}

// Table column definitions
const TABLE = {
  COLUMNS: {
    ITEM_NO: { x: PAGE.MARGIN_LEFT, width: 70 },
    DESCRIPTION: { x: PAGE.MARGIN_LEFT + 70, width: 200 },
    QTY: { x: PAGE.MARGIN_LEFT + 270, width: 60 },
    UNIT_PRICE: { x: PAGE.MARGIN_LEFT + 330, width: 80 },
    TOTAL: { x: PAGE.MARGIN_LEFT + 410, width: 102 },
  },
  ROW_HEIGHT: 20,
  HEADER_HEIGHT: 25,
}

const CONTENT_WIDTH = PAGE.WIDTH - PAGE.MARGIN_LEFT - PAGE.MARGIN_RIGHT

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatCurrency(amount: number | undefined | null): string {
  if (amount === undefined || amount === null) return ''
  return `$${amount.toFixed(2)}`
}

function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return ''
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: '2-digit',
    })
  } catch {
    return dateString
  }
}

function truncateText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, fontSize) <= maxWidth) {
    return text
  }

  let truncated = text
  while (truncated.length > 0 && font.widthOfTextAtSize(truncated + '...', fontSize) > maxWidth) {
    truncated = truncated.slice(0, -1)
  }
  return truncated + '...'
}

// ============================================
// DRAWING FUNCTIONS
// ============================================

interface DrawContext {
  page: PDFPage
  fonts: {
    regular: PDFFont
    bold: PDFFont
    title: PDFFont // Bitter font for titles
  }
  y: number // Current Y position (top-down)
}

function drawHeader(ctx: DrawContext, org: OrgInfo, documentType: DocumentType = 'order_form'): number {
  const { page, fonts } = ctx
  let y = PAGE.HEIGHT - PAGE.MARGIN_TOP

  // Title - document type on the right (using Bitter font)
  const titleText = documentType === 'invoice' ? 'INVOICE' : 'SALES ORDER FORM'
  const titleWidth = fonts.title.widthOfTextAtSize(titleText, FONTS.TITLE)
  page.drawText(titleText, {
    x: PAGE.WIDTH - PAGE.MARGIN_RIGHT - titleWidth,
    y: y - 10,
    size: FONTS.TITLE,
    font: fonts.title,
    color: COLORS.GRAY,
  })

  // Organization name (left side)
  page.drawText(org.name, {
    x: PAGE.MARGIN_LEFT,
    y: y,
    size: FONTS.HEADER,
    font: fonts.bold,
    color: COLORS.BLACK,
  })

  y -= 15

  // Organization address (single field, may contain multiple lines)
  if (org.addressLine1) {
    // Split address by newlines or commas for multi-line display
    const addressLines = org.addressLine1.split(/[,\n]/).map(line => line.trim()).filter(Boolean)
    for (const line of addressLines) {
      page.drawText(line, {
        x: PAGE.MARGIN_LEFT,
        y,
        size: FONTS.BODY,
        font: fonts.regular,
        color: COLORS.BLACK,
      })
      y -= 12
    }
  }

  // Email
  if (org.email) {
    page.drawText(org.email, {
      x: PAGE.MARGIN_LEFT,
      y,
      size: FONTS.BODY,
      font: fonts.regular,
      color: COLORS.PRIMARY,
    })
    y -= 12
  }

  // Phone
  if (org.phone) {
    page.drawText(org.phone, {
      x: PAGE.MARGIN_LEFT,
      y,
      size: FONTS.BODY,
      font: fonts.regular,
      color: COLORS.BLACK,
    })
    y -= 12
  }

  return y - 15 // Return Y position after header with spacing
}

function drawDateAndOrderBlock(ctx: DrawContext, order: Order, documentType: DocumentType = 'order_form'): number {
  const { page, fonts } = ctx
  const rightX = PAGE.WIDTH - PAGE.MARGIN_RIGHT
  let y = PAGE.HEIGHT - PAGE.MARGIN_TOP - 50

  if (documentType === 'invoice') {
    // Invoice layout: Invoice #, Date of Issue, Due Date
    const invoiceLabel = 'INVOICE #:'
    page.drawText(invoiceLabel, {
      x: rightX - 110,
      y,
      size: FONTS.SMALL,
      font: fonts.bold,
      color: COLORS.GRAY,
    })
    page.drawText(order.order_number, {
      x: rightX - 60,
      y,
      size: FONTS.BODY,
      font: fonts.bold,
      color: COLORS.BLACK,
    })

    y -= 18

    // Date of issue
    page.drawText('DATE:', {
      x: rightX - 110,
      y,
      size: FONTS.SMALL,
      font: fonts.bold,
      color: COLORS.GRAY,
    })
    page.drawText(formatDate(order.received_date), {
      x: rightX - 60,
      y,
      size: FONTS.BODY,
      font: fonts.regular,
      color: COLORS.BLACK,
    })

    y -= 18

    // Due date (use expected_date or default to received_date + 30 days)
    page.drawText('DUE:', {
      x: rightX - 110,
      y,
      size: FONTS.SMALL,
      font: fonts.bold,
      color: COLORS.GRAY,
    })
    const dueDate = order.expected_date || order.received_date
    page.drawText(formatDate(dueDate), {
      x: rightX - 60,
      y,
      size: FONTS.BODY,
      font: fonts.regular,
      color: COLORS.BLACK,
    })

    return y - 15
  }

  // Order form layout (original)
  const dateLabel = 'DATE'
  const dateValue = formatDate(order.received_date)

  page.drawText(dateLabel, {
    x: rightX - 100,
    y,
    size: FONTS.SMALL,
    font: fonts.bold,
    color: COLORS.GRAY,
  })

  page.drawText(dateValue, {
    x: rightX - 60,
    y,
    size: FONTS.BODY,
    font: fonts.regular,
    color: COLORS.BLACK,
  })

  y -= 25

  const orderLabel = 'ORDER #:'
  page.drawText(orderLabel, {
    x: rightX - 100,
    y,
    size: FONTS.SMALL,
    font: fonts.bold,
    color: COLORS.GRAY,
  })

  page.drawText(order.order_number, {
    x: rightX - 60,
    y,
    size: FONTS.BODY,
    font: fonts.bold,
    color: COLORS.BLACK,
  })

  return y - 20
}

function drawAddressBlocks(ctx: DrawContext, order: Order, documentType: DocumentType = 'order_form'): number {
  const { page, fonts } = ctx
  let y = ctx.y

  // Horizontal line
  page.drawLine({
    start: { x: PAGE.MARGIN_LEFT, y },
    end: { x: PAGE.WIDTH - PAGE.MARGIN_RIGHT, y },
    thickness: 0.5,
    color: COLORS.LINE,
  })

  y -= 20

  // Left block label
  const leftLabel = documentType === 'invoice' ? 'BILL TO' : 'CUSTOMER'
  page.drawText(leftLabel, {
    x: PAGE.MARGIN_LEFT,
    y,
    size: FONTS.SMALL,
    font: fonts.bold,
    color: COLORS.GRAY,
  })

  // Right block label (only show for order form)
  if (documentType === 'order_form') {
    page.drawText('CUSTOMER ADDRESS', {
      x: PAGE.MARGIN_LEFT + 260,
      y,
      size: FONTS.SMALL,
      font: fonts.bold,
      color: COLORS.GRAY,
    })
  }

  y -= 15

  // Customer name
  if (order.company_name) {
    page.drawText(order.company_name, {
      x: PAGE.MARGIN_LEFT,
      y,
      size: FONTS.BODY,
      font: fonts.bold,
      color: COLORS.BLACK,
    })
  }

  // Delivery address (use billing_address if available)
  let addrY = y
  if (order.billing_address) {
    const addressLines = order.billing_address.split('\n')
    for (const line of addressLines.slice(0, 3)) {
      page.drawText(line, {
        x: PAGE.MARGIN_LEFT + 260,
        y: addrY,
        size: FONTS.BODY,
        font: fonts.regular,
        color: COLORS.BLACK,
      })
      addrY -= 12
    }
  }

  // License field (below address) - from custom_fields.liquor_license
  const licenseValue = order.custom_fields?.liquor_license
  if (licenseValue) {
    addrY -= 12 // More spacing to avoid crowding
    page.drawText('LICENSE:', {
      x: PAGE.MARGIN_LEFT + 260,
      y: addrY,
      size: FONTS.SMALL,
      font: fonts.bold,
      color: COLORS.GRAY,
    })
    page.drawText(String(licenseValue), {
      x: PAGE.MARGIN_LEFT + 310,
      y: addrY,
      size: FONTS.BODY,
      font: fonts.regular,
      color: COLORS.BLACK,
    })
  }

  y -= 12

  // Contact name
  if (order.contact_name) {
    page.drawText(order.contact_name, {
      x: PAGE.MARGIN_LEFT,
      y,
      size: FONTS.BODY,
      font: fonts.regular,
      color: COLORS.BLACK,
    })
    y -= 12
  }

  // Contact email
  if (order.contact_email) {
    page.drawText(order.contact_email, {
      x: PAGE.MARGIN_LEFT,
      y,
      size: FONTS.BODY,
      font: fonts.regular,
      color: COLORS.PRIMARY,
    })
    y -= 12
  }

  // Phone
  if (order.phone) {
    page.drawText(order.phone, {
      x: PAGE.MARGIN_LEFT,
      y,
      size: FONTS.BODY,
      font: fonts.regular,
      color: COLORS.BLACK,
    })
    y -= 12
  }

  return y - 20
}

function drawMetaRow(ctx: DrawContext, order: Order, documentType: DocumentType = 'order_form'): number {
  const { page, fonts } = ctx
  let y = ctx.y

  // Horizontal line
  page.drawLine({
    start: { x: PAGE.MARGIN_LEFT, y },
    end: { x: PAGE.WIDTH - PAGE.MARGIN_RIGHT, y },
    thickness: 0.5,
    color: COLORS.LINE,
  })

  y -= 15

  // Meta row with columns - different for invoice vs order form
  const columns = documentType === 'invoice'
    ? [
        { label: 'INVOICE #', value: order.order_number || '', x: PAGE.MARGIN_LEFT },
        { label: 'DATE', value: formatDate(order.received_date) || '', x: PAGE.MARGIN_LEFT + 130 },
        { label: 'TERMS', value: 'Net 30', x: PAGE.MARGIN_LEFT + 280 },
      ]
    : [
        { label: 'P.O NO.', value: order.order_number || '', x: PAGE.MARGIN_LEFT },
        { label: 'DELIVERY DATE', value: formatDate(order.expected_date) || '', x: PAGE.MARGIN_LEFT + 130 },
        { label: 'SHIP VIA', value: order.ship_via || '', x: PAGE.MARGIN_LEFT + 280 },
      ]

  // Draw labels
  for (const col of columns) {
    page.drawText(col.label, {
      x: col.x,
      y,
      size: FONTS.SMALL,
      font: fonts.bold,
      color: COLORS.GRAY,
    })
  }

  y -= 12

  // Draw values
  for (const col of columns) {
    page.drawText(col.value, {
      x: col.x,
      y,
      size: FONTS.BODY,
      font: fonts.regular,
      color: COLORS.BLACK,
    })
  }

  y -= 20

  // Horizontal line
  page.drawLine({
    start: { x: PAGE.MARGIN_LEFT, y },
    end: { x: PAGE.WIDTH - PAGE.MARGIN_RIGHT, y },
    thickness: 0.5,
    color: COLORS.LINE,
  })

  return y - 10
}

function drawTableHeader(ctx: DrawContext): number {
  const { page, fonts } = ctx
  let y = ctx.y

  // Table header background
  page.drawRectangle({
    x: PAGE.MARGIN_LEFT,
    y: y - TABLE.HEADER_HEIGHT,
    width: CONTENT_WIDTH,
    height: TABLE.HEADER_HEIGHT,
    color: COLORS.TABLE_HEADER_BG,
  })

  // Header text
  const headers = [
    { text: 'ITEM NO.', x: TABLE.COLUMNS.ITEM_NO.x + 5 },
    { text: 'DESCRIPTION', x: TABLE.COLUMNS.DESCRIPTION.x + 5 },
    { text: 'QTY', x: TABLE.COLUMNS.QTY.x + 5 },
    { text: 'UNIT PRICE', x: TABLE.COLUMNS.UNIT_PRICE.x + 5 },
    { text: 'TOTAL', x: TABLE.COLUMNS.TOTAL.x + 5 },
  ]

  const headerY = y - TABLE.HEADER_HEIGHT + 8

  for (const header of headers) {
    page.drawText(header.text, {
      x: header.x,
      y: headerY,
      size: FONTS.TABLE_HEADER,
      font: fonts.bold,
      color: COLORS.GRAY,
    })
  }

  // Draw vertical lines for columns
  const columnXPositions = [
    TABLE.COLUMNS.ITEM_NO.x,
    TABLE.COLUMNS.DESCRIPTION.x,
    TABLE.COLUMNS.QTY.x,
    TABLE.COLUMNS.UNIT_PRICE.x,
    TABLE.COLUMNS.TOTAL.x,
    PAGE.WIDTH - PAGE.MARGIN_RIGHT,
  ]

  for (const x of columnXPositions) {
    page.drawLine({
      start: { x, y },
      end: { x, y: y - TABLE.HEADER_HEIGHT },
      thickness: 0.5,
      color: COLORS.LINE,
    })
  }

  // Top and bottom border
  page.drawLine({
    start: { x: PAGE.MARGIN_LEFT, y },
    end: { x: PAGE.WIDTH - PAGE.MARGIN_RIGHT, y },
    thickness: 0.5,
    color: COLORS.LINE,
  })

  page.drawLine({
    start: { x: PAGE.MARGIN_LEFT, y: y - TABLE.HEADER_HEIGHT },
    end: { x: PAGE.WIDTH - PAGE.MARGIN_RIGHT, y: y - TABLE.HEADER_HEIGHT },
    thickness: 0.5,
    color: COLORS.LINE,
  })

  return y - TABLE.HEADER_HEIGHT
}

interface DrawRowsResult {
  y: number
  remainingItems: OrderItem[]
}

function drawTableRows(
  ctx: DrawContext,
  items: OrderItem[],
  minY: number
): DrawRowsResult {
  const { page, fonts } = ctx
  let y = ctx.y
  const remainingItems: OrderItem[] = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]

    // Check if we have room for this row
    if (y - TABLE.ROW_HEIGHT < minY) {
      // Not enough space, return remaining items
      remainingItems.push(...items.slice(i))
      break
    }

    const rowY = y - TABLE.ROW_HEIGHT + 6

    // Draw row data
    // Item SKU
    const sku = item.sku || ''
    page.drawText(truncateText(sku, fonts.regular, FONTS.TABLE_BODY, TABLE.COLUMNS.ITEM_NO.width - 10), {
      x: TABLE.COLUMNS.ITEM_NO.x + 5,
      y: rowY,
      size: FONTS.TABLE_BODY,
      font: fonts.regular,
      color: COLORS.BLACK,
    })

    // Description (name + unit)
    const description = `${item.name} ${item.quantity_unit || ''}`
    page.drawText(truncateText(description, fonts.regular, FONTS.TABLE_BODY, TABLE.COLUMNS.DESCRIPTION.width - 10), {
      x: TABLE.COLUMNS.DESCRIPTION.x + 5,
      y: rowY,
      size: FONTS.TABLE_BODY,
      font: fonts.regular,
      color: COLORS.BLACK,
    })

    // Quantity
    page.drawText(String(item.quantity || ''), {
      x: TABLE.COLUMNS.QTY.x + 5,
      y: rowY,
      size: FONTS.TABLE_BODY,
      font: fonts.regular,
      color: COLORS.BLACK,
    })

    // Unit price
    page.drawText(formatCurrency(item.unit_price), {
      x: TABLE.COLUMNS.UNIT_PRICE.x + 5,
      y: rowY,
      size: FONTS.TABLE_BODY,
      font: fonts.regular,
      color: COLORS.BLACK,
    })

    // Total (right-aligned)
    const totalText = formatCurrency(item.total)
    const totalWidth = fonts.regular.widthOfTextAtSize(totalText, FONTS.TABLE_BODY)
    page.drawText(totalText, {
      x: TABLE.COLUMNS.TOTAL.x + TABLE.COLUMNS.TOTAL.width - totalWidth - 10,
      y: rowY,
      size: FONTS.TABLE_BODY,
      font: fonts.regular,
      color: COLORS.BLACK,
    })

    // Draw row border
    page.drawLine({
      start: { x: PAGE.MARGIN_LEFT, y: y - TABLE.ROW_HEIGHT },
      end: { x: PAGE.WIDTH - PAGE.MARGIN_RIGHT, y: y - TABLE.ROW_HEIGHT },
      thickness: 0.3,
      color: COLORS.LINE,
    })

    // Draw column separators for this row
    const columnXPositions = [
      TABLE.COLUMNS.ITEM_NO.x,
      TABLE.COLUMNS.DESCRIPTION.x,
      TABLE.COLUMNS.QTY.x,
      TABLE.COLUMNS.UNIT_PRICE.x,
      TABLE.COLUMNS.TOTAL.x,
      PAGE.WIDTH - PAGE.MARGIN_RIGHT,
    ]

    for (const x of columnXPositions) {
      page.drawLine({
        start: { x, y },
        end: { x, y: y - TABLE.ROW_HEIGHT },
        thickness: 0.3,
        color: COLORS.LINE,
      })
    }

    y -= TABLE.ROW_HEIGHT
  }

  return { y, remainingItems }
}

function drawTotalsBox(ctx: DrawContext, order: Order, documentType: DocumentType = 'order_form'): number {
  const { page, fonts } = ctx
  let y = ctx.y - 20

  const boxWidth = 180
  const boxX = PAGE.WIDTH - PAGE.MARGIN_RIGHT - boxWidth
  const lineHeight = 18

  // Draw box outline
  page.drawRectangle({
    x: boxX,
    y: y - lineHeight * 3 - 10,
    width: boxWidth,
    height: lineHeight * 3 + 10,
    borderColor: COLORS.LINE,
    borderWidth: 1,
  })

  // Subtotal
  page.drawText('SUBTOTAL', {
    x: boxX + 10,
    y: y - lineHeight + 5,
    size: FONTS.BODY,
    font: fonts.regular,
    color: COLORS.GRAY,
  })

  const subtotalText = formatCurrency(order.order_value)
  const subtotalWidth = fonts.regular.widthOfTextAtSize(subtotalText, FONTS.BODY)
  page.drawText(subtotalText, {
    x: boxX + boxWidth - subtotalWidth - 10,
    y: y - lineHeight + 5,
    size: FONTS.BODY,
    font: fonts.regular,
    color: COLORS.BLACK,
  })

  y -= lineHeight

  // Tax line (for invoice) or Shipping/Handling (for order form)
  page.drawLine({
    start: { x: boxX, y },
    end: { x: boxX + boxWidth, y },
    thickness: 0.5,
    color: COLORS.LINE,
  })

  const middleRowLabel = documentType === 'invoice' ? 'TAX' : 'SHIPPING/HANDLING'
  page.drawText(middleRowLabel, {
    x: boxX + 10,
    y: y - lineHeight + 5,
    size: FONTS.BODY,
    font: fonts.regular,
    color: COLORS.GRAY,
  })

  page.drawText('-', {
    x: boxX + boxWidth - 20,
    y: y - lineHeight + 5,
    size: FONTS.BODY,
    font: fonts.regular,
    color: COLORS.BLACK,
  })

  y -= lineHeight

  // Total/Amount Due line
  page.drawLine({
    start: { x: boxX, y },
    end: { x: boxX + boxWidth, y },
    thickness: 1,
    color: COLORS.BLACK,
  })

  const totalLabel = documentType === 'invoice' ? 'AMOUNT DUE' : 'TOTAL'
  page.drawText(totalLabel, {
    x: boxX + 10,
    y: y - lineHeight + 5,
    size: FONTS.HEADER,
    font: fonts.bold,
    color: COLORS.BLACK,
  })

  // Dollar sign
  page.drawText('$', {
    x: boxX + boxWidth - 80,
    y: y - lineHeight + 5,
    size: FONTS.HEADER,
    font: fonts.bold,
    color: COLORS.BLACK,
  })

  const totalText = order.order_value?.toFixed(2) || '0.00'
  const totalWidth = fonts.bold.widthOfTextAtSize(totalText, FONTS.HEADER)
  page.drawText(totalText, {
    x: boxX + boxWidth - totalWidth - 10,
    y: y - lineHeight + 5,
    size: FONTS.HEADER,
    font: fonts.bold,
    color: COLORS.BLACK,
  })

  return y - lineHeight - 20
}

function drawNotes(ctx: DrawContext, order: Order): number {
  const { page, fonts } = ctx
  let y = ctx.y - 15 // Add spacing after table

  if (!order.notes) return y

  page.drawText('Notes:', {
    x: PAGE.MARGIN_LEFT,
    y,
    size: FONTS.SMALL,
    font: fonts.bold,
    color: COLORS.GRAY,
  })

  y -= 12

  // Wrap notes text (simple implementation)
  const maxWidth = 250
  const words = order.notes.split(' ')
  let line = ''

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word
    if (fonts.regular.widthOfTextAtSize(testLine, FONTS.BODY) < maxWidth) {
      line = testLine
    } else {
      if (line) {
        page.drawText(line, {
          x: PAGE.MARGIN_LEFT,
          y,
          size: FONTS.BODY,
          font: fonts.regular,
          color: COLORS.BLACK,
        })
        y -= 12
      }
      line = word
    }
  }

  // Draw remaining text
  if (line) {
    page.drawText(line, {
      x: PAGE.MARGIN_LEFT,
      y,
      size: FONTS.BODY,
      font: fonts.regular,
      color: COLORS.BLACK,
    })
    y -= 12
  }

  return y - 10
}

function drawFooter(ctx: DrawContext, org: OrgInfo): void {
  const { page, fonts } = ctx
  const footerY = PAGE.MARGIN_BOTTOM + 40

  // "THANK YOU" text (using Bitter font)
  page.drawText('THANK YOU', {
    x: PAGE.MARGIN_LEFT,
    y: footerY + 20,
    size: 20,
    font: fonts.title,
    color: COLORS.LIGHT_GRAY,
  })

  // Contact info line
  const contactLine = 'For questions concerning this order, please contact'
  page.drawText(contactLine, {
    x: PAGE.WIDTH / 2 - fonts.regular.widthOfTextAtSize(contactLine, FONTS.SMALL) / 2,
    y: footerY,
    size: FONTS.SMALL,
    font: fonts.regular,
    color: COLORS.GRAY,
  })

  // Email
  if (org.email) {
    page.drawText(org.email, {
      x: PAGE.WIDTH / 2 - fonts.regular.widthOfTextAtSize(org.email, FONTS.BODY) / 2,
      y: footerY - 12,
      size: FONTS.BODY,
      font: fonts.regular,
      color: COLORS.PRIMARY,
    })
  }

  // Website
  if (org.website) {
    page.drawText(org.website, {
      x: PAGE.WIDTH / 2 - fonts.regular.widthOfTextAtSize(org.website, FONTS.BODY) / 2,
      y: footerY - 24,
      size: FONTS.BODY,
      font: fonts.regular,
      color: COLORS.PRIMARY,
    })
  }
}

// ============================================
// MAIN EXPORT FUNCTION
// ============================================

export async function generateOrderPdf(input: OrderPdfInput): Promise<Uint8Array> {
  const { order, items, org, includeNotes = false, documentType = 'order_form' } = input

  // Create a new PDF document
  const pdfDoc = await PDFDocument.create()

  // Embed standard fonts
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // Load and embed Bitter font for titles
  let titleFont: PDFFont
  try {
    const fontPath = path.join(process.cwd(), 'public', 'fonts', 'Bitter-Bold.ttf')
    const fontBytes = fs.readFileSync(fontPath)
    titleFont = await pdfDoc.embedFont(fontBytes)
  } catch (error) {
    // Fallback to Helvetica Bold if Bitter font is not available
    console.warn('Bitter font not found, falling back to Helvetica Bold:', error)
    titleFont = boldFont
  }

  const fonts = { regular: regularFont, bold: boldFont, title: titleFont }

  // Track remaining items for multi-page support
  let remainingItems = [...items]
  let isFirstPage = true

  while (remainingItems.length > 0 || isFirstPage) {
    // Add a new page
    const page = pdfDoc.addPage([PAGE.WIDTH, PAGE.HEIGHT])

    const ctx: DrawContext = {
      page,
      fonts,
      y: PAGE.HEIGHT - PAGE.MARGIN_TOP,
    }

    if (isFirstPage) {
      // Draw header sections only on first page
      drawHeader(ctx, org, documentType)
      drawDateAndOrderBlock(ctx, order, documentType)

      ctx.y = PAGE.HEIGHT - PAGE.MARGIN_TOP - 120
      ctx.y = drawAddressBlocks(ctx, order, documentType)
      ctx.y = drawMetaRow(ctx, order, documentType)
    } else {
      // For continuation pages, add a simple header
      page.drawText(`${order.order_number} - Continued`, {
        x: PAGE.MARGIN_LEFT,
        y: PAGE.HEIGHT - PAGE.MARGIN_TOP,
        size: FONTS.HEADER,
        font: boldFont,
        color: COLORS.BLACK,
      })
      ctx.y = PAGE.HEIGHT - PAGE.MARGIN_TOP - 30
    }

    // Draw table header
    ctx.y = drawTableHeader(ctx)

    // Calculate minimum Y for table rows (leave room for totals on last page)
    const minY = isFirstPage ? PAGE.MARGIN_BOTTOM + 150 : PAGE.MARGIN_BOTTOM + 50

    // Draw table rows
    const result = drawTableRows(ctx, remainingItems, minY)
    ctx.y = result.y
    remainingItems = result.remainingItems

    // If no more items, draw totals and footer
    if (remainingItems.length === 0) {
      // Only draw notes if includeNotes is true
      if (includeNotes) {
        ctx.y = drawNotes(ctx, order)
      }
      drawTotalsBox(ctx, order, documentType)
      drawFooter(ctx, org)
    }

    isFirstPage = false
  }

  // Serialize the PDF to bytes
  return await pdfDoc.save()
}
