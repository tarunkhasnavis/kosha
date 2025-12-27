/**
 * WooCommerce API Client
 *
 * Handles all communication with WooCommerce REST API.
 * Uses 2-call pattern: fetch current stock, then batch update.
 */

import type {
  WooCommerceConfig,
  WooCommerceProduct,
  StockUpdateItem,
  WooCommerceResult,
} from './types'

/**
 * Create Basic Auth header from consumer key and secret
 */
function createAuthHeader(config: WooCommerceConfig): string {
  const credentials = Buffer.from(
    `${config.consumerKey}:${config.consumerSecret}`
  ).toString('base64')
  return `Basic ${credentials}`
}

/**
 * Fetch current stock for multiple products by ID
 *
 * @param config - WooCommerce API credentials
 * @param productIds - Array of WooCommerce product IDs to fetch
 * @returns Array of products with current stock info
 */
export async function fetchProductStock(
  config: WooCommerceConfig,
  productIds: number[]
): Promise<WooCommerceProduct[]> {
  // Build URL with query params:
  // - include: comma-separated product IDs to filter results
  // - per_page: max results (avoid pagination)
  const url = new URL(`${config.baseUrl}/wp-json/wc/v3/products`)
  url.searchParams.set('include', productIds.join(','))
  url.searchParams.set('per_page', '100')

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: createAuthHeader(config),
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`WooCommerce API error: ${response.status} - ${error}`)
  }

  return response.json()
}

/**
 * Batch update product stock quantities
 *
 * @param config - WooCommerce API credentials
 * @param updates - Array of product IDs and their new quantities
 * @returns Result with success status and updated product IDs
 */
export async function batchUpdateStock(
  config: WooCommerceConfig,
  updates: StockUpdateItem[]
): Promise<WooCommerceResult> {
  const url = `${config.baseUrl}/wp-json/wc/v3/products/batch`

  const payload = {
    update: updates.map((item) => ({
      id: item.productId,
      stock_quantity: item.newQuantity,
    })),
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: createAuthHeader(config),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const error = await response.text()
    return {
      success: false,
      error: `WooCommerce batch update failed: ${response.status} - ${error}`,
    }
  }

  const result = await response.json()
  return {
    success: true,
    message: `Updated ${updates.length} products`,
    updatedProducts: result.update?.map((p: { id: number }) => p.id) || [],
  }
}

/**
 * Test connection to WooCommerce API
 * Use this to verify API keys are valid before saving
 *
 * @param config - WooCommerce API credentials to test
 * @returns Success status and error message if failed
 */
export async function testConnection(
  config: WooCommerceConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    const url = new URL(`${config.baseUrl}/wp-json/wc/v3/products`)
    url.searchParams.set('per_page', '1')

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: createAuthHeader(config),
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      return {
        success: false,
        error: `Connection failed: ${response.status}`,
      }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
