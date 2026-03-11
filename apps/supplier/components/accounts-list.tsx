'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  ScrollArea,
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
import { Plus, Search, Building2 } from 'lucide-react'
import { useMediaQuery } from '@/hooks/use-media-query'
import { fetchAccountDetails } from '@/lib/territory/actions'
import { AccountCard } from './account-card'
import { AccountDetail } from './account-detail'
import { AccountForm } from './account-form'
import type { Account, Capture, Insight, Task, Visit } from '@kosha/types'

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
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-900">Accounts</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Account
        </Button>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search accounts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <Building2 className="h-6 w-6 text-slate-400" />
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
                    className="cursor-pointer hover:bg-slate-50"
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
        <div className="md:hidden space-y-3">
          {filtered.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              onClick={() => handleAccountClick(account)}
            />
          ))}
        </div>
      )}

      {/* Account Detail Sheet — bottom on mobile, right on desktop */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side={isDesktop ? 'right' : 'bottom'}
          hideCloseButton={!isDesktop}
          className={
            isDesktop
              ? 'w-full sm:max-w-4xl overflow-y-auto p-8 bg-white'
              : 'flex flex-col p-0 bg-white h-[85vh]'
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
                <div className="w-10 h-1 rounded-full bg-slate-300" />
              </div>
              <SheetHeader className="sr-only">
                <SheetTitle>Account Details</SheetTitle>
                <SheetDescription>
                  Details for {selectedAccount?.name}
                </SheetDescription>
              </SheetHeader>
              <ScrollArea className="flex-1 overflow-y-auto">
                <div className="px-5 pb-8 pt-2">
                  {selectedAccount && (
                    <AccountDetail
                      account={selectedAccount}
                      visits={visits}
                      insights={insights}
                      tasks={tasks}
                      captures={captures}
                      loading={detailLoading}
                      onClose={handleDetailClose}
                      onDeleted={handleDetailClose}
                    />
                  )}
                </div>
              </ScrollArea>
            </>
          )}
        </SheetContent>
      </Sheet>

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
