import { readFileSync } from 'fs'
import { join } from 'path'

const AI_DIR = join(process.cwd(), 'lib', 'ai')

const TONE_RULES = `
## COMMUNICATION RULES
- IMPORTANT: Always speak in English. Never switch languages.
- IMPORTANT: Speak at a brisk, efficient pace. Keep responses concise. Reps are busy — be snappy.
- IMPORTANT: ZERO acknowledgment or commentary. Never say "Great, that sounds like...", "Good to know...", "Got it, so it sounds like..." or ANY form of parroting, summarizing, or commenting on what was said. Just ask your next question immediately. No filler, no transitions, no validation. The ONLY exception is genuine ambiguity that needs clarification.
`

const SKILL_FILES = ['debrief.md', 'prep.md', 'note.md']

export function composePrompt(options?: {
  accountContext?: string
}): string {
  const router = readFileSync(join(AI_DIR, 'router.md'), 'utf-8')

  const skills = SKILL_FILES
    .map((f) => readFileSync(join(AI_DIR, 'skills', f), 'utf-8'))
    .join('\n\n')

  let prompt = `${router}\n\n${skills}\n\n${TONE_RULES}`

  if (options?.accountContext) {
    prompt += `\n\n## ACCOUNT CONTEXT\n${options.accountContext}`
  }

  return prompt
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
