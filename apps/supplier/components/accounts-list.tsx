'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@kosha/ui'
import { Plus, Search, Building2, CalendarPlus, Pencil, Calendar } from 'lucide-react'
import { useMediaQuery } from '@/hooks/use-media-query'
import { fetchAccountDetails } from '@/lib/territory/actions'
import { createVisit } from '@/lib/visits/actions'
import { toast } from '@/hooks/use-toast'
import { AccountCard } from './account-card'
import { AccountDetail } from './account-detail'
import { AccountForm } from './account-form'
import type { Account, AccountContact, Capture, Insight, Task, Visit } from '@kosha/types'

const premiseConfig: Record<string, { label: string; className: string }> = {
  on_premise: { label: 'On Premise', className: 'bg-emerald-50 text-emerald-700' },
  off_premise: { label: 'Off Premise', className: 'bg-blue-50 text-blue-700' },
  hybrid: { label: 'Hybrid', className: 'bg-amber-50 text-amber-700' },
}

interface AccountsListProps {
  initialAccounts: Account[]
}

export function AccountsList({ initialAccounts }: AccountsListProps) {
  const router = useRouter()
  const isDesktop = useMediaQuery('(min-width: 768px)')

  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  // Detail data fetched on-demand when sheet opens
  const [detailLoading, setDetailLoading] = useState(false)
  const [insights, setInsights] = useState<Insight[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [visits, setVisits] = useState<Visit[]>([])
  const [captures, setCaptures] = useState<Capture[]>([])
  const [contacts, setContacts] = useState<AccountContact[]>([])
  const [visitDialogOpen, setVisitDialogOpen] = useState(false)
  const [visitDate, setVisitDate] = useState<Date | undefined>(undefined)
  const [visitNotes, setVisitNotes] = useState('')
  const [scheduling, setScheduling] = useState(false)

  async function handleScheduleVisit() {
    if (!selectedAccount || !visitDate) return
    setScheduling(true)
    const result = await createVisit({
      account_id: selectedAccount.id,
      account_name: selectedAccount.name,
      visit_date: visitDate.toISOString(),
      notes: visitNotes.trim() || undefined,
    })
    setScheduling(false)
    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' })
      return
    }
    toast({ title: 'Visit scheduled', description: `Visit to ${selectedAccount.name} scheduled.` })
    setVisitDialogOpen(false)
    setVisitDate(undefined)
    setVisitNotes('')
  }

  const filtered = useMemo(() => {
    let result = initialAccounts

    if (search.trim()) {
      const term = search.trim().toLowerCase()
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(term) ||
          a.industry?.toLowerCase().includes(term) ||
          a.address?.toLowerCase().includes(term)
      )
    }

    return result
  }, [initialAccounts, search])

  // Fetch detail data when an account is selected
  useEffect(() => {
    if (!selectedAccount || !sheetOpen) return

    setDetailLoading(true)
    fetchAccountDetails(selectedAccount.id)
      .then((details) => {
        setInsights(details.insights)
        setTasks(details.tasks)
        setVisits(details.visits)
        setCaptures(details.captures)
        setContacts(details.contacts)
      })
      .finally(() => setDetailLoading(false))
  }, [selectedAccount?.id, sheetOpen])

  function handleAccountClick(account: Account) {
    setSelectedAccount(account)
    setSheetOpen(true)
  }

  function handleCreateSuccess() {
    setCreateOpen(false)
    router.refresh()
  }

  function handleDetailClose() {
    setSheetOpen(false)
    setSelectedAccount(null)
    setInsights([])
    setTasks([])
    setVisits([])
    setCaptures([])
    setContacts([])
    router.refresh()
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-stone-50/95 backdrop-blur-sm px-4 pt-6 pb-3">
        <h1 className="text-2xl font-bold text-stone-800 mb-4">Accounts</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
          <input
            type="text"
            placeholder="Search accounts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white rounded-xl border border-stone-200 text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-800/10 focus:border-stone-300 transition-all"
          />
        </div>
      </div>

      <div className="flex-1 px-4 pb-24">
      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-12 w-12 rounded-full bg-stone-100 flex items-center justify-center mb-4">
            <Building2 className="h-6 w-6 text-stone-400" />
          </div>
          <p className="text-muted-foreground mb-4">
            {initialAccounts.length === 0
              ? 'No accounts yet. Add your first account to get started.'
              : 'No accounts match your filters.'}
          </p>
          {initialAccounts.length === 0 && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Account
            </Button>
          )}
        </div>
      )}

      {/* Desktop: Table */}
      {filtered.length > 0 && (
        <div className="hidden md:block rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Premise</TableHead>
                <TableHead>Last Contact</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((account) => {
                return (
                  <TableRow
                    key={account.id}
                    className="cursor-pointer hover:bg-stone-50"
                    onClick={() => handleAccountClick(account)}
                  >
                    <TableCell className="font-medium">{account.name}</TableCell>
                    <TableCell>{account.industry || '—'}</TableCell>
                    <TableCell>
                      {account.premise_type
                        ? premiseConfig[account.premise_type]?.label || account.premise_type
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {account.last_contact
                        ? new Date(account.last_contact).toLocaleDateString()
                        : '—'}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Mobile: Cards */}
      {filtered.length > 0 && (
        <div className="md:hidden space-y-3 mt-4">
          {filtered.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              onClick={() => handleAccountClick(account)}
            />
          ))}
        </div>
      )}

      </div>

      {/* FAB - Add Account */}
      <button
        onClick={() => setCreateOpen(true)}
        className="fixed bottom-16 right-4 z-30 w-14 h-14 bg-teal-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-teal-600/25 active:scale-95 transition-transform"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Account Detail Sheet — bottom on mobile, right on desktop */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side={isDesktop ? 'right' : 'bottom'}
          hideCloseButton={!isDesktop}
          className={
            isDesktop
              ? 'w-full sm:max-w-4xl overflow-y-auto p-8 bg-white'
              : 'flex flex-col p-0 bg-white h-[72vh]'
          }
        >
          {isDesktop ? (
            <>
              <SheetHeader>
                <SheetTitle>Account Details</SheetTitle>
                <SheetDescription className="sr-only">
                  Details for {selectedAccount?.name}
                </SheetDescription>
              </SheetHeader>
              {selectedAccount && (
                <div className="mt-4">
                  <AccountDetail
                    account={selectedAccount}
                    visits={visits}
                    insights={insights}
                    tasks={tasks}
                    captures={captures}
                    contacts={contacts}
                    loading={detailLoading}
                    onClose={handleDetailClose}
                    onDeleted={handleDetailClose}
                  />
                </div>
              )}
            </>
          ) : (
            <>
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-stone-300" />
              </div>
              <SheetHeader className="sr-only">
                <SheetTitle>Account Details</SheetTitle>
                <SheetDescription>
                  Details for {selectedAccount?.name}
                </SheetDescription>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-5 pt-2 pb-5">
                  {selectedAccount && (
                    <AccountDetail
                      account={selectedAccount}
                      visits={visits}
                      insights={insights}
                      tasks={tasks}
                      captures={captures}
                      contacts={contacts}
                      loading={detailLoading}
                      onClose={handleDetailClose}
                      onDeleted={handleDetailClose}
                    />
                  )}
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
                  onClick={() => { handleDetailClose(); router.push(`/capture?accountId=${selectedAccount?.id}`) }}
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
                    const parsed = new Date(e.target.value)
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

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Account</DialogTitle>
          </DialogHeader>
          <AccountForm
            onSuccess={handleCreateSuccess}
            onCancel={() => setCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
