"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  CheckCircle,
  XCircle,
  CheckCheck,
  Send,
  Loader2,
  AlertCircle,
  Download,
  Archive,
  ArchiveRestore,
} from "lucide-react"
import type { Order } from "@/types/orders"
import type { OrgRequiredField } from "@/lib/orders/field-config"
import { markOrderPdfDownloaded, archiveOrder, unarchiveOrder } from "@/lib/orders/actions"
import { calculateCompleteness, type EditableItem } from "@/lib/orders/completeness"
import { listItem, durations, easings } from "@/lib/motion"

// =============================================================================
// Status Configuration (muted/desaturated colors per spec)
// =============================================================================

type OrderStatus = "waiting_review" | "awaiting_clarification" | "approved" | "archived"

interface StatusConfig {
  dotColor: string
  accentColor: string
}

const statusConfig: Record<OrderStatus, StatusConfig> = {
  awaiting_clarification: {
    dotColor: "bg-amber-500",
    accentColor: "bg-amber-500",
  },
  waiting_review: {
    dotColor: "bg-blue-500",
    accentColor: "bg-blue-500",
  },
  approved: {
    dotColor: "bg-emerald-500",
    accentColor: "bg-emerald-500",
  },
  archived: {
    dotColor: "bg-slate-400",
    accentColor: "bg-slate-400",
  },
}

// =============================================================================
// Helper: Convert OrderItem[] to EditableItem[] for completeness calculation
// =============================================================================

function orderItemsToEditable(order: Order): EditableItem[] {
  return order.items?.map((item) => ({
    id: item.id,
    name: item.name,
    sku: item.sku || "",
    quantity: item.quantity,
    quantity_unit: item.quantity_unit || "each",
    unit_price: String(item.unit_price),
    total: item.total,
  })) || []
}

// =============================================================================
// Main Component
// =============================================================================

interface OrderRowProps {
  order: Order
  onClick: () => void
  onRejectClick?: (order: Order) => void
  onApprove?: (orderId: string) => Promise<void>
  onRequestInfo?: (orderId: string) => Promise<void>
  onDownload?: (orderId: string) => void
  orgRequiredFields?: OrgRequiredField[]
}

export function OrderRow({ order, onClick, onRejectClick, onApprove, onRequestInfo, onDownload, orgRequiredFields = [] }: OrderRowProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const [justDownloaded, setJustDownloaded] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const status = order.status as OrderStatus
  const config = statusConfig[status] || statusConfig.waiting_review
  const hasBeenDownloaded = order.pdf_downloaded_at !== null && order.pdf_downloaded_at !== undefined
  const isNeedsInfo = order.status === "awaiting_clarification"
  const hasClarificationMessage = order.clarification_message !== null && order.clarification_message !== undefined

  // Calculate completeness percentage
  const editableItems = orderItemsToEditable(order)
  const completeness = calculateCompleteness(order, editableItems, orgRequiredFields)

  const createActionHandler = (action: string, handler: () => Promise<void>) => {
    return async (e: React.MouseEvent) => {
      e.stopPropagation()
      setIsLoading(action)
      try {
        await handler()
      } finally {
        setIsLoading(null)
      }
    }
  }

  const handleArchive = createActionHandler("archive", async () => { await archiveOrder(order.id) })
  const handleUnarchive = createActionHandler("unarchive", async () => { await unarchiveOrder(order.id) })

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsLoading("download")
    window.open(`/api/orders/${order.id}/pdf`, '_blank')
    try {
      await markOrderPdfDownloaded(order.id)
      setJustDownloaded(true)
      onDownload?.(order.id)
    } catch (error) {
      console.error('Failed to mark as downloaded:', error)
    } finally {
      setIsLoading(null)
    }
  }

  const handleSimpleDownload = (e: React.MouseEvent) => {
    e.stopPropagation()
    window.open(`/api/orders/${order.id}/pdf`, '_blank')
  }

  const isDownloaded = hasBeenDownloaded || justDownloaded

  return (
    <motion.div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      variants={listItem}
      whileHover={{
        scale: 1.005,
        transition: { duration: durations.fast, ease: easings.easeOut },
      }}
      whileTap={{
        scale: 0.995,
        transition: { duration: 0.08 },
      }}
      className={`
        relative flex items-center gap-5 px-5 py-4
        bg-white border border-[rgba(15,23,42,0.06)] rounded-lg
        cursor-pointer select-none
        transition-colors duration-150 ease-out
        ${isHovered ? "border-[rgba(15,23,42,0.12)] shadow-[0_2px_8px_rgba(15,23,42,0.06)]" : ""}
      `}
    >
      {/* Left accent strip */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${config.accentColor}`} />

      {/* Status dot */}
      <div className={`w-2 h-2 rounded-full ${config.dotColor} shrink-0 ml-2`} />

      {/* Order Number */}
      <div className="flex items-center gap-1.5 w-28 shrink-0">
        <span className="text-sm font-semibold text-slate-900 truncate">
          {order.order_number}
        </span>
        {isNeedsInfo && hasClarificationMessage && (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Pending clarification request</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Company Name */}
      <span className="text-sm text-slate-600 truncate w-44 shrink-0">
        {order.company_name || "Unknown Company"}
      </span>

      {/* Received date */}
      <div className="flex items-center text-slate-500 w-28 shrink-0">
        <span className="text-sm">
          {new Date(order.received_date).toLocaleDateString()}
        </span>
      </div>

      {/* Items count */}
      <span className="text-sm text-slate-500 w-20 shrink-0 -mr-2">
        {order.item_count ?? 0} items
      </span>

      {/* Order value */}
      <span className="text-sm font-medium text-slate-700 w-24 shrink-0 text-right">
        ${Number(order.order_value)?.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }) ?? "0.00"}
      </span>

      {/* Completeness */}
      <div className="flex items-center gap-2 w-24 shrink-0 ml-6">
        {(order.status === "approved" || order.status === "archived") ? (
          <div className="flex items-center gap-1.5">
            <CheckCircle className="h-4 w-4 text-emerald-500" />
            <span className="text-xs font-medium text-emerald-600">Complete</span>
          </div>
        ) : (
          <>
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  completeness.percentage === 100
                    ? "bg-blue-500"
                    : completeness.percentage >= 70
                    ? "bg-amber-500"
                    : "bg-[hsl(var(--attention-500))]"
                }`}
                style={{ width: `${completeness.percentage}%` }}
              />
            </div>
            <span className={`text-xs font-medium ${
              completeness.percentage === 100
                ? "text-blue-600"
                : completeness.percentage >= 70
                ? "text-amber-600"
                : "text-[hsl(var(--attention-600))]"
            }`}>
              {completeness.percentage}%
            </span>
          </>
        )}
      </div>

      {/* Status Label */}
      <div className="flex items-center justify-center w-28 shrink-0">
        <span
          className={`text-xs font-medium px-2.5 py-1 rounded-full ${
            order.status === "waiting_review"
              ? "bg-blue-50 text-blue-700"
              : order.status === "awaiting_clarification"
              ? "bg-amber-50 text-amber-700"
              : order.status === "approved"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          {order.status === "waiting_review"
            ? "Pending Review"
            : order.status === "awaiting_clarification"
            ? "Needs Info"
            : order.status === "approved"
            ? "Approved"
            : order.status === "archived"
            ? "Archived"
            : order.status.replace("_", " ")}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 ml-auto shrink-0">
        {/* Pending Review: Reject + Approve + Archive */}
        {order.status === "waiting_review" && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-3 text-xs"
              disabled={isLoading !== null}
              onClick={(e) => {
                e.stopPropagation()
                onRejectClick?.(order)
              }}
            >
              <XCircle className="h-3.5 w-3.5 mr-1" />
              Reject
            </Button>
            <Button
              size="sm"
              className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={isLoading !== null}
              onClick={createActionHandler("approve", () => onApprove?.(order.id) ?? Promise.resolve())}
            >
              {isLoading === "approve" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle className="h-3.5 w-3.5 mr-1" />
              )}
              Approve
            </Button>
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 w-8 p-0"
                    disabled={isLoading === "archive"}
                    onClick={handleArchive}
                  >
                    {isLoading === "archive" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Archive className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Archive</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        )}

        {/* Needs Info: Reject + Request Info + Archive */}
        {order.status === "awaiting_clarification" && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-3 text-xs"
              disabled={isLoading !== null}
              onClick={(e) => {
                e.stopPropagation()
                onRejectClick?.(order)
              }}
            >
              <XCircle className="h-3.5 w-3.5 mr-1" />
              Reject
            </Button>
            {hasClarificationMessage ? (
              <Button
                size="sm"
                className="h-8 px-3 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                disabled={isLoading !== null}
                onClick={createActionHandler("requestInfo", () => onRequestInfo?.(order.id) ?? Promise.resolve())}
              >
                {isLoading === "requestInfo" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5 mr-1" />
                )}
                Request Info
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-3 text-xs bg-slate-100 text-slate-500"
                disabled
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                Request Sent
              </Button>
            )}
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 w-8 p-0"
                    disabled={isLoading === "archive"}
                    onClick={handleArchive}
                  >
                    {isLoading === "archive" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Archive className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Archive</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        )}

        {/* Approved: Archive + Download */}
        {order.status === "approved" && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-3 text-xs"
              disabled={isLoading === "archive"}
              onClick={handleArchive}
            >
              {isLoading === "archive" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Archive className="h-3.5 w-3.5 mr-1" />
              )}
              Archive
            </Button>
            <Button
              size="sm"
              className={`h-8 px-3 text-xs ${
                isDownloaded
                  ? "bg-slate-100 hover:bg-slate-200 text-slate-500"
                  : "bg-slate-500 hover:bg-slate-600 text-white"
              }`}
              disabled={isLoading === "download"}
              onClick={handleDownload}
            >
              {isLoading === "download" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : isDownloaded ? (
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
              ) : (
                <Download className="h-3.5 w-3.5 mr-1" />
              )}
              {isDownloaded ? "Downloaded" : "Download"}
            </Button>
          </>
        )}

        {/* Archived: Restore + Download */}
        {order.status === "archived" && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-3 text-xs"
              disabled={isLoading === "unarchive"}
              onClick={handleUnarchive}
            >
              {isLoading === "unarchive" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ArchiveRestore className="h-3.5 w-3.5 mr-1" />
              )}
              Restore
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-3 text-xs"
              onClick={handleSimpleDownload}
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              Download
            </Button>
          </>
        )}
      </div>
    </motion.div>
  )
}

// =============================================================================
// Skeleton Component for loading states
// =============================================================================

export function OrderRowSkeleton() {
  return (
    <div className="flex items-center gap-5 px-5 py-4 bg-white border border-[rgba(15,23,42,0.06)] rounded-lg animate-pulse">
      <div className="w-2 h-2 rounded-full bg-slate-200 ml-2" />
      <div className="h-4 w-28 bg-slate-200 rounded" />
      <div className="h-4 w-44 bg-slate-100 rounded" />
      <div className="w-8 h-8 bg-slate-100 rounded" />
      <div className="h-4 w-28 bg-slate-100 rounded" />
      <div className="h-4 w-20 bg-slate-100 rounded -mr-2" />
      <div className="h-4 w-24 bg-slate-100 rounded" />
      <div className="flex items-center gap-2 w-24 ml-6">
        <div className="flex-1 h-1.5 bg-slate-100 rounded-full" />
        <div className="h-3 w-8 bg-slate-100 rounded" />
      </div>
      <div className="flex items-center gap-2 ml-auto">
        <div className="h-8 w-20 bg-slate-100 rounded" />
        <div className="h-8 w-20 bg-slate-100 rounded" />
      </div>
    </div>
  )
}
