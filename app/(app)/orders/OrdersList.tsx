"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, TrendingUp, Clock, CheckCircle, AlertCircle, Archive } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { OrderCard } from "./components/OrderCard"
import { OrderEditModal, type OrderFieldsWithOrgFields } from "./components/OrderEditModal"
import {
  saveOrderChanges,
  saveAndApproveOrder,
  saveAndAnalyzeOrder,
  approveOrder,
  rejectOrder,
  requestOrderInfo,
  saveClarificationMessage,
  type EditableItemInput,
  type SaveAndAnalyzeResult,
} from "@/lib/orders/actions"
import { createClient } from "@/utils/supabase/client"
import type { Order, OrderStats } from "@/types/orders"
import type { OrgRequiredField } from "@/lib/orders/field-config"

interface OrdersListProps {
  initialOrders: Order[]
  initialStats: OrderStats
  orgRequiredFields: OrgRequiredField[]
}

export function OrdersList({ initialOrders, initialStats, orgRequiredFields }: OrdersListProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  // Set up real-time subscription for automation updates
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        () => {
          // When automation updates DB, refresh the page data
          router.refresh()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [router])

  // Open modal when clicking an order card
  const handleOrderClick = (order: Order) => {
    setSelectedOrder(order)
    setIsModalOpen(true)
  }

  // Close modal
  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedOrder(null)
  }

  // Handle save from modal
  const handleSave = async (
    orderId: string,
    items: EditableItemInput[],
    orderFields: OrderFieldsWithOrgFields
  ) => {
    try {
      await saveOrderChanges(orderId, items, orderFields)
      toast({
        title: "Success",
        description: "Order saved successfully",
      })
    } catch (error) {
      console.error("Failed to save order:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save order",
        variant: "destructive",
      })
      throw error // Re-throw so modal knows save failed
    }
  }

  // Handle save and approve from modal
  const handleSaveAndApprove = async (
    orderId: string,
    items: EditableItemInput[],
    orderFields: OrderFieldsWithOrgFields
  ) => {
    try {
      await saveAndApproveOrder(orderId, items, orderFields)
      toast({
        title: "Success",
        description: "Order saved and approved",
      })
    } catch (error) {
      console.error("Failed to save and approve order:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save and approve order",
        variant: "destructive",
      })
      throw error
    }
  }

  // Handle reject from card
  const handleReject = async (orderId: string) => {
    try {
      await rejectOrder(orderId)
      toast({
        title: "Order Rejected",
        description: "The order has been removed",
      })
    } catch (error) {
      console.error("Failed to reject order:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reject order",
        variant: "destructive",
      })
    }
  }

  // Handle approve from card
  const handleApprove = async (orderId: string) => {
    try {
      await approveOrder(orderId)
      toast({
        title: "Order Approved",
        description: "The order has been approved",
      })
    } catch (error) {
      console.error("Failed to approve order:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to approve order",
        variant: "destructive",
      })
    }
  }

  // Handle request info from card (uses stored message)
  const handleRequestInfo = async (orderId: string) => {
    try {
      await requestOrderInfo(orderId)
      toast({
        title: "Request Sent",
        description: "Clarification email has been sent to the customer",
      })
    } catch (error) {
      console.error("Failed to send clarification request:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send clarification request",
        variant: "destructive",
      })
    }
  }

  // Handle save and analyze from modal (for "needs info" orders with edits)
  const handleSaveAndAnalyze = async (
    orderId: string,
    items: EditableItemInput[],
    orderFields: OrderFieldsWithOrgFields
  ): Promise<SaveAndAnalyzeResult> => {
    try {
      const result = await saveAndAnalyzeOrder(orderId, items, orderFields)
      toast({
        title: "Changes Saved",
        description: result.isComplete
          ? "Order is now complete and ready for review"
          : "Order saved. Still missing some information.",
      })
      return result
    } catch (error) {
      console.error("Failed to save and analyze order:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save order",
        variant: "destructive",
      })
      throw error
    }
  }

  // Handle request info from modal (with custom message)
  const handleRequestInfoWithMessage = async (orderId: string, clarificationMessage: string) => {
    try {
      await requestOrderInfo(orderId, clarificationMessage)
      toast({
        title: "Request Sent",
        description: "Clarification email has been sent to the customer",
      })
    } catch (error) {
      console.error("Failed to send clarification request:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send clarification request",
        variant: "destructive",
      })
      throw error
    }
  }

  // Handle saving clarification message edits (for "Save for Later")
  const handleSaveClarificationMessage = async (orderId: string, message: string) => {
    try {
      await saveClarificationMessage(orderId, message)
      toast({
        title: "Saved",
        description: "Clarification message saved for later",
      })
    } catch (error) {
      console.error("Failed to save clarification message:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save clarification message",
        variant: "destructive",
      })
      throw error
    }
  }

  const filteredOrders = initialOrders.filter((order) => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    return (
      (order.company_name || "").toLowerCase().includes(searchLower) ||
      (order.order_number || "").toLowerCase().includes(searchLower)
    )
  })

  const waitingOrders = filteredOrders.filter((order) => order.status === "waiting_review")
  const approvedOrders = filteredOrders.filter((order) => order.status === "approved")
  const clarificationOrders = filteredOrders.filter((order) => order.status === "awaiting_clarification")
  const archivedOrders = filteredOrders.filter((order) => order.status === "archived")

  return (
    <div className="flex h-screen bg-gray-50">
      <main className="flex-1 overflow-y-auto pl-64">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-8 max-w-[1920px] mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
              <p className="text-muted-foreground mt-1">AI-powered order processing and management</p>
            </div>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 max-w-2xl">
            <Card className="border-l-4 border-l-orange-600">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
                <Clock className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{initialStats.awaitingClarification + initialStats.waitingReview}</div>
                <p className="text-xs text-muted-foreground">Needs attention</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Today</CardTitle>
                <TrendingUp className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{initialStats.totalToday}</div>
                <p className="text-xs text-muted-foreground">Last 24 hours</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="waiting" className="space-y-6">
            <TabsList className="grid w-full max-w-4xl grid-cols-4">
              <TabsTrigger value="clarification" className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Needs Info
                <Badge variant="secondary" className="ml-1">
                  {clarificationOrders.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="waiting" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Pending Review
                <Badge variant="secondary" className="ml-1">
                  {waitingOrders.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="approved" className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Approved
                <Badge variant="secondary" className="ml-1">
                  {approvedOrders.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="archived" className="flex items-center gap-2">
                <Archive className="h-4 w-4" />
                Archived
                <Badge variant="secondary" className="ml-1">
                  {archivedOrders.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="waiting" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Orders ready for review and approval.
              </p>
              {waitingOrders.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
                    <p className="text-muted-foreground text-center max-w-md">
                      No orders pending review at the moment. New orders will appear here when they're received.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6">
                  {waitingOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onClick={() => handleOrderClick(order)}
                      onReject={handleReject}
                      onApprove={handleApprove}
                      onRequestInfo={handleRequestInfo}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="clarification" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Orders missing information. Request clarification from the customer before processing.
              </p>
              {clarificationOrders.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No incomplete orders</h3>
                    <p className="text-muted-foreground text-center max-w-md">
                      Orders needing clarification will appear here when customers send incomplete information.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6">
                  {clarificationOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onClick={() => handleOrderClick(order)}
                      onReject={handleReject}
                      onApprove={handleApprove}
                      onRequestInfo={handleRequestInfo}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="approved" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Orders that have been approved and are ready for fulfillment.
              </p>
              {approvedOrders.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Clock className="h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No approved orders yet</h3>
                    <p className="text-muted-foreground text-center max-w-md">
                      Approved orders will appear here once they've been processed.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6">
                  {approvedOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onClick={() => handleOrderClick(order)}
                      onReject={handleReject}
                      onApprove={handleApprove}
                      onRequestInfo={handleRequestInfo}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="archived" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Orders that have been archived after processing.
              </p>
              {archivedOrders.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Archive className="h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No archived orders</h3>
                    <p className="text-muted-foreground text-center max-w-md">
                      Archived orders will appear here. You can archive approved orders to keep your workspace tidy.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6">
                  {archivedOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onClick={() => handleOrderClick(order)}
                      onReject={handleReject}
                      onApprove={handleApprove}
                      onRequestInfo={handleRequestInfo}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Order Edit Modal */}
      <OrderEditModal
        order={selectedOrder}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSave}
        onSaveAndApprove={handleSaveAndApprove}
        onSaveAndAnalyze={handleSaveAndAnalyze}
        onRequestInfo={handleRequestInfoWithMessage}
        onSaveClarificationMessage={handleSaveClarificationMessage}
        orgRequiredFields={orgRequiredFields}
      />
    </div>
  )
}
