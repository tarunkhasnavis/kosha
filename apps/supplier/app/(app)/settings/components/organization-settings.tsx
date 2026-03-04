'use client'

import { useState } from 'react'
import { Button, Input, Label } from '@kosha/ui'
import { toast } from '@/hooks/use-toast'
import { updateOrganizationName } from '@/lib/settings/actions'

interface OrganizationSettingsProps {
  orgId: string
  initialName: string
}

export function OrganizationSettings({ orgId, initialName }: OrganizationSettingsProps) {
  const [name, setName] = useState(initialName)
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    if (!name.trim()) return
    setLoading(true)
    const result = await updateOrganizationName(orgId, name.trim())
    setLoading(false)

    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' })
    } else {
      toast({ title: 'Organization name updated' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="org-name">Organization Name</Label>
        <Input
          id="org-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your organization name"
        />
      </div>
      <Button
        onClick={handleSave}
        disabled={loading || !name.trim() || name.trim() === initialName}
        size="sm"
      >
        {loading ? 'Saving...' : 'Save'}
      </Button>
    </div>
  )
}
