// Centralized type definitions for Supplier Visits feature

export interface Visit {
  id: string
  user_id: string
  organization_id: string
  account_id: string
  account_name: string
  visit_date: string
  notes: string | null
  created_at: string
}

export interface CreateVisitInput {
  account_id: string
  account_name: string
  visit_date: string
  notes?: string
}
