'use client'

import { Card, CardContent, Badge } from '@kosha/ui'
import type { Account } from '@kosha/types'

const premiseConfig: Record<string, { label: string; className: string }> = {
  on_premise: { label: 'On Premise', className: 'bg-emerald-50 text-emerald-700' },
  off_premise: { label: 'Off Premise', className: 'bg-sky-50 text-sky-700' },
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
      <CardContent className="px-4 py-3">
        <h3 className="text-sm font-semibold text-stone-800 truncate">{account.name}</h3>
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          {account.industry && (
            <Badge className="bg-stone-200/60 text-stone-700">{account.industry}</Badge>
          )}
          {account.premise_type && (() => {
            const pc = premiseConfig[account.premise_type]
            return (
              <Badge className={pc?.className || 'bg-stone-100 text-stone-500'}>
                {pc?.label || account.premise_type}
              </Badge>
            )
          })()}
          {account.last_contact && (
            <span className="text-xs text-muted-foreground ml-auto">
              {new Date(account.last_contact).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
