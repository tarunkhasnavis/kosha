"use client"

import { useState, useEffect, useMemo } from "react"
import { motion } from "framer-motion"
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet"
import * as VisuallyHidden from "@radix-ui/react-visually-hidden"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Loader2,
  Mail,
  Send,
  ChevronDown,
  ChevronRight,
  X,
  AlertTriangle,
  Maximize2,
  Minimize2,
  CheckCircle,
  MessageSquare,
  Voicemail,
  FileSpreadsheet,
  FileText,
  RotateCcw,
  Paperclip,
  Pencil,
  Building2,
  CreditCard,
  AlertCircle,
} from "lucide-react"
import type { Order } from "@/types/orders"
import type { Product } from "@/types/products"
import type { Customer } from "@/types/customers"
import type { SaveAndAnalyzeResult, OrderAttachmentData } from "@/lib/orders/actions"
import { pushInvoiceToErp, checkInvoiceStatus } from "@/lib/integrations/actions"
import { generateApprovalEmailPreview, getOrderAttachmentsAction } from "@/lib/orders/actions"
import { getProducts } from "@/lib/products/actions"
import { fetchCustomers, fetchCustomer, setOrderCustomer, createCustomerAndLinkToOrder } from "@/lib/customers/actions"
import { CustomerCombobox } from "@/components/CustomerCombobox"
import type { OrgRequiredField } from "@/lib/orders/field-config"
import { AttachmentViewer } from "./AttachmentViewer"
import { EmailHtmlViewer } from "./EmailHtmlViewer"
import {
  calculateCompleteness,
  hasItemsChanged,
  generateTempId,
  type EditableItem,
  type EditedFieldOverrides,
} from "@/lib/orders/completeness"
import { ItemsTable } from "./ItemsTable"
import { durations, easings } from "@/lib/motion"
import { cn } from "@/lib/utils"

// Panel modes for different widths
export type PanelMode = "peek" | "full"

const PANEL_WIDTHS: Record<PanelMode, number | string> = {
  peek: "66vw",
  full: "100vw",
}

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
  include_notes_in_pdf?: boolean
  company_name?: string
  contact_name?: string
  customer_id?: string | null
}

interface OrderEditPanelProps {
  order: Order | null
  isOpen: boolean
  mode: PanelMode
  onClose: () => void
  onModeChange: (mode: PanelMode) => void
  onSave: (orderId: string, items: EditableItem[], orderFields: OrderFieldsWithOrgFields, deletedItems?: EditableItem[]) => Promise<void>
  onSaveAndApprove: (orderId: string, items: EditableItem[], orderFields: OrderFieldsWithOrgFields, customApprovalEmail?: string, deletedItems?: EditableItem[]) => Promise<void>
  onSaveAndAnalyze?: (orderId: string, items: EditableItem[], orderFields: OrderFieldsWithOrgFields, deletedItems?: EditableItem[]) => Promise<SaveAndAnalyzeResult>
  onRequestInfo?: (orderId: string, clarificationMessage: string) => Promise<void>
  onSaveClarificationMessage?: (orderId: string, clarificationMessage: string) => Promise<void>
  onRetry?: (orderId: string) => Promise<{ success: boolean; isComplete: boolean; error?: string }>
  orgRequiredFields: OrgRequiredField[]
}

export function OrderEditPanel({
  order,
  isOpen,
  mode,
  onClose,
  onModeChange,
  onSave,
  onSaveAndApprove,
  onSaveAndAnalyze,
  onRequestInfo,
  onSaveClarificationMessage,
  onRetry,
  orgRequiredFields,
}: OrderEditPanelProps) {
  const [items, setItems] = useState<EditableItem[]>([])
  const [deletedItems, setDeletedItems] = useState<EditableItem[]>([])
  const [originalItems, setOriginalItems] = useState<EditableItem[]>([])
  const [notes, setNotes] = useState("")
  const [deliveryDate, setDeliveryDate] = useState<Date | undefined>(undefined)
  const [shipVia, setShipVia] = useState<string>("")
  const [includeNotesInPdf, setIncludeNotesInPdf] = useState(false)
  const [companyName, setCompanyName] = useState("")
  const [contactName, setContactName] = useState("")
  const [isEditingCustomer, setIsEditingCustomer] = useState(false)
  const [orgFieldValues, setOrgFieldValues] = useState<Record<string, string | number | null>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [savingAction, setSavingAction] = useState<string | null>(null)
  const [isRequestingInfo, setIsRequestingInfo] = useState(false)
  const [isEmailSectionOpen, setIsEmailSectionOpen] = useState(false)
  const [editableClarificationMessage, setEditableClarificationMessage] = useState("")
  const [isApprovalEmailSectionOpen, setIsApprovalEmailSectionOpen] = useState(false)
  const [editableApprovalEmail, setEditableApprovalEmail] = useState("")
  const [isLoadingApprovalEmail, setIsLoadingApprovalEmail] = useState(false)
  const [sendApprovalEmail, setSendApprovalEmail] = useState(false) // Toggle for sending approval email
  const [isRetrying, setIsRetrying] = useState(false)
  const [showRetryConfirm, setShowRetryConfirm] = useState(false)

  // ERP actions
  const [isPushingInvoice, setIsPushingInvoice] = useState(false)
  const [isCheckingPayment, setIsCheckingPayment] = useState(false)

  // Inline continuation result (replaces dialog)
  const [continueResult, setContinueResult] = useState<{
    isComplete: boolean
    clarificationMessage?: string
  } | null>(null)

  // Attachments state
  const [attachments, setAttachments] = useState<OrderAttachmentData[]>([])
  const [isLoadingAttachments, setIsLoadingAttachments] = useState(false)
  const [emailSectionTab, setEmailSectionTab] = useState<'email' | 'attachments'>('email')

  // Products state for SKU dropdown
  const [products, setProducts] = useState<Product[]>([])

  // Customer state for customer linking
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [suggestedCustomer, setSuggestedCustomer] = useState<Customer | null>(null)
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false)

  // Load products once when component mounts
  useEffect(() => {
    async function loadProducts() {
      const { products: loadedProducts } = await getProducts()
      setProducts(loadedProducts)
    }
    loadProducts()
  }, [])

  // Load customers once when component mounts
  useEffect(() => {
    async function loadCustomers() {
      setIsLoadingCustomers(true)
      const { customers: loadedCustomers } = await fetchCustomers()
      setCustomers(loadedCustomers)
      setIsLoadingCustomers(false)
    }
    loadCustomers()
  }, [])

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

      // Map deleted items from DB
      const mappedDeletedItems = order.deletedItems?.map((item) => ({
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
      setDeletedItems(mappedDeletedItems)
      setOriginalItems(mappedItems)
      setNotes(order.notes || "")
      setDeliveryDate(order.expected_date ? new Date(order.expected_date) : undefined)
      setShipVia(order.ship_via || "")
      setIncludeNotesInPdf(order.include_notes_in_pdf ?? false)
      setCompanyName(order.company_name || "")
      setContactName(order.contact_name || "")
      setIsEditingCustomer(false)

      // Load linked customer if exists
      if (order.customer_id) {
        fetchCustomer(order.customer_id).then(({ customer }) => {
          setSelectedCustomer(customer)
        })
      } else {
        setSelectedCustomer(null)
      }

      // Load suggested customer if exists
      if (order.suggested_customer_id) {
        fetchCustomer(order.suggested_customer_id).then(({ customer }) => {
          setSuggestedCustomer(customer)
        })
      } else {
        setSuggestedCustomer(null)
      }

      // Initialize org field values from order.custom_fields
      const initialOrgFields: Record<string, string | number | null> = {}
      const customFields = order.custom_fields || {}
      for (const field of orgRequiredFields) {
        const value = customFields[field.field]
        initialOrgFields[field.field] = value ?? null
      }
      setOrgFieldValues(initialOrgFields)

      setIsEmailSectionOpen(false)
      setIsApprovalEmailSectionOpen(false)
      setEditableApprovalEmail("")
      setContinueResult(null)
      setEditableClarificationMessage(order.clarification_message || "")

      // Fetch attachments for this order
      setIsLoadingAttachments(true)
      getOrderAttachmentsAction(order.id)
        .then(setAttachments)
        .catch((error) => {
          console.error('Failed to fetch attachments:', error)
          setAttachments([])
        })
        .finally(() => setIsLoadingAttachments(false))
    }
  }, [order, orgRequiredFields])

  // Auto-load approval email when in full mode and order is waiting_review
  // The email is always generated; the toggle only controls visibility and whether it's sent
  useEffect(() => {
    if (mode === "full" && order?.status === "waiting_review" && !editableApprovalEmail && !isLoadingApprovalEmail) {
      setIsLoadingApprovalEmail(true)
      generateApprovalEmailPreview(order.id, items, deletedItems)
        .then((preview) => {
          if (preview) setEditableApprovalEmail(preview)
        })
        .catch(console.error)
        .finally(() => setIsLoadingApprovalEmail(false))
    }
  }, [mode, order?.status, order?.id])

  // Compute dirty state - checks items, notes, dates, and org fields
  const isDirty = useMemo(() => {
    if (!order) return false

    // Check if items changed
    if (hasItemsChanged(items, originalItems)) return true

    // Check if notes changed
    if (notes !== (order.notes || "")) return true

    // Check if delivery date changed
    const originalDeliveryDate = order.expected_date ? new Date(order.expected_date) : undefined
    const deliveryDateChanged = deliveryDate?.toDateString() !== originalDeliveryDate?.toDateString()
    if (deliveryDateChanged) return true

    // Check if ship via changed
    if (shipVia !== (order.ship_via || "")) return true

    // Check if customer fields changed
    if (companyName !== (order.company_name || "")) return true
    if (contactName !== (order.contact_name || "")) return true

    // Check if linked customer changed
    const currentCustomerId = selectedCustomer?.id || null
    const originalCustomerId = order.customer_id || null
    if (currentCustomerId !== originalCustomerId) return true

    // Check if org fields changed
    const customFields = order.custom_fields || {}
    for (const field of orgRequiredFields) {
      const originalValue = customFields[field.field] ?? null
      const currentValue = orgFieldValues[field.field]
      if (currentValue !== originalValue) return true
    }

    return false
  }, [order, items, originalItems, notes, deliveryDate, shipVia, companyName, contactName, selectedCustomer, orgFieldValues, orgRequiredFields])

  // Check if clarification message was edited
  const isClarificationMessageDirty = useMemo(() => {
    if (!order) return false
    const originalMessage = order.clarification_message || ""
    return editableClarificationMessage !== originalMessage
  }, [order, editableClarificationMessage])

  // Compute completeness (using current edited field values)
  const completeness = useMemo(() => {
    if (!order) return null
    const editedFields: EditedFieldOverrides = { ship_via: shipVia }
    return calculateCompleteness(order, items, orgRequiredFields, editedFields)
  }, [order, items, orgRequiredFields, shipVia])

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

  // Delete item - moves item to deletedItems list instead of removing completely
  const deleteItem = (id: string) => {
    const itemToDelete = items.find((item) => item.id === id)
    if (itemToDelete) {
      // Only track non-new items (items that exist in the database)
      if (!itemToDelete.isNew) {
        setDeletedItems((prev) => [...prev, itemToDelete])
      }
      setItems((prev) => prev.filter((item) => item.id !== id))
    }
  }

  // Restore a deleted item back to the items list
  const restoreItem = (id: string) => {
    const itemToRestore = deletedItems.find((item) => item.id === id)
    if (itemToRestore) {
      setDeletedItems((prev) => prev.filter((item) => item.id !== id))
      setItems((prev) => [...prev, itemToRestore])
    }
  }

  // Handle product selection from combobox - auto-fill SKU, name, and unit_price
  const handleProductSelect = (itemId: string, product: Product) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item
        const newTotal = item.quantity * product.unit_price
        return {
          ...item,
          sku: product.sku,
          name: product.name,
          unit_price: String(product.unit_price),
          total: newTotal,
        }
      })
    )
  }

  // Handle save
  const handleSave = async () => {
    setIsSaving(true)
    setSavingAction("save")
    try {
      const deliveryDateStr = deliveryDate ? deliveryDate.toISOString().split('T')[0] : undefined
      await onSave(order.id, items, { notes, expected_date: deliveryDateStr, ship_via: shipVia || undefined, orgFields: orgFieldValues, include_notes_in_pdf: includeNotesInPdf, company_name: companyName || undefined, contact_name: contactName || undefined, customer_id: selectedCustomer?.id || null }, deletedItems)
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
      // Only send approval email if toggle is on, otherwise pass undefined to skip sending
      // We use a special marker "__SKIP_EMAIL__" to indicate no email should be sent
      const customEmail = sendApprovalEmail ? (editableApprovalEmail.trim() || undefined) : "__SKIP_EMAIL__"
      await onSaveAndApprove(order.id, items, { notes, expected_date: deliveryDateStr, ship_via: shipVia || undefined, orgFields: orgFieldValues, include_notes_in_pdf: includeNotesInPdf, company_name: companyName || undefined, contact_name: contactName || undefined, customer_id: selectedCustomer?.id || null }, customEmail, deletedItems)
      onClose()
    } finally {
      setIsSaving(false)
      setSavingAction(null)
    }
  }

  // Handle loading approval email preview when section is opened
  const handleApprovalEmailSectionToggle = async (open: boolean) => {
    setIsApprovalEmailSectionOpen(open)
    if (open && !editableApprovalEmail && order) {
      setIsLoadingApprovalEmail(true)
      try {
        const preview = await generateApprovalEmailPreview(order.id, items, deletedItems)
        if (preview) {
          setEditableApprovalEmail(preview)
        }
      } catch (error) {
        console.error('Failed to generate approval email preview:', error)
      } finally {
        setIsLoadingApprovalEmail(false)
      }
    }
  }

  // Handle Save & Continue (for dirty "needs info" orders)
  const handleSaveAndContinue = async () => {
    if (!onSaveAndAnalyze) return

    setIsSaving(true)
    setSavingAction("continue")
    try {
      const deliveryDateStr = deliveryDate ? deliveryDate.toISOString().split('T')[0] : undefined
      const result = await onSaveAndAnalyze(order.id, items, { notes, expected_date: deliveryDateStr, ship_via: shipVia || undefined, orgFields: orgFieldValues, include_notes_in_pdf: includeNotesInPdf, company_name: companyName || undefined, contact_name: contactName || undefined, customer_id: selectedCustomer?.id || null }, deletedItems)

      // Show inline result instead of dialog
      setContinueResult({
        isComplete: result.isComplete,
        clarificationMessage: result.clarificationMessage,
      })
      setEditableClarificationMessage(result.clarificationMessage || "")
      setOriginalItems([...items])
    } finally {
      setIsSaving(false)
      setSavingAction(null)
    }
  }

  // Handle Request Info (send clarification email)
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

  // Handle Approve from inline continue result
  const handleApproveFromContinue = async () => {
    setIsSaving(true)
    setSavingAction("approve")
    try {
      const deliveryDateStr = deliveryDate ? deliveryDate.toISOString().split('T')[0] : undefined
      await onSaveAndApprove(order.id, items, { notes, expected_date: deliveryDateStr, ship_via: shipVia || undefined, include_notes_in_pdf: includeNotesInPdf, company_name: companyName || undefined, contact_name: contactName || undefined, customer_id: selectedCustomer?.id || null }, undefined, deletedItems)
      setContinueResult(null)
      onClose()
    } finally {
      setIsSaving(false)
      setSavingAction(null)
    }
  }

  // Handle Send from inline continue result
  const handleSendFromContinue = async () => {
    if (!onRequestInfo || !editableClarificationMessage) return

    setIsRequestingInfo(true)
    try {
      await onRequestInfo(order.id, editableClarificationMessage)
      setContinueResult(null)
      onClose()
    } catch (error) {
      console.error("Failed to send clarification request:", error)
    } finally {
      setIsRequestingInfo(false)
    }
  }

  // Handle dismiss continue result
  const handleDismissContinueResult = async () => {
    if (isClarificationMessageDirty && onSaveClarificationMessage && order) {
      try {
        await onSaveClarificationMessage(order.id, editableClarificationMessage)
      } catch (error) {
        console.error('Failed to save clarification message:', error)
      }
    }
    setContinueResult(null)
  }

  // Handle retry processing
  const handleRetry = async () => {
    if (!onRetry || !order) return

    setIsRetrying(true)
    setShowRetryConfirm(false)
    try {
      const result = await onRetry(order.id)
      if (result.success) {
        // Close and let the list refresh with new data
        onClose()
      } else {
        console.error('Retry failed:', result.error)
        // Could show an error toast here
      }
    } catch (error) {
      console.error('Error during retry:', error)
    } finally {
      setIsRetrying(false)
    }
  }

  // Handle push invoice to ERP
  const handlePushInvoice = async () => {
    if (!order) return
    setIsPushingInvoice(true)
    try {
      const result = await pushInvoiceToErp(order.id)
      if (result.success) {
        onClose()
      } else {
        console.error('Failed to push invoice:', result.error)
      }
    } catch (error) {
      console.error('Error pushing invoice:', error)
    } finally {
      setIsPushingInvoice(false)
    }
  }

  // Handle check payment status
  const handleCheckPayment = async () => {
    if (!order) return
    setIsCheckingPayment(true)
    try {
      const result = await checkInvoiceStatus(order.id)
      if (result.success) {
        onClose()
      } else {
        console.error('Failed to check payment:', result.error)
      }
    } catch (error) {
      console.error('Error checking payment:', error)
    } finally {
      setIsCheckingPayment(false)
    }
  }

  const isNeedsInfo = order.status === "awaiting_clarification"
  const isPendingReview = order.status === "waiting_review"
  const isApproved = order.status === "approved"
  const isInvoiced = order.status === "invoiced"
  const isPaid = order.status === "paid"
  const isArchived = order.status === "archived"
  const hasClarificationMessage = order.clarification_message !== null && order.clarification_message !== undefined

  // Completeness color class
  const completenessColorClass = completeness
    ? completeness.percentage === 100
      ? order.status === "approved" ? "text-emerald-600" : "text-blue-600"
      : completeness.percentage >= 70
      ? "text-amber-600"
      : "text-[hsl(var(--attention-600))]"
    : ""

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        hideCloseButton
        className={cn(
          "p-0 flex flex-col",
          "border-l border-slate-200/60",
          "shadow-[-20px_0_50px_rgba(15,23,42,0.08)]"
        )}
        style={{ width: PANEL_WIDTHS[mode] }}
      >
        {/* Accessibility: Hidden title for screen readers */}
        <VisuallyHidden.Root>
          <SheetTitle>Edit Order {order.order_number}</SheetTitle>
        </VisuallyHidden.Root>

        {/* Panel Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/60 shrink-0 bg-white">
          {/* Left: Order info */}
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-900">
              {order.order_number}
            </h2>
            <Badge
              variant="outline"
              className={cn(
                "text-xs font-medium px-2.5 py-0.5 rounded-full border-0",
                order.status === "waiting_review"
                  ? "bg-[hsl(var(--status-pending-bg))] text-[hsl(var(--status-pending-text))]"
                  : order.status === "awaiting_clarification"
                  ? "bg-[hsl(var(--status-needs-info-bg))] text-[hsl(var(--status-needs-info-text))]"
                  : order.status === "approved"
                  ? "bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved-text))]"
                  : order.status === "invoiced"
                  ? "bg-[hsl(var(--status-invoiced-bg))] text-[hsl(var(--status-invoiced-text))]"
                  : order.status === "paid"
                  ? "bg-[hsl(var(--status-paid-bg))] text-[hsl(var(--status-paid-text))]"
                  : "bg-[hsl(var(--status-archived-bg))] text-[hsl(var(--status-archived-text))]"
              )}
            >
              {order.status === "waiting_review"
                ? "Pending Review"
                : order.status === "awaiting_clarification"
                ? "Needs Info"
                : order.status === "approved"
                ? "Approved"
                : order.status === "invoiced"
                ? "Invoiced"
                : order.status === "paid"
                ? "Paid"
                : order.status.replace("_", " ")}
            </Badge>
            {/* Completeness indicator */}
            {completeness && (
              <span className={cn("text-sm font-medium", completenessColorClass)}>
                {completeness.percentage}% Complete
              </span>
            )}
            {/* Source indicator */}
            {order.source === "email" && <Mail className="h-4 w-4 text-slate-400" />}
            {order.source === "text" && <MessageSquare className="h-4 w-4 text-slate-400" />}
            {order.source === "voicemail" && <Voicemail className="h-4 w-4 text-slate-400" />}
            {order.source === "spreadsheet" && <FileSpreadsheet className="h-4 w-4 text-slate-400" />}
            {order.source === "pdf" && <FileText className="h-4 w-4 text-slate-400" />}
          </div>

          {/* Right: Action buttons + Controls */}
          <div className="flex items-center gap-2">
            {/* Action buttons (non-archived) */}
            {!isArchived && !continueResult && (
              <>
                {/* Needs Info - Clean State: Request Info button */}
                {isNeedsInfo && !isDirty && (
                  <>
                    {hasClarificationMessage ? (
                      <Button
                        size="sm"
                        className="h-8 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
                        onClick={handleRequestInfo}
                        disabled={isSaving || isRequestingInfo || !editableClarificationMessage.trim()}
                      >
                        {isRequestingInfo ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Request Info
                      </Button>
                    ) : (
                      <Button disabled variant="secondary" size="sm" className="h-8 px-3 rounded-lg">
                        Request Sent
                      </Button>
                    )}
                  </>
                )}

                {/* Needs Info - Dirty State: Save & Continue button */}
                {isNeedsInfo && isDirty && onSaveAndAnalyze && (
                  <Button
                    size="sm"
                    className="h-8 px-3 rounded-lg bg-[hsl(var(--action))] hover:bg-[hsl(var(--action))]/90 text-white shadow-sm"
                    onClick={handleSaveAndContinue}
                    disabled={isSaving}
                  >
                    {savingAction === "continue" ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : null}
                    Save & Continue
                  </Button>
                )}

                {/* Pending Review: Save and Save & Approve */}
                {isPendingReview && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSave}
                      disabled={isSaving}
                      className="h-8 px-3 rounded-lg border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      {savingAction === "save" ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : null}
                      Save
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveAndApprove}
                      disabled={isSaving}
                      className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                    >
                      {savingAction === "approve" ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : null}
                      Save & Approve
                    </Button>
                  </>
                )}

                {/* Approved: Save + Create Invoice */}
                {isApproved && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSave}
                      disabled={isSaving}
                      className="h-8 px-3 rounded-lg border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      {savingAction === "save" ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : null}
                      Save
                    </Button>
                    {!order.erp_entity_id && (
                      <Button
                        size="sm"
                        onClick={handlePushInvoice}
                        disabled={isPushingInvoice || isSaving}
                        className="h-8 px-3 rounded-lg bg-sky-600 hover:bg-sky-700 text-white shadow-sm"
                      >
                        {isPushingInvoice ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <Building2 className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Create Invoice
                      </Button>
                    )}
                  </>
                )}

                {/* Invoiced: Check Payment Status */}
                {isInvoiced && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCheckPayment}
                    disabled={isCheckingPayment}
                    className="h-8 px-3 rounded-lg border-teal-300 text-teal-700 hover:bg-teal-50"
                  >
                    {isCheckingPayment ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Check Payment
                  </Button>
                )}
              </>
            )}

            {/* Retry button - available for email orders that need AI reprocessing (not complete, approved, or archived) */}
            {!isArchived && !isApproved && !isPendingReview && order.source === "email" && onRetry && (
              showRetryConfirm ? (
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowRetryConfirm(false)}
                    disabled={isRetrying}
                    className="h-8 px-2 text-slate-500 hover:text-slate-700"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetry}
                    disabled={isRetrying}
                    className="h-8 px-3 rounded-lg border-violet-300 text-violet-600 hover:bg-violet-50"
                  >
                    {isRetrying ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : null}
                    Confirm
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRetryConfirm(true)}
                  disabled={isSaving || isRetrying}
                  className="h-8 px-3 rounded-lg border-violet-300 text-violet-600 hover:bg-violet-50"
                  title="Re-run AI processing on this order"
                >
                  {isRetrying ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Retry
                </Button>
              )
            )}

            {/* Divider between actions and controls */}
            {!isArchived && !continueResult && (
              <div className="w-px h-6 bg-slate-200 mx-1" />
            )}

            {/* Fullscreen toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onModeChange(mode === "full" ? "peek" : "full")}
              className="h-8 w-8 text-slate-400 hover:text-slate-600"
            >
              {mode === "full" ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>

            {/* Close */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Panel Body - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Inline Continue Result Banner - Always full width at top */}
          {continueResult && (
            <div className={cn(
              "rounded-xl p-4 mb-5",
              continueResult.isComplete
                ? "bg-emerald-50 border border-emerald-200/60"
                : "bg-amber-50 border border-amber-200/60"
            )}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  {continueResult.isComplete ? (
                    <CheckCircle className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <p className="font-medium text-slate-900">
                      {continueResult.isComplete ? "Order Complete" : "Still Missing Information"}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      {continueResult.isComplete
                        ? "Ready for approval"
                        : "Review the clarification message below"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDismissContinueResult}
                    className="h-8 text-xs"
                  >
                    {continueResult.isComplete ? "Review Later" : "Send Later"}
                  </Button>
                  {continueResult.isComplete ? (
                    <Button
                      size="sm"
                      onClick={handleApproveFromContinue}
                      disabled={isSaving}
                      className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {savingAction === "approve" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                      Approve Now
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={handleSendFromContinue}
                      disabled={isRequestingInfo || !editableClarificationMessage}
                      className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      {isRequestingInfo ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Send className="h-3 w-3 mr-1" />
                      )}
                      Send Request
                    </Button>
                  )}
                </div>
              </div>
              {/* Clarification message editor when not complete */}
              {!continueResult.isComplete && (
                <div className="mt-4">
                  <Textarea
                    value={editableClarificationMessage}
                    onChange={(e) => setEditableClarificationMessage(e.target.value)}
                    rows={4}
                    className="text-sm bg-white border-amber-200 focus:ring-2 focus:ring-amber-200 focus:border-amber-300 resize-none"
                    placeholder="Enter clarification message..."
                  />
                </div>
              )}
            </div>
          )}

          {/* Two-column layout when expanded, single column when peek */}
          {mode === "full" ? (
            /* FULL MODE: Two-column grid layout */
            <div className="grid grid-cols-2 gap-6">
              {/* LEFT COLUMN: Customer Info + Clarification/Approval Email */}
              <div className="space-y-5">
                {/* Customer Linking */}
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
                      {!selectedCustomer && (
                        <span className="text-xs text-[hsl(var(--attention-700))] bg-[hsl(var(--attention-100))] px-2 py-0.5 rounded-full">
                          Required
                        </span>
                      )}
                    </div>
                    {!isEditingCustomer && selectedCustomer && (
                      <button
                        onClick={() => setIsEditingCustomer(true)}
                        className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <Pencil className="h-3 w-3" />
                        <span>Change</span>
                      </button>
                    )}
                  </div>

                  {/* Customer Combobox - show when no customer selected or editing */}
                  {(!selectedCustomer || isEditingCustomer) && (
                    <div className="space-y-3">
                      <CustomerCombobox
                        customers={customers}
                        selectedCustomer={selectedCustomer}
                        suggestedCustomer={suggestedCustomer}
                        suggestionConfidence={order.suggested_customer_confidence ?? undefined}
                        onCustomerSelect={(customer) => {
                          setSelectedCustomer(customer)
                          // Auto-fill company name from customer
                          if (customer) {
                            setCompanyName(customer.name)
                            if (customer.primary_contact_name) {
                              setContactName(customer.primary_contact_name)
                            }
                          }
                          setIsEditingCustomer(false)
                        }}
                        onCreateNew={async (name) => {
                          // Create a new customer and link to order
                          const result = await createCustomerAndLinkToOrder(
                            { name, primary_contact_name: contactName || undefined },
                            order.id
                          )
                          if (result.customer) {
                            setSelectedCustomer(result.customer)
                            setCompanyName(result.customer.name)
                            // Refresh customers list
                            const { customers: updatedCustomers } = await fetchCustomers()
                            setCustomers(updatedCustomers)
                          }
                          setIsEditingCustomer(false)
                        }}
                      />

                      {/* Show extracted info from email */}
                      {companyName && !selectedCustomer && (
                        <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2">
                          <span className="font-medium">From email:</span> {companyName}
                          {contactName && ` (${contactName})`}
                        </div>
                      )}

                      {isEditingCustomer && (
                        <div className="flex justify-end">
                          <button
                            onClick={() => setIsEditingCustomer(false)}
                            className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Show selected customer details when not editing */}
                  {selectedCustomer && !isEditingCustomer && (
                    <div className="text-slate-900">
                      <p className="font-medium">{selectedCustomer.name}</p>
                      {selectedCustomer.customer_number && (
                        <p className="text-xs text-slate-500">#{selectedCustomer.customer_number}</p>
                      )}
                      {selectedCustomer.primary_contact_name && (
                        <p className="text-sm text-slate-500 mt-0.5">
                          {selectedCustomer.primary_contact_name}
                          {selectedCustomer.primary_contact_email && ` · ${selectedCustomer.primary_contact_email}`}
                        </p>
                      )}
                      {selectedCustomer.primary_contact_phone && (
                        <p className="text-sm text-slate-500">{selectedCustomer.primary_contact_phone}</p>
                      )}
                      {selectedCustomer.total_orders > 0 && (
                        <p className="text-xs text-slate-400 mt-2">
                          {selectedCustomer.total_orders} orders · ${selectedCustomer.total_spend.toLocaleString()} total
                        </p>
                      )}
                    </div>
                  )}

                  {/* Source email — always read-only */}
                  {order.original_email_from && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-xs text-slate-400">Source</p>
                      <p className="text-sm text-slate-500 mt-0.5">{order.original_email_from}</p>
                    </div>
                  )}
                </motion.div>

                {/* Original Email Section */}
                {order.original_email_body && (
                  <motion.div
                    className="bg-white border border-slate-200/60 rounded-xl p-4"
                    custom={1}
                    initial="hidden"
                    animate="visible"
                    variants={sectionVariants}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                          Original Email
                        </h3>
                        {order.email_url && (
                          <a
                            href={order.email_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            <Mail className="h-3 w-3" />
                            <span>View in Inbox</span>
                          </a>
                        )}
                      </div>

                      {/* Email / Attachments tab bar — inline with title */}
                      {(!isLoadingAttachments && attachments.length > 0) && (
                        <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
                          <button
                            onClick={() => setEmailSectionTab('email')}
                            className={cn(
                              "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                              emailSectionTab === 'email'
                                ? "bg-white text-slate-900 shadow-sm"
                                : "text-slate-500 hover:text-slate-700"
                            )}
                          >
                            Email
                          </button>
                          <button
                            onClick={() => setEmailSectionTab('attachments')}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors",
                              emailSectionTab === 'attachments'
                                ? "bg-white text-slate-900 shadow-sm"
                                : "text-slate-500 hover:text-slate-700"
                            )}
                          >
                            <Paperclip className="h-3 w-3" />
                            Attachments
                            <span className={cn(
                              "inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[10px] font-semibold",
                              emailSectionTab === 'attachments'
                                ? "bg-slate-200 text-slate-700"
                                : "bg-blue-100 text-blue-700"
                            )}>
                              {attachments.length}
                            </span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Tab content */}
                    {emailSectionTab === 'email' ? (
                      <>
                        {/* Email metadata: From and Date */}
                        <div className="flex items-center justify-between mb-3 text-sm">
                          <div className="text-slate-500">
                            <span className="text-slate-400">From: </span>
                            <span>{order.original_email_from || 'Unknown'}</span>
                          </div>
                          {order.original_email_date && (
                            <div className="text-slate-400">
                              {new Date(order.original_email_date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })} at {new Date(order.original_email_date).toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true,
                              })}
                            </div>
                          )}
                        </div>
                        <div className="bg-slate-50 rounded-lg overflow-hidden max-h-[600px] overflow-y-auto">
                          {order.original_email_body_html ? (
                            <EmailHtmlViewer html={order.original_email_body_html} />
                          ) : (
                            <pre className="text-sm text-slate-600 whitespace-pre-wrap font-sans p-3">
                              {order.original_email_body}
                            </pre>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Attachments tab content */}
                        {isLoadingAttachments ? (
                          <div className="flex items-center justify-center py-8 text-slate-400">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            <span className="text-sm">Loading attachments...</span>
                          </div>
                        ) : (
                          <AttachmentViewer attachments={attachments} compact />
                        )}
                      </>
                    )}
                  </motion.div>
                )}

                {/* Clarification Email Section */}
                {isNeedsInfo && hasClarificationMessage && !continueResult && (
                  <motion.div
                    className="bg-white border border-slate-200/60 rounded-xl p-4"
                    custom={2}
                    initial="hidden"
                    animate="visible"
                    variants={sectionVariants}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                        Clarification Email
                      </h3>
                    </div>
                    {isDirty ? (
                      <div className="bg-amber-50 border border-amber-200/60 rounded-lg p-3 flex items-start gap-3">
                        <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                        <div className="text-sm">
                          <p className="font-medium text-slate-700">You've made changes</p>
                          <p className="text-slate-500 mt-0.5">A new clarification email will be generated based on your edits when you save.</p>
                        </div>
                      </div>
                    ) : (
                      <Textarea
                        value={editableClarificationMessage}
                        onChange={(e) => setEditableClarificationMessage(e.target.value)}
                        rows={12}
                        className="text-sm bg-white border-slate-200 focus:ring-2 focus:ring-slate-200 focus:border-slate-300 resize-none"
                        placeholder="Enter clarification message..."
                      />
                    )}
                  </motion.div>
                )}

                {/* Approval Email Section */}
                {isPendingReview && (
                  <motion.div
                    className="bg-white border border-slate-200/60 rounded-xl p-4"
                    custom={2}
                    initial="hidden"
                    animate="visible"
                    variants={sectionVariants}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                        Approval Email
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Auto-send</span>
                        <Switch
                          checked={sendApprovalEmail}
                          onCheckedChange={setSendApprovalEmail}
                        />
                      </div>
                    </div>
                    {sendApprovalEmail && (
                      isLoadingApprovalEmail ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                          <span className="ml-2 text-sm text-slate-500">Loading email preview...</span>
                        </div>
                      ) : (
                        <Textarea
                          value={editableApprovalEmail}
                          onChange={(e) => setEditableApprovalEmail(e.target.value)}
                          rows={12}
                          className="text-sm bg-white border-slate-200 focus:ring-2 focus:ring-slate-200 focus:border-slate-300 resize-none font-mono"
                          placeholder="Approval email content..."
                        />
                      )
                    )}
                  </motion.div>
                )}
              </div>

              {/* RIGHT COLUMN: Items, Order Details, Additional Info, Total */}
              <div className="space-y-5">
              {/* Items Table */}
              <motion.div
                custom={mode === "full" ? 0 : 1}
                initial="hidden"
                animate="visible"
                variants={sectionVariants}
              >
                <ItemsTable
                  items={items}
                  deletedItems={deletedItems}
                  completeness={completeness}
                  inferredFields={order.inferred_fields}
                  readOnly={isArchived}
                  products={products}
                  onUpdateItem={updateItem}
                  onDeleteItem={deleteItem}
                  onRestoreItem={restoreItem}
                  onAddItem={addItem}
                  onProductSelect={handleProductSelect}
                />
              </motion.div>

              {/* Order Details */}
              <motion.div
                className="bg-white border border-slate-200/60 rounded-xl p-4"
                custom={mode === "full" ? 1 : 2}
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
                      disabled={isArchived}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600">
                      Ship Via <span className="text-red-500">*</span>
                    </Label>
                    <Select value={shipVia} onValueChange={setShipVia} disabled={isArchived}>
                      <SelectTrigger className={cn(
                        "bg-white border-slate-200 focus:ring-2 focus:ring-slate-200 focus:border-slate-300",
                        isArchived && "bg-slate-50 text-slate-500 cursor-not-allowed",
                        !shipVia && "border-red-300"
                      )}>
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
                  <div className="flex items-center justify-between">
                    <Label htmlFor="notes" className="text-xs text-slate-600">Notes</Label>
                    <div className="flex items-center gap-1.5">
                      <Checkbox
                        id="include-notes-pdf"
                        checked={includeNotesInPdf}
                        onCheckedChange={(checked) => setIncludeNotesInPdf(checked === true)}
                        disabled={isArchived}
                        className="h-3.5 w-3.5"
                      />
                      <Label
                        htmlFor="include-notes-pdf"
                        className="text-xs text-slate-400 cursor-pointer"
                      >
                        Include in PDF
                      </Label>
                    </div>
                  </div>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={isArchived ? "" : "Add any notes about this order..."}
                    rows={3}
                    disabled={isArchived}
                    className={cn(
                      "bg-white border-slate-200 focus:ring-2 focus:ring-slate-200 focus:border-slate-300 resize-none",
                      isArchived && "bg-slate-50 text-slate-500 cursor-not-allowed"
                    )}
                  />
                </div>
              </motion.div>

              {/* Additional Info - Org-Specific Required Fields */}
              {orgRequiredFields.length > 0 && (
                <motion.div
                  className="bg-white border border-slate-200/60 rounded-xl p-4"
                  custom={mode === "full" ? 2 : 3}
                  initial="hidden"
                  animate="visible"
                  variants={sectionVariants}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      Additional Info
                    </h3>
                    {!isArchived && (() => {
                      const missingOrgFields = orgRequiredFields.filter(f => {
                        if (!f.required) return false
                        const value = orgFieldValues[f.field]
                        return value === null || value === undefined || value === ''
                      })
                      return missingOrgFields.length > 0 ? (
                        <span className="text-xs text-[hsl(var(--attention-700))] bg-[hsl(var(--attention-100))] px-2 py-0.5 rounded-full">
                          {missingOrgFields.length} field{missingOrgFields.length > 1 ? 's' : ''} need{missingOrgFields.length === 1 ? 's' : ''} attention
                        </span>
                      ) : null
                    })()}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {orgRequiredFields.map((field) => {
                      const value = orgFieldValues[field.field]
                      const displayValue = value !== null && value !== undefined ? String(value) : ''
                      const isMissing = !isArchived && field.required && (!displayValue || displayValue === '')
                      return (
                        <div key={field.field} className="space-y-1.5">
                          <Label className={`text-xs ${isMissing ? 'text-[hsl(var(--attention-700))]' : 'text-slate-600'}`}>
                            {field.label}
                            {!isArchived && field.required && <span className="text-[hsl(var(--attention-500))] ml-0.5">*</span>}
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
                            disabled={isArchived}
                            className={cn(
                              "bg-white border-slate-200 focus:ring-2 focus:ring-slate-200 focus:border-slate-300",
                              isMissing && "border-[hsl(var(--attention-200))] bg-[hsl(var(--attention-50))]/50",
                              isArchived && "bg-slate-50 text-slate-500 cursor-not-allowed"
                            )}
                            placeholder={isArchived ? "" : `Enter ${field.label.toLowerCase()}`}
                          />
                          {isMissing && (
                            <p className="text-[11px] text-[hsl(var(--attention-600))]">Required</p>
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
                custom={3}
                initial="hidden"
                animate="visible"
                variants={sectionVariants}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-slate-600">Order Total</span>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {items.length} item{items.length !== 1 ? "s" : ""}
                      {deletedItems.length > 0 && (
                        <span className="text-slate-400"> · {deletedItems.length} removed</span>
                      )}
                    </p>
                  </div>
                  <span className="text-2xl font-semibold text-slate-900">${calculateOrderTotal().toFixed(2)}</span>
                </div>

                {/* Deleted Items Summary */}
                {deletedItems.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Removed from order</p>
                    <div className="space-y-1">
                      {deletedItems.map((item) => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span className="text-slate-400">{item.name}</span>
                          <span className="text-slate-400">-${item.total.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>

              {/* ERP Sync Status */}
              {(order.erp_entity_id || order.erp_sync_status === 'error') && (
                <motion.div
                  className="bg-white border border-slate-200/60 rounded-xl p-4"
                  custom={4}
                  initial="hidden"
                  animate="visible"
                  variants={sectionVariants}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 className="h-4 w-4 text-slate-400" />
                    <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      ERP Invoice
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {order.erp_sync_status === 'error' && (
                      <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-lg p-2.5">
                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>{order.erp_sync_error || 'Sync failed'}</span>
                      </div>
                    )}
                    {order.erp_entity_id && (
                      <>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">Invoice</span>
                          <span className="font-medium text-slate-700">{order.erp_display_name || order.erp_entity_id}</span>
                        </div>
                        {order.erp_synced_at && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500">Last synced</span>
                            <span className="text-slate-600">{new Date(order.erp_synced_at).toLocaleString()}</span>
                          </div>
                        )}
                      </>
                    )}
                    {isInvoiced && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCheckPayment}
                        disabled={isCheckingPayment}
                        className="w-full mt-2 border-teal-200 text-teal-700 hover:bg-teal-50"
                      >
                        {isCheckingPayment ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Check Payment Status
                      </Button>
                    )}
                    {isApproved && !order.erp_entity_id && (
                      <Button
                        size="sm"
                        onClick={handlePushInvoice}
                        disabled={isPushingInvoice}
                        className="w-full mt-2 bg-sky-600 hover:bg-sky-700 text-white"
                      >
                        {isPushingInvoice ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <Building2 className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Retry Create Invoice
                      </Button>
                    )}
                  </div>
                </motion.div>
              )}
              </div>
            </div>
          ) : (
            /* PEEK MODE: Single column with logical order */
            <div className="space-y-5">
              {/* Customer Info */}
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
                    {completeness && completeness.missingRequiredFields.some(f =>
                      f === 'Company Name'
                    ) && (
                      <span className="text-xs text-[hsl(var(--attention-700))] bg-[hsl(var(--attention-100))] px-2 py-0.5 rounded-full">
                        Missing
                      </span>
                    )}
                  </div>
                  {!isEditingCustomer && (
                    <button
                      onClick={() => setIsEditingCustomer(true)}
                      className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <Pencil className="h-3 w-3" />
                      <span>Edit</span>
                    </button>
                  )}
                </div>

                {isEditingCustomer ? (
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs text-slate-500">Company Name *</Label>
                      <Input
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Company name (required)"
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Contact Name *</Label>
                      <Input
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="Contact name (required)"
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => setIsEditingCustomer(false)}
                        className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={`${!companyName ? 'text-[hsl(var(--attention-700))]' : 'text-slate-900'}`}>
                    <p className="font-medium">
                      {companyName || "Unknown Company"}
                      {!companyName && (
                        <span className="ml-2 text-xs font-normal text-[hsl(var(--attention-500))]">(required)</span>
                      )}
                    </p>
                    {contactName ? (
                      <p className="text-sm text-slate-500 mt-0.5">
                        {contactName}
                        {order.contact_email && ` · ${order.contact_email}`}
                      </p>
                    ) : (
                      <p className="text-sm text-[hsl(var(--attention-500))] mt-0.5">
                        No contact name <span className="text-xs">(required)</span>
                      </p>
                    )}
                    {order.phone && (
                      <p className="text-sm text-slate-500">{order.phone}</p>
                    )}
                  </div>
                )}

                {/* Source email — always read-only */}
                {order.original_email_from && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-xs text-slate-400">Source</p>
                    <p className="text-sm text-slate-500 mt-0.5">{order.original_email_from}</p>
                  </div>
                )}
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
                  deletedItems={deletedItems}
                  completeness={completeness}
                  inferredFields={order.inferred_fields}
                  readOnly={isArchived}
                  products={products}
                  onUpdateItem={updateItem}
                  onDeleteItem={deleteItem}
                  onRestoreItem={restoreItem}
                  onAddItem={addItem}
                  onProductSelect={handleProductSelect}
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
                      disabled={isArchived}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600">
                      Ship Via <span className="text-red-500">*</span>
                    </Label>
                    <Select value={shipVia} onValueChange={setShipVia} disabled={isArchived}>
                      <SelectTrigger className={cn(
                        "bg-white border-slate-200 focus:ring-2 focus:ring-slate-200 focus:border-slate-300",
                        isArchived && "bg-slate-50 text-slate-500 cursor-not-allowed",
                        !shipVia && "border-red-300"
                      )}>
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
                  <div className="flex items-center justify-between">
                    <Label htmlFor="notes-peek" className="text-xs text-slate-600">Notes</Label>
                    <div className="flex items-center gap-1.5">
                      <Checkbox
                        id="include-notes-pdf-peek"
                        checked={includeNotesInPdf}
                        onCheckedChange={(checked) => setIncludeNotesInPdf(checked === true)}
                        disabled={isArchived}
                        className="h-3.5 w-3.5"
                      />
                      <Label
                        htmlFor="include-notes-pdf-peek"
                        className="text-xs text-slate-400 cursor-pointer"
                      >
                        Include in PDF
                      </Label>
                    </div>
                  </div>
                  <Textarea
                    id="notes-peek"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={isArchived ? "" : "Add any notes about this order..."}
                    rows={3}
                    disabled={isArchived}
                    className={cn(
                      "bg-white border-slate-200 focus:ring-2 focus:ring-slate-200 focus:border-slate-300 resize-none",
                      isArchived && "bg-slate-50 text-slate-500 cursor-not-allowed"
                    )}
                  />
                </div>
              </motion.div>

              {/* Additional Info - Org-Specific Required Fields */}
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
                    {!isArchived && (() => {
                      const missingOrgFields = orgRequiredFields.filter(f => {
                        if (!f.required) return false
                        const value = orgFieldValues[f.field]
                        return value === null || value === undefined || value === ''
                      })
                      return missingOrgFields.length > 0 ? (
                        <span className="text-xs text-[hsl(var(--attention-700))] bg-[hsl(var(--attention-100))] px-2 py-0.5 rounded-full">
                          {missingOrgFields.length} field{missingOrgFields.length > 1 ? 's' : ''} need{missingOrgFields.length === 1 ? 's' : ''} attention
                        </span>
                      ) : null
                    })()}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {orgRequiredFields.map((field) => {
                      const value = orgFieldValues[field.field]
                      const displayValue = value !== null && value !== undefined ? String(value) : ''
                      const isMissing = !isArchived && field.required && (!displayValue || displayValue === '')
                      return (
                        <div key={field.field} className="space-y-1.5">
                          <Label className={`text-xs ${isMissing ? 'text-[hsl(var(--attention-700))]' : 'text-slate-600'}`}>
                            {field.label}
                            {!isArchived && field.required && <span className="text-[hsl(var(--attention-500))] ml-0.5">*</span>}
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
                            disabled={isArchived}
                            className={cn(
                              "bg-white border-slate-200 focus:ring-2 focus:ring-slate-200 focus:border-slate-300",
                              isMissing && "border-[hsl(var(--attention-200))] bg-[hsl(var(--attention-50))]/50",
                              isArchived && "bg-slate-50 text-slate-500 cursor-not-allowed"
                            )}
                            placeholder={isArchived ? "" : `Enter ${field.label.toLowerCase()}`}
                          />
                          {isMissing && (
                            <p className="text-[11px] text-[hsl(var(--attention-600))]">Required</p>
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

                {/* Deleted Items Summary */}
                {deletedItems.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Removed from order</p>
                    <div className="space-y-1">
                      {deletedItems.map((item) => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span className="text-slate-400">{item.name}</span>
                          <span className="text-slate-400">-${item.total.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>

              {/* ERP Sync Status - Peek mode */}
              {(order.erp_entity_id || order.erp_sync_status === 'error') && (
                <motion.div
                  className="bg-white border border-slate-200/60 rounded-xl p-4"
                  custom={5}
                  initial="hidden"
                  animate="visible"
                  variants={sectionVariants}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 className="h-4 w-4 text-slate-400" />
                    <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      ERP Invoice
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {order.erp_sync_status === 'error' && (
                      <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-lg p-2.5">
                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>{order.erp_sync_error || 'Sync failed'}</span>
                      </div>
                    )}
                    {order.erp_entity_id && (
                      <>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">Invoice</span>
                          <span className="font-medium text-slate-700">{order.erp_display_name || order.erp_entity_id}</span>
                        </div>
                        {order.erp_synced_at && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500">Last synced</span>
                            <span className="text-slate-600">{new Date(order.erp_synced_at).toLocaleString()}</span>
                          </div>
                        )}
                      </>
                    )}
                    {isInvoiced && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCheckPayment}
                        disabled={isCheckingPayment}
                        className="w-full mt-2 border-teal-200 text-teal-700 hover:bg-teal-50"
                      >
                        {isCheckingPayment ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Check Payment Status
                      </Button>
                    )}
                    {isApproved && !order.erp_entity_id && (
                      <Button
                        size="sm"
                        onClick={handlePushInvoice}
                        disabled={isPushingInvoice}
                        className="w-full mt-2 bg-sky-600 hover:bg-sky-700 text-white"
                      >
                        {isPushingInvoice ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <Building2 className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Retry Create Invoice
                      </Button>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Clarification Email Section - At bottom in peek mode */}
              {isNeedsInfo && hasClarificationMessage && !continueResult && (
                <motion.div
                  className="bg-white border border-slate-200/60 rounded-xl p-4"
                  custom={5}
                  initial="hidden"
                  animate="visible"
                  variants={sectionVariants}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      Clarification Email
                    </h3>
                    {!isDirty && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsEmailSectionOpen(!isEmailSectionOpen)}
                        className="h-6 px-2 text-xs text-slate-500 hover:text-slate-700"
                      >
                        {isEmailSectionOpen ? "Close" : "View & Edit"}
                      </Button>
                    )}
                  </div>
                  {isDirty ? (
                    <div className="bg-amber-50 border border-amber-200/60 rounded-lg p-3 flex items-start gap-3">
                      <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      <div className="text-sm">
                        <p className="font-medium text-slate-700">You've made changes</p>
                        <p className="text-slate-500 mt-0.5">A new clarification email will be generated based on your edits when you save.</p>
                      </div>
                    </div>
                  ) : isEmailSectionOpen ? (
                    <Textarea
                      value={editableClarificationMessage}
                      onChange={(e) => setEditableClarificationMessage(e.target.value)}
                      rows={8}
                      className="text-sm bg-white border-slate-200 focus:ring-2 focus:ring-slate-200 focus:border-slate-300 resize-none"
                      placeholder="Enter clarification message..."
                    />
                  ) : (
                    <div className="relative">
                      <pre className="text-sm text-slate-600 whitespace-pre-wrap font-sans max-h-24 overflow-hidden">
                        {editableClarificationMessage || "No clarification message"}
                      </pre>
                      {editableClarificationMessage && editableClarificationMessage.length > 200 && (
                        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent" />
                      )}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Approval Email Section - At bottom in peek mode */}
              {isPendingReview && (
                <motion.div
                  className="bg-white border border-slate-200/60 rounded-xl p-4"
                  custom={5}
                  initial="hidden"
                  animate="visible"
                  variants={sectionVariants}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      Approval Email
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">Auto-send</span>
                      <Switch
                        checked={sendApprovalEmail}
                        onCheckedChange={setSendApprovalEmail}
                      />
                    </div>
                  </div>
                  {sendApprovalEmail && (
                    <>
                      <div className="flex justify-end mb-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleApprovalEmailSectionToggle(!isApprovalEmailSectionOpen)}
                          className="h-6 px-2 text-xs text-slate-500 hover:text-slate-700"
                        >
                          {isApprovalEmailSectionOpen ? "Collapse" : "Expand"}
                        </Button>
                      </div>
                      {isApprovalEmailSectionOpen ? (
                        isLoadingApprovalEmail ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                            <span className="ml-2 text-sm text-slate-500">Loading email preview...</span>
                          </div>
                        ) : (
                          <Textarea
                            value={editableApprovalEmail}
                            onChange={(e) => setEditableApprovalEmail(e.target.value)}
                            rows={10}
                            className="text-sm bg-white border-slate-200 focus:ring-2 focus:ring-slate-200 focus:border-slate-300 resize-none font-mono"
                            placeholder="Approval email content..."
                          />
                        )
                      ) : isLoadingApprovalEmail ? (
                        <div className="flex items-center py-4">
                          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                          <span className="ml-2 text-sm text-slate-500">Loading...</span>
                        </div>
                      ) : (
                        <div className="relative">
                          <pre className="text-sm text-slate-600 whitespace-pre-wrap font-sans max-h-24 overflow-hidden">
                            {editableApprovalEmail || "Loading preview..."}
                          </pre>
                          {editableApprovalEmail && editableApprovalEmail.length > 200 && (
                            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent" />
                          )}
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              )}
            </div>
          )}
        </div>

      </SheetContent>
    </Sheet>
  )
}
