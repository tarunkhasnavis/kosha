'use client'

import { useState } from 'react'
import {
  Button,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  DatePicker,
} from '@kosha/ui'
import { createVisit } from '@/lib/visits/actions'
import { toast } from '@/hooks/use-toast'
import type { Account } from '@kosha/types'

interface VisitFormProps {
  accounts: Account[]
  onSuccess?: () => void
  onCancel?: () => void
}

export function VisitForm({ accounts, onSuccess, onCancel }: VisitFormProps) {
  const [loading, setLoading] = useState(false)
  const [accountId, setAccountId] = useState('')
  const [visitDate, setVisitDate] = useState<Date | undefined>(undefined)
  const [notes, setNotes] = useState('')

  const selectedAccount = accounts.find((a) => a.id === accountId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!accountId || !visitDate) return

    setLoading(true)

    const result = await createVisit({
      account_id: accountId,
      account_name: selectedAccount?.name || '',
      visit_date: visitDate.toISOString(),
      notes: notes.trim() || undefined,
    })

    setLoading(false)

    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' })
      return
    }

    toast({ title: 'Visit scheduled' })
    onSuccess?.()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Account *</Label>
        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger>
            <SelectValue placeholder="Select an account" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Date *</Label>
        <DatePicker
          selected={visitDate}
          onSelect={setVisitDate}
          placeholder="Pick a date"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Meeting agenda, topics to discuss..."
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={loading || !accountId || !visitDate}>
          {loading ? 'Scheduling...' : 'Schedule Visit'}
        </Button>
      </div>
    </form>
  )
}
