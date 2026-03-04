'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
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
} from '@kosha/ui'
import { Plus, MapPin, Trash2, Calendar } from 'lucide-react'
import { VisitForm } from './visit-form'
import { deleteVisit } from '@/lib/visits/actions'
import { toast } from '@/hooks/use-toast'
import type { Visit, Account } from '@kosha/types'

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

interface VisitsListProps {
  upcomingVisits: Visit[]
  pastVisits: Visit[]
  accounts: Account[]
}

export function VisitsList({ upcomingVisits, pastVisits, accounts }: VisitsListProps) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function handleCreateSuccess() {
    setCreateOpen(false)
    router.refresh()
  }

  async function handleDelete(visitId: string) {
    setDeletingId(visitId)
    const result = await deleteVisit(visitId)
    setDeletingId(null)

    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' })
      return
    }

    toast({ title: 'Visit deleted' })
    router.refresh()
  }

  const hasVisits = upcomingVisits.length > 0 || pastVisits.length > 0

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-900">Visits</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Schedule Visit
        </Button>
      </div>

      {/* Empty state */}
      {!hasVisits && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <MapPin className="h-6 w-6 text-slate-400" />
          </div>
          <p className="text-muted-foreground mb-4">
            No visits scheduled yet. Schedule your first visit to get started.
          </p>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Schedule Visit
          </Button>
        </div>
      )}

      {/* Tabs */}
      {hasVisits && (
        <Tabs defaultValue="upcoming">
          <TabsList>
            <TabsTrigger value="upcoming">
              Upcoming ({upcomingVisits.length})
            </TabsTrigger>
            <TabsTrigger value="past">
              Past ({pastVisits.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming">
            {upcomingVisits.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No upcoming visits scheduled.
              </div>
            ) : (
              <VisitTable
                visits={upcomingVisits}
                deletingId={deletingId}
                onDelete={handleDelete}
              />
            )}
          </TabsContent>

          <TabsContent value="past">
            {pastVisits.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No past visits recorded.
              </div>
            ) : (
              <VisitTable
                visits={pastVisits}
                deletingId={deletingId}
                onDelete={handleDelete}
              />
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Schedule Visit</DialogTitle>
          </DialogHeader>
          <VisitForm
            accounts={accounts}
            onSuccess={handleCreateSuccess}
            onCancel={() => setCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface VisitTableProps {
  visits: Visit[]
  deletingId: string | null
  onDelete: (id: string) => void
}

function VisitTable({ visits, deletingId, onDelete }: VisitTableProps) {
  return (
    <>
      {/* Desktop: Table */}
      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visits.map((visit) => (
              <TableRow key={visit.id}>
                <TableCell className="font-medium">{visit.account_name}</TableCell>
                <TableCell>{formatDate(visit.visit_date)}</TableCell>
                <TableCell>{formatTime(visit.visit_date)}</TableCell>
                <TableCell className="max-w-[200px] truncate">
                  {visit.notes || '—'}
                </TableCell>
                <TableCell>
                  <DeleteVisitButton
                    visitId={visit.id}
                    accountName={visit.account_name}
                    deleting={deletingId === visit.id}
                    onDelete={onDelete}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: Cards */}
      <div className="md:hidden space-y-3">
        {visits.map((visit) => (
          <Card key={visit.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1 min-w-0 flex-1">
                  <p className="font-medium text-slate-900">{visit.account_name}</p>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>{formatDate(visit.visit_date)} at {formatTime(visit.visit_date)}</span>
                  </div>
                  {visit.notes && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                      {visit.notes}
                    </p>
                  )}
                </div>
                <DeleteVisitButton
                  visitId={visit.id}
                  accountName={visit.account_name}
                  deleting={deletingId === visit.id}
                  onDelete={onDelete}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}

interface DeleteVisitButtonProps {
  visitId: string
  accountName: string
  deleting: boolean
  onDelete: (id: string) => void
}

function DeleteVisitButton({ visitId, accountName, deleting, onDelete }: DeleteVisitButtonProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" disabled={deleting}>
          <Trash2 className="h-4 w-4 text-red-500" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Visit</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this visit to &quot;{accountName}&quot;? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onDelete(visitId)}
            className="bg-red-600 hover:bg-red-700"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
