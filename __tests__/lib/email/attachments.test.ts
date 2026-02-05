import { describe, it, expect } from 'vitest'
import {
  getAttachmentType,
  isSupportedAttachment,
  prepareAttachmentsForAI,
  type ProcessedAttachment,
} from '@/lib/email/attachments'

// =============================================================================
// Factory Functions
// =============================================================================

function createEmailAttachment(overrides: {
  filename?: string
  mimeType?: string
  data?: string
} = {}) {
  return {
    filename: 'test-file.jpg',
    mimeType: 'image/jpeg',
    data: 'base64encodeddata',
    size: 1024,
    attachmentId: 'att-123',
    ...overrides,
  }
}

function createProcessedAttachment(overrides: Partial<ProcessedAttachment> = {}): ProcessedAttachment {
  return {
    filename: 'test-file.jpg',
    type: 'image',
    ...overrides,
  }
}

// =============================================================================
// getAttachmentType Tests
// =============================================================================

describe('getAttachmentType', () => {
  describe('image types', () => {
    it('identifies image/jpeg as image', () => {
      expect(getAttachmentType('image/jpeg')).toBe('image')
    })

    it('identifies image/png as image', () => {
      expect(getAttachmentType('image/png')).toBe('image')
    })

    it('identifies image/webp as image', () => {
      expect(getAttachmentType('image/webp')).toBe('image')
    })

    it('identifies image/gif as image', () => {
      expect(getAttachmentType('image/gif')).toBe('image')
    })

    it('identifies image/svg+xml as image', () => {
      expect(getAttachmentType('image/svg+xml')).toBe('image')
    })
  })

  describe('pdf types', () => {
    it('identifies application/pdf as pdf', () => {
      expect(getAttachmentType('application/pdf')).toBe('pdf')
    })
  })

  describe('excel types', () => {
    it('identifies xlsx as excel', () => {
      expect(getAttachmentType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe('excel')
    })

    it('identifies xls as excel', () => {
      expect(getAttachmentType('application/vnd.ms-excel')).toBe('excel')
    })

    it('identifies ods as excel', () => {
      expect(getAttachmentType('application/vnd.oasis.opendocument.spreadsheet')).toBe('excel')
    })
  })

  describe('html types', () => {
    it('identifies text/html as html', () => {
      expect(getAttachmentType('text/html')).toBe('html')
    })

    it('handles text/html with charset parameter', () => {
      expect(getAttachmentType('text/html; charset=utf-8')).toBe('html')
    })
  })

  describe('unsupported types', () => {
    it('returns unsupported for text/plain', () => {
      expect(getAttachmentType('text/plain')).toBe('unsupported')
    })

    it('returns unsupported for application/zip', () => {
      expect(getAttachmentType('application/zip')).toBe('unsupported')
    })

    it('returns unsupported for application/octet-stream', () => {
      expect(getAttachmentType('application/octet-stream')).toBe('unsupported')
    })

    it('returns unsupported for video types', () => {
      expect(getAttachmentType('video/mp4')).toBe('unsupported')
    })
  })

  describe('normalization', () => {
    it('handles uppercase MIME types', () => {
      expect(getAttachmentType('IMAGE/JPEG')).toBe('image')
    })

    it('handles mixed case MIME types', () => {
      expect(getAttachmentType('Image/Png')).toBe('image')
    })

    it('strips charset and other parameters', () => {
      expect(getAttachmentType('application/pdf; charset=binary')).toBe('pdf')
    })

    it('handles extra whitespace', () => {
      expect(getAttachmentType('  image/jpeg  ')).toBe('image')
    })

    it('handles multiple parameters', () => {
      expect(getAttachmentType('text/html; charset=utf-8; boundary=something')).toBe('html')
    })
  })
})

// =============================================================================
// isSupportedAttachment Tests
// =============================================================================

describe('isSupportedAttachment', () => {
  it('returns true for jpeg images', () => {
    const attachment = createEmailAttachment({ mimeType: 'image/jpeg' })
    expect(isSupportedAttachment(attachment)).toBe(true)
  })

  it('returns true for png images', () => {
    const attachment = createEmailAttachment({ mimeType: 'image/png' })
    expect(isSupportedAttachment(attachment)).toBe(true)
  })

  it('returns true for pdf files', () => {
    const attachment = createEmailAttachment({ mimeType: 'application/pdf' })
    expect(isSupportedAttachment(attachment)).toBe(true)
  })

  it('returns true for xlsx files', () => {
    const attachment = createEmailAttachment({
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    expect(isSupportedAttachment(attachment)).toBe(true)
  })

  it('returns true for html files', () => {
    const attachment = createEmailAttachment({ mimeType: 'text/html' })
    expect(isSupportedAttachment(attachment)).toBe(true)
  })

  it('returns false for text/plain', () => {
    const attachment = createEmailAttachment({ mimeType: 'text/plain' })
    expect(isSupportedAttachment(attachment)).toBe(false)
  })

  it('returns false for zip files', () => {
    const attachment = createEmailAttachment({ mimeType: 'application/zip' })
    expect(isSupportedAttachment(attachment)).toBe(false)
  })

  it('returns false for word documents', () => {
    const attachment = createEmailAttachment({
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
    expect(isSupportedAttachment(attachment)).toBe(false)
  })
})

// =============================================================================
// prepareAttachmentsForAI Tests
// =============================================================================

describe('prepareAttachmentsForAI', () => {
  it('returns empty content for empty array', () => {
    const result = prepareAttachmentsForAI([])

    expect(result.textContent).toBe('')
    expect(result.imageUrls).toHaveLength(0)
  })

  describe('excel attachments', () => {
    it('includes excel data in textContent', () => {
      const attachments = [
        createProcessedAttachment({
          type: 'excel',
          filename: 'order.xlsx',
          excelData: '{"Sheet1": [{"Product": "Widget", "Qty": 10}]}',
        }),
      ]

      const result = prepareAttachmentsForAI(attachments)

      expect(result.textContent).toContain('Excel Attachment: order.xlsx')
      expect(result.textContent).toContain('Widget')
      expect(result.imageUrls).toHaveLength(0)
    })

    it('does not include excel attachment without excelData', () => {
      const attachments = [
        createProcessedAttachment({
          type: 'excel',
          filename: 'empty.xlsx',
        }),
      ]

      const result = prepareAttachmentsForAI(attachments)

      expect(result.textContent).toBe('')
    })
  })

  describe('pdf attachments', () => {
    it('includes pdf text in textContent when available', () => {
      const attachments = [
        createProcessedAttachment({
          type: 'pdf',
          filename: 'order.pdf',
          pdfText: 'Order #123: 10 widgets at $5 each',
        }),
      ]

      const result = prepareAttachmentsForAI(attachments)

      expect(result.textContent).toContain('PDF Attachment: order.pdf')
      expect(result.textContent).toContain('Order #123')
    })

    it('includes pdf images as data URLs', () => {
      const attachments = [
        createProcessedAttachment({
          type: 'pdf',
          filename: 'order.pdf',
          images: ['base64page1', 'base64page2'],
        }),
      ]

      const result = prepareAttachmentsForAI(attachments)

      expect(result.imageUrls).toHaveLength(2)
      expect(result.imageUrls[0]).toBe('data:image/png;base64,base64page1')
      expect(result.imageUrls[1]).toBe('data:image/png;base64,base64page2')
    })
  })

  describe('html attachments', () => {
    it('includes html content in textContent', () => {
      const attachments = [
        createProcessedAttachment({
          type: 'html',
          filename: 'order.html',
          htmlContent: 'Order Details: 10 widgets',
        }),
      ]

      const result = prepareAttachmentsForAI(attachments)

      expect(result.textContent).toContain('HTML Attachment: order.html')
      expect(result.textContent).toContain('10 widgets')
    })
  })

  describe('image attachments', () => {
    it('includes images as data URLs with image/jpeg type', () => {
      const attachments = [
        createProcessedAttachment({
          type: 'image',
          filename: 'photo.jpg',
          images: ['base64imagedata'],
        }),
      ]

      const result = prepareAttachmentsForAI(attachments)

      expect(result.imageUrls).toHaveLength(1)
      expect(result.imageUrls[0]).toBe('data:image/jpeg;base64,base64imagedata')
    })

    it('does not include image attachment without images array', () => {
      const attachments = [
        createProcessedAttachment({
          type: 'image',
          filename: 'photo.jpg',
        }),
      ]

      const result = prepareAttachmentsForAI(attachments)

      expect(result.imageUrls).toHaveLength(0)
    })

    it('does not include image attachment with empty images array', () => {
      const attachments = [
        createProcessedAttachment({
          type: 'image',
          filename: 'photo.jpg',
          images: [],
        }),
      ]

      const result = prepareAttachmentsForAI(attachments)

      expect(result.imageUrls).toHaveLength(0)
    })
  })

  describe('multiple attachments', () => {
    it('combines text from multiple attachments', () => {
      const attachments = [
        createProcessedAttachment({
          type: 'excel',
          filename: 'data.xlsx',
          excelData: '{"items": []}',
        }),
        createProcessedAttachment({
          type: 'pdf',
          filename: 'order.pdf',
          pdfText: 'Order text content',
        }),
        createProcessedAttachment({
          type: 'html',
          filename: 'details.html',
          htmlContent: 'HTML content here',
        }),
      ]

      const result = prepareAttachmentsForAI(attachments)

      expect(result.textContent).toContain('data.xlsx')
      expect(result.textContent).toContain('order.pdf')
      expect(result.textContent).toContain('details.html')
    })

    it('combines images from multiple attachments', () => {
      const attachments = [
        createProcessedAttachment({
          type: 'image',
          filename: 'photo1.jpg',
          images: ['image1data'],
        }),
        createProcessedAttachment({
          type: 'image',
          filename: 'photo2.jpg',
          images: ['image2data'],
        }),
        createProcessedAttachment({
          type: 'pdf',
          filename: 'doc.pdf',
          images: ['pdfpage1', 'pdfpage2'],
        }),
      ]

      const result = prepareAttachmentsForAI(attachments)

      expect(result.imageUrls).toHaveLength(4)
    })
  })

  describe('unsupported attachments', () => {
    it('ignores unsupported attachment types', () => {
      const attachments = [
        createProcessedAttachment({
          type: 'unsupported',
          filename: 'file.zip',
        }),
      ]

      const result = prepareAttachmentsForAI(attachments)

      expect(result.textContent).toBe('')
      expect(result.imageUrls).toHaveLength(0)
    })
  })
})
