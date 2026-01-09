"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Mail,
  MessageSquare,
  Phone,
  FileSpreadsheet,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  CheckCheck,
  Send,
  Loader2,
  AlertCircle,
  Download,
  Archive,
  ArchiveRestore,
  Truck,
  UserCheck,
  type LucideIcon,
} from "lucide-react"
import type { Order } from "@/types/orders"
import { markOrderPdfDownloaded, archiveOrder, unarchiveOrder } from "@/lib/orders/actions"

// =============================================================================
// Constants
// =============================================================================

const sourceIcons: Record<Order["source"], LucideIcon> = {
  email: Mail,
  text: MessageSquare,
  voicemail: Phone,
  spreadsheet: FileSpreadsheet,
  pdf: FileText,
}

const sourceColors: Record<Order["source"], string> = {
  email: "bg-blue-100 text-blue-800",
  text: "bg-green-100 text-green-800",
  voicemail: "bg-purple-100 text-purple-800",
  spreadsheet: "bg-orange-100 text-orange-800",
  pdf: "bg-gray-100 text-gray-800",
}

const statusBorderColors: Record<string, string> = {
  waiting_review: "border-l-blue-500",
  awaiting_clarification: "border-l-orange-600",
  approved: "border-l-green-500",
  rejected: "border-l-red-500",
  archived: "border-l-gray-400",
}

// =============================================================================
// Reusable Sub-components
// =============================================================================

interface IconButtonProps {
  icon: LucideIcon
  tooltip: string
  loading: boolean
  disabled?: boolean
  className?: string
  onClick: (e: React.MouseEvent) => void
}

function IconButton({ icon: Icon, tooltip, loading, disabled, className = "", onClick }: IconButtonProps) {
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            disabled={disabled || loading}
            className={`h-8 w-8 p-0 ${className}`}
            onClick={onClick}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Icon className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

interface ActionButtonProps {
  icon: LucideIcon
  label: string
  loading: boolean
  disabled?: boolean
  variant?: "default" | "outline"
  className?: string
  onClick: (e: React.MouseEvent) => void
}

function ActionButton({
  icon: Icon,
  label,
  loading,
  disabled,
  variant = "outline",
  className = "",
  onClick
}: ActionButtonProps) {
  return (
    <Button
      size="sm"
      variant={variant}
      onClick={onClick}
      disabled={disabled || loading}
      className={className}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
      ) : (
        <Icon className="h-4 w-4 mr-1" />
      )}
      {label}
    </Button>
  )
}

// =============================================================================
// Status-specific Action Components
// =============================================================================

interface StatusActionsProps {
  order: Order
  isLoading: string | null
  onAction: (action: string, handler: () => Promise<void>) => (e: React.MouseEvent) => void
  onReject?: (orderId: string) => Promise<void>
  onApprove?: (orderId: string) => Promise<void>
  onRequestInfo?: (orderId: string) => Promise<void>
  onArchive?: (e: React.MouseEvent) => void
}

function PendingReviewActions({ order, isLoading, onAction, onReject, onApprove, onArchive }: StatusActionsProps) {
  return (
    <div className="flex items-center gap-2 pt-4">
      <div className="grid grid-cols-2 gap-2 flex-1">
        <ActionButton
          icon={XCircle}
          label="Reject"
          loading={isLoading === "reject"}
          disabled={isLoading !== null}
          onClick={onAction("reject", () => onReject?.(order.id) ?? Promise.resolve())}
        />
        <ActionButton
          icon={CheckCircle}
          label="Approve"
          loading={isLoading === "approve"}
          disabled={isLoading !== null}
          variant="default"
          onClick={onAction("approve", () => onApprove?.(order.id) ?? Promise.resolve())}
        />
      </div>
      <IconButton
        icon={Archive}
        tooltip="Archive"
        loading={isLoading === "archive"}
        disabled={isLoading !== null}
        onClick={onArchive!}
      />
    </div>
  )
}

function NeedsInfoActions({ order, isLoading, onAction, onReject, onRequestInfo, onArchive }: StatusActionsProps) {
  const hasClarificationMessage = order.clarification_message !== null && order.clarification_message !== undefined

  return (
    <div className="flex items-center gap-2 pt-4">
      <div className="grid grid-cols-2 gap-2 flex-1">
        <ActionButton
          icon={XCircle}
          label="Reject"
          loading={isLoading === "reject"}
          disabled={isLoading !== null}
          onClick={onAction("reject", () => onReject?.(order.id) ?? Promise.resolve())}
        />
        {hasClarificationMessage ? (
          <ActionButton
            icon={Send}
            label="Request Info"
            loading={isLoading === "requestInfo"}
            disabled={isLoading !== null}
            variant="default"
            className="bg-orange-600 hover:bg-orange-700 text-white"
            onClick={onAction("requestInfo", () => onRequestInfo?.(order.id) ?? Promise.resolve())}
          />
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="bg-gray-100 text-gray-500"
            disabled
          >
            <CheckCheck className="h-4 w-4 mr-1" />
            Request Sent
          </Button>
        )}
      </div>
      <IconButton
        icon={Archive}
        tooltip="Archive"
        loading={isLoading === "archive"}
        disabled={isLoading !== null}
        onClick={onArchive!}
      />
    </div>
  )
}

interface ApprovedActionsProps {
  order: Order
  isLoading: string | null
  hasBeenDownloaded: boolean
  justDownloaded: boolean
  onArchive: (e: React.MouseEvent) => void
  onDownload: (e: React.MouseEvent) => void
}

function ApprovedActions({
  isLoading,
  hasBeenDownloaded,
  justDownloaded,
  onArchive,
  onDownload
}: ApprovedActionsProps) {
  const isDownloaded = hasBeenDownloaded || justDownloaded

  return (
    <div className="flex items-center justify-between pt-4">
      <div className="flex items-center gap-2 text-green-600 text-sm">
        <CheckCircle className="h-4 w-4" />
        <span className="font-medium">Approved</span>
      </div>
      <div className="flex items-center gap-2">
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                disabled={isLoading === "download"}
                className={
                  isDownloaded
                    ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800"
                    : ""
                }
                onClick={onDownload}
              >
                {isLoading === "download" ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : isDownloaded ? (
                  <CheckCheck className="h-4 w-4 mr-1" />
                ) : (
                  <Download className="h-4 w-4 mr-1" />
                )}
                {isDownloaded ? "Downloaded" : "Download"}
              </Button>
            </TooltipTrigger>
            {isDownloaded && (
              <TooltipContent>
                <p>Click to download again</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
        <IconButton
          icon={Archive}
          tooltip="Archive"
          loading={isLoading === "archive"}
          onClick={onArchive}
        />
      </div>
    </div>
  )
}

interface ArchivedActionsProps {
  order: Order
  isLoading: string | null
  onUnarchive: (e: React.MouseEvent) => void
  onDownload: (e: React.MouseEvent) => void
}

function ArchivedActions({ isLoading, onUnarchive, onDownload }: ArchivedActionsProps) {
  return (
    <div className="flex items-center justify-between pt-4">
      <div className="flex items-center gap-2 text-gray-500 text-sm">
        <Archive className="h-4 w-4" />
        <span className="font-medium">Archived</span>
      </div>
      <div className="flex items-center gap-2">
        <IconButton
          icon={ArchiveRestore}
          tooltip="Restore"
          loading={isLoading === "unarchive"}
          onClick={onUnarchive}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={onDownload}
        >
          <Download className="h-4 w-4 mr-1" />
          Download
        </Button>
      </div>
    </div>
  )
}

// =============================================================================
// Main Component
// =============================================================================

interface OrderCardProps {
  order: Order
  onClick: () => void
  onReject?: (orderId: string) => Promise<void>
  onApprove?: (orderId: string) => Promise<void>
  onRequestInfo?: (orderId: string) => Promise<void>
  onDownload?: (orderId: string) => void
}

export function OrderCard({ order, onClick, onReject, onApprove, onRequestInfo, onDownload }: OrderCardProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const [justDownloaded, setJustDownloaded] = useState(false)

  const SourceIcon = sourceIcons[order.source]
  const borderColor = statusBorderColors[order.status] || "border-l-gray-500"
  const hasBeenDownloaded = order.pdf_downloaded_at !== null && order.pdf_downloaded_at !== undefined
  const isNeedsInfo = order.status === "awaiting_clarification"
  const hasClarificationMessage = order.clarification_message !== null && order.clarification_message !== undefined

  // Generic action handler factory
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

  // Specific handlers for archive/download actions
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

  return (
    <Card
      className={`hover:shadow-md transition-shadow border-l-4 ${borderColor} cursor-pointer`}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold text-lg">{order.order_number}</h3>
              {isNeedsInfo && hasClarificationMessage && (
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help">
                        <AlertCircle className="h-4 w-4 text-orange-600" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Pending clarification request</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{order.company_name || "Unknown Company"}</p>
          </div>
          <Badge className={sourceColors[order.source]} variant="outline">
            <SourceIcon className="h-3 w-3 mr-1" />
            {order.source}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Order Summary */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Order Value</p>
            <p className="font-medium">${Number(order.order_value)?.toLocaleString() ?? 'N/A'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Items</p>
            <p className="font-medium">{order.item_count ?? 0} items</p>
          </div>
        </div>

        {/* Timestamp & Delivery Info */}
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3" />
            <span>Received: {new Date(order.received_date).toLocaleString()}</span>
          </div>
          {order.ship_via && (
            <div className="flex items-center gap-2">
              {order.ship_via === "Customer Pickup" ? (
                <UserCheck className="h-3 w-3" />
              ) : (
                <Truck className="h-3 w-3" />
              )}
              <span>{order.ship_via}</span>
            </div>
          )}
        </div>

        {/* Status-specific Actions */}
        {order.status === "waiting_review" && (
          <PendingReviewActions
            order={order}
            isLoading={isLoading}
            onAction={createActionHandler}
            onReject={onReject}
            onApprove={onApprove}
            onArchive={handleArchive}
          />
        )}

        {order.status === "awaiting_clarification" && (
          <NeedsInfoActions
            order={order}
            isLoading={isLoading}
            onAction={createActionHandler}
            onReject={onReject}
            onRequestInfo={onRequestInfo}
            onArchive={handleArchive}
          />
        )}

        {order.status === "approved" && (
          <ApprovedActions
            order={order}
            isLoading={isLoading}
            hasBeenDownloaded={hasBeenDownloaded}
            justDownloaded={justDownloaded}
            onArchive={handleArchive}
            onDownload={handleDownload}
          />
        )}

        {order.status === "archived" && (
          <ArchivedActions
            order={order}
            isLoading={isLoading}
            onUnarchive={handleUnarchive}
            onDownload={handleSimpleDownload}
          />
        )}
      </CardContent>
    </Card>
  )
}
