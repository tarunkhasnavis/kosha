/**
 * Integration Dispatcher
 *
 * Single entry point to trigger all integrations when events occur.
 * Add new integrations here by importing and calling them.
 *
 * To remove an integration: delete its folder and remove the import/call here.
 */

import { onOrderCompleted as wooCommerceSync } from './woocommerce'

interface OrderItem {
  sku?: string | null
  name: string
  quantity: number
}

interface IntegrationResults {
  woocommerce?: { success: boolean; message?: string; error?: string }
  // Add more integrations here as needed
}

/**
 * Trigger all integrations when an order is marked complete
 *
 * This is the ONLY function you need to call from your order completion flow.
 * It handles all integrations and returns results for each.
 */
export async function triggerOrderCompleted(
  organizationId: string,
  orderId: string,
  items: OrderItem[]
): Promise<IntegrationResults> {
  const results: IntegrationResults = {}

  // WooCommerce integration
  try {
    results.woocommerce = await wooCommerceSync(organizationId, orderId, items)
  } catch (error) {
    results.woocommerce = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }

  // Add more integrations here:
  // try {
  //   results.shopify = await shopifySync(organizationId, orderId, items)
  // } catch (error) { ... }

  return results
}
