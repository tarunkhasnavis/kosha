'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@kosha/ui'
import {
  AlertTriangle,
  TrendingUp,
  ClipboardList,
  Loader2,
  MapPin,
  Copy,
  Mail,
  X,
  ChevronDown,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import type { Insight, Task } from '@kosha/types'

interface VisitSummary {
  id: string
  account_name: string
  account: { id: string; name: string; address: string | null }
}

interface DailySummaryData {
  date: string
  visits: VisitSummary[]
  insights: Insight[]
  tasks: Task[]
}

interface DailySummaryProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  date: string
  dateLabel: string
}

const WATCH_OUT_TYPES = new Set(['friction', 'competitive'])
const OPPORTUNITY_TYPES = new Set(['demand', 'expansion', 'promotion', 'relationship'])

function formatRecapText(data: DailySummaryData, dateLabel: string): string {
  const lines: string[] = []
  lines.push(`TERRITORY RECAP — ${dateLabel}`)
  lines.push('')

  // Group insights by account
  const insightsByAccount = new Map<string, Insight[]>()
  for (const insight of data.insights) {
    const existing = insightsByAccount.get(insight.account_name) || []
    existing.push(insight)
    insightsByAccount.set(insight.account_name, existing)
  }

  // List each visited account with its insights
  for (const visit of data.visits) {
    const name = visit.account_name || visit.account?.name || 'Unknown'
    lines.push(name.toUpperCase())
    const accountInsights = insightsByAccount.get(name) || []
    if (accountInsights.length > 0) {
      for (const i of accountInsights) {
        lines.push(`  - ${i.description}`)
      }
    } else {
      lines.push('  - Routine check-in')
    }
    lines.push('')
  }

  // Action items
  if (data.tasks.length > 0) {
    lines.push('ACTION ITEMS:')
    data.tasks.forEach((t, idx) => {
      const priority = t.priority ? `[${t.priority.toUpperCase()}]` : ''
      const account = t.account_name ? ` at ${t.account_name}` : ''
      lines.push(`${idx + 1}. ${priority} ${t.task}${account}`)
    })
    lines.push('')
  }

  lines.push(`Total visits: ${data.visits.length} | Insights: ${data.insights.length} | Action items: ${data.tasks.length}`)

  return lines.join('\n')
}

export function DailySummary({ open, onOpenChange, date, dateLabel }: DailySummaryProps) {
  const [data, setData] = useState<DailySummaryData | null>(null)
  const [loading, setLoading] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareEmail, setShareEmail] = useState('')
  const [shareBody, setShareBody] = useState('')
  const [recentEmails, setRecentEmails] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      return JSON.parse(localStorage.getItem('kosha_recent_emails') || '[]')
    } catch {
      return []
    }
  })

  const fetchSummary = useCallback(async (dateStr: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/summary?date=${dateStr}`)
      if (!res.ok) throw new Error('Failed to fetch summary')
      const json = await res.json()
      setData(json)
    } catch {
      toast({ title: 'Failed to load summary', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch when sheet opens
  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (isOpen) {
      fetchSummary(date)
    } else {
      setShareOpen(false)
    }
    onOpenChange(isOpen)
  }, [date, fetchSummary, onOpenChange])

  const watchOuts = data?.insights.filter((i) => WATCH_OUT_TYPES.has(i.insight_type)) || []
  const opportunities = data?.insights.filter((i) => OPPORTUNITY_TYPES.has(i.insight_type)) || []
  const actionItems = data?.tasks || []

  const handleCopyRecap = useCallback(() => {
    if (!data) return
    const text = formatRecapText(data, dateLabel)
    navigator.clipboard.writeText(text)
    toast({ title: 'Recap copied to clipboard' })
  }, [data, dateLabel])

  const handleShareToWholesaler = useCallback(() => {
    if (!data) return
    setShareBody(formatRecapText(data, dateLabel))
    setShareOpen(true)
  }, [data, dateLabel])

  const handleSendEmail = useCallback(() => {
    if (!shareEmail.trim()) {
      toast({ title: 'Enter an email address', variant: 'destructive' })
      return
    }
    // Save to recent emails
    const updated = [shareEmail, ...recentEmails.filter((e) => e !== shareEmail)].slice(0, 5)
    setRecentEmails(updated)
    if (typeof window !== 'undefined') {
      localStorage.setItem('kosha_recent_emails', JSON.stringify(updated))
    }

    const subject = encodeURIComponent(`Territory Recap — ${dateLabel}`)
    const body = encodeURIComponent(shareBody)
    window.open(`mailto:${shareEmail}?subject=${subject}&body=${body}`, '_blank')
    toast({ title: 'Opening email client...' })
  }, [shareEmail, shareBody, dateLabel, recentEmails])

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" hideCloseButton className="flex flex-col p-0 bg-white h-[80vh]">
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-stone-300" />
        </div>

        <SheetHeader className="px-5 pb-3 shrink-0">
          <SheetTitle className="text-left text-lg font-semibold text-stone-800">
            {dateLabel}&apos;s Summary
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
            </div>
          ) : !data || (data.visits.length === 0 && data.insights.length === 0 && data.tasks.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-12 text-stone-400">
              <MapPin className="h-8 w-8 mb-3" />
              <p className="text-sm">No activity recorded for {dateLabel.toLowerCase()}</p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={data.date}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-5"
              >
                {/* Visit count */}
                <div className="flex items-center gap-2 text-sm text-stone-600">
                  <MapPin className="h-4 w-4" />
                  <span className="font-medium">{data.visits.length} visit{data.visits.length !== 1 ? 's' : ''}</span>
                  <span className="text-stone-400">|</span>
                  <span>{data.insights.length} insight{data.insights.length !== 1 ? 's' : ''}</span>
                  <span className="text-stone-400">|</span>
                  <span>{data.tasks.length} task{data.tasks.length !== 1 ? 's' : ''}</span>
                </div>

                {/* Watch Outs */}
                {watchOuts.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <h3 className="text-sm font-semibold text-stone-800">Watch Outs</h3>
                    </div>
                    <div className="space-y-2">
                      {watchOuts.map((insight) => (
                        <div key={insight.id} className="flex items-start gap-2 pl-6">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-stone-700">{insight.description}</p>
                            <p className="text-xs text-stone-400 mt-0.5">{insight.account_name}</p>
                          </div>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${
                            insight.insight_type === 'friction'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {insight.sub_category || insight.insight_type}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Opportunities */}
                {opportunities.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-4 w-4 text-emerald-500" />
                      <h3 className="text-sm font-semibold text-stone-800">Opportunities</h3>
                    </div>
                    <div className="space-y-2">
                      {opportunities.map((insight) => (
                        <div key={insight.id} className="flex items-start gap-2 pl-6">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-stone-700">{insight.description}</p>
                            <p className="text-xs text-stone-400 mt-0.5">{insight.account_name}</p>
                          </div>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${
                            insight.insight_type === 'demand'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {insight.sub_category || insight.insight_type}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Items */}
                {actionItems.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <ClipboardList className="h-4 w-4 text-blue-500" />
                      <h3 className="text-sm font-semibold text-stone-800">Wholesaler Action Items</h3>
                    </div>
                    <div className="space-y-2">
                      {actionItems.map((task) => (
                        <div key={task.id} className="flex items-start gap-2 pl-6">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-stone-700">{task.task}</p>
                            <p className="text-xs text-stone-400 mt-0.5">{task.account_name}</p>
                          </div>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${
                            task.priority === 'high'
                              ? 'bg-red-100 text-red-700'
                              : task.priority === 'medium'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-stone-100 text-stone-600'
                          }`}>
                            {task.priority}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Share buttons */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleCopyRecap}
                    className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl border border-stone-200 bg-white text-stone-700 text-sm font-medium hover:bg-stone-50 active:scale-[0.98] transition-all"
                  >
                    <Copy className="h-4 w-4" />
                    Copy Recap
                  </button>
                  <button
                    onClick={handleShareToWholesaler}
                    className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-[#D97706] text-white text-sm font-medium hover:bg-[#B45309] active:scale-[0.98] transition-all"
                  >
                    <Mail className="h-4 w-4" />
                    Share to Wholesaler
                  </button>
                </div>

                {/* Inline share form */}
                <AnimatePresence>
                  {shareOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="border border-stone-200 rounded-xl p-4 space-y-3 bg-stone-50">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-stone-800">Send Recap</h4>
                          <button onClick={() => setShareOpen(false)} className="text-stone-400 hover:text-stone-600">
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        {/* To field */}
                        <div>
                          <label className="text-xs font-medium text-stone-500 mb-1 block">To</label>
                          <input
                            type="email"
                            value={shareEmail}
                            onChange={(e) => setShareEmail(e.target.value)}
                            placeholder="wholesaler@example.com"
                            className="w-full h-10 px-3 text-sm rounded-lg border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#D97706]/30 focus:border-[#D97706]"
                          />
                          {recentEmails.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {recentEmails.map((email) => (
                                <button
                                  key={email}
                                  onClick={() => setShareEmail(email)}
                                  className="text-xs px-2.5 py-1 rounded-full bg-white border border-stone-200 text-stone-600 hover:bg-stone-100 transition-colors"
                                >
                                  {email}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Editable body */}
                        <div>
                          <label className="text-xs font-medium text-stone-500 mb-1 block">Message</label>
                          <textarea
                            value={shareBody}
                            onChange={(e) => setShareBody(e.target.value)}
                            rows={8}
                            className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#D97706]/30 focus:border-[#D97706] resize-none"
                          />
                        </div>

                        <button
                          onClick={handleSendEmail}
                          className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-[#D97706] text-white text-sm font-medium hover:bg-[#B45309] active:scale-[0.98] transition-all"
                        >
                          <Mail className="h-4 w-4" />
                          Open Email Client
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
