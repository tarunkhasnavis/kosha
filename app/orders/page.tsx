"use client"

import { useState, useEffect } from "react"
import { MainNav } from "@/components/main-nav"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, Filter, RefreshCw, TrendingUp, Clock, CheckCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { OrderCard } from "./components/OrderCard"
import type { Order, OrderStats } from "@/types/orders"


export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [stats, setStats] = useState<OrderStats>({
    waitingReview: 0,
    uploadSuccessful: 0,
    totalToday: 0,
    processingTime: "0 min",
  })
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Placeholder data with fixed timestamps
      const mockOrders: Order[] = [
        {
          id: "1",
          orderNumber: "ORD-2024-001",
          companyName: "Acme Restaurant",
          source: "email",
          status: "waiting_review",
          items: [
            { name: "Organic Tomatoes", quantity: "50 lbs", unit_price: 2.50, total: 125.00 },
            { name: "Fresh Basil", quantity: "10 bunches", unit_price: 3.00, total: 30.00 }
          ],
          orderValue: 155.00,
          itemCount: 2,
          receivedDate: "2024-01-14T10:30:00Z"
        },
        {
          id: "2",
          orderNumber: "ORD-2024-002",
          companyName: "Bistro Belle",
          source: "spreadsheet",
          status: "approved",
          items: [
            { name: "Prime Beef", quantity: "100 lbs", unit_price: 8.50, total: 850.00 }
          ],
          orderValue: 850.00,
          itemCount: 1,
          receivedDate: "2024-01-14T11:45:00Z"
        }
      ]
      
      const mockStats: OrderStats = {
        waitingReview: 1,
        uploadSuccessful: 1,
        totalToday: 2,
        processingTime: "2 min"
      }
      
      setOrders(mockOrders)
      setStats(mockStats)
    } catch (error) {
      console.error("Failed to fetch orders:", error)
      toast({
        title: "Error",
        description: "Failed to fetch orders",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (orderId: string) => {
    try {
      await fetch(`/api/orders/${orderId}/approve`, { method: "POST" })
      toast({
        title: "Success",
        description: "Order approved successfully",
      })
      fetchOrders()
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
      await fetch(`/api/orders/${orderId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Manual rejection" }),
      })
      toast({
        title: "Success",
        description: "Order rejected successfully",
      })
      fetchOrders()
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
    const order = orders.find((o) => o.id === orderId)
    if (!order) return

    try {
      await fetch(`/api/orders/${orderId}/request-info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientEmail: order.companyName,
        }),
      })
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

  const filteredOrders = orders.filter((order) => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    return (
      (order.companyName || "").toLowerCase().includes(searchLower) ||
      (order.orderNumber || "").toLowerCase().includes(searchLower)
    )
  })

  const waitingOrders = filteredOrders.filter((order) => order.status === "waiting_review")
  const approvedOrders = filteredOrders.filter((order) => order.status === "approved")

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <MainNav />
        <main className="flex-1 overflow-y-auto pl-64">
          <div className="w-full px-4 sm:px-6 lg:px-8 py-8 max-w-[1920px] mx-auto">
            <div className="animate-pulse space-y-8">
              <div className="space-y-2">
                <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-24 bg-gray-200 rounded"></div>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-64 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <MainNav />
      <main className="flex-1 overflow-y-auto pl-64">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-8 max-w-[1920px] mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
              <p className="text-muted-foreground mt-1">AI-powered order processing and management</p>
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
                <div className="text-2xl font-bold text-orange-600">{stats.waitingReview}</div>
                <p className="text-xs text-muted-foreground">Awaiting approval</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                <TrendingUp className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{stats.totalToday}</div>
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
              <Button variant="outline" size="sm" onClick={fetchOrders} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="waiting" className="space-y-6">
            <TabsList className="grid w-full max-w-xl grid-cols-2">
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
