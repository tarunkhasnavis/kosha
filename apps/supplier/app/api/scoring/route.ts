import { createServiceClient } from '@kosha/supabase/service'
import { NextResponse } from 'next/server'
import { computeAccountScore } from '@/lib/scoring/compute-score'
import type { AccountSignals } from '@/lib/scoring/compute-score'

/**
 * POST /api/scoring
 *
 * Backfill/refresh scores for all accounts across all orgs.
 * Uses the service client (bypasses RLS) since this is an admin operation.
 */
export async function POST() {
  const supabase = createServiceClient()

  const { data: accounts, error: fetchError } = await supabase
    .from('accounts')
    .select('id')

  if (fetchError || !accounts) {
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 })
  }

  let scored = 0

  for (const account of accounts) {
    const [insightsRes, tasksRes, visitsRes, notesRes] = await Promise.all([
      supabase
        .from('insights')
        .select('insight_type, created_at')
        .eq('account_id', account.id),
      supabase
        .from('tasks')
        .select('priority, due_date, completed')
        .eq('account_id', account.id),
      supabase
        .from('visits')
        .select('visit_date')
        .eq('account_id', account.id),
      supabase
        .from('account_notes')
        .select('created_at')
        .eq('account_id', account.id)
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

    const { error } = await supabase
      .from('accounts')
      .update({
        score,
        score_reasons: reasons,
        scored_at: new Date().toISOString(),
      })
      .eq('id', account.id)

    if (!error) scored++
  }

  return NextResponse.json({ scored, total: accounts.length })
}
