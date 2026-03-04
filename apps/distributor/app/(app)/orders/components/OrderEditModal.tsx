"use client"

import { useState, useEffect, useMemo } from "react"
import { motion } from "framer-motion"
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button, Input, Label, Textarea, Badge, Collapsible, CollapsibleContent, CollapsibleTrigger, DatePicker, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kosha/ui"
import {
  Loader2,
  Mail,
  Send,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
} from "lucide-react"
import type { Order } from "@kosha/types"
import type { SaveAndAnalyzeResult } from "@/lib/orders/actions"
import type { OrgRequiredField } from "@/lib/orders/field-config"
import {
  calculateCompleteness,
  hasItemsChanged,
  generateTempId,
  type EditableItem,
} from "@/lib/orders/completeness"
import { ItemsTable } from "./ItemsTable"
import { durations, easings } from "@/lib/motion"

// Staggered section animation variants
const sectionVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.05,
      duration: durations.base,
      ease: easings.easeOut,
    },
  }),
}

/**
 * Extended order fields type that includes org-specific fields
 */
export interface OrderFieldsWithOrgFields {
  notes?: string
  expected_date?: string
  ship_via?: string
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
  const [shipVia, setShipVia] = useState<string>("")
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
      setDeliveryDate(order.expected_date ? new Date(order.expected_date) : undefined)
      setShipVia(order.ship_via || "")

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
      await onSave(order.id, items, { notes, expected_date: deliveryDateStr, ship_via: shipVia || undefined, orgFields: orgFieldValues })
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
      await onSaveAndApprove(order.id, items, { notes, expected_date: deliveryDateStr, ship_via: shipVia || undefined, orgFields: orgFieldValues })
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
      const result = await onSaveAndAnalyze(order.id, items, { notes, expected_date: deliveryDateStr, ship_via: shipVia || undefined, orgFields: orgFieldValues })

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
      await onSaveAndApprove(order.id, items, { notes, expected_date: deliveryDateStr, ship_via: shipVia || undefined })
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
        <DialogContent className="max-w-lg p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-slate-900">
              {continueDialogData.isComplete ? "Order Complete" : "Still Missing Information"}
            </DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {continueDialogData.isComplete ? (
              <p className="text-sm text-slate-500">
                The order now has all required information and is ready for approval.
              </p>
            ) : (
              <>
                <p className="text-sm text-slate-500">
                  The order is still missing some information. Review and send the clarification request below.
                </p>
                <Collapsible defaultOpen>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent text-slate-700">
                      <span className="text-sm font-medium">Clarification Email</span>
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <Textarea
                      value={editableClarificationMessage}
                      onChange={(e) => setEditableClarificationMessage(e.target.value)}
                      rows={5}
                      className="text-sm bg-white border-slate-200 focus:ring-2 focus:ring-slate-200 focus:border-slate-300 resize-none"
                      placeholder="Enter clarification message..."
                    />
                  </CollapsibleContent>
                </Collapsible>
              </>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200/60">
            {continueDialogData.isComplete ? (
              <>
                <Button variant="outline" onClick={handleLater} className="h-10 px-4 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50">
                  Review Later
                </Button>
                <Button
                  className="h-10 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm"
                  onClick={handleApproveFromDialog}
                  disabled={isSaving}
                >
                  {savingAction === "approve" ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : null}
                  Approve Now
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={handleLater} className="h-10 px-4 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50">
                  Send Later
                </Button>
                <Button
                  className="h-10 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
                  onClick={handleSendFromDialog}
                  disabled={isRequestingInfo || !editableClarificationMessage}
                >
                  {isRequestingInfo ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-1.5" />
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-7">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-xl font-semibold text-slate-900">{order.order_number}</DialogTitle>
              <Badge
                variant="outline"
                className={`text-xs font-medium px-2.5 py-0.5 rounded-full border-0 ${
                  order.status === "waiting_review"
                    ? "bg-[hsl(var(--status-pending-bg))] text-[hsl(var(--status-pending-text))]"
                    : order.status === "awaiting_clarification"
                    ? "bg-[hsl(var(--status-needs-info-bg))] text-[hsl(var(--status-needs-info-text))]"
                    : order.status === "approved"
                    ? "bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved-text))]"
                    : "bg-[hsl(var(--status-archived-bg))] text-[hsl(var(--status-archived-text))]"
                }`}
              >
                {order.status === "waiting_review"
                  ? "Pending Review"
                  : order.status === "awaiting_clarification"
                  ? "Needs Info"
                  : order.status === "approved"
                  ? "Approved"
                  : order.status.replace("_", " ")}
              </Badge>
            </div>
            {/* Completeness Indicator */}
            {completeness && (
              <span
                className={`text-sm font-medium ${
                  completeness.percentage === 100
                    ? (order.status === "approved" ? "text-emerald-600" : "text-blue-600")
                    : completeness.percentage >= 70
                    ? "text-amber-600"
                    : "text-orange-600"
                }`}
              >
                {completeness.percentage}% Complete
              </span>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Customer Info (read-only) */}
          <motion.div
            className="bg-white border border-slate-200/60 rounded-xl p-4"
            custom={0}
            initial="hidden"
            animate="visible"
            variants={sectionVariants}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Customer
                </h3>
                {/* Show missing customer fields indicator */}
                {completeness && completeness.missingRequiredFields.some(f =>
                  f === 'Company Name'
                ) && (
                  <span className="inline-flex items-center gap-1 text-xs text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full">
                    <span className="w-1 h-1 rounded-full bg-orange-500"></span>
                    Missing
                  </span>
                )}
              </div>
              {order.email_url && (
                <a
                  href={order.email_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                >
                  <Mail className="h-3 w-3" />
                  <span>View Email</span>
                </a>
              )}
            </div>
            <div className={`${!order.company_name ? 'text-orange-700' : 'text-slate-900'}`}>
              <p className="font-medium">
                {order.company_name || "Unknown Company"}
                {!order.company_name && (
                  <span className="ml-2 text-xs font-normal text-orange-500">(required)</span>
                )}
              </p>
              {order.contact_name && (
                <p className="text-sm text-slate-500 mt-0.5">
                  {order.contact_name}
                  {order.contact_email && ` · ${order.contact_email}`}
                </p>
              )}
              {order.phone && (
                <p className="text-sm text-slate-500">{order.phone}</p>
              )}
            </div>
          </motion.div>

          {/* Items Table */}
          <motion.div
            custom={1}
            initial="hidden"
            animate="visible"
            variants={sectionVariants}
          >
            <ItemsTable
              items={items}
              completeness={completeness}
              inferredFields={order.inferred_fields}
              onUpdateItem={updateItem}
              onDeleteItem={deleteItem}
              onAddItem={addItem}
            />
          </motion.div>

          {/* Order Details */}
          <motion.div
            className="bg-white border border-slate-200/60 rounded-xl p-4"
            custom={2}
            initial="hidden"
            animate="visible"
            variants={sectionVariants}
          >
            <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-4">
              Order Details
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600">Expected Date</Label>
                <DatePicker
                  selected={deliveryDate}
                  onSelect={setDeliveryDate}
                  placeholder="Select date"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600">Ship Via</Label>
                <Select value={shipVia} onValueChange={setShipVia}>
                  <SelectTrigger className="bg-white border-slate-200 focus:ring-2 focus:ring-slate-200 focus:border-slate-300">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Delivery">Delivery</SelectItem>
                    <SelectItem value="Customer Pickup">Customer Pickup</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600">Received Date</Label>
                <Input
                  value={new Date(order.received_date).toLocaleDateString()}
                  disabled
                  className="bg-slate-100/50 border-slate-200 text-slate-500"
                />
              </div>
            </div>
            <div className="space-y-1.5 mt-4">
              <Label htmlFor="notes" className="text-xs text-slate-600">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this order..."
                rows={3}
                className="bg-white border-slate-200 focus:ring-2 focus:ring-slate-200 focus:border-slate-300 resize-none"
              />
            </div>
          </motion.div>

          {/* Additional Info - Org-Specific Required Fields (below Order Details) */}
          {orgRequiredFields.length > 0 && (
            <motion.div
              className="bg-white border border-slate-200/60 rounded-xl p-4"
              custom={3}
              initial="hidden"
              animate="visible"
              variants={sectionVariants}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Additional Info
                </h3>
                {/* Show indicator if any org fields need attention */}
                {(() => {
                  const missingOrgFields = orgRequiredFields.filter(f => {
                    if (!f.required) return false
                    const value = orgFieldValues[f.field]
                    return value === null || value === undefined || value === ''
                  })
                  return missingOrgFields.length > 0 ? (
                    <span className="inline-flex items-center gap-1 text-xs text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full">
                      <span className="w-1 h-1 rounded-full bg-orange-500"></span>
                      {missingOrgFields.length} field{missingOrgFields.length > 1 ? 's' : ''} need{missingOrgFields.length === 1 ? 's' : ''} attention
                    </span>
                  ) : null
                })()}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {orgRequiredFields.map((field) => {
                  const value = orgFieldValues[field.field]
                  const displayValue = value !== null && value !== undefined ? String(value) : ''
                  const isMissing = field.required && (!displayValue || displayValue === '')
                  return (
                    <div key={field.field} className="space-y-1.5">
                      <Label className={`text-xs ${isMissing ? 'text-orange-700' : 'text-slate-600'}`}>
                        {field.label}
                        {field.required && <span className="text-orange-500 ml-0.5">*</span>}
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
                        className={`bg-white border-slate-200 focus:ring-2 focus:ring-slate-200 focus:border-slate-300 ${isMissing ? 'border-orange-200 bg-orange-50/30' : ''}`}
                        placeholder={`Enter ${field.label.toLowerCase()}`}
                      />
                      {isMissing && (
                        <p className="text-[11px] text-orange-600">Required</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )}

          {/* Order Total */}
          <motion.div
            className="bg-white border border-slate-200/60 rounded-xl p-4"
            custom={4}
            initial="hidden"
            animate="visible"
            variants={sectionVariants}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-slate-600">Order Total</span>
                <p className="text-xs text-slate-400 mt-0.5">
                  {items.length} item{items.length !== 1 ? "s" : ""}
                </p>
              </div>
              <span className="text-2xl font-semibold text-slate-900">${calculateOrderTotal().toFixed(2)}</span>
            </div>
          </motion.div>

          {/* Dirty State Warning - Only show for "Needs Info" orders when items changed */}
          {isNeedsInfo && isDirty && (
            <div className="bg-amber-50 border border-amber-200/60 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-slate-700">You've made changes</p>
                <p className="text-slate-500 mt-0.5">A new clarification email will be generated based on your edits when you save.</p>
              </div>
            </div>
          )}

          {/* Collapsible Clarification Email Section - Only for "Needs Info" orders in clean state */}
          {isNeedsInfo && !isDirty && hasClarificationMessage && (
            <Collapsible open={isEmailSectionOpen} onOpenChange={setIsEmailSectionOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-between px-4 py-3 h-auto bg-white hover:bg-slate-50 border border-slate-200/60 rounded-xl"
                >
                  <span className="text-sm font-medium text-slate-600">View / Edit Clarification Email</span>
                  {isEmailSectionOpen ? (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                <Textarea
                  value={editableClarificationMessage}
                  onChange={(e) => setEditableClarificationMessage(e.target.value)}
                  rows={5}
                  className="text-sm bg-white border-slate-200 focus:ring-2 focus:ring-slate-200 focus:border-slate-300 resize-none"
                  placeholder="Enter clarification message..."
                />
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Actions - Simplified per status */}
          <div className="flex items-center justify-between pt-5 mt-2 border-t border-slate-200/60">
            <Button variant="outline" onClick={onClose} disabled={isSaving} className="h-10 px-4 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-700">
              Cancel
            </Button>
            <div className="flex items-center gap-2">
              {/* Needs Info - Clean State: Request Info button */}
              {isNeedsInfo && !isDirty && (
                <>
                  {hasClarificationMessage ? (
                    <Button
                      className="h-10 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
                      onClick={handleRequestInfo}
                      disabled={isSaving || isRequestingInfo || !editableClarificationMessage.trim()}
                    >
                      {isRequestingInfo ? (
                        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-1.5" />
                      )}
                      Request Info
                    </Button>
                  ) : (
                    <Button disabled variant="secondary" className="h-10 px-4 rounded-xl">
                      Request Sent
                    </Button>
                  )}
                </>
              )}

              {/* Needs Info - Dirty State: Save & Continue button */}
              {isNeedsInfo && isDirty && onSaveAndAnalyze && (
                <Button
                  className="h-10 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
                  onClick={handleSaveAndContinue}
                  disabled={isSaving}
                >
                  {savingAction === "continue" ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : null}
                  Save & Continue
                </Button>
              )}

              {/* Pending Review: Save and Save & Approve */}
              {isPendingReview && (
                <>
                  <Button variant="outline" onClick={handleSave} disabled={isSaving} className="h-10 px-4 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50">
                    {savingAction === "save" ? (
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    ) : null}
                    Save
                  </Button>
                  <Button onClick={handleSaveAndApprove} disabled={isSaving} className="h-10 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-sm">
                    {savingAction === "approve" ? (
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    ) : null}
                    Save & Approve
                  </Button>
                </>
              )}

              {/* Approved: Only Save button */}
              {isApproved && (
                <Button onClick={handleSave} disabled={isSaving} className="h-10 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-sm">
                  {savingAction === "save" ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
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
