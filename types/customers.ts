// Centralized type definitions for Customers feature

export type ErpSyncStatus = 'synced' | 'pending' | 'conflict' | 'error' | null

export interface Address {
  street?: string
  city?: string
  state?: string
  zip?: string
  country?: string
}

export interface Customer {
  id: string
  organization_id: string
  name: string
  customer_number: string | null

  // Contact
  primary_contact_name: string | null
  primary_contact_email: string | null
  primary_contact_phone: string | null

  // Addresses
  billing_address: Address | null
  shipping_address: Address | null

  // Notes
  notes: string | null

  // ERP link (generic - works for QB, Dynamics, NetSuite, etc.)
  erp_entity_id: string | null
  erp_display_name: string | null
  erp_synced_at: string | null
  erp_sync_status: ErpSyncStatus
  erp_sync_error: string | null
  erp_metadata: Record<string, unknown> | null

  // Analytics (computed)
  total_orders: number
  total_spend: number
  average_order_value: number | null
  first_order_date: string | null
  last_order_date: string | null

  // Metadata
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CreateCustomerInput {
  name: string
  customer_number?: string
  primary_contact_name?: string
  primary_contact_email?: string
  primary_contact_phone?: string
  billing_address?: Address
  shipping_address?: Address
  notes?: string
}

export interface UpdateCustomerInput {
  name?: string
  customer_number?: string
  primary_contact_name?: string
  primary_contact_email?: string
  primary_contact_phone?: string
  billing_address?: Address
  shipping_address?: Address
  notes?: string
  is_active?: boolean
}

export interface CustomerFilters {
  search?: string
  isActive?: boolean
  hasErpLink?: boolean
  sortBy?: 'name' | 'total_orders' | 'total_spend' | 'last_order_date' | 'created_at'
  sortOrder?: 'asc' | 'desc'
}

export interface CustomerMatch {
  customer: Customer
  confidence: number
  matchType: 'exact_email' | 'exact_name' | 'fuzzy_name'
}

// Type guard
export const isErpSyncStatus = (status: string): status is NonNullable<ErpSyncStatus> => {
  return ['synced', 'pending', 'conflict', 'error'].includes(status)
}
