'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Badge,
  Button,
  ScrollArea,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  Separator,
  Skeleton,
} from '@kosha/ui'
import {
  Building2,
  MapPin,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Tag,
} from 'lucide-react'
import { fetchAccountDetails } from '@/lib/territory/actions'
import type { Account, Insight, Task, Visit } from '@kosha/types'

const insightTypeConfig: Record<string, { label: string; className: string }> = {
  demand: { label: 'Demand', className: 'bg-purple-100 text-purple-700' },
  competitive: { label: 'Competitive', className: 'bg-red-100 text-red-700' },
  friction: { label: 'Friction', className: 'bg-amber-100 text-amber-700' },
  expansion: { label: 'Expansion', className: 'bg-emerald-100 text-emerald-700' },
  relationship: { label: 'Relationship', className: 'bg-blue-100 text-blue-700' },
}

const premiseConfig: Record<string, { label: string; className: string }> = {
  on_premise: { label: 'On Premise', className: 'bg-emerald-50 text-emerald-700' },
  off_premise: { label: 'Off Premise', className: 'bg-blue-50 text-blue-700' },
  hybrid: { label: 'Hybrid', className: 'bg-amber-50 text-amber-700' },
}

interface TerritoryAccountPanelProps {
  account: Account | null
  open: boolean
  onClose: () => void
}

export function TerritoryAccountPanel({
  account,
  open,
  onClose,
}: TerritoryAccountPanelProps) {
  const [loading, setLoading] = useState(false)
  const [insights, setInsights] = useState<Insight[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [visits, setVisits] = useState<Visit[]>([])

  useEffect(() => {
    if (!account || !open) return

    setLoading(true)
    fetchAccountDetails(account.id)
      .then((details) => {
        setInsights(details.insights)
        setTasks(details.tasks)
        setVisits(details.visits)
      })
      .finally(() => setLoading(false))
  }, [account?.id, open])

  const pendingTasks = tasks.filter((t) => !t.completed)
  const recentInsights = insights.slice(0, 5)

  return (
    <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0">
        {account && (
          <>
            <SheetHeader className="p-6 pb-0">
              <SheetTitle className="text-lg">{account.name}</SheetTitle>
              <SheetDescription className="sr-only">
                Account details for {account.name}
              </SheetDescription>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {account.industry && (
                  <Badge className="bg-slate-100 text-slate-700 text-xs">
                    <Building2 className="h-3 w-3 mr-1" />
                    {account.industry}
                  </Badge>
                )}
                {account.premise_type && (() => {
                  const pc = premiseConfig[account.premise_type]
                  return (
                    <Badge className={`${pc?.className || 'bg-slate-100 text-slate-600'} text-xs`}>
                      <Tag className="h-3 w-3 mr-1" />
                      {pc?.label || account.premise_type}
                    </Badge>
                  )
                })()}
              </div>
            </SheetHeader>

            <ScrollArea className="h-[calc(100vh-140px)]">
              <div className="p-6 space-y-5">
                {/* Quick stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <Calendar className="h-3 w-3" />
                      Last Contact
                    </div>
                    <p className="text-sm font-semibold">
                      {account.last_contact
                        ? new Date(account.last_contact).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })
                        : '—'}
                    </p>
                  </div>
                </div>

                {account.address && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{account.address}</span>
                  </div>
                )}

                <Separator />

                {/* Insights */}
                <div>
                  <h3 className="text-sm font-medium text-slate-900 mb-3">
                    Recent Insights
                  </h3>
                  {loading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : recentInsights.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">
                      No insights yet.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {recentInsights.map((insight) => {
                        const typeInfo =
                          insightTypeConfig[insight.insight_type] ||
                          insightTypeConfig.demand
                        return (
                          <div
                            key={insight.id}
                            className="border-l-2 border-slate-200 pl-3 py-1"
                          >
                            <div className="flex items-center gap-2">
                              <Badge className={`${typeInfo.className} text-[10px] px-1.5 py-0`}>
                                {typeInfo.label}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground ml-auto">
                                {new Date(insight.created_at).toLocaleDateString(
                                  'en-US',
                                  { month: 'short', day: 'numeric' }
                                )}
                              </span>
                            </div>
                            <p className="text-xs mt-1 line-clamp-2">
                              {insight.description}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Tasks */}
                <div>
                  <h3 className="text-sm font-medium text-slate-900 mb-3">
                    Pending Tasks
                  </h3>
                  {loading ? (
                    <div className="space-y-2">
                      {[1, 2].map((i) => (
                        <Skeleton key={i} className="h-10 w-full" />
                      ))}
                    </div>
                  ) : pendingTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">
                      No pending tasks.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {pendingTasks.slice(0, 5).map((task) => (
                        <div
                          key={task.id}
                          className="flex items-start gap-2 text-sm"
                        >
                          {task.priority === 'high' ? (
                            <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs line-clamp-1">{task.task}</p>
                            <p className="text-[10px] text-muted-foreground">
                              Due{' '}
                              {new Date(task.due_date).toLocaleDateString(
                                'en-US',
                                { month: 'short', day: 'numeric' }
                              )}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Visits */}
                <div>
                  <h3 className="text-sm font-medium text-slate-900 mb-3">
                    Recent Visits
                  </h3>
                  {loading ? (
                    <div className="space-y-2">
                      {[1, 2].map((i) => (
                        <Skeleton key={i} className="h-8 w-full" />
                      ))}
                    </div>
                  ) : visits.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">
                      No visits yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {visits.slice(0, 5).map((visit) => (
                        <div
                          key={visit.id}
                          className="border-l-2 border-slate-200 pl-3 py-1"
                        >
                          <p className="text-xs font-medium">
                            {new Date(visit.visit_date).toLocaleDateString(
                              'en-US',
                              {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                              }
                            )}
                          </p>
                          {visit.notes && (
                            <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                              {visit.notes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Link to full account */}
                <Link href={`/accounts/${account.id}`}>
                  <Button variant="outline" size="sm" className="w-full">
                    View Full Account
                    <ExternalLink className="h-3.5 w-3.5 ml-2" />
                  </Button>
                </Link>
              </div>
            </ScrollArea>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
