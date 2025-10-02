// Centralized type definitions for Orders feature

export interface Order {
  id: string
  orderNumber: string
  companyName: string
  source: "email" | "text" | "voicemail" | "spreadsheet" | "pdf"
  status: "waiting_review" | "approved" | "rejected" | "processing"
  receivedDate: string
  orderValue: number
  itemCount: number
  items: OrderItem[]
}

export interface OrderItem {
  name: string
  quantity: string  // Changed to string to include unit, e.g., "50 lbs"
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