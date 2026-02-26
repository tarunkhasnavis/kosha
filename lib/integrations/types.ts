/**
 * Generic ERP Provider Types
 *
 * ERP-agnostic interfaces used by sync orchestration.
 * Provider implementations (QBO, QB Desktop, etc.) map their
 * specific data into these generic types.
 */

import type { Customer } from '@/types/customers'
import type { Product } from '@/types/products'
import type { Order, OrderItem } from '@/types/orders'

// ============================================
// Provider identification
// ============================================

export type ErpProviderType =
  | 'quickbooks_online'
  | 'quickbooks_desktop'
  | 'dynamics'
  | 'netsuite'

// ============================================
// Generic ERP data types (provider-agnostic)
// ============================================

export interface ErpCustomer {
  erpId: string
  displayName: string
  email: string | null
  phone: string | null
  companyName: string | null
  billingAddress: {
    street?: string
    city?: string
    state?: string
    zip?: string
    country?: string
  } | null
  raw: Record<string, unknown>  // Original provider data for metadata storage
}

export interface ErpProduct {
  erpId: string
  name: string
  sku: string | null
  unitPrice: number | null
  description: string | null
  isActive: boolean
  raw: Record<string, unknown>
}

export type ErpInvoiceStatus =
  | 'draft'
  | 'sent'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'voided'
  | 'unknown'

export interface ErpInvoiceStatusResult {
  status: ErpInvoiceStatus
  amountDue: number | null
  amountPaid: number | null
  dueDate: string | null
  raw: Record<string, unknown>
}

export interface ErpSyncResult {
  success: boolean
  erpEntityId?: string
  erpDisplayName?: string
  error?: string
}

// ============================================
// Provider interface
// ============================================

export interface ErpProvider {
  type: ErpProviderType

  // Customers
  pullCustomers(): Promise<ErpCustomer[]>
  pushCustomer(customer: Customer): Promise<ErpSyncResult>

  // Products
  pullProducts(): Promise<ErpProduct[]>
  pushProduct(product: Product): Promise<ErpSyncResult>

  // Invoices
  pushInvoice(order: Order, items: OrderItem[], customer: Customer): Promise<ErpSyncResult>
  getInvoiceStatus(erpInvoiceId: string): Promise<ErpInvoiceStatusResult>

  // Connection
  testConnection(): Promise<{ success: boolean; companyName?: string; error?: string }>
}

// ============================================
// Connection info (for UI display)
// ============================================

export interface ErpConnectionInfo {
  providerType: ErpProviderType
  companyName: string | null
  enabled: boolean
  connectedAt: string | null
}
