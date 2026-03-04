'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button, Input, Label, Textarea } from '@kosha/ui'
import { Loader2 } from 'lucide-react'
import { createCustomer, updateCustomer } from '@/lib/customers/actions'
import { validateCustomerName, validateEmail, validatePhone } from '@/lib/customers/services'
import type { Customer, CreateCustomerInput, UpdateCustomerInput, Address } from '@kosha/types'

interface CustomerModalProps {
  isOpen: boolean
  onClose: () => void
  customer: Customer | null
  onCreated: (customer: Customer) => void
  onUpdated: (customer: Customer) => void
}

export function CustomerModal({
  isOpen,
  onClose,
  customer,
  onCreated,
  onUpdated,
}: CustomerModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [customerNumber, setCustomerNumber] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [notes, setNotes] = useState('')

  // Billing address
  const [billingStreet, setBillingStreet] = useState('')
  const [billingCity, setBillingCity] = useState('')
  const [billingState, setBillingState] = useState('')
  const [billingZip, setBillingZip] = useState('')

  // Shipping address
  const [shippingStreet, setShippingStreet] = useState('')
  const [shippingCity, setShippingCity] = useState('')
  const [shippingState, setShippingState] = useState('')
  const [shippingZip, setShippingZip] = useState('')
  const [sameAsBilling, setSameAsBilling] = useState(true)

  // Field validation errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const isEditing = customer !== null

  // Reset form when modal opens/closes or customer changes
  useEffect(() => {
    if (isOpen) {
      if (customer) {
        setName(customer.name)
        setCustomerNumber(customer.customer_number || '')
        setContactName(customer.primary_contact_name || '')
        setContactEmail(customer.primary_contact_email || '')
        setContactPhone(customer.primary_contact_phone || '')
        setNotes(customer.notes || '')

        // Billing address
        setBillingStreet(customer.billing_address?.street || '')
        setBillingCity(customer.billing_address?.city || '')
        setBillingState(customer.billing_address?.state || '')
        setBillingZip(customer.billing_address?.zip || '')

        // Shipping address
        const hasShipping = customer.shipping_address && (
          customer.shipping_address.street ||
          customer.shipping_address.city ||
          customer.shipping_address.state ||
          customer.shipping_address.zip
        )
        setSameAsBilling(!hasShipping)
        setShippingStreet(customer.shipping_address?.street || '')
        setShippingCity(customer.shipping_address?.city || '')
        setShippingState(customer.shipping_address?.state || '')
        setShippingZip(customer.shipping_address?.zip || '')
      } else {
        // Reset for new customer
        setName('')
        setCustomerNumber('')
        setContactName('')
        setContactEmail('')
        setContactPhone('')
        setNotes('')
        setBillingStreet('')
        setBillingCity('')
        setBillingState('')
        setBillingZip('')
        setShippingStreet('')
        setShippingCity('')
        setShippingState('')
        setShippingZip('')
        setSameAsBilling(true)
      }
      setError(null)
      setFieldErrors({})
    }
  }, [isOpen, customer])

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    const nameError = validateCustomerName(name)
    if (nameError) errors.name = nameError

    const emailError = validateEmail(contactEmail)
    if (emailError) errors.email = emailError

    const phoneError = validatePhone(contactPhone)
    if (phoneError) errors.phone = phoneError

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const buildAddress = (street: string, city: string, state: string, zip: string): Address | undefined => {
    if (!street && !city && !state && !zip) return undefined
    return {
      street: street || undefined,
      city: city || undefined,
      state: state || undefined,
      zip: zip || undefined,
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!validateForm()) return

    setIsSubmitting(true)

    try {
      const billingAddress = buildAddress(billingStreet, billingCity, billingState, billingZip)
      const shippingAddress = sameAsBilling
        ? billingAddress
        : buildAddress(shippingStreet, shippingCity, shippingState, shippingZip)

      if (isEditing && customer) {
        const input: UpdateCustomerInput = {
          name: name.trim(),
          customer_number: customerNumber.trim() || undefined,
          primary_contact_name: contactName.trim() || undefined,
          primary_contact_email: contactEmail.trim() || undefined,
          primary_contact_phone: contactPhone.trim() || undefined,
          billing_address: billingAddress,
          shipping_address: shippingAddress,
          notes: notes.trim() || undefined,
        }

        const result = await updateCustomer(customer.id, input)
        if (result.error) {
          setError(result.error)
        } else if (result.customer) {
          onUpdated(result.customer)
        }
      } else {
        const input: CreateCustomerInput = {
          name: name.trim(),
          customer_number: customerNumber.trim() || undefined,
          primary_contact_name: contactName.trim() || undefined,
          primary_contact_email: contactEmail.trim() || undefined,
          primary_contact_phone: contactPhone.trim() || undefined,
          billing_address: billingAddress,
          shipping_address: shippingAddress,
          notes: notes.trim() || undefined,
        }

        const result = await createCustomer(input)
        if (result.error) {
          setError(result.error)
        } else if (result.customer) {
          onCreated(result.customer)
        }
      }
    } catch (err) {
      setError('An unexpected error occurred')
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Customer' : 'Add Customer'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-700">Basic Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <Label htmlFor="name">Customer Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Acme Corporation"
                  className={fieldErrors.name ? 'border-red-300' : ''}
                />
                {fieldErrors.name && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.name}</p>
                )}
              </div>
              <div className="col-span-2 sm:col-span-1">
                <Label htmlFor="customerNumber">Customer Number</Label>
                <Input
                  id="customerNumber"
                  value={customerNumber}
                  onChange={(e) => setCustomerNumber(e.target.value)}
                  placeholder="CUST-001"
                />
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-700">Contact Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <Label htmlFor="contactName">Contact Name</Label>
                <Input
                  id="contactName"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="John Smith"
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <Label htmlFor="contactPhone">Phone</Label>
                <Input
                  id="contactPhone"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  className={fieldErrors.phone ? 'border-red-300' : ''}
                />
                {fieldErrors.phone && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.phone}</p>
                )}
              </div>
              <div className="col-span-2">
                <Label htmlFor="contactEmail">Email</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="john@acme.com"
                  className={fieldErrors.email ? 'border-red-300' : ''}
                />
                {fieldErrors.email && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.email}</p>
                )}
              </div>
            </div>
          </div>

          {/* Billing Address */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-700">Billing Address</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="billingStreet">Street</Label>
                <Input
                  id="billingStreet"
                  value={billingStreet}
                  onChange={(e) => setBillingStreet(e.target.value)}
                  placeholder="123 Main Street"
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <Label htmlFor="billingCity">City</Label>
                <Input
                  id="billingCity"
                  value={billingCity}
                  onChange={(e) => setBillingCity(e.target.value)}
                  placeholder="Springfield"
                />
              </div>
              <div className="col-span-1">
                <Label htmlFor="billingState">State</Label>
                <Input
                  id="billingState"
                  value={billingState}
                  onChange={(e) => setBillingState(e.target.value)}
                  placeholder="CA"
                />
              </div>
              <div className="col-span-1">
                <Label htmlFor="billingZip">ZIP</Label>
                <Input
                  id="billingZip"
                  value={billingZip}
                  onChange={(e) => setBillingZip(e.target.value)}
                  placeholder="90210"
                />
              </div>
            </div>
          </div>

          {/* Shipping Address */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-700">Shipping Address</h3>
              <label className="flex items-center gap-2 text-sm text-slate-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sameAsBilling}
                  onChange={(e) => setSameAsBilling(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Same as billing
              </label>
            </div>
            {!sameAsBilling && (
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="shippingStreet">Street</Label>
                  <Input
                    id="shippingStreet"
                    value={shippingStreet}
                    onChange={(e) => setShippingStreet(e.target.value)}
                    placeholder="456 Oak Avenue"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Label htmlFor="shippingCity">City</Label>
                  <Input
                    id="shippingCity"
                    value={shippingCity}
                    onChange={(e) => setShippingCity(e.target.value)}
                    placeholder="Los Angeles"
                  />
                </div>
                <div className="col-span-1">
                  <Label htmlFor="shippingState">State</Label>
                  <Input
                    id="shippingState"
                    value={shippingState}
                    onChange={(e) => setShippingState(e.target.value)}
                    placeholder="CA"
                  />
                </div>
                <div className="col-span-1">
                  <Label htmlFor="shippingZip">ZIP</Label>
                  <Input
                    id="shippingZip"
                    value={shippingZip}
                    onChange={(e) => setShippingZip(e.target.value)}
                    placeholder="90001"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-700">Notes</h3>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes about this customer..."
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Create Customer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
