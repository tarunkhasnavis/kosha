'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Input, Label, Textarea, Checkbox } from '@kosha/ui'
import { useToast } from '@/hooks/use-toast'
import { MapPin, Link, Building, Loader2, Pencil, X, Check } from 'lucide-react'
import { updatePaymentSettings } from '@/lib/organizations/actions'

interface PaymentSettingsProps {
  organizationId: string
  organizationAddress: string | null
  billingAddressPayment: string | null
  paymentLink: string | null
  bankInformation: string | null
}

export function PaymentSettings({
  organizationId,
  organizationAddress,
  billingAddressPayment,
  paymentLink,
  bankInformation,
}: PaymentSettingsProps) {
  const { toast } = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Form state
  const [editedBillingAddress, setEditedBillingAddress] = useState(billingAddressPayment || '')
  const [editedPaymentLink, setEditedPaymentLink] = useState(paymentLink || '')
  const [editedBankInfo, setEditedBankInfo] = useState(bankInformation || '')
  const [sameAsOrgAddress, setSameAsOrgAddress] = useState(false)

  // When checkbox is toggled, update billing address accordingly
  useEffect(() => {
    if (sameAsOrgAddress && organizationAddress) {
      setEditedBillingAddress(organizationAddress)
    }
  }, [sameAsOrgAddress, organizationAddress])

  const handleSave = async () => {
    setIsSaving(true)

    const result = await updatePaymentSettings(organizationId, {
      billing_address_payment: editedBillingAddress.trim() || null,
      payment_link: editedPaymentLink.trim() || null,
      bank_information: editedBankInfo.trim() || null,
    })

    setIsSaving(false)

    if (result.success) {
      setIsEditing(false)
      toast({
        title: 'Settings saved',
        description: 'Payment settings have been updated',
      })
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to save payment settings',
        variant: 'destructive',
      })
    }
  }

  const handleCancel = () => {
    // Reset to original values
    setEditedBillingAddress(billingAddressPayment || '')
    setEditedPaymentLink(paymentLink || '')
    setEditedBankInfo(bankInformation || '')
    setSameAsOrgAddress(false)
    setIsEditing(false)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Payment Information</CardTitle>
            <CardDescription>
              Configure payment details displayed on invoices
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
        {/* Billing Address */}
        <div className="flex items-start gap-4">
          <div className="p-2 bg-gray-100 rounded-lg">
            <MapPin className="h-5 w-5 text-gray-600" />
          </div>
          <div className="flex-1">
            <Label className="text-sm font-medium text-gray-500">Billing Address</Label>
            <p className="text-xs text-gray-400 mb-1">Displayed on invoices</p>
            {isEditing ? (
              <div className="space-y-2">
                {organizationAddress && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="sameAsOrgAddress"
                      checked={sameAsOrgAddress}
                      onCheckedChange={(checked) => setSameAsOrgAddress(checked === true)}
                    />
                    <label
                      htmlFor="sameAsOrgAddress"
                      className="text-sm text-gray-600 cursor-pointer"
                    >
                      Same as organization address
                    </label>
                  </div>
                )}
                <Textarea
                  value={editedBillingAddress}
                  onChange={(e) => setEditedBillingAddress(e.target.value)}
                  placeholder="Enter your billing address"
                  rows={3}
                  disabled={sameAsOrgAddress}
                  className={sameAsOrgAddress ? 'bg-gray-50' : ''}
                />
              </div>
            ) : billingAddressPayment ? (
              <p className="text-base text-gray-900 whitespace-pre-line">{billingAddressPayment}</p>
            ) : (
              <p className="text-base text-gray-400 italic">No billing address set</p>
            )}
          </div>
        </div>

        {/* Payment Link */}
        <div className="flex items-start gap-4">
          <div className="p-2 bg-gray-100 rounded-lg">
            <Link className="h-5 w-5 text-gray-600" />
          </div>
          <div className="flex-1">
            <Label className="text-sm font-medium text-gray-500">Payment Link</Label>
            <p className="text-xs text-gray-400 mb-1">URL where customers can pay</p>
            {isEditing ? (
              <Input
                value={editedPaymentLink}
                onChange={(e) => setEditedPaymentLink(e.target.value)}
                placeholder="https://pay.example.com/your-company"
                className="mt-1"
                type="url"
              />
            ) : paymentLink ? (
              <a
                href={paymentLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-base text-blue-600 hover:underline"
              >
                {paymentLink}
              </a>
            ) : (
              <p className="text-base text-gray-400 italic">No payment link set</p>
            )}
          </div>
        </div>

        {/* Bank Information */}
        <div className="flex items-start gap-4">
          <div className="p-2 bg-gray-100 rounded-lg">
            <Building className="h-5 w-5 text-gray-600" />
          </div>
          <div className="flex-1">
            <Label className="text-sm font-medium text-gray-500">Bank Information</Label>
            <p className="text-xs text-gray-400 mb-1">Bank details for wire transfers (displayed on invoices)</p>
            {isEditing ? (
              <Textarea
                value={editedBankInfo}
                onChange={(e) => setEditedBankInfo(e.target.value)}
                placeholder="Bank Name: First National Bank&#10;Routing: 123456789&#10;Account: 987654321"
                className="mt-1"
                rows={4}
              />
            ) : bankInformation ? (
              <p className="text-base text-gray-900 whitespace-pre-line">{bankInformation}</p>
            ) : (
              <p className="text-base text-gray-400 italic">No bank information set</p>
            )}
          </div>
        </div>

        {/* Info note */}
        <div className="pt-4 border-t">
          <p className="text-sm text-gray-500">
            Payment details will appear below the items table on invoice PDFs.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
