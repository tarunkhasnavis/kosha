import { readFileSync } from 'fs'
import { join } from 'path'

const AI_DIR = join(process.cwd(), 'lib', 'ai')

const TONE_RULES = `
## COMMUNICATION RULES
- IMPORTANT: Always speak in English only.
- IMPORTANT: Never use profanity or crude language. Keep all language professional and workplace-appropriate.
- IMPORTANT: Speak at a brisk, efficient pace. Keep responses concise. Reps are busy.
- IMPORTANT: ZERO acknowledgment or commentary. Never say "Great", "Got it", "Good to know" or ANY form of parroting or summarizing. Just ask your next question or stay silent.
- IMPORTANT: Keep responses under 2 sentences. One sentence is ideal. Never monologue.
`

export function composePrompt(options?: {
  accountContext?: string
  orgContext?: string
  userContext?: string
  timeContext?: string
}): string {
  const router = readFileSync(join(AI_DIR, 'router.md'), 'utf-8')

  let prompt = `${router}\n\n${TONE_RULES}`

  if (options?.userContext || options?.timeContext) {
    prompt += `\n\n## USER CONTEXT`
    if (options.timeContext) prompt += `\n${options.timeContext}`
    if (options.userContext) prompt += `\n${options.userContext}`
  }

  if (options?.orgContext) {
    prompt += `\n\n## ORGANIZATION CONTEXT\n${options.orgContext}`
  }

  if (options?.accountContext) {
    prompt += `\n\n## SELECTED ACCOUNT CONTEXT\n${options.accountContext}`
  }

  return prompt
}

export function formatOrgContext(data: {
  accounts: { name: string; address?: string | null }[]
  upcomingVisits: { account_name: string; visit_date: string; notes?: string | null }[]
  pendingTasks: { account_name: string; task: string; priority?: string | null; due_date: string }[]
}): string {
  const lines: string[] = []

  if (data.accounts.length > 0) {
    lines.push('Known Accounts:')
    data.accounts.forEach((a) => {
      lines.push(`- ${a.name}${a.address ? ` (${a.address})` : ''}`)
    })
  }

  if (data.upcomingVisits.length > 0) {
    lines.push('\nUpcoming Visits:')
    data.upcomingVisits.forEach((v) => {
      const date = new Date(v.visit_date).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
      lines.push(`- ${v.account_name} on ${date}${v.notes ? ` — ${v.notes}` : ''}`)
    })
  }

  if (data.pendingTasks.length > 0) {
    lines.push('\nPending Tasks:')
    data.pendingTasks.forEach((t) => {
      const due = new Date(t.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const priority = t.priority ? ` [${t.priority}]` : ''
      lines.push(`- ${t.account_name}: ${t.task}${priority} (due ${due})`)
    })
  }

  return lines.join('\n')
}

export function formatAccountContext(data: {
  name: string
  address?: string | null
  contacts?: { name: string; role?: string | null; phone?: string | null }[]
  recentInsights?: { description: string; insight_type: string; created_at: string }[]
  openTasks?: { task: string; priority?: string | null }[]
  recentNotes?: { content: string; created_at: string }[]
  lastVisit?: { visit_date: string; notes?: string | null } | null
}): string {
  const lines: string[] = []

  lines.push(`Account: ${data.name}`)
  if (data.address) lines.push(`Address: ${data.address}`)

  if (data.contacts && data.contacts.length > 0) {
    lines.push('\nKey Contacts:')
    data.contacts.forEach((c) => {
      const parts = [c.name]
      if (c.role) parts.push(`(${c.role})`)
      if (c.phone) parts.push(`- ${c.phone}`)
      lines.push(`- ${parts.join(' ')}`)
    })
  }

  if (data.lastVisit) {
    const date = new Date(data.lastVisit.visit_date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    lines.push(`\nLast Visit: ${date}`)
    if (data.lastVisit.notes) lines.push(`Notes: ${data.lastVisit.notes}`)
  }

  if (data.recentInsights && data.recentInsights.length > 0) {
    lines.push('\nRecent Insights:')
    data.recentInsights.forEach((i) => {
      const date = new Date(i.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      lines.push(`- [${i.insight_type}] ${i.description} (${date})`)
    })
  }

  if (data.openTasks && data.openTasks.length > 0) {
    lines.push('\nOpen Tasks:')
    data.openTasks.forEach((t) => {
      const priority = t.priority ? ` [${t.priority}]` : ''
      lines.push(`- ${t.task}${priority}`)
    })
  }

  if (data.recentNotes && data.recentNotes.length > 0) {
    lines.push('\nAccount Notes:')
    data.recentNotes.forEach((n) => {
      const date = new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      lines.push(`- ${n.content} (${date})`)
    })
  }

  return lines.join('\n')
}
