// Centralized type definitions for Orders feature

export interface Order {
  id: string
  order_number: string
  company_name: string
  source: "email" | "text" | "voicemail" | "spreadsheet" | "pdf"
  status: "waiting_review" | "approved" | "rejected" | "processing" | "awaiting_clarification"
  received_date: string
  expected_delivery_date?: string
  order_value: number
  item_count: number
  notes?: string
  billing_address?: string
  phone?: string
  payment_method?: string
  contact_name?: string
  contact_email?: string
  items?: OrderItem[]
  email_url?: string
  clarification_message?: string | null  // Pending clarification message to send (null = already sent)
  ship_via?: string  // Delivery method: 'Delivery' or 'Customer Pickup' (empty = not specified)
  custom_fields?: Record<string, string | number | null>  // Org-specific fields (e.g., liquor_license)
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
  return ['waiting_review', 'approved', 'rejected', 'processing', 'awaiting_clarification'].includes(status)
}

// Helper types
export type OrderSource = Order['source']
export type OrderStatus = Order['status']