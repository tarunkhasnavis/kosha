/**
 * Insight Queries
 *
 * Read-only operations for insights.
 * RLS handles rep vs admin visibility automatically.
 */

import { createClient } from '@kosha/supabase/server'
import { getOrganizationId } from '@/lib/auth'
import type { Insight } from '@kosha/types'

/**
 * Get recent insights, ordered by most recent first.
 */
export async function getRecentInsights(
  limit = 20
): Promise<{ insights: Insight[]; error?: string }> {
  const orgId = await getOrganizationId()
  if (!orgId) return { insights: [], error: 'No organization found' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('insights')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Failed to fetch insights:', error)
    return { insights: [], error: 'Failed to fetch insights' }
  }

  return { insights: (data as Insight[]) || [] }
}

/**
 * Get insights for a specific account.
 */
export async function getInsightsForAccount(
  accountId: string
): Promise<{ insights: Insight[]; error?: string }> {
  const orgId = await getOrganizationId()
  if (!orgId) return { insights: [], error: 'No organization found' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('insights')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch insights for account:', error)
    return { insights: [], error: 'Failed to fetch insights' }
  }

  return { insights: (data as Insight[]) || [] }
}

/**
 * Get insights created within a date range (for daily summaries).
 */
export async function getInsightsForDate(
  date: string
): Promise<{ insights: Insight[]; error?: string }> {
  const orgId = await getOrganizationId()
  if (!orgId) return { insights: [], error: 'No organization found' }

  const startOfDay = `${date}T00:00:00.000Z`
  const endOfDay = `${date}T23:59:59.999Z`

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('insights')
    .select('*')
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch insights for date:', error)
    return { insights: [], error: 'Failed to fetch insights' }
  }

  return { insights: (data as Insight[]) || [] }
}

/**
 * Get total insight count (for dashboard).
 */
export async function getInsightCount(): Promise<number> {
  const orgId = await getOrganizationId()
  if (!orgId) return 0

  const supabase = await createClient()
  const { count, error } = await supabase
    .from('insights')
    .select('*', { count: 'exact', head: true })

  if (error) {
    console.error('Failed to count insights:', error)
    return 0
  }

  return count || 0
}
