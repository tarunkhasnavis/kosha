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
 * Fetch a single product or variation from WooCommerce by SKU
 *
 * WooCommerce stores SKUs on simple products OR on variations (for variable products).
 * The ?sku= parameter works for both when querying the right endpoint.
 *
 * Note: For variations, we need to search within variable products' variations.
 */
async function fetchSingleProductBySku(
  config: WooCommerceConfig,
  sku: string
): Promise<WooCommerceProduct | null> {
  // 1. Try the products endpoint first (works for simple products)
  const productUrl = new URL(`${config.baseUrl}/wp-json/wc/v3/products`)
  productUrl.searchParams.set('sku', sku)
  productUrl.searchParams.set('per_page', '1')

  const productResponse = await fetch(productUrl.toString(), {
    method: 'GET',
    headers: {
      Authorization: createAuthHeader(config),
      'Content-Type': 'application/json',
    },
  })

  if (!productResponse.ok) {
    const error = await productResponse.text()
    throw new Error(`WooCommerce API error: ${productResponse.status} - ${error}`)
  }

  const products: WooCommerceProduct[] = await productResponse.json()
  if (products.length > 0) {
    return products[0]
  }

  // 2. SKU not found in simple products - it might be a variation
  // Use the search parameter to find potential parent products, then check variations
  const searchUrl = new URL(`${config.baseUrl}/wp-json/wc/v3/products`)
  searchUrl.searchParams.set('type', 'variable')
  searchUrl.searchParams.set('per_page', '50')

  const searchResponse = await fetch(searchUrl.toString(), {
    method: 'GET',
    headers: {
      Authorization: createAuthHeader(config),
      'Content-Type': 'application/json',
    },
  })

  if (!searchResponse.ok) {
    // If we can't search variable products, just return null
    console.log(`[WooCommerce] Could not search variable products for SKU "${sku}"`)
    return null
  }

  const variableProducts: Array<{ id: number; name: string }> = await searchResponse.json()

  // Check each variable product's variations for the SKU
  for (const parent of variableProducts) {
    const variationUrl = new URL(
      `${config.baseUrl}/wp-json/wc/v3/products/${parent.id}/variations`
    )
    variationUrl.searchParams.set('sku', sku)
    variationUrl.searchParams.set('per_page', '1')

    const variationResponse = await fetch(variationUrl.toString(), {
      method: 'GET',
      headers: {
        Authorization: createAuthHeader(config),
        'Content-Type': 'application/json',
      },
    })

    if (variationResponse.ok) {
      const variations: WooCommerceProduct[] = await variationResponse.json()
      if (variations.length > 0) {
        console.log(`[WooCommerce] Found SKU "${sku}" as variation of "${parent.name}" (${parent.id})`)
        return variations[0]
      }
    }
  }

  return null
}

/**
 * Fetch products from WooCommerce by SKU
 *
 * @param config - WooCommerce API credentials
 * @param skus - Array of SKUs to look up
 * @returns Array of products matching the SKUs (includes both simple products and variations)
 */
export async function fetchProductsBySku(
  config: WooCommerceConfig,
  skus: string[]
): Promise<WooCommerceProduct[]> {
  if (skus.length === 0) return []

  const products: WooCommerceProduct[] = []

  for (const sku of skus) {
    try {
      const product = await fetchSingleProductBySku(config, sku)
      if (product) {
        products.push(product)
      }
    } catch (error) {
      // Log but continue with other SKUs
      console.error(`[WooCommerce] Error fetching SKU "${sku}":`, error)
    }
  }

  return products
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
