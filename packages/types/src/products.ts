/**
 * Product Types
 *
 * Types for the master product catalog.
 */

export interface Product {
  id: string
  organization_id: string
  sku: string
  name: string  // Full name including pack size (e.g., "Ghia Aperitif 6/500ml")
  unit_price: number
  is_active: boolean
  created_at: string
  updated_at: string

  // ERP sync tracking fields
  erp_entity_id: string | null
  erp_display_name: string | null
  erp_synced_at: string | null
  erp_sync_status: 'pending' | 'synced' | 'error' | null
  erp_sync_error: string | null
  erp_metadata: Record<string, unknown> | null
}

// For creating a new product (id and timestamps are auto-generated)
export interface CreateProductInput {
  sku: string
  name: string
  unit_price: number
  is_active?: boolean  // Defaults to true
}

// For updating an existing product
export interface UpdateProductInput {
  sku?: string
  name?: string
  unit_price?: number
  is_active?: boolean
}

// For CSV import
export interface ProductCSVRow {
  sku: string
  name: string
  unit_price: string | number
}
