'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { Building2, Mail, Phone, MapPin, Loader2, Pencil, X, Check } from 'lucide-react'
import { updateOrganizationInfo } from '@/lib/organizations/actions'

interface OrganizationInfoSettingsProps {
  organizationId: string
  name: string
  gmailEmail: string | null
  address: string | null
  phone: string | null
  createdAt: string
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function OrganizationInfoSettings({
  organizationId,
  name,
  gmailEmail,
  address,
  phone,
  createdAt,
}: OrganizationInfoSettingsProps) {
  const { toast } = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Form state
  const [editedAddress, setEditedAddress] = useState(address || '')
  const [editedPhone, setEditedPhone] = useState(phone || '')

  const handleSave = async () => {
    setIsSaving(true)

    const result = await updateOrganizationInfo(organizationId, {
      address: editedAddress.trim() || null,
      phone: editedPhone.trim() || null,
    })

    setIsSaving(false)

    if (result.success) {
      setIsEditing(false)
      toast({
        title: 'Settings saved',
        description: 'Organization information has been updated',
      })
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to save organization information',
        variant: 'destructive',
      })
    }
  }

  const handleCancel = () => {
    // Reset to original values
    setEditedAddress(address || '')
    setEditedPhone(phone || '')
    setIsEditing(false)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Organization Information</CardTitle>
            <CardDescription>
              Details about your organization and connected services
            </CardDescription>
          </div>
          {!isEditing ? (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleCancel} disabled={isSaving}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-1" />
                )}
                Save
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Organization Name (read-only) */}
        <div className="flex items-start gap-4">
          <div className="p-2 bg-gray-100 rounded-lg">
            <Building2 className="h-5 w-5 text-gray-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-500">Organization Name</p>
            <p className="text-base text-gray-900">{name}</p>
          </div>
        </div>

        {/* Connected Email (read-only) */}
        <div className="flex items-start gap-4">
          <div className="p-2 bg-gray-100 rounded-lg">
            <Mail className="h-5 w-5 text-gray-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-500">Connected Gmail</p>
            {gmailEmail ? (
              <p className="text-base text-gray-900">{gmailEmail}</p>
            ) : (
              <p className="text-base text-gray-400 italic">No email connected</p>
            )}
          </div>
        </div>

        {/* Phone Number (editable) */}
        <div className="flex items-start gap-4">
          <div className="p-2 bg-gray-100 rounded-lg">
            <Phone className="h-5 w-5 text-gray-600" />
          </div>
          <div className="flex-1">
            <Label className="text-sm font-medium text-gray-500">Phone Number</Label>
            {isEditing ? (
              <Input
                value={editedPhone}
                onChange={(e) => setEditedPhone(e.target.value)}
                placeholder="e.g., (555) 123-4567"
                className="mt-1"
              />
            ) : phone ? (
              <p className="text-base text-gray-900">{phone}</p>
            ) : (
              <p className="text-base text-gray-400 italic">No phone number set</p>
            )}
          </div>
        </div>

        {/* Address (editable) */}
        <div className="flex items-start gap-4">
          <div className="p-2 bg-gray-100 rounded-lg">
            <MapPin className="h-5 w-5 text-gray-600" />
          </div>
          <div className="flex-1">
            <Label className="text-sm font-medium text-gray-500">Address</Label>
            {isEditing ? (
              <Textarea
                value={editedAddress}
                onChange={(e) => setEditedAddress(e.target.value)}
                placeholder="Enter your organization's address"
                className="mt-1"
                rows={3}
              />
            ) : address ? (
              <p className="text-base text-gray-900 whitespace-pre-line">{address}</p>
            ) : (
              <p className="text-base text-gray-400 italic">No address set</p>
            )}
          </div>
        </div>

        {/* Created Date */}
        <div className="pt-4 border-t">
          <p className="text-sm text-gray-500">
            Organization created on {formatDate(createdAt)}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
