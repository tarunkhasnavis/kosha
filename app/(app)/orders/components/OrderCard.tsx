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
} from "lucide-react"
import type { Order } from "@/types/orders"

interface OrderCardProps {
  order: Order
  onClick: () => void
  onReject?: (orderId: string) => Promise<void>
  onApprove?: (orderId: string) => Promise<void>
  onRequestInfo?: (orderId: string) => Promise<void>
}

const sourceIcons = {
  email: Mail,
  text: MessageSquare,
  voicemail: Phone,
  spreadsheet: FileSpreadsheet,
  pdf: FileText,
}

const sourceColors = {
  email: "bg-blue-100 text-blue-800",
  text: "bg-green-100 text-green-800",
  voicemail: "bg-purple-100 text-purple-800",
  spreadsheet: "bg-orange-100 text-orange-800",
  pdf: "bg-gray-100 text-gray-800",
}

const statusBorderColors = {
  waiting_review: "border-l-blue-500",
  awaiting_clarification: "border-l-orange-600",
  approved: "border-l-green-500",
  rejected: "border-l-red-500",
}

export function OrderCard({ order, onClick, onReject, onApprove, onRequestInfo }: OrderCardProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const SourceIcon = sourceIcons[order.source]
  const borderColor = statusBorderColors[order.status as keyof typeof statusBorderColors] || "border-l-gray-500"

  const handleAction = async (
    e: React.MouseEvent,
    action: "reject" | "approve" | "requestInfo",
    handler?: (orderId: string) => Promise<void>
  ) => {
    e.stopPropagation() // Prevent card click
    if (!handler) return

    setIsLoading(action)
    try {
      await handler(order.id)
    } finally {
      setIsLoading(null)
    }
  }

  const isNeedsInfo = order.status === "awaiting_clarification"
  const isPendingReview = order.status === "waiting_review"
  const hasClarificationMessage = order.clarification_message !== null && order.clarification_message !== undefined

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

        {/* Timestamp */}
        <div className="text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3" />
            <span>Received: {new Date(order.received_date).toLocaleString()}</span>
          </div>
        </div>

        {/* Action Buttons */}
        {/* Pending Review: Reject, Approve */}
        {isPendingReview && (
          <div className="grid grid-cols-2 gap-2 pt-4">
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => handleAction(e, "reject", onReject)}
              disabled={isLoading !== null}
            >
              {isLoading === "reject" ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-1" />
              )}
              Reject
            </Button>
            <Button
              size="sm"
              onClick={(e) => handleAction(e, "approve", onApprove)}
              disabled={isLoading !== null}
            >
              {isLoading === "approve" ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-1" />
              )}
              Approve
            </Button>
          </div>
        )}

        {/* Needs Info: Reject, Request Info or Request Sent */}
        {isNeedsInfo && (
          <div className="grid grid-cols-2 gap-2 pt-4">
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => handleAction(e, "reject", onReject)}
              disabled={isLoading !== null}
            >
              {isLoading === "reject" ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-1" />
              )}
              Reject
            </Button>
            {hasClarificationMessage ? (
              <Button
                size="sm"
                className="bg-orange-600 hover:bg-orange-700 text-white"
                onClick={(e) => handleAction(e, "requestInfo", onRequestInfo)}
                disabled={isLoading !== null}
              >
                {isLoading === "requestInfo" ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-1" />
                )}
                Request Info
              </Button>
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
        )}

        {/* Approved */}
        {order.status === "approved" && (
          <div className="flex items-center justify-between pt-4">
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle className="h-4 w-4" />
              <span className="font-medium">Approved</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation()
                // Trigger download via browser
                window.open(`/api/orders/${order.id}/pdf`, '_blank')
              }}
            >
              <Download className="h-4 w-4 mr-1" />
              Download
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
