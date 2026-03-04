'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createOrganization } from '@/lib/organizations/actions'
import { Button, Input, Label } from '@kosha/ui'
import { useToast } from '@/hooks/use-toast'

export function CreateOrganizationForm() {
  const [organizationName, setOrganizationName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

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
      // Create organization and wait for database transaction to complete
      const result = await createOrganization(organizationName)

      console.log('Organization created successfully:', result.organizationId)

      // Database transaction is now committed
      // Force router refresh to clear any cached data
      router.refresh()

      // Navigate to orders page - organization is guaranteed to exist
      router.push('/orders')

      // Note: We keep isLoading=true during navigation
      // The form will unmount when navigation completes
    } catch (error) {
      console.error('Failed to create organization:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create organization. Please try again.',
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
          placeholder="Ellijay Mushrooms"
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
