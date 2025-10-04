'use client'

import { useState } from 'react'
import { createOrganization } from '@/lib/actions/organizations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

export function CreateOrganizationForm() {
  const [organizationName, setOrganizationName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!organizationName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter an organization name',
        variant: 'destructive',
      })
      return
    }

    setIsLoading(true)

    try {
      await createOrganization(organizationName)
      // Server Action will redirect to /orders
    } catch (error) {
      console.error('Failed to create organization:', error)
      toast({
        title: 'Error',
        description: 'Failed to create organization. Please try again.',
        variant: 'destructive',
      })
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="orgName">Organization Name</Label>
        <Input
          id="orgName"
          type="text"
          placeholder="Acme Restaurant"
          value={organizationName}
          onChange={(e) => setOrganizationName(e.target.value)}
          disabled={isLoading}
          autoFocus
          className="text-lg"
        />
        <p className="text-xs text-muted-foreground">
          You can change this later in settings
        </p>
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={isLoading || !organizationName.trim()}
      >
        {isLoading ? 'Creating...' : 'Create Organization'}
      </Button>
    </form>
  )
}
