// Centralized type definitions for Orders feature

export interface Order {
  id: string
  order_number: string
  company_name: string
  source: "email" | "text" | "voicemail" | "spreadsheet" | "pdf"
  status: "waiting_review" | "approved" | "rejected" | "processing"
  received_date: string
  order_value: number
  item_count: number
  items?: OrderItem[]
}

export interface OrderItem {
  name: string
  quantity: string
  unit_price: number
  total: number
}

export interface OrderStats {
  waitingReview: number
  uploadSuccessful: number
  totalToday: number
  processingTime: string
}

// Type guards
export const isOrderStatus = (status: string): status is Order['status'] => {
  return ['waiting_review', 'approved', 'rejected', 'processing'].includes(status)
}

// Helper types
export type OrderSource = Order['source']
export type OrderStatus = Order['status']