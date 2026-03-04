// Centralized type definitions for Supplier Accounts feature

export type AccountHealth = 'healthy' | 'at_risk' | 'critical'
export type PremiseType = 'on_premise' | 'off_premise' | 'hybrid'
export type SupplierRole = 'admin' | 'rep'

export interface Account {
  id: string
  user_id: string
  organization_id: string
  name: string
  industry: string | null
  health: AccountHealth
  arr: number
  address: string | null
  premise_type: PremiseType | null
  last_contact: string | null
  latitude: number | null
  longitude: number | null
  created_at: string
  updated_at: string
}

export interface CreateAccountInput {
  name: string
  industry?: string
  health?: AccountHealth
  arr?: number
  address?: string
  premise_type?: PremiseType
  latitude?: number
  longitude?: number
}

export interface UpdateAccountInput {
  name?: string
  industry?: string
  health?: AccountHealth
  arr?: number
  address?: string
  premise_type?: PremiseType
  last_contact?: string
  latitude?: number
  longitude?: number
}

export interface AccountFilters {
  search?: string
  health?: AccountHealth
  premise_type?: PremiseType
  sortBy?: 'name' | 'arr' | 'last_contact' | 'created_at'
  sortOrder?: 'asc' | 'desc'
}
