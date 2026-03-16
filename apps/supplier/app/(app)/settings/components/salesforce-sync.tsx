'use client'

import { useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, Check, Loader2 } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

type SyncDirection = 'pull' | 'push'
type SyncState = 'idle' | 'syncing' | 'done'

export function SalesforceSync() {
  const [pullState, setPullState] = useState<SyncState>('idle')
  const [pushState, setPushState] = useState<SyncState>('idle')
  const [lastPull, setLastPull] = useState<string | null>(null)
  const [lastPush, setLastPush] = useState<string | null>(null)

  async function handleSync(direction: SyncDirection) {
    const setState = direction === 'pull' ? setPullState : setPushState
    const setLastSync = direction === 'pull' ? setLastPull : setLastPush

    setState('syncing')

    // Fake a sync with realistic timing
    const duration = 1500 + Math.random() * 1500
    await new Promise((resolve) => setTimeout(resolve, duration))

    setState('done')
    setLastSync(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }))

    const counts = direction === 'pull'
      ? { accounts: 12 + Math.floor(Math.random() * 8), contacts: 24 + Math.floor(Math.random() * 15) }
      : { visits: 6 + Math.floor(Math.random() * 10), insights: 3 + Math.floor(Math.random() * 8) }

    toast({
      title: direction === 'pull' ? 'Pull complete' : 'Push complete',
      description: direction === 'pull'
        ? `Synced ${counts.accounts} accounts and ${counts.contacts} contacts from Salesforce.`
        : `Pushed ${counts.visits} visits and ${counts.insights} insights to Salesforce.`,
    })

    // Reset back to idle after a moment
    setTimeout(() => setState('idle'), 2000)
  }

  const isSyncing = pullState === 'syncing' || pushState === 'syncing'

  return (
    <div className="rounded-lg border border-stone-100 bg-stone-50/50 overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-[#00A1E0]/10 flex items-center justify-center">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#00A1E0">
              <path d="M10.05 4.15a4.63 4.63 0 0 1 3.37-1.45c1.78 0 3.33 1.01 4.12 2.49a5.09 5.09 0 0 1 1.96-.39c2.83 0 5.12 2.31 5.12 5.15 0 2.85-2.29 5.16-5.12 5.16-.37 0-.73-.04-1.07-.12a3.79 3.79 0 0 1-3.35 2.01c-.62 0-1.21-.15-1.73-.42a4.46 4.46 0 0 1-3.86 2.27 4.5 4.5 0 0 1-4.07-2.57 3.75 3.75 0 0 1-.65.06c-2.16 0-3.91-1.76-3.91-3.94 0-1.31.64-2.47 1.63-3.18A4.3 4.3 0 0 1 2.1 7.65c0-2.39 1.93-4.33 4.31-4.33 1.12 0 2.14.43 2.91 1.13l.73-.3z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-stone-800">Salesforce</p>
            <p className="text-xs text-stone-400">CRM</p>
          </div>
        </div>
        <span className="text-xs text-emerald-600 font-medium px-2.5 py-1 rounded-full bg-emerald-50">Connected</span>
      </div>

      {/* Sync actions */}
      <div className="px-3 pb-3 flex gap-2">
        <button
          onClick={() => handleSync('pull')}
          disabled={isSyncing}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-stone-200 bg-white text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {pullState === 'syncing' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#00A1E0]" />
          ) : pullState === 'done' ? (
            <Check className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <ArrowDownToLine className="h-3.5 w-3.5 text-[#00A1E0]" />
          )}
          {pullState === 'syncing' ? 'Pulling...' : 'Pull from CRM'}
        </button>
        <button
          onClick={() => handleSync('push')}
          disabled={isSyncing}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-stone-200 bg-white text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {pushState === 'syncing' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#D97706]" />
          ) : pushState === 'done' ? (
            <Check className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <ArrowUpFromLine className="h-3.5 w-3.5 text-[#D97706]" />
          )}
          {pushState === 'syncing' ? 'Pushing...' : 'Push to CRM'}
        </button>
      </div>

      {/* Last synced timestamps */}
      {(lastPull || lastPush) && (
        <div className="px-3 pb-2.5 flex gap-4">
          {lastPull && (
            <p className="text-[10px] text-stone-400">Last pull: {lastPull}</p>
          )}
          {lastPush && (
            <p className="text-[10px] text-stone-400">Last push: {lastPush}</p>
          )}
        </div>
      )}
    </div>
  )
}
