'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Badge,
  Button,
  Calendar as CalendarWidget,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  Separator,
  Skeleton,
} from '@kosha/ui'
import {
  MapPin,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Phone,
  Mail,
  CalendarPlus,
  Pencil,
  User,
} from 'lucide-react'
import { fetchAccountDetails } from '@/lib/territory/actions'
import { createVisit } from '@/lib/visits/actions'
import { toast } from '@/hooks/use-toast'
import type { Account, AccountContact, Insight, Task, Visit } from '@kosha/types'

const insightTypeConfig: Record<string, { label: string; className: string }> = {
  demand: { label: 'Demand', className: 'bg-purple-100 text-purple-700' },
  competitive: { label: 'Competitive', className: 'bg-red-100 text-red-700' },
  friction: { label: 'Friction', className: 'bg-amber-100 text-amber-700' },
  expansion: { label: 'Expansion', className: 'bg-emerald-100 text-emerald-700' },
  relationship: { label: 'Relationship', className: 'bg-blue-100 text-blue-700' },
  promotion: { label: 'Promotion', className: 'bg-pink-100 text-pink-700' },
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
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [insights, setInsights] = useState<Insight[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [visits, setVisits] = useState<Visit[]>([])
  const [contacts, setContacts] = useState<AccountContact[]>([])
  const [visitDialogOpen, setVisitDialogOpen] = useState(false)
  const [visitDate, setVisitDate] = useState<Date | undefined>(undefined)
  const [visitNotes, setVisitNotes] = useState('')
  const [scheduling, setScheduling] = useState(false)

  useEffect(() => {
    if (!account || !open) return

    setLoading(true)
    fetchAccountDetails(account.id)
      .then((details) => {
        setInsights(details.insights)
        setTasks(details.tasks)
        setVisits(details.visits)
        setContacts(details.contacts)
      })
      .finally(() => setLoading(false))
  }, [account?.id, open])

  const pendingTasks = tasks.filter((t) => !t.completed)
  const recentInsights = insights.slice(0, 5)

  async function handleScheduleVisit() {
    if (!account || !visitDate) return
    setScheduling(true)
    const result = await createVisit({
      account_id: account.id,
      account_name: account.name,
      visit_date: visitDate.toISOString(),
      notes: visitNotes.trim() || undefined,
    })
    setScheduling(false)
    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' })
      return
    }
    toast({ title: 'Visit scheduled', description: `Visit to ${account.name} scheduled.` })
    setVisitDialogOpen(false)
    setVisitDate(undefined)
    setVisitNotes('')
  }

  return (
    <>
    <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <SheetContent side="bottom" hideCloseButton className="p-0 bg-white h-[82dvh] flex flex-col">
        {account && (
          <>
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0 relative">
              {account.phone ? (
                <a href={`tel:${account.phone}`} className="absolute left-5 top-2 p-1.5 rounded-lg hover:bg-stone-100 transition-colors">
                  <Phone className="h-4 w-4 text-teal-600" />
                </a>
              ) : (
                <div className="absolute left-5 top-2 p-1.5">
                  <Phone className="h-4 w-4 text-stone-200" />
                </div>
              )}
              <div className="w-10 h-1 rounded-full bg-stone-300" />
              <Link href={`/accounts/${account.id}`} className="absolute right-5 top-2">
                <button className="p-1.5 rounded-lg hover:bg-stone-100 transition-colors">
                  <ExternalLink className="h-4 w-4 text-stone-400" />
                </button>
              </Link>
            </div>

            <SheetHeader className="px-5 pt-2 pb-4 shrink-0 text-center">
              <SheetTitle className="text-lg font-bold text-stone-800">{account.name}</SheetTitle>
              <SheetDescription className="sr-only">
                Account details for {account.name}
              </SheetDescription>
              {account.address && (
                <p className="text-sm text-stone-500 flex items-center justify-center gap-1.5 mt-1">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span>{account.address}</span>
                </p>
              )}

              {/* Last Visit & Next Visit */}
              {(() => {
                const now = new Date()
                const pastVisits = visits
                  .filter((v) => new Date(v.visit_date) < now)
                  .sort((a, b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime())
                const futureVisits = visits
                  .filter((v) => new Date(v.visit_date) >= now)
                  .sort((a, b) => new Date(a.visit_date).getTime() - new Date(b.visit_date).getTime())
                const lastVisit = pastVisits[0]
                const nextVisit = futureVisits[0]
                return (
                  <div className="mt-10 w-full flex justify-center gap-6">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-0.5">
                        <Calendar className="h-3 w-3 shrink-0" />
                        Last Visit
                      </p>
                      <p className="text-sm font-semibold text-stone-800">
                        {lastVisit
                          ? new Date(lastVisit.visit_date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : 'No visits yet'}
                      </p>
                    </div>
                    {nextVisit && (
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-0.5">
                          <CalendarPlus className="h-3 w-3 shrink-0" />
                          Next Visit
                        </p>
                        <p className="text-sm font-semibold text-amber-700">
                          {new Date(nextVisit.visit_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })()}
            </SheetHeader>

            <div className="flex-1 overflow-y-auto">
              <div className="px-5 pb-5 space-y-4">
                {/* Contact actions */}
                {(account.phone || account.website) && (
                  <div className="flex justify-center gap-2">
                    {account.phone && (
                      <a href={`tel:${account.phone}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-100 text-xs font-medium text-stone-700 hover:bg-stone-200 transition-colors">
                        <Phone className="h-3 w-3" />
                        {account.phone}
                      </a>
                    )}
                    {account.website && (
                      <a href={account.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-100 text-xs font-medium text-blue-600 hover:bg-stone-200 transition-colors">
                        <ExternalLink className="h-3 w-3" />
                        Website
                      </a>
                    )}
                  </div>
                )}

                <Separator />

                {/* Insights */}
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">
                    Insights
                  </h3>
                  {loading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-16 w-full rounded-xl" />
                      ))}
                    </div>
                  ) : recentInsights.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">
                      No insights captured yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {recentInsights.map((insight) => {
                        const typeInfo =
                          insightTypeConfig[insight.insight_type] ||
                          insightTypeConfig.demand
                        return (
                          <div
                            key={insight.id}
                            className="bg-white rounded-xl p-3.5 border border-stone-100 shadow-sm"
                          >
                            <div className="flex items-center gap-2 mb-1.5">
                              <Badge className={typeInfo.className}>
                                {typeInfo.label}
                              </Badge>
                              <span className="text-xs text-muted-foreground ml-auto">
                                {new Date(insight.created_at).toLocaleDateString(
                                  'en-US',
                                  { month: 'short', day: 'numeric' }
                                )}
                              </span>
                            </div>
                            <p className="text-sm">{insight.description}</p>
                            {insight.suggested_action && (
                              <p className="text-xs text-blue-600 mt-1.5 font-medium">
                                {insight.suggested_action}
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Tasks */}
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">
                    Pending Tasks
                  </h3>
                  {loading ? (
                    <div className="space-y-2">
                      {[1, 2].map((i) => (
                        <Skeleton key={i} className="h-14 w-full rounded-xl" />
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
                          className="flex items-start gap-3 bg-white rounded-xl p-3.5 border border-stone-100 shadow-sm"
                        >
                          {task.priority === 'high' ? (
                            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-stone-400 shrink-0 mt-0.5" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-stone-800 line-clamp-1">{task.task}</p>
                            <p className="text-xs text-muted-foreground">
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

                {/* Contacts */}
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">
                    Contacts
                  </h3>
                  {loading ? (
                    <div className="space-y-2">
                      {[1, 2].map((i) => (
                        <Skeleton key={i} className="h-14 w-full rounded-xl" />
                      ))}
                    </div>
                  ) : contacts.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">
                      No contacts yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {contacts.map((contact) => (
                        <div
                          key={contact.id}
                          className="flex items-center gap-3 bg-white rounded-xl p-3.5 border border-stone-100 shadow-sm"
                        >
                          <div className="h-8 w-8 rounded-full bg-stone-100 flex items-center justify-center shrink-0">
                            <User className="h-4 w-4 text-stone-500" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-stone-800">{contact.name}</p>
                            {contact.role && (
                              <p className="text-xs text-muted-foreground">{contact.role}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {contact.phone && (
                              <a href={`tel:${contact.phone}`} className="p-1.5 rounded-lg hover:bg-stone-100 transition-colors">
                                <Phone className="h-3.5 w-3.5 text-stone-500" />
                              </a>
                            )}
                            {contact.email && (
                              <a href={`mailto:${contact.email}`} className="p-1.5 rounded-lg hover:bg-stone-100 transition-colors">
                                <Mail className="h-3.5 w-3.5 text-stone-500" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* Bottom Action Buttons */}
            <div className="shrink-0 px-5 py-4 border-t border-stone-100 flex gap-3">
              <button
                onClick={() => setVisitDialogOpen(true)}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-[#D97706] text-white text-sm font-semibold hover:bg-[#B45309] transition-colors"
              >
                <CalendarPlus className="h-4 w-4" />
                Schedule Visit
              </button>
              <button
                onClick={() => { onClose(); router.push(`/capture?accountId=${account.id}`) }}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors"
              >
                <Pencil className="h-4 w-4" />
                Add Notes
              </button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>

    {/* Schedule Visit Dialog */}
    <Dialog open={visitDialogOpen} onOpenChange={setVisitDialogOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Schedule Visit</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <p className="text-sm font-medium text-stone-700 mb-2">Date</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={visitDate ? `${String(visitDate.getMonth() + 1).padStart(2, '0')}/${String(visitDate.getDate()).padStart(2, '0')}/${visitDate.getFullYear()}` : ''}
                onChange={(e) => {
                  const val = e.target.value
                  const parsed = new Date(val)
                  if (!isNaN(parsed.getTime())) setVisitDate(parsed)
                }}
                placeholder="MM/DD/YYYY"
                className="flex-1 rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
              />
              <Popover>
                <PopoverTrigger asChild>
                  <button className="p-2.5 rounded-lg border border-stone-200 hover:bg-stone-50 transition-colors">
                    <Calendar className="h-4 w-4 text-stone-500" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.15)]" align="end">
                  <CalendarWidget
                    mode="single"
                    selected={visitDate}
                    onSelect={(date) => { if (date) setVisitDate(date) }}
                    className="rounded-2xl"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-stone-700 mb-1.5">Notes (optional)</p>
            <textarea
              value={visitNotes}
              onChange={(e) => setVisitNotes(e.target.value)}
              placeholder="Meeting agenda, topics to discuss..."
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300 resize-none h-20"
            />
          </div>
          <Button
            onClick={handleScheduleVisit}
            disabled={!visitDate || scheduling}
            className="w-full bg-[#D97706] hover:bg-[#B45309] text-white"
          >
            {scheduling ? 'Scheduling...' : 'Schedule Visit'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}
