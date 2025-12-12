"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Mail,
  MessageSquare,
  Phone,
  FileSpreadsheet,
  FileText,
  Clock,
  User,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Send,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCheck,
} from "lucide-react"
import type { Order } from "@/types/orders"

interface OrderCardProps {
  order: Order
  onApprove: (orderId: string) => void
  onReject: (orderId: string) => void
  onRequestInfo: (orderId: string) => Promise<void>
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
  awaiting_clarification: "border-l-orange-500",
  approved: "border-l-green-500",
  rejected: "border-l-red-500",
}

export function OrderCard({ order, onApprove, onReject, onRequestInfo }: OrderCardProps) {
  const [isItemsExpanded, setIsItemsExpanded] = useState(false)
  const [isRequestingInfo, setIsRequestingInfo] = useState(false)
  const SourceIcon = sourceIcons[order.source]
  const isWaitingReview = order.status === "waiting_review"

  // Check if there's a pending clarification message to send
  const hasPendingClarification = !!order.clarification_message

  const handleRequestInfo = async () => {
    setIsRequestingInfo(true)
    try {
      await onRequestInfo(order.id)
    } finally {
      setIsRequestingInfo(false)
    }
  }

  const borderColor = statusBorderColors[order.status as keyof typeof statusBorderColors] || "border-l-gray-500"

  return (
    <Card className={`hover:shadow-md transition-shadow border-l-4 ${borderColor}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="font-semibold text-lg">{order.order_number}</h3>
            <p className="text-sm text-muted-foreground">{order.company_name}</p>
          </div>
          {order.email_url ? (
            <a
              href={order.email_url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-80 transition-opacity"
            >
              <Badge className={sourceColors[order.source]} variant="outline">
                <SourceIcon className="h-3 w-3 mr-1" />
                {order.source}
              </Badge>
            </a>
          ) : (
            <Badge className={sourceColors[order.source]} variant="outline">
              <SourceIcon className="h-3 w-3 mr-1" />
              {order.source}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Order Details */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Order Value</p>
            <p className="font-medium">${Number(order.order_value)?.toLocaleString() ?? 'N/A'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Items</p>
            <div className="flex items-center gap-1">
              <p className="font-medium">{order.item_count ?? 0} items</p>
              {order.items && order.items.length > 0 && (
                <button
                  onClick={() => setIsItemsExpanded(!isItemsExpanded)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  {isItemsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Expandable Items List */}
        {order.items && order.items.length > 0 && isItemsExpanded && (
          <div className="border-t pt-3">
            <p className="text-sm font-medium text-muted-foreground mb-2">Order Items:</p>
            <div className="space-y-2">
              {order.items.map((item, index) => (
                <div key={item.id || index} className="text-sm bg-gray-50 p-3 rounded">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium">{item.name}</span>
                    <span className="font-semibold">${Number(item.total).toFixed(2)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Quantity: {item.quantity} × ${Number(item.unit_price).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}


        {/* Timestamp */}
        <div className="text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3" />
            <span>Received: {new Date(order.received_date).toLocaleString()}</span>
          </div>
        </div>

        {/* Actions */}
        {isWaitingReview && (
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button size="sm" onClick={() => onApprove(order.id)}>
              <CheckCircle className="h-4 w-4 mr-1" />
              Approve
            </Button>
            <Button size="sm" variant="outline" onClick={() => onReject(order.id)}>
              <XCircle className="h-4 w-4 mr-1" />
              Reject
            </Button>
          </div>
        )}

        {order.status === "awaiting_clarification" && (
          <div className="grid grid-cols-2 gap-2 pt-2">
            {hasPendingClarification ? (
              <Button
                size="sm"
                className="bg-orange-500 hover:bg-orange-600 text-white"
                onClick={handleRequestInfo}
                disabled={isRequestingInfo}
              >
                {isRequestingInfo ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-1" />
                    Request Info
                  </>
                )}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="bg-gray-100 text-gray-500 cursor-not-allowed"
                disabled
              >
                <CheckCheck className="h-4 w-4 mr-1" />
                Request Sent
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => onReject(order.id)}>
              <XCircle className="h-4 w-4 mr-1" />
              Reject
            </Button>
          </div>
        )}

        {order.status === "approved" && (
          <div className="flex items-center gap-2 text-green-600 text-sm pt-2">
            <CheckCircle className="h-4 w-4" />
            <span className="font-medium">Approved and processed</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
