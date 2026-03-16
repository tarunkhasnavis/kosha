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
import type { Account, PremiseType } from '@kosha/types'
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
        <Label htmlFor="name" className="text-sm font-medium text-stone-700">Name *</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Account name"
          required
          className="focus-visible:ring-amber-600/30 focus-visible:border-amber-600"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="industry" className="text-sm font-medium text-stone-700">Industry</Label>
        <Input
          id="industry"
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          placeholder="e.g., Restaurant, Retail, Hospitality"
          className="focus-visible:ring-amber-600/30 focus-visible:border-amber-600"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-stone-700">Premise Type</Label>
          <Select value={premiseType} onValueChange={(v) => setPremiseType(v as PremiseType)}>
            <SelectTrigger className="focus:ring-amber-600/30 focus:border-amber-600">
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
        <Label htmlFor="address" className="text-sm font-medium text-stone-700">Address</Label>
        <Input
          id="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Street address"
          className="focus-visible:ring-amber-600/30 focus-visible:border-amber-600"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          disabled={loading || !name.trim()}
          className="bg-[#D97706] hover:bg-[#B45309] text-white disabled:opacity-40"
        >
          {loading ? (isEditing ? 'Saving...' : 'Creating...') : (isEditing ? 'Save Changes' : 'Create Account')}
        </Button>
      </div>
    </form>
  )
}
