'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Input, Label, Badge } from '@kosha/ui'
import { RefreshCw, Mail, CheckCircle, XCircle, Loader2, Calendar } from 'lucide-react'

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
  message?: string
}

export function AdminEmailSync() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<SyncResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Date picker state - default to yesterday
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const [selectedDate, setSelectedDate] = useState(yesterday.toISOString().split('T')[0])

  const syncEmailsFromDate = async (date: string) => {
    setIsLoading(true)
    setResult(null)
    setError(null)

    try {
      // Convert date to Gmail query format (YYYY/MM/DD)
      const dateObj = new Date(date)
      const nextDay = new Date(dateObj)
      nextDay.setDate(nextDay.getDate() + 1)

      const formatDate = (d: Date) => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`

      const query = `after:${formatDate(dateObj)} before:${formatDate(nextDay)}`

      const response = await fetch('/api/admin/sync-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, maxEmails: 50 }),
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

  const syncRecentEmails = async (days: number) => {
    setIsLoading(true)
    setResult(null)
    setError(null)

    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)
      const formatDate = (d: Date) => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`

      const query = `after:${formatDate(startDate)}`

      const response = await fetch('/api/admin/sync-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, maxEmails: 50 }),
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
          Re-process emails that may have been missed. Already-processed emails are safely skipped.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Quick Actions */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Quick Sync</Label>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => syncRecentEmails(1)}
              disabled={isLoading}
              variant="outline"
              size="sm"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Last 24 Hours
            </Button>
            <Button
              onClick={() => syncRecentEmails(3)}
              disabled={isLoading}
              variant="outline"
              size="sm"
            >
              Last 3 Days
            </Button>
            <Button
              onClick={() => syncRecentEmails(7)}
              disabled={isLoading}
              variant="outline"
              size="sm"
            >
              Last 7 Days
            </Button>
          </div>
        </div>

        {/* Date Picker */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Sync Specific Date</Label>
          <div className="flex gap-2">
            <div className="relative flex-1 max-w-48">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="pl-10"
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            <Button
              onClick={() => syncEmailsFromDate(selectedDate)}
              disabled={isLoading || !selectedDate}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Sync This Date
            </Button>
          </div>
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
            {/* No emails found */}
            {result.message && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-muted-foreground">{result.message}</p>
              </div>
            )}

            {/* Summary for batch queries */}
            {result.summary && (
              <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="font-medium">Sync Complete</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <div>Total emails found:</div>
                  <div className="font-medium">{result.summary.total}</div>
                  <div>New orders created:</div>
                  <div className="font-medium text-green-600">{result.summary.newlyProcessed}</div>
                  <div>Already processed:</div>
                  <div className="font-medium text-gray-600">{result.summary.alreadyProcessed}</div>
                  <div>Not orders:</div>
                  <div className="font-medium text-yellow-600">{result.summary.skippedNotOrder}</div>
                  {result.summary.skippedOwnEmails > 0 && (
                    <>
                      <div>Outgoing emails skipped:</div>
                      <div className="font-medium text-gray-500">{result.summary.skippedOwnEmails}</div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Detailed results list */}
            {result.results && result.results.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Processed Emails</Label>
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
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
