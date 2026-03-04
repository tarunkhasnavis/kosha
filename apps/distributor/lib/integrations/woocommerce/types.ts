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
  orderNotificationEmail?: string // Email address that WooCommerce sends order notifications from (e.g., info@store.com). Orders from this sender will skip inventory sync since they're already reflected in WooCommerce.
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
