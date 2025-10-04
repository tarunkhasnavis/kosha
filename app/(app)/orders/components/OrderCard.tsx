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
} from "lucide-react"
import type { Order } from "@/types/orders"

interface OrderCardProps {
  order: Order
  onApprove: (orderId: string) => void
  onReject: (orderId: string) => void
  onRequestInfo: (orderId: string) => void
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

export function OrderCard({ order, onApprove, onReject, onRequestInfo }: OrderCardProps) {
  const SourceIcon = sourceIcons[order.source]
  const isWaitingReview = order.status === "waiting_review"

  return (
    <Card className="hover:shadow-md transition-shadow border-l-4 border-l-blue-500">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="font-semibold text-lg">{order.order_number}</h3>
            <p className="text-sm text-muted-foreground">{order.company_name}</p>
          </div>
          <Badge className={sourceColors[order.source]} variant="outline">
            <SourceIcon className="h-3 w-3 mr-1" />
            {order.source}
          </Badge>
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
            <p className="font-medium">{order.item_count ?? 0} items</p>
          </div>
        </div>

        {/* Sample Items */}
        {order.items && order.items.length > 0 && (
          <div>
            <p className="text-sm text-muted-foreground mb-2">Items Preview:</p>
            <div className="space-y-1">
              {order.items.slice(0, 2).map((item, index) => (
                <div key={index} className="text-xs bg-gray-50 p-2 rounded">
                  <span className="font-medium">{item.name}</span>
                  <span className="text-muted-foreground ml-2">
                    {item.quantity} @ ${item.unit_price} = ${item.total}
                  </span>
                </div>
              ))}
              {order.items.length > 2 && (
                <p className="text-xs text-muted-foreground">+{order.items.length - 2} more items...</p>
              )}
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
          <div className="grid grid-cols-3 gap-2 pt-2">
            <Button size="sm" onClick={() => onApprove(order.id)}>
              <CheckCircle className="h-4 w-4 mr-1" />
              Approve
            </Button>
            <Button size="sm" variant="outline" onClick={() => onReject(order.id)}>
              <XCircle className="h-4 w-4 mr-1" />
              Reject
            </Button>
            <Button size="sm" variant="secondary" onClick={() => onRequestInfo(order.id)}>
              <Send className="h-4 w-4 mr-1" />
              Info
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
