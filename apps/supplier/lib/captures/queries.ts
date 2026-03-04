/**
 * Capture Queries
 *
 * Read-only operations for conversation captures.
 * RLS handles rep vs admin visibility automatically.
 */

import { createClient } from '@kosha/supabase/server'
import { getOrganizationId } from '@/lib/auth'
import type { Capture } from '@kosha/types'

/**
 * Get captures for a specific account, ordered most recent first.
 */
export async function getCapturesForAccount(
  accountId: string
): Promise<{ captures: Capture[]; error?: string }> {
  const orgId = await getOrganizationId()
  if (!orgId) return { captures: [], error: 'No organization found' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('captures')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch captures for account:', error)
    return { captures: [], error: 'Failed to fetch captures' }
  }

  return { captures: (data as Capture[]) || [] }
}

/**
 * Get recent captures across all accounts, ordered most recent first.
 */
export async function getRecentCaptures(
  limit = 5
): Promise<{ captures: Capture[]; error?: string }> {
  const orgId = await getOrganizationId()
  if (!orgId) return { captures: [], error: 'No organization found' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('captures')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Failed to fetch recent captures:', error)
    return { captures: [], error: 'Failed to fetch recent captures' }
  }

  return { captures: (data as Capture[]) || [] }
}
