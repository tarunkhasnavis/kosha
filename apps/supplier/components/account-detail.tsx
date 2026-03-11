'use client'

import { useState } from 'react'
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Separator,
  Skeleton,
} from '@kosha/ui'
import { Pencil, Building2, MapPin, Calendar } from 'lucide-react'
import { AccountForm } from './account-form'
import { TaskList } from './task-list'
import { ConversationList } from './conversation-list'
import { deleteAccount } from '@/lib/accounts/actions'
import { toast } from '@/hooks/use-toast'
import type { Account, Visit, Insight, Task, Capture } from '@kosha/types'

const insightTypeConfig: Record<string, { label: string; className: string }> = {
  demand: { label: 'Demand', className: 'bg-purple-100 text-purple-700' },
  competitive: { label: 'Competitive', className: 'bg-red-100 text-red-700' },
  friction: { label: 'Friction', className: 'bg-amber-100 text-amber-700' },
  expansion: { label: 'Expansion', className: 'bg-emerald-100 text-emerald-700' },
  relationship: { label: 'Relationship', className: 'bg-blue-100 text-blue-700' },
  promotion: { label: 'Promotion', className: 'bg-pink-100 text-pink-700' },
}

const premiseConfig: Record<string, { label: string; className: string }> = {
  on_premise: { label: 'On Premise', className: 'bg-emerald-50 text-emerald-700' },
  off_premise: { label: 'Off Premise', className: 'bg-blue-50 text-blue-700' },
  hybrid: { label: 'Hybrid', className: 'bg-amber-50 text-amber-700' },
}

type TabKey = 'summary' | 'conversations'

interface AccountDetailProps {
  account: Account
  visits?: Visit[]
  insights?: Insight[]
  tasks?: Task[]
  captures?: Capture[]
  loading?: boolean
  onClose?: () => void
  onDeleted?: () => void
}

export function AccountDetail({ account, visits, insights, tasks, captures, loading, onClose, onDeleted }: AccountDetailProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('summary')

  async function handleDelete() {
    setDeleting(true)
    const result = await deleteAccount(account.id)
    setDeleting(false)

    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' })
      return
    }

    toast({ title: 'Account deleted' })
    onDeleted?.()
    onClose?.()
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'summary', label: 'Summary' },
    { key: 'conversations', label: `Conversations${captures && captures.length > 0 ? ` (${captures.length})` : ''}` },
  ]

  return (
    <div className="space-y-4">
      {/* Centered Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-between">
          <div className="w-7" />
          <h2 className="text-lg font-semibold text-slate-900">{account.name}</h2>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Premise badge */}
        {account.premise_type && (() => {
          const pc = premiseConfig[account.premise_type]
          return (
            <Badge className={`${pc?.className || 'bg-slate-100 text-slate-600'} text-xs`}>
              {pc?.label || account.premise_type}
            </Badge>
          )
        })()}

        {/* Compact metadata */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
          {account.address && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="line-clamp-1">{account.address}</span>
            </span>
          )}
          {account.industry && (
            <span className="flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              {account.industry}
            </span>
          )}
          {account.last_contact && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              {new Date(account.last_contact).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </span>
          )}
        </div>
      </div>

      <Separator />

      {/* Tabs — distributor style */}
      <div className="bg-slate-100/80 rounded-xl p-1.5 flex">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`
              flex-1 flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg
              transition-all duration-150
              ${activeTab === tab.key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'}
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'summary' && (
        <div className="space-y-5">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <>
              {/* Insights */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Insights</h3>
                {!insights || insights.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    No insights captured yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {insights.map((insight) => {
                      const typeInfo = insightTypeConfig[insight.insight_type] || insightTypeConfig.demand

                      return (
                        <div key={insight.id} className="flex items-start gap-3 border-l-2 border-slate-200 pl-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <Badge className={typeInfo.className}>{typeInfo.label}</Badge>
                              <span className="text-xs text-muted-foreground ml-auto">
                                {new Date(insight.created_at).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                            </div>
                            <p className="text-sm mt-1">{insight.description}</p>
                            {insight.sub_category && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {insight.sub_category}
                              </p>
                            )}
                            {insight.suggested_action && (
                              <p className="text-xs text-blue-600 mt-1">
                                {insight.suggested_action}
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <Separator />

              {/* Tasks */}
              <TaskList tasks={tasks || []} />

              <Separator />

              {/* Visit History */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Visit History</h3>
                {!visits || visits.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    No visits recorded yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {visits.map((visit) => (
                      <div key={visit.id} className="flex items-start gap-3 border-l-2 border-slate-200 pl-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900">
                            {new Date(visit.visit_date).toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </p>
                          {visit.notes && (
                            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                              {visit.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'conversations' && (
        <div>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : (
            <ConversationList captures={captures || []} />
          )}
        </div>
      )}

      {/* Edit Dialog — includes delete option */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
          </DialogHeader>
          <AccountForm
            account={account}
            onSuccess={() => setEditOpen(false)}
            onCancel={() => setEditOpen(false)}
          />
          <Separator />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full text-red-500 hover:text-red-600 hover:bg-red-50">
                Delete Account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Account</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete &quot;{account.name}&quot;? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={deleting}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DialogContent>
      </Dialog>
    </div>
  )
}
