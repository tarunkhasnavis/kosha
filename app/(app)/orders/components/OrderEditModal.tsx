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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Loader2,
  Mail,
  Send,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
} from "lucide-react"
import type { Order } from "@/types/orders"
import type { SaveAndAnalyzeResult } from "@/lib/orders/actions"
import type { OrgRequiredField } from "@/lib/orders/field-config"
import {
  calculateCompleteness,
  hasItemsChanged,
  generateTempId,
  type EditableItem,
} from "@/lib/orders/completeness"
import { ItemsTable } from "./ItemsTable"

/**
 * Extended order fields type that includes org-specific fields
 */
export interface OrderFieldsWithOrgFields {
  notes?: string
  expected_delivery_date?: string
  orgFields?: Record<string, string | number | null>
}

interface OrderEditModalProps {
  order: Order | null
  isOpen: boolean
  onClose: () => void
  onSave: (orderId: string, items: EditableItem[], orderFields: OrderFieldsWithOrgFields) => Promise<void>
  onSaveAndApprove: (orderId: string, items: EditableItem[], orderFields: OrderFieldsWithOrgFields) => Promise<void>
  onSaveAndAnalyze?: (orderId: string, items: EditableItem[], orderFields: OrderFieldsWithOrgFields) => Promise<SaveAndAnalyzeResult>
  onRequestInfo?: (orderId: string, clarificationMessage: string) => Promise<void>
  onSaveClarificationMessage?: (orderId: string, clarificationMessage: string) => Promise<void>
  orgRequiredFields: OrgRequiredField[]
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
  orgRequiredFields,
}: OrderEditModalProps) {
  const [items, setItems] = useState<EditableItem[]>([])
  const [originalItems, setOriginalItems] = useState<EditableItem[]>([])
  const [notes, setNotes] = useState("")
  const [deliveryDate, setDeliveryDate] = useState<Date | undefined>(undefined)
  const [orgFieldValues, setOrgFieldValues] = useState<Record<string, string | number | null>>({})
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

      // Initialize org field values from order.custom_fields
      const initialOrgFields: Record<string, string | number | null> = {}
      const customFields = order.custom_fields || {}
      for (const field of orgRequiredFields) {
        const value = customFields[field.field]
        initialOrgFields[field.field] = value ?? null
      }
      setOrgFieldValues(initialOrgFields)

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
    return calculateCompleteness(order, items, orgRequiredFields)
  }, [order, items, orgRequiredFields])

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
      await onSave(order.id, items, { notes, expected_delivery_date: deliveryDateStr, orgFields: orgFieldValues })
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
      await onSaveAndApprove(order.id, items, { notes, expected_delivery_date: deliveryDateStr, orgFields: orgFieldValues })
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
      const result = await onSaveAndAnalyze(order.id, items, { notes, expected_delivery_date: deliveryDateStr, orgFields: orgFieldValues })

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
          <ItemsTable
            items={items}
            completeness={completeness}
            inferredFields={order.inferred_fields}
            onUpdateItem={updateItem}
            onDeleteItem={deleteItem}
            onAddItem={addItem}
          />

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

          {/* Additional Info - Org-Specific Required Fields (below Order Details) */}
          {orgRequiredFields.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Additional Info
                </h3>
                {/* Show indicator if any org fields need attention - styled like Items section */}
                {(() => {
                  const missingOrgFields = orgRequiredFields.filter(f => {
                    if (!f.required) return false
                    const value = orgFieldValues[f.field]
                    return value === null || value === undefined || value === ''
                  })
                  return missingOrgFields.length > 0 ? (
                    <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300 text-xs">
                      {missingOrgFields.length} field{missingOrgFields.length > 1 ? 's' : ''} need{missingOrgFields.length === 1 ? 's' : ''} attention
                    </Badge>
                  ) : null
                })()}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {orgRequiredFields.map((field) => {
                  const value = orgFieldValues[field.field]
                  const displayValue = value !== null && value !== undefined ? String(value) : ''
                  const isMissing = field.required && (!displayValue || displayValue === '')
                  return (
                    <div key={field.field} className="space-y-1">
                      <Label className={isMissing ? 'text-orange-600' : ''}>
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </Label>
                      <Input
                        type={field.type === 'number' ? 'number' : 'text'}
                        value={displayValue}
                        onChange={(e) => {
                          const newValue = field.type === 'number'
                            ? (e.target.value === '' ? null : Number(e.target.value))
                            : e.target.value
                          setOrgFieldValues(prev => ({
                            ...prev,
                            [field.field]: newValue
                          }))
                        }}
                        className={isMissing ? 'border-orange-400' : ''}
                        placeholder={`Enter ${field.label.toLowerCase()}`}
                      />
                      {isMissing && (
                        <p className="text-xs text-orange-500">Required field</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

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
