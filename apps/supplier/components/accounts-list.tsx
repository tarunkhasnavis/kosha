'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Button,
  Input,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@kosha/ui'
import { Plus, Search, Building2 } from 'lucide-react'
import { useMediaQuery } from '@/hooks/use-media-query'
import { AccountCard } from './account-card'
import { AccountDetail } from './account-detail'
import { AccountForm } from './account-form'
import type { Account, AccountHealth } from '@kosha/types'

const healthConfig: Record<string, { label: string; className: string }> = {
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
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`
  return `$${value.toFixed(0)}`
}

const healthFilters: { value: AccountHealth | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'healthy', label: 'Healthy' },
  { value: 'at_risk', label: 'At Risk' },
  { value: 'critical', label: 'Critical' },
]

interface AccountsListProps {
  initialAccounts: Account[]
}

export function AccountsList({ initialAccounts }: AccountsListProps) {
  const router = useRouter()
  const isDesktop = useMediaQuery('(min-width: 768px)')

  const [search, setSearch] = useState('')
  const [healthFilter, setHealthFilter] = useState<AccountHealth | 'all'>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

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

    if (healthFilter !== 'all') {
      result = result.filter((a) => a.health === healthFilter)
    }

    return result
  }, [initialAccounts, search, healthFilter])

  function handleAccountClick(account: Account) {
    if (isDesktop) {
      setSelectedAccount(account)
      setSheetOpen(true)
    } else {
      router.push(`/accounts/${account.id}`)
    }
  }

  function handleCreateSuccess() {
    setCreateOpen(false)
    router.refresh()
  }

  function handleDetailClose() {
    setSheetOpen(false)
    setSelectedAccount(null)
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
        <div className="flex gap-2 overflow-x-auto">
          {healthFilters.map((f) => (
            <Button
              key={f.value}
              variant={healthFilter === f.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setHealthFilter(f.value)}
              className="whitespace-nowrap"
            >
              {f.label}
            </Button>
          ))}
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
                <TableHead>Health</TableHead>
                <TableHead>ARR</TableHead>
                <TableHead>Premise</TableHead>
                <TableHead>Last Contact</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((account) => {
                const health = healthConfig[account.health] || healthConfig.healthy
                return (
                  <TableRow
                    key={account.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => handleAccountClick(account)}
                  >
                    <TableCell className="font-medium">{account.name}</TableCell>
                    <TableCell>{account.industry || '—'}</TableCell>
                    <TableCell>
                      <Badge className={health.className}>{health.label}</Badge>
                    </TableCell>
                    <TableCell>
                      {account.arr > 0 ? formatCurrency(account.arr) : '—'}
                    </TableCell>
                    <TableCell>
                      {account.premise_type
                        ? premiseLabels[account.premise_type] || account.premise_type
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

      {/* Desktop: Sheet detail */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-4xl overflow-y-auto p-8">
          <SheetHeader>
            <SheetTitle>Account Details</SheetTitle>
          </SheetHeader>
          {selectedAccount && (
            <div className="mt-4">
              <AccountDetail
                account={selectedAccount}
                onClose={handleDetailClose}
                onDeleted={handleDetailClose}
              />
            </div>
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
