/**
 * Test script for HTML attachment processing
 * Run with: npx tsx scripts/test-html-attachment.ts
 */

import { getAttachmentType, isSupportedAttachment, processAttachment } from '../lib/email/attachments'
import type { EmailAttachment } from '../lib/email/gmail/client'

// Sample HTML content (base64 encoded) - more realistic order HTML
const sampleHtmlContent = Buffer.from(`
<!DOCTYPE html>
<html>
<head>
  <title>Order</title>
  <style>body { font-family: Arial; }</style>
  <script>console.log('test');</script>
</head>
<body>
  <h1>Order #160367981</h1>
  <p>Customer: Whole Foods Market</p>
  <p>Store: Portsmouth</p>
  <table>
    <tr><th>Product</th><th>Qty</th><th>Price</th></tr>
    <tr><td>Wine A</td><td>10</td><td>$5.00</td></tr>
    <tr><td>Wine B</td><td>5</td><td>$10.00</td></tr>
  </table>
  <p>Total: $100.00</p>
  <p>&copy; 2024 Whole Foods &amp; Market</p>
</body>
</html>
`).toString('base64')

async function testHtmlAttachment() {
  console.log('=== Testing HTML Attachment Processing ===\n')

  // Test 1: Check if text/html is recognized as supported
  const mimeType = 'text/html'
  const attachmentType = getAttachmentType(mimeType)
  console.log(`1. getAttachmentType("${mimeType}"): ${attachmentType}`)
  console.log(`   Expected: "html"`)
  console.log(`   Pass: ${attachmentType === 'html' ? '✅' : '❌'}\n`)

  // Test 2: Check isSupportedAttachment
  const mockAttachment: EmailAttachment = {
    attachmentId: 'test-attachment-id',
    filename: 'order_160367981.html',
    mimeType: 'text/html',
    size: 4291,
    data: sampleHtmlContent,
  }

  const isSupported = isSupportedAttachment(mockAttachment)
  console.log(`2. isSupportedAttachment(mockAttachment): ${isSupported}`)
  console.log(`   Expected: true`)
  console.log(`   Pass: ${isSupported === true ? '✅' : '❌'}\n`)

  // Test 3: Process the attachment
  console.log('3. Processing HTML attachment...')
  try {
    const processed = await processAttachment(mockAttachment)
    console.log(`   Result type: ${processed.type}`)
    console.log(`   Has htmlContent: ${!!processed.htmlContent}`)
    console.log(`   Content length: ${processed.htmlContent?.length ?? 0} chars`)
    console.log(`   Content preview: "${processed.htmlContent?.substring(0, 100)}..."`)
    console.log(`   Pass: ${processed.type === 'html' && !!processed.htmlContent ? '✅' : '❌'}\n`)
  } catch (error) {
    console.log(`   Error: ${error}`)
    console.log(`   Pass: ❌\n`)
  }

  // Test 4: Test with different MIME type variations
  console.log('4. Testing MIME type variations:')
  const mimeVariations = [
    'text/html',
    'text/html; charset=utf-8',
    'text/HTML',
    'TEXT/HTML',
  ]

  for (const mime of mimeVariations) {
    const type = getAttachmentType(mime)
    console.log(`   "${mime}" -> "${type}" ${type === 'html' ? '✅' : '❌'}`)
  }

  console.log('\n=== Test Complete ===')
}

testHtmlAttachment().catch(console.error)
