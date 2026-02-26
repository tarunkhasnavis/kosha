// Centralized type definitions for Orders feature

export interface Order {
  id: string
  order_number: string
  company_name: string
  source: "email" | "text" | "voicemail" | "spreadsheet" | "pdf"
  status: "waiting_review" | "approved" | "rejected" | "processing" | "invoiced" | "paid" | "awaiting_clarification" | "archived"
  received_date: string
  expected_date?: string  // When customer wants pickup OR delivery
  order_value: number
  item_count: number
  notes?: string
  billing_address?: string
  phone?: string
  payment_method?: string
  contact_name?: string
  contact_email?: string
  items?: OrderItem[]
  deletedItems?: OrderItem[]  // Items that were soft-deleted from the order
  email_url?: string
  clarification_message?: string | null  // Pending clarification message to send (null = already sent)
  approval_email_message?: string | null  // Custom approval email to send (null = use default template)
  ship_via?: string  // Delivery method: 'Delivery' or 'Customer Pickup' (empty = not specified)
  custom_fields?: Record<string, string | number | null>  // Org-specific fields (e.g., liquor_license)
  pdf_downloaded_at?: string | null  // Timestamp when PDF was last downloaded
  inferred_fields?: string[]  // Fields where AI made logical leaps (e.g., "items[0].sku", "liquor_license")
  original_email_body?: string | null  // Original email content from the first email in the thread (plain text)
  original_email_body_html?: string | null  // Original email content in HTML format (for display)
  original_email_from?: string | null  // Sender of the original email
  original_email_date?: string | null  // Date/time the original email was sent
  include_notes_in_pdf?: boolean  // Whether to include notes in PDF download (default: false)
  rejection_reason?: string | null  // Reason for rejection (stored when status = 'rejected')

  // Customer linking
  customer_id?: string | null  // FK to customers table (set after human confirmation)
  suggested_customer_id?: string | null  // AI's suggestion (not a FK, just a hint)
  suggested_customer_confidence?: number | null  // Confidence of AI's suggestion (0.00 to 1.00)

  // ERP sync tracking (Kosha's metadata about the sync relationship)
  erp_entity_id?: string | null
  erp_display_name?: string | null
  erp_synced_at?: string | null
  erp_sync_status?: 'synced' | 'pending' | 'error' | null
  erp_sync_error?: string | null
  erp_metadata?: Record<string, unknown> | null
}

export interface OrderItem {
  id: string
  order_id: string
  name: string
  sku?: string
  quantity: number
  quantity_unit: string
  unit_price: number
  total: number
  created_at?: string
  organization_id?: string
  deleted?: boolean  // Whether item was removed from order (soft delete)
}

export interface OrderStats {
  waitingReview: number
  awaitingClarification: number
  uploadSuccessful: number
  totalToday: number
  processingTime: string
}

// Type guards
export const isOrderStatus = (status: string): status is Order['status'] => {
  return ['waiting_review', 'approved', 'rejected', 'processing', 'invoiced', 'paid', 'awaiting_clarification', 'archived'].includes(status)
}

// Helper types
export type OrderSource = Order['source']
export type OrderStatus = Order['status']