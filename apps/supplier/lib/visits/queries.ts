/**
 * Visit Queries
 *
 * Read-only database operations for visits.
 * RLS handles rep vs admin visibility automatically.
 */

import { createClient } from '@kosha/supabase/server'
import { getOrganizationId } from '@/lib/auth'
import type { Visit } from '@kosha/types'

/**
 * Get upcoming visits (visit_date >= now), ordered soonest first.
 */
export async function getUpcomingVisits(): Promise<{ visits: Visit[]; error?: string }> {
  const orgId = await getOrganizationId()
  if (!orgId) return { visits: [], error: 'No organization found' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('visits')
    .select('*')
    .gte('visit_date', new Date().toISOString())
    .order('visit_date', { ascending: true })

  if (error) {
    console.error('Failed to fetch upcoming visits:', error)
    return { visits: [], error: 'Failed to fetch visits' }
  }

  return { visits: (data as Visit[]) || [] }
}

/**
 * Get past visits (visit_date < now), ordered most recent first.
 */
export async function getPastVisits(): Promise<{ visits: Visit[]; error?: string }> {
  const orgId = await getOrganizationId()
  if (!orgId) return { visits: [], error: 'No organization found' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('visits')
    .select('*')
    .lt('visit_date', new Date().toISOString())
    .order('visit_date', { ascending: false })

  if (error) {
    console.error('Failed to fetch past visits:', error)
    return { visits: [], error: 'Failed to fetch visits' }
  }

  return { visits: (data as Visit[]) || [] }
}

/**
 * Count visits in the current week (Mon–Sun).
 */
export async function getVisitsThisWeek(): Promise<number> {
  const orgId = await getOrganizationId()
  if (!orgId) return 0

  const now = new Date()
  const day = now.getDay()
  const diffToMonday = day === 0 ? 6 : day - 1
  const monday = new Date(now)
  monday.setDate(now.getDate() - diffToMonday)
  monday.setHours(0, 0, 0, 0)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 7)

  const supabase = await createClient()
  const { count, error } = await supabase
    .from('visits')
    .select('*', { count: 'exact', head: true })
    .gte('visit_date', monday.toISOString())
    .lt('visit_date', sunday.toISOString())

  if (error) {
    console.error('Failed to count visits this week:', error)
    return 0
  }

  return count || 0
}

/**
 * Get visits for a specific account, ordered most recent first.
 */
export async function getVisitsForAccount(
  accountId: string
): Promise<{ visits: Visit[]; error?: string }> {
  const orgId = await getOrganizationId()
  if (!orgId) return { visits: [], error: 'No organization found' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('visits')
    .select('*')
    .eq('account_id', accountId)
    .order('visit_date', { ascending: false })

  if (error) {
    console.error('Failed to fetch visits for account:', error)
    return { visits: [], error: 'Failed to fetch visits' }
  }

  return { visits: (data as Visit[]) || [] }
}
