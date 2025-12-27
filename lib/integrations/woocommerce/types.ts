/**
 * WooCommerce Integration Types
 *
 * All types specific to the WooCommerce integration.
 * Delete this folder to remove the integration entirely.
 */

export interface WooCommerceConfig {
  baseUrl: string
  consumerKey: string
  consumerSecret: string
}

export interface WooCommerceProduct {
  id: number
  name: string
  sku: string
  stock_quantity: number | null
  stock_status: 'instock' | 'outofstock' | 'onbackorder'
  manage_stock: boolean
}

export interface SkuMapping {
  localSku: string
  wooProductId: number
  productName: string
}

export interface StockUpdateItem {
  productId: number
  newQuantity: number
}

export interface WooCommerceResult {
  success: boolean
  message?: string
  error?: string
  updatedProducts?: number[]
}
