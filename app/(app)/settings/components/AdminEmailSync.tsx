'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, Mail, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react'

interface SyncResult {
  id: string
  subject?: string
  from?: string
  action: string
  orderId?: string
  error?: string
}

interface SyncResponse {
  status: string
  organization?: string
  query?: string
  messageId?: string
  subject?: string
  from?: string
  action?: string
  orderId?: string | null
  summary?: {
    total: number
    newlyProcessed: number
    alreadyProcessed: number
    skippedNotOrder: number
    skippedOwnEmails: number
  }
  results?: SyncResult[]
  error?: string
  reason?: string
}

export function AdminEmailSync() {
  const [query, setQuery] = useState('')
  const [messageId, setMessageId] = useState('')
  const [maxEmails, setMaxEmails] = useState('20')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<SyncResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSync = async (mode: 'query' | 'messageId') => {
    setIsLoading(true)
    setResult(null)
    setError(null)

    try {
      const body = mode === 'messageId'
        ? { messageId }
        : { query, maxEmails: parseInt(maxEmails) || 20 }

      const response = await fetch('/api/admin/sync-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to sync emails')
        return
      }

      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync emails')
    } finally {
      setIsLoading(false)
    }
  }

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'created_order':
        return <Badge className="bg-green-100 text-green-800">Created Order</Badge>
      case 'updated_order':
        return <Badge className="bg-blue-100 text-blue-800">Updated Order</Badge>
      case 'already_processed':
        return <Badge className="bg-gray-100 text-gray-600">Already Processed</Badge>
      case 'not_an_order':
        return <Badge className="bg-yellow-100 text-yellow-800">Not an Order</Badge>
      case 'skipped_self_email':
        return <Badge className="bg-gray-100 text-gray-500">Self Email</Badge>
      case 'error':
        return <Badge className="bg-red-100 text-red-800">Error</Badge>
      default:
        return <Badge variant="outline">{action}</Badge>
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Manual Email Sync
        </CardTitle>
        <CardDescription>
          Process missed emails that weren't captured by the Gmail webhook.
          Already-processed emails will be safely skipped.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Search by Query */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Search by Gmail Query</Label>
          <div className="flex gap-2">
            <Input
              placeholder="e.g., after:2025/01/06 before:2025/01/08"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1"
            />
            <Input
              type="number"
              placeholder="Max"
              value={maxEmails}
              onChange={(e) => setMaxEmails(e.target.value)}
              className="w-20"
              min="1"
              max="50"
            />
            <Button
              onClick={() => handleSync('query')}
              disabled={isLoading || !query.trim()}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2">Sync</span>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Use Gmail search syntax: <code className="bg-gray-100 px-1 rounded">after:YYYY/MM/DD</code>,{' '}
            <code className="bg-gray-100 px-1 rounded">from:email@example.com</code>,{' '}
            <code className="bg-gray-100 px-1 rounded">subject:order</code>
          </p>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-muted-foreground">Or</span>
          </div>
        </div>

        {/* Search by Message ID */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Process Specific Email</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Gmail message ID (e.g., 18d1234567890abc)"
              value={messageId}
              onChange={(e) => setMessageId(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={() => handleSync('messageId')}
              disabled={isLoading || !messageId.trim()}
              variant="outline"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              <span className="ml-2">Process</span>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Find the message ID in Gmail's URL when viewing an email
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Error</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Results Display */}
        {result && (
          <div className="space-y-4">
            {/* Summary for batch queries */}
            {result.summary && (
              <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="font-medium">Sync Complete</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Total emails found: <span className="font-medium">{result.summary.total}</span></div>
                  <div>Newly processed: <span className="font-medium text-green-600">{result.summary.newlyProcessed}</span></div>
                  <div>Already processed: <span className="font-medium text-gray-600">{result.summary.alreadyProcessed}</span></div>
                  <div>Not orders: <span className="font-medium text-yellow-600">{result.summary.skippedNotOrder}</span></div>
                </div>
              </div>
            )}

            {/* Single email result */}
            {result.action && !result.summary && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium truncate">{result.subject || 'Email processed'}</span>
                  {getActionBadge(result.action)}
                </div>
                {result.from && (
                  <p className="text-sm text-muted-foreground">From: {result.from}</p>
                )}
                {result.orderId && (
                  <p className="text-sm text-green-600 mt-1">Order ID: {result.orderId}</p>
                )}
                {result.reason && (
                  <p className="text-sm text-yellow-600 mt-1">{result.reason}</p>
                )}
              </div>
            )}

            {/* Detailed results list */}
            {result.results && result.results.length > 0 && (
              <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                {result.results.map((r, i) => (
                  <div key={i} className="p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{r.subject || r.id}</p>
                      {r.from && <p className="text-xs text-muted-foreground truncate">{r.from}</p>}
                      {r.error && <p className="text-xs text-red-600">{r.error}</p>}
                    </div>
                    <div className="shrink-0">
                      {getActionBadge(r.action)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
