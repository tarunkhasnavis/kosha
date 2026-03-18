// Centralized type definitions for Supplier Accounts feature

export type PremiseType = 'on_premise' | 'off_premise' | 'hybrid'
export type SupplierRole = 'admin' | 'rep'

export interface Account {
  id: string
  user_id: string
  organization_id: string
  name: string
  industry: string | null
  address: string | null
  premise_type: PremiseType | null
  last_contact: string | null
  latitude: number | null
  longitude: number | null
  phone: string | null
  website: string | null
  hours: string | null
  distributor_name: string | null
  score: number
  score_reasons: string[]
  scored_at: string | null
  created_at: string
  updated_at: string
}

export interface CreateAccountInput {
  name: string
  industry?: string
  address?: string
  premise_type?: PremiseType
  latitude?: number
  longitude?: number
  phone?: string
  website?: string
  hours?: string
}

export interface UpdateAccountInput {
  name?: string
  industry?: string
  address?: string
  premise_type?: PremiseType
  last_contact?: string
  latitude?: number
  longitude?: number
  phone?: string
  website?: string
  hours?: string
}

export interface AccountFilters {
  search?: string
  premise_type?: PremiseType
  sortBy?: 'name' | 'last_contact' | 'created_at' | 'score'
  sortOrder?: 'asc' | 'desc'
}
