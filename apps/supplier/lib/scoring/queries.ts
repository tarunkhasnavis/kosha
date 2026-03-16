/**
 * Scoring Queries
 *
 * Read-only queries for account priority scoring.
 */

import { createClient } from '@kosha/supabase/server'
import type { Account } from '@kosha/types'

/**
 * Get the top priority accounts, sorted by score descending.
 * Only returns accounts with a score > 0.
 */
export async function getTopPriorityAccounts(
  limit = 5
): Promise<{ accounts: Account[]; error?: string }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .gt('score', 0)
    .order('score', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Failed to fetch priority accounts:', error)
    return { accounts: [], error: 'Failed to fetch priority accounts' }
  }

  return { accounts: (data as Account[]) || [] }
}
