'use client'

import { useState } from 'react'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
} from '@kosha/ui'
import { Pencil, Trash2, Building2, DollarSign, MapPin, Calendar, Tag } from 'lucide-react'
import { AccountForm } from './account-form'
import { TaskList } from './task-list'
import { deleteAccount } from '@/lib/accounts/actions'
import { toast } from '@/hooks/use-toast'
import type { Account, Visit, Signal, Task } from '@kosha/types'

const signalTypeConfig: Record<string, { label: string; className: string }> = {
  demand: { label: 'Demand', className: 'bg-purple-100 text-purple-700' },
  competitive: { label: 'Competitive', className: 'bg-red-100 text-red-700' },
  friction: { label: 'Friction', className: 'bg-amber-100 text-amber-700' },
  expansion: { label: 'Expansion', className: 'bg-emerald-100 text-emerald-700' },
  relationship: { label: 'Relationship', className: 'bg-blue-100 text-blue-700' },
}

const healthConfig = {
  healthy: { label: 'Healthy', className: 'bg-emerald-100 text-emerald-700' },
  at_risk: { label: 'At Risk', className: 'bg-amber-100 text-amber-700' },
  critical: { label: 'Critical', className: 'bg-red-100 text-red-700' },
}

const premiseLabels: Record<string, string> = {
  on_premise: 'On Premise',
  off_premise: 'Off Premise',
  hybrid: 'Hybrid',
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`
}

interface AccountDetailProps {
  account: Account
  visits?: Visit[]
  signals?: Signal[]
  tasks?: Task[]
  onClose?: () => void
  onDeleted?: () => void
}

export function AccountDetail({ account, visits, signals, tasks, onClose, onDeleted }: AccountDetailProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const health = healthConfig[account.health] || healthConfig.healthy

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{account.name}</h2>
          <div className="flex gap-2 mt-2">
            <Badge className={health.className}>{health.label}</Badge>
            {account.industry && <Badge variant="outline">{account.industry}</Badge>}
            {account.premise_type && (
              <Badge variant="outline">
                {premiseLabels[account.premise_type] || account.premise_type}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Trash2 className="h-4 w-4 text-red-500" />
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
        </div>
      </div>

      <Separator />

      {/* Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium text-muted-foreground">ARR</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {account.arr > 0 ? formatCurrency(account.arr) : '—'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium text-muted-foreground">Industry</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{account.industry || '—'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium text-muted-foreground">Premise Type</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {account.premise_type ? premiseLabels[account.premise_type] || account.premise_type : '—'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium text-muted-foreground">Last Contact</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {account.last_contact
                ? new Date(account.last_contact).toLocaleDateString()
                : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {account.address && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium text-muted-foreground">Address</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{account.address}</p>
          </CardContent>
        </Card>
      )}

      {/* Signals, Tasks, and Visit History */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Signals
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!signals || signals.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No signals captured yet.
              </p>
            ) : (
              <div className="space-y-3">
                {signals.map((signal) => {
                  const typeInfo = signalTypeConfig[signal.signal_type] || signalTypeConfig.demand

                  return (
                    <div key={signal.id} className="flex items-start gap-3 border-l-2 border-slate-200 pl-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <Badge className={typeInfo.className}>{typeInfo.label}</Badge>
                          <span className="text-xs font-medium text-muted-foreground">
                            {formatConfidence(signal.confidence)}
                          </span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {new Date(signal.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                        <p className="text-sm mt-1">{signal.description}</p>
                        {signal.sub_category && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {signal.sub_category}
                          </p>
                        )}
                        {signal.suggested_action && (
                          <p className="text-xs text-blue-600 mt-1">
                            {signal.suggested_action}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <TaskList tasks={tasks || []} />

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Visit History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!visits || visits.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
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
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
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
        </DialogContent>
      </Dialog>
    </div>
  )
}
