/**
 * Integration Dispatcher
 *
 * Single entry point to trigger all integrations when events occur.
 * Add new integrations here by importing and calling them.
 *
 * To remove an integration: delete its folder and remove the import/call here.
 */

import { onOrderCompleted as wooCommerceSync } from './woocommerce'
import { pushInvoiceToErp } from './sync/invoices'

interface OrderItem {
  sku?: string | null
  name: string
  quantity: number
}

interface OrderContext {
  senderEmail?: string // Original email sender - used to skip integrations for certain sources
}

interface IntegrationResults {
  woocommerce?: { success: boolean; message?: string; error?: string }
  erp?: { success: boolean; error?: string }
}

/**
 * Trigger all integrations when an order is marked complete
 *
 * This is the ONLY function you need to call from your order completion flow.
 * It handles all integrations and returns results for each.
 *
 * @param organizationId - The organization ID
 * @param orderId - The order ID
 * @param items - Order items to sync
 * @param context - Additional context like sender email (for skipping certain integrations)
 */
export async function triggerOrderCompleted(
  organizationId: string,
  orderId: string,
  items: OrderItem[],
  context?: OrderContext
): Promise<IntegrationResults> {
  const results: IntegrationResults = {}

  // WooCommerce integration
  try {
    results.woocommerce = await wooCommerceSync(organizationId, orderId, items, context?.senderEmail)
  } catch (error) {
    results.woocommerce = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }

  // ERP integration (generic -- works with QBO, QB Desktop, etc.)
  // Creates an invoice in the connected ERP when an order is approved.
  // Non-blocking: errors don't fail the approval.
  try {
    results.erp = await pushInvoiceToErp(organizationId, orderId)
  } catch (error) {
    results.erp = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }

  return results
}
