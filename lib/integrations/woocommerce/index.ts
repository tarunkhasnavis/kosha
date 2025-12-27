/**
 * WooCommerce Integration
 *
 * Main entry point for WooCommerce stock sync.
 * Called when an order is marked complete.
 */

import { getWooCommerceConfig } from './db'
import { fetchProductStock, batchUpdateStock } from './client'
import type { WooCommerceResult, SkuMapping } from './types'

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
 * 2. Map order items to WooCommerce product IDs using SKU mappings
 * 3. Fetch current stock for those products (API call 1)
 * 4. Calculate new stock (current - ordered quantity)
 * 5. Batch update stock in WooCommerce (API call 2)
 */
export async function onOrderCompleted(
  organizationId: string,
  orderId: string,
  items: OrderItem[]
): Promise<WooCommerceResult> {
  // 1. Get config - if not configured, silently skip
  const integration = await getWooCommerceConfig(organizationId)
  if (!integration) {
    return {
      success: true,
      message: 'WooCommerce integration not configured - skipped',
    }
  }

  const { config, skuMappings } = integration

  // 2. Map order items to WooCommerce product IDs
  const itemsToUpdate: Array<{ productId: number; quantity: number }> = []

  for (const item of items) {
    const mapping = findSkuMapping(item, skuMappings)
    if (mapping) {
      itemsToUpdate.push({
        productId: mapping.wooProductId,
        quantity: item.quantity,
      })
    }
  }

  if (itemsToUpdate.length === 0) {
    return {
      success: true,
      message: 'No items matched WooCommerce products - skipped',
    }
  }

  // 3. Fetch current stock (API call 1)
  const productIds = itemsToUpdate.map((i) => i.productId)
  let currentProducts
  try {
    currentProducts = await fetchProductStock(config, productIds)
  } catch (error) {
    return {
      success: false,
      error: `Failed to fetch current stock: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }

  // 4. Calculate new stock quantities
  const stockUpdates = itemsToUpdate
    .map((item) => {
      const product = currentProducts.find((p) => p.id === item.productId)
      if (!product || product.stock_quantity === null) {
        // Product not found or stock not managed - skip
        return null
      }

      const newQuantity = Math.max(0, product.stock_quantity - item.quantity)
      return {
        productId: item.productId,
        newQuantity,
      }
    })
    .filter((u): u is { productId: number; newQuantity: number } => u !== null)

  if (stockUpdates.length === 0) {
    return {
      success: true,
      message: 'No products with managed stock to update',
    }
  }

  // 5. Batch update stock (API call 2)
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

/**
 * Find SKU mapping for an order item
 * Matches by SKU first, then falls back to name matching
 */
function findSkuMapping(
  item: OrderItem,
  mappings: SkuMapping[]
): SkuMapping | undefined {
  // Try exact SKU match first
  if (item.sku) {
    const bysku = mappings.find(
      (m) => m.localSku.toLowerCase() === item.sku!.toLowerCase()
    )
    if (bysku) return bysku
  }

  // Fall back to name match (case-insensitive)
  return mappings.find(
    (m) => m.productName.toLowerCase() === item.name.toLowerCase()
  )
}
