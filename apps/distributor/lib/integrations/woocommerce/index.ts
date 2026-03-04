/**
 * WooCommerce Integration
 *
 * Main entry point for WooCommerce stock sync.
 * Called when an order is marked complete.
 */

import { getWooCommerceConfig } from './db'
import { fetchProductsBySku, batchUpdateStock } from './client'
import type { WooCommerceResult, WooCommerceProduct } from './types'

interface OrderItem {
  sku?: string | null
  name: string
  quantity: number
}

/**
 * Handle order completion - sync stock to WooCommerce
 *
 * Flow:
 * 1. Get WooCommerce config for the organization
 * 2. Check if order came from WooCommerce (skip if so)
 * 3. Look up products in WooCommerce by SKU
 * 4. Calculate new stock (current - ordered quantity)
 * 5. Batch update stock in WooCommerce
 *
 * @param organizationId - The organization ID
 * @param orderId - The order ID
 * @param items - Order items to sync
 * @param senderEmail - Original email sender (used to skip orders from WooCommerce)
 */
export async function onOrderCompleted(
  organizationId: string,
  orderId: string,
  items: OrderItem[],
  senderEmail?: string
): Promise<WooCommerceResult> {
  // 1. Get config - if not configured, silently skip
  const integration = await getWooCommerceConfig(organizationId)
  if (!integration) {
    console.log(`[WooCommerce] Order ${orderId}: Integration not configured - skipped`)
    return {
      success: true,
      message: 'WooCommerce integration not configured - skipped',
    }
  }

  const { config } = integration

  // 2. Check if order came from WooCommerce notification email
  // If so, skip sync - inventory already updated in WooCommerce
  if (senderEmail && config.orderNotificationEmail) {
    const normalizedSender = senderEmail.toLowerCase().trim()
    const normalizedNotificationEmail = config.orderNotificationEmail.toLowerCase().trim()

    if (normalizedSender === normalizedNotificationEmail) {
      console.log(
        `[WooCommerce] Order ${orderId}: Skipped - order originated from WooCommerce (${senderEmail})`
      )
      return {
        success: true,
        message: 'Order from WooCommerce - inventory sync skipped',
      }
    }
  }

  // 3. Get items with SKUs to look up
  const itemsWithSku = items.filter((item): item is OrderItem & { sku: string } =>
    typeof item.sku === 'string' && item.sku.trim() !== ''
  )

  if (itemsWithSku.length === 0) {
    console.log(`[WooCommerce] Order ${orderId}: No items with SKUs - skipped`)
    return {
      success: true,
      message: 'No items with SKUs to sync - skipped',
    }
  }

  // 4. Look up products in WooCommerce by SKU
  const skus = itemsWithSku.map((item) => item.sku)
  let wooProducts: WooCommerceProduct[]
  try {
    wooProducts = await fetchProductsBySku(config, skus)
    console.log(`[WooCommerce] Order ${orderId}: Found ${wooProducts.length}/${skus.length} products by SKU`)
  } catch (error) {
    const errorMsg = `Failed to fetch products by SKU: ${error instanceof Error ? error.message : 'Unknown error'}`
    console.error(`[WooCommerce] Order ${orderId}: ${errorMsg}`)
    return {
      success: false,
      error: errorMsg,
    }
  }

  if (wooProducts.length === 0) {
    console.log(`[WooCommerce] Order ${orderId}: No matching products found in WooCommerce`)
    return {
      success: true,
      message: 'No matching products found in WooCommerce - skipped',
    }
  }

  // 5. Calculate new stock quantities
  const stockUpdates: Array<{ productId: number; newQuantity: number }> = []

  for (const item of itemsWithSku) {
    const product = wooProducts.find(
      (p) => p.sku.toLowerCase() === item.sku.toLowerCase()
    )

    if (!product) {
      console.log(`[WooCommerce] Order ${orderId}: SKU "${item.sku}" not found in WooCommerce`)
      continue
    }

    if (product.stock_quantity === null) {
      console.log(`[WooCommerce] Order ${orderId}: SKU "${item.sku}" (product ${product.id}) has no managed stock`)
      continue
    }

    const newQuantity = Math.max(0, product.stock_quantity - item.quantity)
    stockUpdates.push({
      productId: product.id,
      newQuantity,
    })
    console.log(
      `[WooCommerce] Order ${orderId}: SKU "${item.sku}" - ${product.stock_quantity} -> ${newQuantity} (ordered: ${item.quantity})`
    )
  }

  if (stockUpdates.length === 0) {
    console.log(`[WooCommerce] Order ${orderId}: No products with managed stock to update`)
    return {
      success: true,
      message: 'No products with managed stock to update',
    }
  }

  // 6. Batch update stock
  const result = await batchUpdateStock(config, stockUpdates)

  if (result.success) {
    console.log(
      `[WooCommerce] Order ${orderId}: Updated ${stockUpdates.length} products`
    )
  } else {
    console.error(`[WooCommerce] Order ${orderId}: ${result.error}`)
  }

  return result
}
