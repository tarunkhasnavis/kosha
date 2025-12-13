"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Trash2,
  Plus,
  Loader2,
  Mail,
  Send,
} from "lucide-react"
import type { Order } from "@/types/orders"
import { requestOrderInfo } from "@/lib/actions/orders"

interface EditableItem {
  id: string
  name: string
  sku: string
  quantity: number
  quantity_unit: string
  unit_price: string
  total: number
  isNew?: boolean
}

const QUANTITY_UNITS = [
  "each",
  "lbs",
  "kg",
  "oz",
  "cases",
  "boxes",
  "bags",
  "dozen",
  "packs",
  "units",
  "gallons",
  "liters",
]

interface OrderEditModalProps {
  order: Order | null
  isOpen: boolean
  onClose: () => void
  onSave: (orderId: string, items: EditableItem[], orderFields: { notes?: string; expected_delivery_date?: string }) => Promise<void>
  onSaveAndApprove: (orderId: string, items: EditableItem[], orderFields: { notes?: string; expected_delivery_date?: string }) => Promise<void>
}

function generateTempId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

export function OrderEditModal({
  order,
  isOpen,
  onClose,
  onSave,
  onSaveAndApprove,
}: OrderEditModalProps) {
  const [items, setItems] = useState<EditableItem[]>([])
  const [notes, setNotes] = useState("")
  const [deliveryDate, setDeliveryDate] = useState<Date | undefined>(undefined)
  const [isSaving, setIsSaving] = useState(false)
  const [savingAction, setSavingAction] = useState<string | null>(null)
  const [isRequestingInfo, setIsRequestingInfo] = useState(false)

  // Initialize form when order changes
  useEffect(() => {
    if (order) {
      setItems(
        order.items?.map((item) => ({
          id: item.id,
          name: item.name,
          sku: item.sku || "",
          quantity: item.quantity,
          quantity_unit: item.quantity_unit || "each",
          unit_price: String(item.unit_price),
          total: item.total,
          isNew: false,
        })) || []
      )
      setNotes(order.notes || "")
      setDeliveryDate(order.expected_delivery_date ? new Date(order.expected_delivery_date) : undefined)
    }
  }, [order])

  if (!order) return null

  // Calculate line total
  const calculateLineTotal = (quantity: number, unitPrice: string): number => {
    const qty = quantity || 0
    const price = parseFloat(unitPrice) || 0
    return qty * price
  }

  // Calculate order total
  const calculateOrderTotal = (): number => {
    return items.reduce((sum, item) => {
      return sum + calculateLineTotal(item.quantity, item.unit_price)
    }, 0)
  }

  // Update item field
  const updateItem = (id: string, field: keyof EditableItem, value: string | number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item
        const updated = { ...item, [field]: value }
        // Recalculate total when quantity or price changes
        if (field === "quantity" || field === "unit_price") {
          const newQty = field === "quantity" ? (value as number) : item.quantity
          const newPrice = field === "unit_price" ? (value as string) : item.unit_price
          updated.total = calculateLineTotal(newQty, newPrice)
        }
        return updated
      })
    )
  }

  // Add new item
  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: generateTempId(),
        name: "",
        sku: "",
        quantity: 1,
        quantity_unit: "each",
        unit_price: "0",
        total: 0,
        isNew: true,
      },
    ])
  }

  // Delete item
  const deleteItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  // Handle save
  const handleSave = async () => {
    setIsSaving(true)
    setSavingAction("save")
    try {
      const deliveryDateStr = deliveryDate ? deliveryDate.toISOString().split('T')[0] : undefined
      await onSave(order.id, items, { notes, expected_delivery_date: deliveryDateStr })
      onClose()
    } finally {
      setIsSaving(false)
      setSavingAction(null)
    }
  }

  // Handle save and approve
  const handleSaveAndApprove = async () => {
    setIsSaving(true)
    setSavingAction("approve")
    try {
      const deliveryDateStr = deliveryDate ? deliveryDate.toISOString().split('T')[0] : undefined
      await onSaveAndApprove(order.id, items, { notes, expected_delivery_date: deliveryDateStr })
      onClose()
    } finally {
      setIsSaving(false)
      setSavingAction(null)
    }
  }

  // Handle request info (send clarification email)
  const handleRequestInfo = async () => {
    setIsRequestingInfo(true)
    try {
      await requestOrderInfo(order.id)
      onClose()
    } catch (error) {
      console.error("Failed to send clarification request:", error)
      // Let the error bubble up - parent should handle toast
    } finally {
      setIsRequestingInfo(false)
    }
  }

  const isNeedsInfo = order.status === "awaiting_clarification"
  const isPendingReview = order.status === "waiting_review"
  const isApproved = order.status === "approved"
  const hasClarificationMessage = order.clarification_message !== null && order.clarification_message !== undefined

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-col gap-1">
            <DialogTitle className="text-2xl font-semibold">{order.order_number}</DialogTitle>
            <Badge
              variant="outline"
              className={`w-fit ${
                order.status === "waiting_review"
                  ? "bg-blue-50 text-blue-700 border-blue-200"
                  : order.status === "awaiting_clarification"
                  ? "bg-orange-50 text-orange-700 border-orange-200"
                  : order.status === "approved"
                  ? "bg-green-50 text-green-700 border-green-200"
                  : "bg-gray-50 text-gray-700"
              }`}
            >
              {order.status === "waiting_review"
                ? "Pending Review"
                : order.status === "awaiting_clarification"
                ? "Needs Info"
                : order.status.replace("_", " ")}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Customer Info (read-only) */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Customer
            </h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-lg">{order.company_name || "Unknown Company"}</p>
                  {order.contact_name && (
                    <p className="text-sm text-muted-foreground">
                      {order.contact_name}
                      {order.contact_email && ` (${order.contact_email})`}
                    </p>
                  )}
                  {order.phone && (
                    <p className="text-sm text-muted-foreground">{order.phone}</p>
                  )}
                </div>
                {order.email_url && (
                  <a
                    href={order.email_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline shrink-0"
                  >
                    <Mail className="h-3 w-3" />
                    <span>View Email</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Items
            </h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3 w-32">
                      SKU
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">
                      Description
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3 w-36">
                      Qty
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3 w-28">
                      Price
                    </th>
                    <th className="text-right text-xs font-medium text-muted-foreground uppercase px-4 py-3 w-24">
                      Total
                    </th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Input
                          value={item.sku}
                          onChange={(e) => updateItem(item.id, "sku", e.target.value)}
                          placeholder="SKU"
                          className="h-8 text-sm"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          value={item.name}
                          onChange={(e) => updateItem(item.id, "name", e.target.value)}
                          placeholder="Item description"
                          className="h-8 text-sm"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItem(item.id, "quantity", parseFloat(e.target.value) || 0)}
                            min="0"
                            step="0.01"
                            className="h-8 text-sm w-16"
                          />
                          <Select
                            value={item.quantity_unit}
                            onValueChange={(value) => updateItem(item.id, "quantity_unit", value)}
                          >
                            <SelectTrigger className="h-8 text-sm w-20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {/* Include current value if not in standard list */}
                              {!QUANTITY_UNITS.includes(item.quantity_unit) && (
                                <SelectItem value={item.quantity_unit}>{item.quantity_unit}</SelectItem>
                              )}
                              {QUANTITY_UNITS.map((unit) => (
                                <SelectItem key={unit} value={unit}>
                                  {unit}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                            $
                          </span>
                          <Input
                            type="number"
                            value={item.unit_price}
                            onChange={(e) => updateItem(item.id, "unit_price", e.target.value)}
                            min="0"
                            step="0.01"
                            className="h-8 text-sm pl-6"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        ${item.total.toFixed(2)}
                      </td>
                      <td className="px-2 py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteItem(item.id)}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        No items. Click "Add Item" to add one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Button variant="outline" size="sm" onClick={addItem}>
              <Plus className="h-4 w-4 mr-1" />
              Add Item
            </Button>
          </div>

          {/* Order Details */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Order Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Expected Delivery Date</Label>
                <DatePicker
                  selected={deliveryDate}
                  onSelect={setDeliveryDate}
                  placeholder="Select delivery date"
                />
              </div>
              <div className="space-y-2">
                <Label>Received Date</Label>
                <Input
                  value={new Date(order.received_date).toLocaleDateString()}
                  disabled
                  className="bg-gray-50"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this order..."
                rows={3}
              />
            </div>
          </div>

          {/* Order Total */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold">Order Total</span>
              <span className="text-2xl font-bold">${calculateOrderTotal().toFixed(2)}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {items.length} item{items.length !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Actions - Simplified per status */}
          <div className="flex items-center justify-between border-t pt-4">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <div className="flex items-center gap-2">
              {/* Needs Info: Save and Request Info buttons */}
              {isNeedsInfo && (
                <>
                  <Button variant="outline" onClick={handleSave} disabled={isSaving || isRequestingInfo}>
                    {savingAction === "save" ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : null}
                    Save
                  </Button>
                  {hasClarificationMessage ? (
                    <Button onClick={handleRequestInfo} disabled={isSaving || isRequestingInfo}>
                      {isRequestingInfo ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-1" />
                      )}
                      Request Info
                    </Button>
                  ) : (
                    <Button disabled variant="secondary">
                      Request Sent
                    </Button>
                  )}
                </>
              )}

              {/* Pending Review: Save and Save & Approve */}
              {isPendingReview && (
                <>
                  <Button variant="outline" onClick={handleSave} disabled={isSaving}>
                    {savingAction === "save" ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : null}
                    Save
                  </Button>
                  <Button onClick={handleSaveAndApprove} disabled={isSaving}>
                    {savingAction === "approve" ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : null}
                    Save & Approve
                  </Button>
                </>
              )}

              {/* Approved: Only Save button */}
              {isApproved && (
                <Button onClick={handleSave} disabled={isSaving}>
                  {savingAction === "save" ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : null}
                  Save Changes
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
