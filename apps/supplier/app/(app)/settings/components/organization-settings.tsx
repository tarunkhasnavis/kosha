'use client'

import { useState } from 'react'
import { Button, Input, Label } from '@kosha/ui'
import { toast } from '@/hooks/use-toast'
import { updateOrganizationName } from '@/lib/settings/actions'
import { useSettingsEdit } from './settings-card'

interface OrganizationSettingsProps {
  orgId: string
  initialName: string
}

export function OrganizationSettings({ orgId, initialName }: OrganizationSettingsProps) {
  const { editing, onEditDone } = useSettingsEdit()
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
      onEditDone()
    }
  }

  function handleCancel() {
    setName(initialName)
    onEditDone()
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Organization Name</Label>
        {editing ? (
          <Input
            id="org-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your organization name"
            autoFocus
          />
        ) : (
          <p className="text-sm text-stone-800">{name || '—'}</p>
        )}
      </div>
      {editing && (
        <div className="flex gap-2">
          <Button
            onClick={handleSave}
            disabled={loading || !name.trim() || name.trim() === initialName}
            size="sm"
          >
            {loading ? 'Saving...' : 'Save'}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}
