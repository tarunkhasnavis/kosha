'use client'

import { useState } from 'react'
import { Button, Input, Label, Badge } from '@kosha/ui'
import { toast } from '@/hooks/use-toast'
import { updateProfileName } from '@/lib/settings/actions'

interface ProfileSettingsProps {
  userId: string
  initialName: string
  email: string
  role: string
}

export function ProfileSettings({ userId, initialName, email, role }: ProfileSettingsProps) {
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
    }
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
        <Label htmlFor="full-name">Full Name</Label>
        <Input
          id="full-name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Your name"
        />
      </div>

      <Button
        onClick={handleSave}
        disabled={loading || !fullName.trim() || fullName.trim() === initialName}
        size="sm"
      >
        {loading ? 'Saving...' : 'Save'}
      </Button>
    </div>
  )
}
