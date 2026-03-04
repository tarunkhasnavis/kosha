'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Button, Input, Label, Textarea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@kosha/ui'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { createManualOrder } from '@/lib/orders/actions'
import type { Order } from '@kosha/types'

interface OrderItemInput {
  id: string
  name: string
  sku: string
  quantity: string
  quantity_unit: string
  unit_price: string
}

interface AddOrderModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: (order: Order) => void
}

function generateTempId() {
  return `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

export function AddOrderModal({ isOpen, onClose, onCreated }: AddOrderModalProps) {
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)

  // Order fields
  const [companyName, setCompanyName] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [shipVia, setShipVia] = useState('')
  const [notes, setNotes] = useState('')

  // Order items
  const [items, setItems] = useState<OrderItemInput[]>([
    { id: generateTempId(), name: '', sku: '', quantity: '1', quantity_unit: 'case', unit_price: '' },
  ])

  const resetForm = () => {
    setCompanyName('')
    setContactName('')
    setContactEmail('')
    setPhone('')
    setExpectedDate('')
    setShipVia('')
    setNotes('')
    setItems([{ id: generateTempId(), name: '', sku: '', quantity: '1', quantity_unit: 'case', unit_price: '' }])
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const addItem = () => {
    setItems([
      ...items,
      { id: generateTempId(), name: '', sku: '', quantity: '1', quantity_unit: 'case', unit_price: '' },
    ])
  }

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter((item) => item.id !== id))
    }
  }

  const updateItem = (id: string, field: keyof OrderItemInput, value: string) => {
    setItems(items.map((item) => (item.id === id ? { ...item, [field]: value } : item)))
  }

  const calculateItemTotal = (item: OrderItemInput) => {
    const qty = parseFloat(item.quantity) || 0
    const price = parseFloat(item.unit_price) || 0
    return qty * price
  }

  const calculateOrderTotal = () => {
    return items.reduce((sum, item) => sum + calculateItemTotal(item), 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate company name
    if (!companyName.trim()) {
      toast({ title: 'Error', description: 'Company name is required', variant: 'destructive' })
      return
    }

    // Validate items
    const validItems = items.filter((item) => item.name.trim())
    if (validItems.length === 0) {
      toast({ title: 'Error', description: 'At least one item is required', variant: 'destructive' })
      return
    }

    // Check each item has required fields
    for (const item of validItems) {
      if (!item.quantity || parseFloat(item.quantity) <= 0) {
        toast({ title: 'Error', description: `Item "${item.name}" needs a valid quantity`, variant: 'destructive' })
        return
      }
      if (!item.unit_price || parseFloat(item.unit_price) < 0) {
        toast({ title: 'Error', description: `Item "${item.name}" needs a valid unit price`, variant: 'destructive' })
        return
      }
    }

    setIsSaving(true)

    const result = await createManualOrder({
      company_name: companyName.trim(),
      contact_name: contactName.trim() || undefined,
      contact_email: contactEmail.trim() || undefined,
      phone: phone.trim() || undefined,
      expected_date: expectedDate || undefined,
      ship_via: shipVia || undefined,
      notes: notes.trim() || undefined,
      items: validItems.map((item) => ({
        name: item.name.trim(),
        sku: item.sku.trim() || undefined,
        quantity: parseFloat(item.quantity),
        quantity_unit: item.quantity_unit,
        unit_price: parseFloat(item.unit_price),
      })),
    })

    setIsSaving(false)

    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' })
    } else if (result.order) {
      toast({ title: 'Order Created', description: `Order ${result.order.order_number} has been created` })
      resetForm()
      onCreated(result.order as Order)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Order</DialogTitle>
            <DialogDescription>Enter the order details below.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            {/* Customer Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-700">Customer Information</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name *</Label>
                  <Input
                    id="companyName"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g., Acme Corp"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactName">Contact Name</Label>
                  <Input
                    id="contactName"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="e.g., John Smith"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">Email</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="e.g., john@acme.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g., (555) 123-4567"
                  />
                </div>
              </div>
            </div>

            {/* Order Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-700">Order Details</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="expectedDate">Expected Date</Label>
                  <Input
                    id="expectedDate"
                    type="date"
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shipVia">Ship Via</Label>
                  <Select value={shipVia} onValueChange={setShipVia}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Delivery">Delivery</SelectItem>
                      <SelectItem value="Customer Pickup">Customer Pickup</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any special instructions..."
                  rows={2}
                />
              </div>
            </div>

            {/* Order Items */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-slate-700">Order Items</h3>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              </div>

              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={item.id} className="p-3 bg-slate-50 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500">Item {index + 1}</span>
                      {items.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-slate-400 hover:text-red-500"
                          onClick={() => removeItem(item.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Product Name *</Label>
                        <Input
                          value={item.name}
                          onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                          placeholder="e.g., Ghia Aperitif"
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">SKU</Label>
                        <Input
                          value={item.sku}
                          onChange={(e) => updateItem(item.id, 'sku', e.target.value)}
                          placeholder="e.g., VL5002"
                          className="h-9 font-mono"
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Quantity *</Label>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Unit</Label>
                        <Select
                          value={item.quantity_unit}
                          onValueChange={(value) => updateItem(item.id, 'quantity_unit', value)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="case">Case</SelectItem>
                            <SelectItem value="bottle">Bottle</SelectItem>
                            <SelectItem value="pack">Pack</SelectItem>
                            <SelectItem value="unit">Unit</SelectItem>
                            <SelectItem value="each">Each</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Unit Price *</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) => updateItem(item.id, 'unit_price', e.target.value)}
                          placeholder="0.00"
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Total</Label>
                        <div className="h-9 px-3 flex items-center bg-white border rounded-md text-sm font-medium">
                          ${calculateItemTotal(item).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Order Total */}
              <div className="flex justify-end pt-2 border-t">
                <div className="text-right">
                  <span className="text-sm text-slate-500">Order Total: </span>
                  <span className="text-lg font-semibold">${calculateOrderTotal().toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" variant="action" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Add Order'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
