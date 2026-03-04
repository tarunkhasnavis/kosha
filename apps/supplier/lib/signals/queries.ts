/**
 * Signal Queries
 *
 * Read-only operations for signals.
 * RLS handles rep vs admin visibility automatically.
 */

import { createClient } from '@kosha/supabase/server'
import { getOrganizationId } from '@/lib/auth'
import type { Signal } from '@kosha/types'

/**
 * Get recent signals, ordered by most recent first.
 */
export async function getRecentSignals(
  limit = 20
): Promise<{ signals: Signal[]; error?: string }> {
  const orgId = await getOrganizationId()
  if (!orgId) return { signals: [], error: 'No organization found' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('signals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Failed to fetch signals:', error)
    return { signals: [], error: 'Failed to fetch signals' }
  }

  return { signals: (data as Signal[]) || [] }
}

/**
 * Get signals for a specific account.
 */
export async function getSignalsForAccount(
  accountId: string
): Promise<{ signals: Signal[]; error?: string }> {
  const orgId = await getOrganizationId()
  if (!orgId) return { signals: [], error: 'No organization found' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('signals')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch signals for account:', error)
    return { signals: [], error: 'Failed to fetch signals' }
  }

  return { signals: (data as Signal[]) || [] }
}

/**
 * Get total signal count (for dashboard).
 */
export async function getSignalCount(): Promise<number> {
  const orgId = await getOrganizationId()
  if (!orgId) return 0

  const supabase = await createClient()
  const { count, error } = await supabase
    .from('signals')
    .select('*', { count: 'exact', head: true })

  if (error) {
    console.error('Failed to count signals:', error)
    return 0
  }

  return count || 0
}
