/**
 * QuickBooks Online - Specific Types
 *
 * Types for QBO API responses, config, and credentials.
 * These are QBO-specific and not shared with other providers.
 */

// ============================================
// Config & Credentials (stored in organization_integrations)
// ============================================

export interface QBOConfig {
  realmId: string           // QBO Company ID
  companyName: string       // Company name from QBO
  environment: 'sandbox' | 'production'
}

export interface QBOCredentials {
  accessToken: string       // Encrypted - 1 hour lifetime
  refreshToken: string      // Encrypted - 100 day lifetime
  tokenExpiresAt: string    // ISO timestamp
  refreshTokenExpiresAt: string  // ISO timestamp
}

// ============================================
// QBO API Response Types (subset we use)
// ============================================

export interface QBOCustomer {
  Id: string
  DisplayName: string
  CompanyName?: string
  PrimaryEmailAddr?: { Address: string }
  PrimaryPhone?: { FreeFormNumber: string }
  BillAddr?: {
    Line1?: string
    City?: string
    CountrySubDivisionCode?: string
    PostalCode?: string
    Country?: string
  }
  Active: boolean
  SyncToken: string
  MetaData?: {
    CreateTime: string
    LastUpdatedTime: string
  }
}

export interface QBOItem {
  Id: string
  Name: string
  Sku?: string
  UnitPrice?: number
  Description?: string
  Active: boolean
  Type: 'Inventory' | 'NonInventory' | 'Service' | 'Group' | 'Category'
  SyncToken: string
}

export interface QBOInvoice {
  Id: string
  DocNumber?: string
  TotalAmt: number
  Balance: number
  DueDate?: string
  TxnDate?: string
  CustomerRef: { value: string; name?: string }
  Line: QBOInvoiceLine[]
  SyncToken: string
  MetaData?: {
    CreateTime: string
    LastUpdatedTime: string
  }
}

export interface QBOInvoiceLine {
  Amount: number
  DetailType: 'SalesItemLineDetail' | 'SubTotalLineDetail' | 'DiscountLineDetail'
  SalesItemLineDetail?: {
    ItemRef: { value: string; name?: string }
    Qty: number
    UnitPrice: number
  }
}
