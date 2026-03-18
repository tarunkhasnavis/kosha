'use client'

import Link from 'next/link'
import { Target } from 'lucide-react'
import type { Account } from '@kosha/types'

function ScoreIndicator({ score }: { score: number }) {
  const config =
    score >= 60
      ? { color: 'bg-red-500', ring: 'ring-red-100' }
      : score >= 30
        ? { color: 'bg-amber-500', ring: 'ring-amber-100' }
        : { color: 'bg-emerald-500', ring: 'ring-emerald-100' }

  return (
    <div className={`flex-shrink-0 w-10 h-10 rounded-full ${config.color} ${config.ring} ring-4 flex items-center justify-center`}>
      <span className="text-xs font-bold text-white tabular-nums">{score}</span>
    </div>
  )
}

interface PriorityAccountsProps {
  accounts: Account[]
}

export function PriorityAccounts({ accounts }: PriorityAccountsProps) {
  if (accounts.length === 0) return null

  return (
    <div className="px-4 pt-6 pb-2">
      <div className="flex items-center gap-2 mb-3">
        <Target className="h-4 w-4 text-stone-500" />
        <h2 className="text-sm font-semibold text-stone-800">Priority Accounts</h2>
      </div>

      <div className="space-y-2">
        {accounts.map((account) => (
          <Link
            key={account.id}
            href={`/territory?accountId=${account.id}`}
            className="flex items-center gap-3 bg-white rounded-xl p-3.5 border border-stone-100 shadow-sm hover:shadow-md transition-shadow"
          >
            <ScoreIndicator score={account.score} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-stone-800 truncate">
                {account.name}
              </p>
              {account.score_reasons.length > 0 && (
                <p className="text-xs text-stone-500 mt-0.5 truncate">
                  {account.score_reasons[0]}
                </p>
              )}
              {account.score_reasons.length > 1 && (
                <p className="text-xs text-stone-400 truncate">
                  {account.score_reasons[1]}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
