'use client'

import { Card, CardContent, Badge } from '@kosha/ui'
import type { Account } from '@kosha/types'
import { ChevronRight } from 'lucide-react'

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
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`
  return `$${value.toFixed(0)}`
}

export function AccountCard({
  account,
  onClick,
}: {
  account: Account
  onClick: () => void
}) {
  const health = healthConfig[account.health] || healthConfig.healthy

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 truncate">{account.name}</h3>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <Badge variant="secondary" className={health.className}>
                {health.label}
              </Badge>
              {account.industry && (
                <Badge variant="outline">{account.industry}</Badge>
              )}
              {account.premise_type && (
                <Badge variant="outline">
                  {premiseLabels[account.premise_type] || account.premise_type}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
              {account.arr > 0 && (
                <span className="font-medium text-slate-700">
                  {formatCurrency(account.arr)} ARR
                </span>
              )}
              {account.last_contact && (
                <span>
                  Last contact: {new Date(account.last_contact).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-400 flex-shrink-0 mt-1" />
        </div>
      </CardContent>
    </Card>
  )
}
