"use client"

import { useState, useEffect, useMemo } from "react"
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Trash2,
  Plus,
  Loader2,
  Mail,
  Send,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
} from "lucide-react"
import type { Order } from "@/types/orders"
import type { SaveAndAnalyzeResult } from "@/lib/actions/orders"

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
  onSaveAndAnalyze?: (orderId: string, items: EditableItem[], orderFields: { notes?: string; expected_delivery_date?: string }) => Promise<SaveAndAnalyzeResult>
  onRequestInfo?: (orderId: string, clarificationMessage: string) => Promise<void>
  onSaveClarificationMessage?: (orderId: string, clarificationMessage: string) => Promise<void>
}

function generateTempId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Compare two item arrays to detect if there are changes
 */
function hasItemsChanged(current: EditableItem[], original: EditableItem[]): boolean {
  if (current.length !== original.length) return true

  for (let i = 0; i < current.length; i++) {
    const curr = current[i]
    const orig = original[i]
    if (
      curr.name !== orig.name ||
      curr.sku !== orig.sku ||
      curr.quantity !== orig.quantity ||
      curr.quantity_unit !== orig.quantity_unit ||
      curr.unit_price !== orig.unit_price
    ) {
      return true
    }
  }
  return false
}

/**
 * Field definitions for completeness tracking
 * - required: true means the field MUST be filled for order to be complete
 * - required: false means it's nice-to-have but doesn't affect completeness
 */
interface FieldDefinition {
  key: string
  label: string
  required: boolean
}

// Order-level fields
const ORDER_FIELDS: FieldDefinition[] = [
  { key: 'company_name', label: 'Company Name', required: true },
  { key: 'contact_name', label: 'Contact Name', required: false },
  { key: 'contact_email', label: 'Contact Email', required: false },
  { key: 'phone', label: 'Phone', required: false },
]

// Item-level fields (per item)
const ITEM_FIELDS: FieldDefinition[] = [
  { key: 'name', label: 'Item Name', required: true },
  { key: 'sku', label: 'SKU', required: false },
  { key: 'quantity', label: 'Quantity', required: true },
  { key: 'quantity_unit', label: 'Unit', required: true },
  { key: 'unit_price', label: 'Unit Price', required: true }, // Required until we have SKU/price catalog
]

interface CompletenessResult {
  percentage: number
  totalFields: number
  filledFields: number
  missingRequiredFields: string[]
  missingOptionalFields: string[]
  itemMissingFields: Map<string, string[]> // itemId -> missing field keys
}

/**
 * Calculate order completeness based on filled fields
 */
function calculateCompleteness(
  order: Order,
  items: EditableItem[]
): CompletenessResult {
  const missingRequiredFields: string[] = []
  const missingOptionalFields: string[] = []
  const itemMissingFields = new Map<string, string[]>()

  let totalFields = 0
  let filledFields = 0

  // Check order-level fields
  for (const field of ORDER_FIELDS) {
    totalFields++
    const value = order[field.key as keyof Order]
    const isFilled = value !== null && value !== undefined && value !== ''

    if (isFilled) {
      filledFields++
    } else {
      if (field.required) {
        missingRequiredFields.push(field.label)
      } else {
        missingOptionalFields.push(field.label)
      }
    }
  }

  // Check item-level fields
  for (const item of items) {
    const itemMissing: string[] = []

    for (const field of ITEM_FIELDS) {
      totalFields++
      let isFilled = false

      if (field.key === 'name') {
        isFilled = item.name.trim() !== ''
      } else if (field.key === 'sku') {
        isFilled = item.sku.trim() !== ''
      } else if (field.key === 'quantity') {
        isFilled = item.quantity > 0
      } else if (field.key === 'quantity_unit') {
        isFilled = item.quantity_unit.trim() !== ''
      } else if (field.key === 'unit_price') {
        const price = parseFloat(item.unit_price)
        isFilled = !isNaN(price) && price > 0
      }

      if (isFilled) {
        filledFields++
      } else {
        itemMissing.push(field.key)
        const fieldDef = ITEM_FIELDS.find(f => f.key === field.key)
        if (fieldDef?.required) {
          // Only add to missing required if not already there
          const label = `${fieldDef.label} (Item: ${item.name || 'Unnamed'})`
          if (!missingRequiredFields.includes(label)) {
            missingRequiredFields.push(label)
          }
        }
      }
    }

    if (itemMissing.length > 0) {
      itemMissingFields.set(item.id, itemMissing)
    }
  }

  // Calculate percentage
  const percentage = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0

  return {
    percentage,
    totalFields,
    filledFields,
    missingRequiredFields,
    missingOptionalFields,
    itemMissingFields,
  }
}

/**
 * Get CSS class for missing field highlight
 */
function getMissingFieldClass(isMissing: boolean): string {
  return isMissing
    ? 'border-orange-400 ring-1 ring-orange-400 focus:border-orange-500 focus:ring-orange-500'
    : ''
}

export function OrderEditModal({
  order,
  isOpen,
  onClose,
  onSave,
  onSaveAndApprove,
  onSaveAndAnalyze,
  onRequestInfo,
  onSaveClarificationMessage,
}: OrderEditModalProps) {
  const [items, setItems] = useState<EditableItem[]>([])
  const [originalItems, setOriginalItems] = useState<EditableItem[]>([])
  const [notes, setNotes] = useState("")
  const [deliveryDate, setDeliveryDate] = useState<Date | undefined>(undefined)
  const [isSaving, setIsSaving] = useState(false)
  const [savingAction, setSavingAction] = useState<string | null>(null)
  const [isRequestingInfo, setIsRequestingInfo] = useState(false)
  const [isEmailSectionOpen, setIsEmailSectionOpen] = useState(false)

  // Continuation dialog state
  const [showContinueDialog, setShowContinueDialog] = useState(false)
  const [continueDialogData, setContinueDialogData] = useState<{
    isComplete: boolean
    clarificationMessage?: string
  } | null>(null)
  const [editableClarificationMessage, setEditableClarificationMessage] = useState("")

  // Initialize form when order changes
  useEffect(() => {
    if (order) {
      const mappedItems = order.items?.map((item) => ({
        id: item.id,
        name: item.name,
        sku: item.sku || "",
        quantity: item.quantity,
        quantity_unit: item.quantity_unit || "each",
        unit_price: String(item.unit_price),
        total: item.total,
        isNew: false,
      })) || []

      setItems(mappedItems)
      setOriginalItems(mappedItems)
      setNotes(order.notes || "")
      setDeliveryDate(order.expected_delivery_date ? new Date(order.expected_delivery_date) : undefined)
      setIsEmailSectionOpen(false)
      setShowContinueDialog(false)
      setContinueDialogData(null)
      // Initialize the editable clarification message from order
      setEditableClarificationMessage(order.clarification_message || "")
    }
  }, [order])

  // Compute dirty state for items
  const isDirty = useMemo(() => {
    return hasItemsChanged(items, originalItems)
  }, [items, originalItems])

  // Check if clarification message was edited
  const isClarificationMessageDirty = useMemo(() => {
    if (!order) return false
    const originalMessage = order.clarification_message || ""
    return editableClarificationMessage !== originalMessage
  }, [order, editableClarificationMessage])

  // Compute completeness
  const completeness = useMemo(() => {
    if (!order) return null
    return calculateCompleteness(order, items)
  }, [order, items])

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

  // Handle Save & Continue (for dirty "needs info" orders)
  const handleSaveAndContinue = async () => {
    if (!onSaveAndAnalyze) return

    setIsSaving(true)
    setSavingAction("continue")
    try {
      const deliveryDateStr = deliveryDate ? deliveryDate.toISOString().split('T')[0] : undefined
      const result = await onSaveAndAnalyze(order.id, items, { notes, expected_delivery_date: deliveryDateStr })

      // Show the continuation dialog with the result
      setContinueDialogData({
        isComplete: result.isComplete,
        clarificationMessage: result.clarificationMessage,
      })
      setEditableClarificationMessage(result.clarificationMessage || "")
      setShowContinueDialog(true)

      // Update original items to match saved state (no longer dirty)
      setOriginalItems([...items])
    } finally {
      setIsSaving(false)
      setSavingAction(null)
    }
  }

  // Handle Request Info (send clarification email) - for clean state
  // Uses the editable message (which may have been edited by user)
  const handleRequestInfo = async () => {
    if (!onRequestInfo || !editableClarificationMessage) return

    setIsRequestingInfo(true)
    try {
      await onRequestInfo(order.id, editableClarificationMessage)
      onClose()
    } catch (error) {
      console.error("Failed to send clarification request:", error)
    } finally {
      setIsRequestingInfo(false)
    }
  }

  // Handle Send Request from continuation dialog
  const handleSendFromDialog = async () => {
    if (!onRequestInfo || !editableClarificationMessage) return

    setIsRequestingInfo(true)
    try {
      await onRequestInfo(order.id, editableClarificationMessage)
      setShowContinueDialog(false)
      onClose()
    } catch (error) {
      console.error("Failed to send clarification request:", error)
    } finally {
      setIsRequestingInfo(false)
    }
  }

  // Handle "Approve Now" from continuation dialog (when order is complete)
  const handleApproveFromDialog = async () => {
    setIsSaving(true)
    setSavingAction("approve")
    try {
      // Items already saved, just need to approve
      const deliveryDateStr = deliveryDate ? deliveryDate.toISOString().split('T')[0] : undefined
      await onSaveAndApprove(order.id, items, { notes, expected_delivery_date: deliveryDateStr })
      setShowContinueDialog(false)
      onClose()
    } finally {
      setIsSaving(false)
      setSavingAction(null)
    }
  }

  // Handle "Send Later" / "Review Later" - save edited clarification message if dirty, then close
  const handleLater = async () => {
    // If clarification message was edited, save it before closing
    if (isClarificationMessageDirty && onSaveClarificationMessage && order) {
      try {
        await onSaveClarificationMessage(order.id, editableClarificationMessage)
      } catch (error) {
        console.error('Failed to save clarification message:', error)
        // Still close even if save fails
      }
    }
    setShowContinueDialog(false)
    onClose()
  }

  const isNeedsInfo = order.status === "awaiting_clarification"
  const isPendingReview = order.status === "waiting_review"
  const isApproved = order.status === "approved"
  const hasClarificationMessage = order.clarification_message !== null && order.clarification_message !== undefined

  // Continuation Dialog
  if (showContinueDialog && continueDialogData) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {continueDialogData.isComplete ? "Order Complete" : "Still Missing Information"}
            </DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {continueDialogData.isComplete ? (
              <p className="text-muted-foreground">
                The order now has all required information and is ready for approval.
              </p>
            ) : (
              <>
                <p className="text-muted-foreground">
                  The order is still missing some information. Review and send the clarification request below.
                </p>
                <Collapsible defaultOpen>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                      <span className="text-sm font-medium">Clarification Email</span>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <Textarea
                      value={editableClarificationMessage}
                      onChange={(e) => setEditableClarificationMessage(e.target.value)}
                      rows={5}
                      className="text-sm"
                      placeholder="Enter clarification message..."
                    />
                  </CollapsibleContent>
                </Collapsible>
              </>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            {continueDialogData.isComplete ? (
              <>
                <Button variant="outline" onClick={handleLater}>
                  Review Later
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={handleApproveFromDialog}
                  disabled={isSaving}
                >
                  {savingAction === "approve" ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : null}
                  Approve Now
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={handleLater}>
                  Send Later
                </Button>
                <Button
                  className="bg-orange-600 hover:bg-orange-700"
                  onClick={handleSendFromDialog}
                  disabled={isRequestingInfo || !editableClarificationMessage}
                >
                  {isRequestingInfo ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-1" />
                  )}
                  Send Request
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-col gap-1">
            <DialogTitle className="text-2xl font-semibold">{order.order_number}</DialogTitle>
            <div className="flex items-center justify-between">
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
              {/* Completeness Indicator */}
              {completeness && (
                <span
                  className={`text-sm font-medium ${
                    completeness.percentage === 100
                      ? "text-green-600"
                      : completeness.percentage >= 70
                      ? "text-yellow-600"
                      : "text-orange-600"
                  }`}
                >
                  {completeness.percentage}% Complete
                </span>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Customer Info (read-only) */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Customer
              </h3>
              {/* Show missing customer fields indicator */}
              {completeness && completeness.missingRequiredFields.some(f =>
                f === 'Company Name'
              ) && (
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300 text-xs">
                  Missing Info
                </Badge>
              )}
            </div>
            <div className={`bg-gray-50 rounded-lg p-4 ${
              !order.company_name ? 'border-2 border-orange-400' : ''
            }`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className={`font-medium text-lg ${!order.company_name ? 'text-orange-600' : ''}`}>
                    {order.company_name || "Unknown Company"}
                    {!order.company_name && (
                      <span className="ml-2 text-xs font-normal text-orange-500">(missing)</span>
                    )}
                  </p>
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
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Items
              </h3>
              {/* Show indicator if any items have missing required fields */}
              {completeness && completeness.itemMissingFields.size > 0 && (
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300 text-xs">
                  {completeness.itemMissingFields.size} item{completeness.itemMissingFields.size > 1 ? 's' : ''} need attention
                </Badge>
              )}
            </div>
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
                          className={`h-8 text-sm ${getMissingFieldClass(
                            completeness?.itemMissingFields.get(item.id)?.includes('sku') ?? false
                          )}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          value={item.name}
                          onChange={(e) => updateItem(item.id, "name", e.target.value)}
                          placeholder="Item description"
                          className={`h-8 text-sm ${getMissingFieldClass(
                            completeness?.itemMissingFields.get(item.id)?.includes('name') ?? false
                          )}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItem(item.id, "quantity", parseInt(e.target.value) || 0)}
                            min="0"
                            step="1"
                            className={`h-8 text-sm w-16 ${getMissingFieldClass(
                              completeness?.itemMissingFields.get(item.id)?.includes('quantity') ?? false
                            )}`}
                          />
                          <Select
                            value={item.quantity_unit}
                            onValueChange={(value) => updateItem(item.id, "quantity_unit", value)}
                          >
                            <SelectTrigger className={`h-8 text-sm w-20 ${getMissingFieldClass(
                              completeness?.itemMissingFields.get(item.id)?.includes('quantity_unit') ?? false
                            )}`}>
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
                            className={`h-8 text-sm pl-6 ${getMissingFieldClass(
                              completeness?.itemMissingFields.get(item.id)?.includes('unit_price') ?? false
                            )}`}
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

          {/* Dirty State Warning - Only show for "Needs Info" orders when items changed */}
          {isNeedsInfo && isDirty && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" />
              <div className="text-sm text-orange-800">
                <p className="font-medium">You've made changes.</p>
                <p className="text-orange-700">A new clarification email will be generated based on your edits when you save.</p>
              </div>
            </div>
          )}

          {/* Collapsible Clarification Email Section - Only for "Needs Info" orders in clean state */}
          {isNeedsInfo && !isDirty && hasClarificationMessage && (
            <Collapsible open={isEmailSectionOpen} onOpenChange={setIsEmailSectionOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-between px-3 py-2 h-auto bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg"
                >
                  <span className="text-sm font-medium text-orange-800">View / Edit Clarification Email</span>
                  {isEmailSectionOpen ? (
                    <ChevronDown className="h-4 w-4 text-orange-600" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-orange-600" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <Textarea
                  value={editableClarificationMessage}
                  onChange={(e) => setEditableClarificationMessage(e.target.value)}
                  rows={5}
                  className="text-sm"
                  placeholder="Enter clarification message..."
                />
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Actions - Simplified per status */}
          <div className="flex items-center justify-between border-t pt-4">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <div className="flex items-center gap-2">
              {/* Needs Info - Clean State: Request Info button */}
              {isNeedsInfo && !isDirty && (
                <>
                  {hasClarificationMessage ? (
                    <Button
                      className="bg-orange-600 hover:bg-orange-700 text-white"
                      onClick={handleRequestInfo}
                      disabled={isSaving || isRequestingInfo || !editableClarificationMessage.trim()}
                    >
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

              {/* Needs Info - Dirty State: Save & Continue button */}
              {isNeedsInfo && isDirty && onSaveAndAnalyze && (
                <Button
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                  onClick={handleSaveAndContinue}
                  disabled={isSaving}
                >
                  {savingAction === "continue" ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : null}
                  Save & Continue
                </Button>
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
