'use client'

import { useState, useCallback, useMemo } from 'react'
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
  Truck,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import type { Insight, Task } from '@kosha/types'

// Extended types with distributor_name from the API
interface SummaryInsight extends Insight {
  distributor_name: string | null
}

interface SummaryTask extends Task {
  distributor_name: string | null
}

interface SummaryVisit {
  id: string
  account_id: string
  account_name: string
  distributor_name: string | null
  account: { id: string; name: string; address: string | null }
}

interface DailySummaryData {
  date: string
  visits: SummaryVisit[]
  insights: SummaryInsight[]
  tasks: SummaryTask[]
}

interface DistributorGroup {
  distributor: string
  visits: SummaryVisit[]
  insights: SummaryInsight[]
  tasks: SummaryTask[]
}

interface DailySummaryProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  date: string
  dateLabel: string
}

const WATCH_OUT_TYPES = new Set(['friction', 'competitive'])
const UNASSIGNED = 'Unassigned'
const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

function groupByDistributor(data: DailySummaryData): DistributorGroup[] {
  const groups = new Map<string, DistributorGroup>()

  const getGroup = (name: string): DistributorGroup => {
    if (!groups.has(name)) {
      groups.set(name, { distributor: name, visits: [], insights: [], tasks: [] })
    }
    return groups.get(name)!
  }

  for (const v of data.visits) getGroup(v.distributor_name || UNASSIGNED).visits.push(v)
  for (const i of data.insights) getGroup(i.distributor_name || UNASSIGNED).insights.push(i)
  for (const t of data.tasks) getGroup(t.distributor_name || UNASSIGNED).tasks.push(t)

  // Sort: named distributors first (alphabetical), Unassigned last
  return [...groups.values()].sort((a, b) => {
    if (a.distributor === UNASSIGNED) return 1
    if (b.distributor === UNASSIGNED) return -1
    return a.distributor.localeCompare(b.distributor)
  })
}

function formatDistributorRecap(group: DistributorGroup, dateLabel: string): string {
  const lines: string[] = []
  lines.push(`RECAP FOR ${group.distributor.toUpperCase()} — ${dateLabel}`)
  lines.push('')

  // ACTION ITEMS FIRST — this is what the wholesaler needs to act on
  const sortedTasks = [...group.tasks].sort((a, b) =>
    (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2)
  )

  if (sortedTasks.length > 0) {
    lines.push('ACTION ITEMS:')
    sortedTasks.forEach((t, idx) => {
      const account = t.account_name ? ` at ${t.account_name}` : ''
      lines.push(`${idx + 1}. ${t.task}${account}`)
    })
    lines.push('')
  }

  // VISIT DETAILS — context for each account
  const insightsByAccount = new Map<string, SummaryInsight[]>()
  for (const i of group.insights) {
    const list = insightsByAccount.get(i.account_name) || []
    list.push(i)
    insightsByAccount.set(i.account_name, list)
  }

  const visitedAccounts = new Set<string>()
  if (group.visits.length > 0 || insightsByAccount.size > 0) {
    lines.push('VISIT DETAILS:')

    for (const v of group.visits) {
      const name = v.account_name || v.account?.name || 'Unknown'
      visitedAccounts.add(name)
      lines.push(name.toUpperCase())
      const accountInsights = insightsByAccount.get(name) || []
      if (accountInsights.length > 0) {
        for (const i of accountInsights) lines.push(`  - ${i.description}`)
      } else {
        lines.push('  - Routine check-in')
      }
      lines.push('')
    }

    // Include insights for accounts not in visits (e.g., from captures without scheduled visits)
    for (const [name, insights] of insightsByAccount) {
      if (!visitedAccounts.has(name)) {
        lines.push(name.toUpperCase())
        for (const i of insights) lines.push(`  - ${i.description}`)
        lines.push('')
      }
    }
  }

  lines.push(`Visits: ${group.visits.length} | Insights: ${group.insights.length} | Action items: ${group.tasks.length}`)

  return lines.join('\n')
}

export function DailySummary({ open, onOpenChange, date, dateLabel }: DailySummaryProps) {
  const [data, setData] = useState<DailySummaryData | null>(null)
  const [loading, setLoading] = useState(false)
  const [shareDistributor, setShareDistributor] = useState<string | null>(null)
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

  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (isOpen) {
      fetchSummary(date)
    } else {
      setShareDistributor(null)
    }
    onOpenChange(isOpen)
  }, [date, fetchSummary, onOpenChange])

  const distributorGroups = useMemo(() => {
    if (!data) return []
    return groupByDistributor(data)
  }, [data])

  const totalVisits = data?.visits.length || 0
  const totalInsights = data?.insights.length || 0
  const totalTasks = data?.tasks.length || 0

  const handleCopyAll = useCallback(() => {
    if (!data) return
    const text = distributorGroups
      .map((g) => formatDistributorRecap(g, dateLabel))
      .join('\n\n---\n\n')
    navigator.clipboard.writeText(text)
    toast({ title: 'Full recap copied to clipboard' })
  }, [data, distributorGroups, dateLabel])

  const handleShareDistributor = useCallback((group: DistributorGroup) => {
    setShareBody(formatDistributorRecap(group, dateLabel))
    setShareDistributor(group.distributor)
  }, [dateLabel])

  const handleSendEmail = useCallback(() => {
    if (!shareEmail.trim()) {
      toast({ title: 'Enter an email address', variant: 'destructive' })
      return
    }
    const updated = [shareEmail, ...recentEmails.filter((e) => e !== shareEmail)].slice(0, 5)
    setRecentEmails(updated)
    if (typeof window !== 'undefined') {
      localStorage.setItem('kosha_recent_emails', JSON.stringify(updated))
    }

    const subject = encodeURIComponent(`Recap for ${shareDistributor} — ${dateLabel}`)
    const body = encodeURIComponent(shareBody)
    window.open(`mailto:${shareEmail}?subject=${subject}&body=${body}`, '_blank')
    toast({ title: 'Opening email client...' })
  }, [shareEmail, shareBody, shareDistributor, dateLabel, recentEmails])

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
          ) : !data || (totalVisits === 0 && totalInsights === 0 && totalTasks === 0) ? (
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
                {/* Totals bar */}
                <div className="flex items-center gap-2 text-sm text-stone-600">
                  <MapPin className="h-4 w-4" />
                  <span className="font-medium">{totalVisits} visit{totalVisits !== 1 ? 's' : ''}</span>
                  <span className="text-stone-400">|</span>
                  <span>{totalInsights} insight{totalInsights !== 1 ? 's' : ''}</span>
                  <span className="text-stone-400">|</span>
                  <span>{totalTasks} task{totalTasks !== 1 ? 's' : ''}</span>
                </div>

                {/* Distributor groups */}
                {distributorGroups.map((group) => {
                  const watchOuts = group.insights.filter((i) => WATCH_OUT_TYPES.has(i.insight_type))
                  const opportunities = group.insights.filter((i) => !WATCH_OUT_TYPES.has(i.insight_type))
                  const sortedTasks = [...group.tasks].sort((a, b) =>
                    (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2)
                  )

                  return (
                    <div key={group.distributor} className="border border-stone-200 rounded-xl overflow-hidden">
                      {/* Distributor header */}
                      <div className="flex items-center justify-between px-4 py-3 bg-stone-50 border-b border-stone-200">
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-stone-500" />
                          <h3 className="text-sm font-semibold text-stone-800">{group.distributor}</h3>
                        </div>
                        <span className="text-xs text-stone-400">
                          {group.visits.length} visit{group.visits.length !== 1 ? 's' : ''}
                        </span>
                      </div>

                      <div className="p-4 space-y-4">
                        {/* Action items FIRST — what the wholesaler needs to do */}
                        {sortedTasks.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <ClipboardList className="h-4 w-4 text-blue-500" />
                              <h4 className="text-xs font-semibold text-stone-800 uppercase tracking-wide">Action Items</h4>
                            </div>
                            <div className="space-y-1.5">
                              {sortedTasks.map((task) => (
                                <div key={task.id} className="flex items-start gap-2 pl-1">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm text-stone-700">{task.task}</p>
                                    <p className="text-xs text-stone-400">{task.account_name}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Watch Outs */}
                        {watchOuts.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                              <h4 className="text-xs font-semibold text-stone-800 uppercase tracking-wide">Watch Outs</h4>
                            </div>
                            <div className="space-y-1.5">
                              {watchOuts.map((insight) => (
                                <div key={insight.id} className="flex items-start gap-2">
                                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 mt-0.5 ${
                                    insight.insight_type === 'friction' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                                  }`}>
                                    {insight.sub_category || insight.insight_type}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm text-stone-700">{insight.description}</p>
                                    <p className="text-xs text-stone-400">{insight.account_name}</p>
                                  </div>
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
                              <h4 className="text-xs font-semibold text-stone-800 uppercase tracking-wide">Opportunities</h4>
                            </div>
                            <div className="space-y-1.5">
                              {opportunities.map((insight) => (
                                <div key={insight.id} className="flex items-start gap-2">
                                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 mt-0.5 ${
                                    insight.insight_type === 'demand' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'
                                  }`}>
                                    {insight.sub_category || insight.insight_type}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm text-stone-700">{insight.description}</p>
                                    <p className="text-xs text-stone-400">{insight.account_name}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Share button for this distributor */}
                        <button
                          onClick={() => handleShareDistributor(group)}
                          className="w-full flex items-center justify-center gap-2 h-10 rounded-lg bg-[#D97706] text-white text-sm font-medium hover:bg-[#B45309] active:scale-[0.98] transition-all"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          Send to {group.distributor}
                        </button>
                      </div>
                    </div>
                  )
                })}

                {/* Copy all button */}
                <button
                  onClick={handleCopyAll}
                  className="w-full flex items-center justify-center gap-2 h-11 rounded-xl border border-stone-200 bg-white text-stone-700 text-sm font-medium hover:bg-stone-50 active:scale-[0.98] transition-all"
                >
                  <Copy className="h-4 w-4" />
                  Copy Full Recap
                </button>

                {/* Inline share form (shown when a distributor is selected) */}
                <AnimatePresence>
                  {shareDistributor && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="border border-stone-200 rounded-xl p-4 space-y-3 bg-stone-50">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-stone-800">Send to {shareDistributor}</h4>
                          <button onClick={() => setShareDistributor(null)} className="text-stone-400 hover:text-stone-600">
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-stone-500 mb-1 block">To</label>
                          <input
                            type="email"
                            value={shareEmail}
                            onChange={(e) => setShareEmail(e.target.value)}
                            placeholder="rep@distributor.com"
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
