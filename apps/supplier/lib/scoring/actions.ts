'use server'

/**
 * Scoring Actions
 *
 * Server actions that fetch account signals, compute scores, and persist them.
 */

import { createClient } from '@kosha/supabase/server'
import { getOrganizationId } from '@/lib/auth'
import { computeAccountScore } from './compute-score'
import type { AccountSignals } from './compute-score'

/**
 * Recompute and persist the score for a single account.
 * Call this after saving captures, notes, tasks, or visits.
 */
export async function scoreAccount(accountId: string): Promise<{ score: number; error?: string }> {
  const orgId = await getOrganizationId()
  if (!orgId) return { score: 0, error: 'No organization found' }

  const supabase = await createClient()

  // Fetch all signals in parallel
  const [insightsRes, tasksRes, visitsRes, notesRes] = await Promise.all([
    supabase
      .from('insights')
      .select('insight_type, created_at')
      .eq('account_id', accountId),
    supabase
      .from('tasks')
      .select('priority, due_date, completed')
      .eq('account_id', accountId),
    supabase
      .from('visits')
      .select('visit_date')
      .eq('account_id', accountId),
    supabase
      .from('account_notes')
      .select('created_at')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false }),
  ])

  const signals: AccountSignals = {
    insights: insightsRes.data || [],
    tasks: tasksRes.data || [],
    visits: visitsRes.data || [],
    noteCount: notesRes.data?.length || 0,
    lastNoteAt: notesRes.data?.[0]?.created_at || null,
  }

  const { score, reasons } = computeAccountScore(signals)

  // Persist score
  const { error } = await supabase
    .from('accounts')
    .update({
      score,
      score_reasons: reasons,
      scored_at: new Date().toISOString(),
    })
    .eq('id', accountId)

  if (error) {
    console.error('Failed to persist account score:', error)
    return { score, error: 'Failed to save score' }
  }

  return { score }
}

/**
 * Recompute scores for all accounts in the current org.
 * Useful for initial backfill or periodic refresh.
 */
export async function scoreAllAccounts(): Promise<{ scored: number; error?: string }> {
  const orgId = await getOrganizationId()
  if (!orgId) return { scored: 0, error: 'No organization found' }

  const supabase = await createClient()

  const { data: accounts, error: fetchError } = await supabase
    .from('accounts')
    .select('id')

  if (fetchError || !accounts) {
    return { scored: 0, error: 'Failed to fetch accounts' }
  }

  let scored = 0
  for (const account of accounts) {
    const result = await scoreAccount(account.id)
    if (!result.error) scored++
  }

  return { scored }
}
