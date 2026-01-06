/**
 * Email Templates for Order Communications
 *
 * Generates formatted email bodies for automated order responses.
 */

import type { OrderItem } from '@/types/orders'

interface OrderSummary {
  orderNumber: string
  companyName?: string
  contactName?: string
  items: OrderItem[]
  deletedItems?: OrderItem[]
  orderValue: number
  expectedDate?: string
}

/**
 * Format currency for display
 */
function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`
}

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

/**
 * Get the customer's first name for greeting
 */
function getFirstName(contactName?: string, companyName?: string): string {
  if (contactName) {
    // Extract first name (handle "John Smith", "Chef John", etc.)
    const parts = contactName.trim().split(' ')
    return parts[0]
  }
  if (companyName) {
    return companyName
  }
  return 'there'
}

/**
 * Generate order summary section for emails
 * Uses a clean format with bullet points for better readability
 */
function generateOrderSummary(order: OrderSummary): string {
  const lines: string[] = []

  // Header
  lines.push(`ORDER #${order.orderNumber}`)
  lines.push('')

  // Items list with bullet points
  lines.push('Items in your order:')
  for (const item of order.items) {
    lines.push(`  • ${item.name} — ${item.quantity} ${item.quantity_unit} × ${formatCurrency(item.unit_price)} = ${formatCurrency(item.total)}`)
  }

  // Total
  lines.push('')
  lines.push(`Order Total: ${formatCurrency(order.orderValue)}`)

  if (order.expectedDate) {
    lines.push(`Delivery Date: ${formatDate(order.expectedDate)}`)
  }

  // Deleted items section (if any)
  if (order.deletedItems && order.deletedItems.length > 0) {
    lines.push('')
    lines.push('')
    lines.push('The following items were removed from your original order:')
    for (const item of order.deletedItems) {
      lines.push(`  • ${item.name} — ${item.quantity} ${item.quantity_unit} × ${formatCurrency(item.unit_price)}`)
    }
  }

  return lines.join('\n')
}

/**
 * Generate approval email body
 */
export function generateApprovalEmail(
  order: OrderSummary,
  organizationName: string
): string {
  const greeting = getFirstName(order.contactName, order.companyName)
  const orderSummary = generateOrderSummary(order)

  const email = `Hi ${greeting},

Thank you for your order! We have received it and are now processing it.

Here's a summary of your order:

${orderSummary}

If you have any questions or need to make changes, please reply to this email.

Thank you for your business!

Best regards,
${organizationName}`

  return email
}

/**
 * Generate rejection email body
 */
export function generateRejectionEmail(
  order: OrderSummary,
  organizationName: string,
  reason?: string
): string {
  const greeting = getFirstName(order.contactName, order.companyName)

  let reasonSection = ''
  if (reason) {
    reasonSection = `\nReason: ${reason}\n`
  }

  const email = `Hi ${greeting},

Thank you for reaching out. Unfortunately, we are unable to process your order #${order.orderNumber} at this time.
${reasonSection}
If you believe this was a mistake or would like to discuss further, please don't hesitate to reply to this email.

We appreciate your understanding and hope to serve you in the future.

Best regards,
${organizationName}`

  return email
}
