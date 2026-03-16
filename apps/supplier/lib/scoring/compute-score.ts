/**
 * Account Scoring — Deterministic Formula
 *
 * Pure function that computes a 0-100 priority score from account signals.
 * No DB calls, no side effects — just data in, score out.
 */

import type { Insight, Task, Visit } from '@kosha/types'

export interface AccountSignals {
  insights: Pick<Insight, 'insight_type' | 'created_at'>[]
  tasks: Pick<Task, 'priority' | 'due_date' | 'completed'>[]
  visits: Pick<Visit, 'visit_date'>[]
  noteCount: number
  lastNoteAt: string | null
}

export interface ScoredAccount {
  score: number
  reasons: string[]
}

const DAY_MS = 1000 * 60 * 60 * 24

function daysSince(dateStr: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / DAY_MS))
}

function daysUntil(dateStr: string): number {
  return Math.floor((new Date(dateStr).getTime() - Date.now()) / DAY_MS)
}

/**
 * Compute a priority score (0-100) for a managed account.
 *
 * Higher score = higher priority = rep should visit sooner.
 *
 * Signal weights:
 *  - Overdue high-priority tasks:    up to 25 pts
 *  - Competitive/friction insights:  up to 25 pts
 *  - Visit recency (neglect risk):   up to 20 pts
 *  - Expansion opportunity:          up to 15 pts
 *  - Open task backlog:              up to 10 pts
 *  - Engagement recency (notes):     up to  5 pts
 *                                   ───────────
 *                                   max 100 pts
 */
export function computeAccountScore(signals: AccountSignals): ScoredAccount {
  let score = 0
  const reasons: string[] = []
  const now = new Date()

  // ── 1. Overdue high-priority tasks (up to 25 pts) ──────────────────────
  const overdueTasks = signals.tasks.filter(
    (t) => !t.completed && daysUntil(t.due_date) < 0
  )
  const overdueHigh = overdueTasks.filter((t) => t.priority === 'high')
  const overdueMedium = overdueTasks.filter((t) => t.priority === 'medium')

  if (overdueHigh.length > 0) {
    const pts = Math.min(25, overdueHigh.length * 12)
    score += pts
    reasons.push(
      `${overdueHigh.length} high-priority task${overdueHigh.length > 1 ? 's' : ''} overdue`
    )
  } else if (overdueMedium.length > 0) {
    const pts = Math.min(15, overdueMedium.length * 5)
    score += pts
    reasons.push(
      `${overdueMedium.length} medium-priority task${overdueMedium.length > 1 ? 's' : ''} overdue`
    )
  }

  // ── 2. Competitive & friction insights (up to 25 pts) ──────────────────
  const recentInsights = signals.insights.filter(
    (i) => daysSince(i.created_at) <= 30
  )
  const competitive = recentInsights.filter((i) => i.insight_type === 'competitive')
  const friction = recentInsights.filter((i) => i.insight_type === 'friction')

  if (competitive.length > 0) {
    const recency = competitive.reduce(
      (min, i) => Math.min(min, daysSince(i.created_at)),
      Infinity
    )
    const pts = Math.min(15, competitive.length * 8)
    score += pts
    reasons.push(
      `Competitor activity detected ${recency === 0 ? 'today' : `${recency} day${recency > 1 ? 's' : ''} ago`}`
    )
  }

  if (friction.length > 0) {
    const pts = Math.min(10, friction.length * 5)
    score += pts
    reasons.push(
      `${friction.length} friction issue${friction.length > 1 ? 's' : ''} flagged recently`
    )
  }

  // ── 3. Visit recency / neglect risk (up to 20 pts) ─────────────────────
  const sortedVisits = [...signals.visits].sort(
    (a, b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime()
  )
  const lastVisit = sortedVisits[0]

  if (!lastVisit) {
    score += 20
    reasons.push('No visits on record')
  } else {
    const daysSinceVisit = daysSince(lastVisit.visit_date)
    if (daysSinceVisit > 30) {
      score += 20
      reasons.push(`No visit in ${daysSinceVisit} days`)
    } else if (daysSinceVisit > 14) {
      score += 12
      reasons.push(`Last visit ${daysSinceVisit} days ago`)
    } else if (daysSinceVisit > 7) {
      score += 5
    }
  }

  // ── 4. Expansion opportunity (up to 15 pts) ────────────────────────────
  const expansion = recentInsights.filter((i) => i.insight_type === 'expansion')
  if (expansion.length > 0) {
    const pts = Math.min(15, expansion.length * 7)
    score += pts
    reasons.push(
      `${expansion.length} expansion opportunit${expansion.length > 1 ? 'ies' : 'y'} identified`
    )
  }

  // ── 5. Open task backlog (up to 10 pts) ────────────────────────────────
  const openTasks = signals.tasks.filter((t) => !t.completed)
  if (openTasks.length > 5) {
    score += 10
    reasons.push(`${openTasks.length} open tasks — high backlog`)
  } else if (openTasks.length > 2) {
    score += 5
    reasons.push(`${openTasks.length} open tasks`)
  }

  // ── 6. Engagement recency (up to 5 pts) ────────────────────────────────
  if (signals.noteCount === 0 && signals.insights.length === 0) {
    score += 5
    reasons.push('No recorded activity — needs engagement')
  } else if (signals.lastNoteAt && daysSince(signals.lastNoteAt) > 21) {
    score += 3
    reasons.push(`No notes in ${daysSince(signals.lastNoteAt)} days`)
  }

  // Clamp to 0-100
  score = Math.max(0, Math.min(100, score))

  // If score is low and no reasons, add a positive note
  if (reasons.length === 0) {
    reasons.push('Account is in good standing')
  }

  return { score, reasons }
}
