'use client'

import { useState } from 'react'
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kosha/ui'
import { createAccount, updateAccount } from '@/lib/accounts/actions'
import type { Account, AccountHealth, PremiseType } from '@kosha/types'
import { toast } from '@/hooks/use-toast'

interface AccountFormProps {
  account?: Account
  onSuccess?: () => void
  onCancel?: () => void
}

export function AccountForm({ account, onSuccess, onCancel }: AccountFormProps) {
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState(account?.name || '')
  const [industry, setIndustry] = useState(account?.industry || '')
  const [health, setHealth] = useState<AccountHealth>(account?.health || 'healthy')
  const [arr, setArr] = useState(account?.arr?.toString() || '')
  const [address, setAddress] = useState(account?.address || '')
  const [premiseType, setPremiseType] = useState<PremiseType | ''>(account?.premise_type || '')

  const isEditing = !!account

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)

    const input = {
      name: name.trim(),
      industry: industry.trim() || undefined,
      health,
      arr: arr ? parseFloat(arr) : undefined,
      address: address.trim() || undefined,
      premise_type: premiseType || undefined,
    }

    const result = isEditing
      ? await updateAccount(account.id, input)
      : await createAccount(input)

    setLoading(false)

    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' })
      return
    }

    toast({ title: isEditing ? 'Account updated' : 'Account created' })
    onSuccess?.()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Account name"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="industry">Industry</Label>
        <Input
          id="industry"
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          placeholder="e.g., Restaurant, Retail, Hospitality"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Health</Label>
          <Select value={health} onValueChange={(v) => setHealth(v as AccountHealth)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="healthy">Healthy</SelectItem>
              <SelectItem value="at_risk">At Risk</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Premise Type</Label>
          <Select value={premiseType} onValueChange={(v) => setPremiseType(v as PremiseType)}>
            <SelectTrigger>
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="on_premise">On Premise</SelectItem>
              <SelectItem value="off_premise">Off Premise</SelectItem>
              <SelectItem value="hybrid">Hybrid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="arr">Annual Recurring Revenue ($)</Label>
        <Input
          id="arr"
          type="number"
          value={arr}
          onChange={(e) => setArr(e.target.value)}
          placeholder="0"
          min="0"
          step="0.01"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Input
          id="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Street address"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={loading || !name.trim()}>
          {loading ? (isEditing ? 'Saving...' : 'Creating...') : (isEditing ? 'Save Changes' : 'Create Account')}
        </Button>
      </div>
    </form>
  )
}
