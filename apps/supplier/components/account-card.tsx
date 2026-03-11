'use client'

import { Card, CardContent, Badge } from '@kosha/ui'
import type { Account } from '@kosha/types'
import { ChevronRight } from 'lucide-react'

const premiseConfig: Record<string, { label: string; className: string }> = {
  on_premise: { label: 'On Premise', className: 'bg-emerald-50 text-emerald-700' },
  off_premise: { label: 'Off Premise', className: 'bg-blue-50 text-blue-700' },
  hybrid: { label: 'Hybrid', className: 'bg-amber-50 text-amber-700' },
}

export function AccountCard({
  account,
  onClick,
}: {
  account: Account
  onClick: () => void
}) {
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
              {account.industry && (
                <Badge className="bg-slate-100 text-slate-700">{account.industry}</Badge>
              )}
              {account.premise_type && (() => {
                const pc = premiseConfig[account.premise_type]
                return (
                  <Badge className={pc?.className || 'bg-slate-100 text-slate-600'}>
                    {pc?.label || account.premise_type}
                  </Badge>
                )
              })()}
            </div>
            <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
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
