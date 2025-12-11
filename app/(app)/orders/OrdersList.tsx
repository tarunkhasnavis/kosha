"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, Filter, RefreshCw, TrendingUp, Clock, CheckCircle, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { OrderCard } from "./components/OrderCard"
import { approveOrder, rejectOrder, requestOrderInfo } from "@/lib/actions/orders"
import { createClient } from "@/utils/supabase/client"
import type { Order, OrderStats } from "@/types/orders"

interface OrdersListProps {
  initialOrders: Order[]
  initialStats: OrderStats
}

export function OrdersList({ initialOrders, initialStats }: OrdersListProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const router = useRouter()
  const { toast } = useToast()

  // Set initial timestamp only on client
  useEffect(() => {
    setLastUpdated(new Date())
  }, [])

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
          setLastUpdated(new Date())
          router.refresh()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [router])

  const handleRefresh = () => {
    setIsRefreshing(true)
    setLastUpdated(new Date())
    router.refresh()
    setTimeout(() => setIsRefreshing(false), 500)
  }

  const handleApprove = async (orderId: string) => {
    try {
      await approveOrder(orderId)
      toast({
        title: "Success",
        description: "Order approved successfully",
      })
    } catch (error) {
      console.error("Failed to approve order:", error)
      toast({
        title: "Error",
        description: "Failed to approve order",
        variant: "destructive",
      })
    }
  }

  const handleReject = async (orderId: string) => {
    try {
      await rejectOrder(orderId, "Manual rejection")
      toast({
        title: "Success",
        description: "Order rejected successfully",
      })
    } catch (error) {
      console.error("Failed to reject order:", error)
      toast({
        title: "Error",
        description: "Failed to reject order",
        variant: "destructive",
      })
    }
  }

  const handleRequestInfo = async (orderId: string) => {
    const order = initialOrders.find((o) => o.id === orderId)
    if (!order) return

    try {
      await requestOrderInfo(orderId, order.company_name)
      toast({
        title: "Success",
        description: "Information request sent successfully",
      })
    } catch (error) {
      console.error("Failed to request info:", error)
      toast({
        title: "Error",
        description: "Failed to send information request",
        variant: "destructive",
      })
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

  return (
    <div className="flex h-screen bg-gray-50">
      <main className="flex-1 overflow-y-auto pl-64">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-8 max-w-[1920px] mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
              <p className="text-muted-foreground mt-1">AI-powered order processing and management</p>
              {lastUpdated && (
                <p className="text-muted-foreground text-xs mt-1">
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <CheckCircle className="h-3 w-3 mr-1" />
                System Online
              </Badge>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
            <Card className="border-l-4 border-l-orange-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
                <Clock className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{initialStats.waitingReview}</div>
                <p className="text-xs text-muted-foreground">Awaiting approval</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                <TrendingUp className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{initialStats.totalToday}</div>
                <p className="text-xs text-muted-foreground">Last 24 hours</p>
              </CardContent>
            </Card>
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by order number or company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="waiting" className="space-y-6">
            <TabsList className="grid w-full max-w-3xl grid-cols-3">
              <TabsTrigger value="waiting" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Pending Review
                <Badge variant="secondary" className="ml-1">
                  {waitingOrders.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="clarification" className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Needs Info
                <Badge variant="secondary" className="ml-1">
                  {clarificationOrders.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="approved" className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Approved
                <Badge variant="secondary" className="ml-1">
                  {approvedOrders.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="waiting" className="space-y-6">
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
                      onApprove={handleApprove}
                      onReject={handleReject}
                      onRequestInfo={handleRequestInfo}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="clarification" className="space-y-6">
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
                      onApprove={handleApprove}
                      onReject={handleReject}
                      onRequestInfo={handleRequestInfo}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="approved" className="space-y-6">
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
                      onApprove={handleApprove}
                      onReject={handleReject}
                      onRequestInfo={handleRequestInfo}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
