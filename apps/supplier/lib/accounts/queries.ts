/**
 * Account Queries
 *
 * Read-only database operations for accounts.
 * RLS handles rep vs admin visibility automatically.
 */

import { createClient } from '@kosha/supabase/server'
import { getOrganizationId } from '@/lib/auth'
import type { Account, AccountFilters } from '@kosha/types'

/**
 * Get all accounts visible to the current user.
 * Reps see their own accounts, admins see all in their org (via RLS).
 */
export async function getAccounts(
  filters?: AccountFilters
): Promise<{ accounts: Account[]; error?: string }> {
  const orgId = await getOrganizationId()
  if (!orgId) {
    return { accounts: [], error: 'No organization found' }
  }

  const supabase = await createClient()

  let query = supabase
    .from('accounts')
    .select('*')

  if (filters?.search) {
    const searchTerm = filters.search.trim().toLowerCase()
    query = query.or(
      `name.ilike.%${searchTerm}%,industry.ilike.%${searchTerm}%,address.ilike.%${searchTerm}%`
    )
  }

  if (filters?.health) {
    query = query.eq('health', filters.health)
  }

  if (filters?.premise_type) {
    query = query.eq('premise_type', filters.premise_type)
  }

  const sortBy = filters?.sortBy || 'name'
  const sortOrder = filters?.sortOrder || 'asc'
  query = query.order(sortBy, { ascending: sortOrder === 'asc' })

  const { data, error } = await query

  if (error) {
    console.error('Failed to fetch accounts:', error)
    return { accounts: [], error: 'Failed to fetch accounts' }
  }

  return { accounts: (data as Account[]) || [] }
}

/**
 * Get a single account by ID.
 */
export async function getAccount(
  accountId: string
): Promise<{ account: Account | null; error?: string }> {
  const orgId = await getOrganizationId()
  if (!orgId) {
    return { account: null, error: 'No organization found' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', accountId)
    .single()

  if (error) {
    console.error('Failed to fetch account:', error)
    return { account: null, error: 'Failed to fetch account' }
  }

  return { account: data as Account }
}

/**
 * Get account stats for the dashboard.
 */
export async function getAccountStats(): Promise<{
  totalAccounts: number
  totalArr: number
}> {
  const orgId = await getOrganizationId()
  if (!orgId) {
    return { totalAccounts: 0, totalArr: 0 }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('accounts')
    .select('arr')

  if (error) {
    console.error('Failed to fetch account stats:', error)
    return { totalAccounts: 0, totalArr: 0 }
  }

  const accounts = data || []
  const totalArr = accounts.reduce((sum, a) => sum + (Number(a.arr) || 0), 0)

  return {
    totalAccounts: accounts.length,
    totalArr,
  }
}
