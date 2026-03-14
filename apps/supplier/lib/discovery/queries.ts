/**
 * Discovery Queries
 *
 * Read-only operations for discovered (prospective) accounts.
 */

import { createClient } from '@kosha/supabase/server'
import type { DiscoveredAccount, DiscoveryCategory } from '@kosha/types'

/**
 * Get discovered accounts by category, optionally filtered by map viewport bounds.
 */
export async function getDiscoveredAccounts(
  category?: DiscoveryCategory,
  bounds?: { north: number; south: number; east: number; west: number }
): Promise<{ accounts: DiscoveredAccount[]; error?: string }> {
  const supabase = await createClient()

  let query = supabase
    .from('discovered_accounts')
    .select('*')
    .eq('is_claimed', false)
    .order('ai_score', { ascending: false })

  if (category) {
    query = query.eq('category', category)
  }

  if (bounds) {
    query = query
      .gte('latitude', bounds.south)
      .lte('latitude', bounds.north)
      .gte('longitude', bounds.west)
      .lte('longitude', bounds.east)
  }

  const { data, error } = await query.limit(100)

  if (error) {
    console.error('Failed to fetch discovered accounts:', error)
    return { accounts: [], error: 'Failed to fetch discovered accounts' }
  }

  return { accounts: (data as DiscoveredAccount[]) || [] }
}

/**
 * Get top discovered accounts by AI score for a category.
 */
export async function getTopDiscoveredAccounts(
  category: DiscoveryCategory,
  limit = 20
): Promise<{ accounts: DiscoveredAccount[]; error?: string }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('discovered_accounts')
    .select('*')
    .eq('category', category)
    .eq('is_claimed', false)
    .order('ai_score', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Failed to fetch top discovered accounts:', error)
    return { accounts: [], error: 'Failed to fetch discovered accounts' }
  }

  return { accounts: (data as DiscoveredAccount[]) || [] }
}
