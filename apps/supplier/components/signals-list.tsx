'use client'

import { useState } from 'react'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@kosha/ui'
import { Trash2, ChevronDown, Radio } from 'lucide-react'
import { deleteSignal } from '@/lib/signals/actions'
import { toast } from '@/hooks/use-toast'
import { useMediaQuery } from '@/hooks/use-media-query'
import type { Signal } from '@kosha/types'

const signalTypeConfig: Record<string, { label: string; className: string }> = {
  demand: { label: 'Demand', className: 'bg-purple-100 text-purple-700' },
  competitive: { label: 'Competitive', className: 'bg-red-100 text-red-700' },
  friction: { label: 'Friction', className: 'bg-amber-100 text-amber-700' },
  expansion: { label: 'Expansion', className: 'bg-emerald-100 text-emerald-700' },
  relationship: { label: 'Relationship', className: 'bg-blue-100 text-blue-700' },
}

function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`
}

interface SignalsListProps {
  signals: Signal[]
}

export function SignalsList({ signals }: SignalsListProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')

  if (signals.length === 0) {
    return null
  }

  if (isDesktop) {
    return <SignalsTable signals={signals} />
  }

  return <SignalsCards signals={signals} />
}

function SignalsTable({ signals }: { signals: Signal[] }) {
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(id: string) {
    setDeletingId(id)
    const result = await deleteSignal(id)
    setDeletingId(null)

    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' })
      return
    }
    toast({ title: 'Signal deleted' })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Recent Signals
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-[80px]">Confidence</TableHead>
              <TableHead className="w-[100px]">Date</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {signals.map((signal) => {
              const typeInfo = signalTypeConfig[signal.signal_type] || signalTypeConfig.demand

              return (
                <Collapsible key={signal.id} asChild>
                  <>
                    <CollapsibleTrigger asChild>
                      <TableRow className="cursor-pointer hover:bg-slate-50">
                        <TableCell className="font-medium">{signal.account_name}</TableCell>
                        <TableCell>
                          <Badge className={typeInfo.className}>{typeInfo.label}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[300px]">
                          <div className="flex items-center gap-2">
                            <span className="truncate">{signal.description}</span>
                            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium">
                            {formatConfidence(signal.confidence)}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(signal.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </TableCell>
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Signal</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(signal.id)}
                                  disabled={deletingId === signal.id}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  {deletingId === signal.id ? 'Deleting...' : 'Delete'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    </CollapsibleTrigger>
                    <CollapsibleContent asChild>
                      <TableRow className="bg-slate-50/50">
                        <TableCell colSpan={6} className="py-3">
                          <div className="space-y-2 pl-2">
                            <p className="text-sm">{signal.description}</p>
                            {signal.sub_category && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">
                                  Category
                                </p>
                                <p className="text-sm">{signal.sub_category}</p>
                              </div>
                            )}
                            {signal.suggested_action && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">
                                  Suggested Action
                                </p>
                                <p className="text-sm">{signal.suggested_action}</p>
                              </div>
                            )}
                            {signal.transcript && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">
                                  Transcript
                                </p>
                                <p className="text-xs text-muted-foreground whitespace-pre-line">
                                  {signal.transcript}
                                </p>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    </CollapsibleContent>
                  </>
                </Collapsible>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function SignalsCards({ signals }: { signals: Signal[] }) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  async function handleDelete(id: string) {
    setDeletingId(id)
    const result = await deleteSignal(id)
    setDeletingId(null)

    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' })
      return
    }
    toast({ title: 'Signal deleted' })
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-muted-foreground">Recent Signals</p>
      {signals.map((signal) => {
        const typeInfo = signalTypeConfig[signal.signal_type] || signalTypeConfig.demand
        const isExpanded = expandedId === signal.id

        return (
          <Card
            key={signal.id}
            className="cursor-pointer"
            onClick={() => setExpandedId(isExpanded ? null : signal.id)}
          >
            <CardContent className="py-3 px-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
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
                  <p className="text-sm font-medium">{signal.account_name}</p>
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                    {signal.description}
                  </p>
                </div>
              </div>

              {isExpanded && (
                <div className="mt-3 pt-3 border-t space-y-2">
                  {signal.sub_category && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Category
                      </p>
                      <p className="text-sm">{signal.sub_category}</p>
                    </div>
                  )}
                  {signal.suggested_action && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Suggested Action
                      </p>
                      <p className="text-sm">{signal.suggested_action}</p>
                    </div>
                  )}
                  {signal.transcript && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Transcript
                      </p>
                      <p className="text-xs text-muted-foreground whitespace-pre-line">
                        {signal.transcript}
                      </p>
                    </div>
                  )}
                  <div className="pt-1">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Signal</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(signal.id)}
                            disabled={deletingId === signal.id}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            {deletingId === signal.id ? 'Deleting...' : 'Delete'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
