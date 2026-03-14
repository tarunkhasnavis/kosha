'use client'

import { useState } from 'react'
import { Button, Input, Label, Badge } from '@kosha/ui'
import { toast } from '@/hooks/use-toast'
import { updateProfileName } from '@/lib/settings/actions'
import { useSettingsEdit } from './settings-card'

interface ProfileSettingsProps {
  userId: string
  initialName: string
  email: string
  role: string
}

export function ProfileSettings({ userId, initialName, email, role }: ProfileSettingsProps) {
  const { editing, onEditDone } = useSettingsEdit()
  const [fullName, setFullName] = useState(initialName)
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    if (!fullName.trim()) return
    setLoading(true)
    const result = await updateProfileName(userId, fullName.trim())
    setLoading(false)

    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' })
    } else {
      toast({ title: 'Profile updated' })
      onEditDone()
    }
  }

  function handleCancel() {
    setFullName(initialName)
    onEditDone()
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Email</Label>
        <p className="text-sm text-muted-foreground">{email}</p>
      </div>

      <div className="space-y-2">
        <Label>Role</Label>
        <div>
          <Badge variant={role === 'admin' ? 'default' : 'secondary'}>
            {role === 'admin' ? 'Admin' : 'Sales Rep'}
          </Badge>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Full Name</Label>
        {editing ? (
          <Input
            id="full-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your name"
            autoFocus
          />
        ) : (
          <p className="text-sm text-stone-800">{fullName || '—'}</p>
        )}
      </div>

      {editing && (
        <div className="flex gap-2">
          <Button
            onClick={handleSave}
            disabled={loading || !fullName.trim() || fullName.trim() === initialName}
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
