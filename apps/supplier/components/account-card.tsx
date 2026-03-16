'use client'

import { Card, CardContent, Badge } from '@kosha/ui'
import type { Account } from '@kosha/types'

const premiseConfig: Record<string, { label: string; className: string }> = {
  on_premise: { label: 'On Premise', className: 'bg-emerald-50 text-emerald-700' },
  off_premise: { label: 'Off Premise', className: 'bg-sky-50 text-sky-700' },
  hybrid: { label: 'Hybrid', className: 'bg-amber-50 text-amber-700' },
}

function ScoreBadge({ score }: { score: number }) {
  if (score === 0) return null

  const config =
    score >= 60
      ? { bg: 'bg-red-50', text: 'text-red-700' }
      : score >= 30
        ? { bg: 'bg-amber-50', text: 'text-amber-700' }
        : { bg: 'bg-emerald-50', text: 'text-emerald-700' }

  return (
    <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${config.bg} ${config.text} tabular-nums`}>
      {score}
    </span>
  )
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
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-stone-800 truncate">{account.name}</h3>
          <ScoreBadge score={account.score} />
        </div>
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
        </div>
        {account.score > 0 && account.score_reasons.length > 0 && (
          <p className="text-xs text-stone-500 mt-1.5 truncate">
            {account.score_reasons[0]}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
