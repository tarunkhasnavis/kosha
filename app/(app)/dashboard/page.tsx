"use client"

import { useState } from "react"
import { MainNav } from "@/components/main-nav"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
} from "recharts"
import {
  Package,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Users,
  Calendar,
  Clock,
  CheckCircle,
  ArrowUpRight,
  ShoppingCart,
  Truck,
  Store,
} from "lucide-react"

// Mock data for charts
const inventoryData = [
  { name: "Jan", value: 4000, target: 4500 },
  { name: "Feb", value: 3000, target: 4200 },
  { name: "Mar", value: 5000, target: 4800 },
  { name: "Apr", value: 4500, target: 4600 },
  { name: "May", value: 6000, target: 5200 },
  { name: "Jun", value: 5500, target: 5400 },
]

const categoryData = [
  { name: "Dairy", value: 35, color: "#3b82f6" },
  { name: "Meat", value: 25, color: "#ef4444" },
  { name: "Produce", value: 20, color: "#10b981" },
  { name: "Bakery", value: 12, color: "#f59e0b" },
  { name: "Other", value: 8, color: "#8b5cf6" },
]

const expiringData = [
  { name: "Today", critical: 12, warning: 8, normal: 45 },
  { name: "Tomorrow", critical: 8, warning: 15, normal: 52 },
  { name: "3 Days", critical: 5, warning: 22, normal: 48 },
  { name: "1 Week", critical: 2, warning: 18, normal: 65 },
]

const supplierData = [
  { name: "FreshCorp", performance: 95, orders: 45, onTime: 98 },
  { name: "QualityFoods", performance: 92, orders: 38, onTime: 94 },
  { name: "LocalFarm", performance: 88, orders: 22, onTime: 91 },
  { name: "GlobalSupply", performance: 85, orders: 67, onTime: 87 },
]

// Mock low stock items
const lowStockItems = [
  {
    id: 1,
    name: "Organic Milk",
    category: "Dairy",
    currentStock: 12,
    minStock: 50,
    unit: "gallons",
    supplier: "FreshCorp",
    lastOrdered: "2024-01-10",
    status: "critical",
  },
  {
    id: 2,
    name: "Whole Wheat Flour",
    category: "Bakery",
    currentStock: 25,
    minStock: 100,
    unit: "lbs",
    supplier: "QualityFoods",
    lastOrdered: "2024-01-08",
    status: "low",
  },
  {
    id: 3,
    name: "Free Range Eggs",
    category: "Dairy",
    currentStock: 8,
    minStock: 30,
    unit: "dozen",
    supplier: "LocalFarm",
    lastOrdered: "2024-01-12",
    status: "critical",
  },
  {
    id: 4,
    name: "Olive Oil",
    category: "Pantry",
    currentStock: 15,
    minStock: 40,
    unit: "bottles",
    supplier: "GlobalSupply",
    lastOrdered: "2024-01-09",
    status: "low",
  },
]

// Mock expiring items
const expiringItems = [
  {
    id: 1,
    name: "Fresh Salmon",
    category: "Seafood",
    expiryDate: "2024-01-16",
    daysUntilExpiry: 1,
    quantity: 8,
    unit: "lbs",
    batchNumber: "SF-2024-001",
    supplier: "OceanFresh",
    status: "critical",
  },
  {
    id: 2,
    name: "Organic Spinach",
    category: "Produce",
    expiryDate: "2024-01-17",
    daysUntilExpiry: 2,
    quantity: 12,
    unit: "bunches",
    batchNumber: "OS-2024-045",
    supplier: "GreenFields",
    status: "critical",
  },
  {
    id: 3,
    name: "Greek Yogurt",
    category: "Dairy",
    expiryDate: "2024-01-18",
    daysUntilExpiry: 3,
    quantity: 24,
    unit: "containers",
    batchNumber: "GY-2024-089",
    supplier: "DairyBest",
    status: "warning",
  },
  {
    id: 4,
    name: "Sourdough Bread",
    category: "Bakery",
    expiryDate: "2024-01-19",
    daysUntilExpiry: 4,
    quantity: 15,
    unit: "loaves",
    batchNumber: "SB-2024-156",
    supplier: "ArtisanBakery",
    status: "warning",
  },
  {
    id: 5,
    name: "Bell Peppers",
    category: "Produce",
    expiryDate: "2024-01-22",
    daysUntilExpiry: 7,
    quantity: 30,
    unit: "pieces",
    batchNumber: "BP-2024-078",
    supplier: "FarmFresh",
    status: "normal",
  },
]

const getStockStatusColor = (status: string) => {
  switch (status) {
    case "critical":
      return "bg-red-100 text-red-800 border-red-200"
    case "low":
      return "bg-yellow-100 text-yellow-800 border-yellow-200"
    default:
      return "bg-green-100 text-green-800 border-green-200"
  }
}

const getExpiryStatusColor = (status: string) => {
  switch (status) {
    case "critical":
      return "bg-red-100 text-red-800 border-red-200"
    case "warning":
      return "bg-yellow-100 text-yellow-800 border-yellow-200"
    case "normal":
      return "bg-green-100 text-green-800 border-green-200"
    default:
      return "bg-gray-100 text-gray-800 border-gray-200"
  }
}

const getExpiryStatusText = (daysUntilExpiry: number) => {
  if (daysUntilExpiry <= 1) return "Expires Today"
  if (daysUntilExpiry <= 3) return "Expires Soon"
  if (daysUntilExpiry <= 7) return "Expires This Week"
  return "Good"
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("overview")

  return (
    <div className="flex min-h-screen w-full">
      <MainNav />
      <main className="flex-1 overflow-auto pl-64">
        <div className="flex flex-col gap-4 p-4 md:gap-8 md:p-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <CheckCircle className="h-3 w-3 mr-1" />
                System Healthy
              </Badge>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="categories">Categories</TabsTrigger>
              <TabsTrigger value="value">Value Analysis</TabsTrigger>
              <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              {/* Summary Cards */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-blue-900">Total Items</CardTitle>
                    <Package className="h-4 w-4 text-blue-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-900">2,847</div>
                    <p className="text-xs text-blue-700 flex items-center">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      +12% from last month
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-green-900">Total Value</CardTitle>
                    <DollarSign className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-900">$45,231</div>
                    <p className="text-xs text-green-700 flex items-center">
                      <ArrowUpRight className="h-3 w-3 mr-1" />
                      +8% from last month
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-yellow-900">Low Stock</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-yellow-900">{lowStockItems.length}</div>
                    <p className="text-xs text-yellow-700">Items need reordering</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-purple-900">Suppliers</CardTitle>
                    <Users className="h-4 w-4 text-purple-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-900">24</div>
                    <p className="text-xs text-purple-700">Active partnerships</p>
                  </CardContent>
                </Card>
              </div>

              {/* Low Stock Items */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    Low Stock Items
                  </CardTitle>
                  <CardDescription>Items that need immediate attention</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {lowStockItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                            <Package className="h-5 w-5 text-gray-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{item.name}</h3>
                            <p className="text-sm text-gray-600">{item.category}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className={getStockStatusColor(item.status)}>
                                {item.status === "critical" ? "Critical" : "Low Stock"}
                              </Badge>
                              <span className="text-xs text-gray-500">
                                {item.currentStock} / {item.minStock} {item.unit}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right text-sm">
                            <p className="text-gray-600">Supplier: {item.supplier}</p>
                            <p className="text-gray-500">Last ordered: {item.lastOrdered}</p>
                          </div>
                          <Button size="sm">
                            <ShoppingCart className="h-4 w-4 mr-1" />
                            Reorder
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Expiring Goods */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-orange-500" />
                    Expiring Goods
                  </CardTitle>
                  <CardDescription>Items expiring soon that need attention</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {expiringItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                            <Calendar className="h-5 w-5 text-orange-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{item.name}</h3>
                            <p className="text-sm text-gray-600">{item.category}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className={getExpiryStatusColor(item.status)}>
                                {getExpiryStatusText(item.daysUntilExpiry)}
                              </Badge>
                              <span className="text-xs text-gray-500">
                                {item.quantity} {item.unit} • Batch: {item.batchNumber}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right text-sm">
                            <p className="text-gray-600">Expires: {item.expiryDate}</p>
                            <p className="text-gray-500">Supplier: {item.supplier}</p>
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline">
                              <Truck className="h-4 w-4 mr-1" />
                              Move
                            </Button>
                            <Button size="sm" variant="outline">
                              <Store className="h-4 w-4 mr-1" />
                              Discount
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Charts */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Inventory Trends</CardTitle>
                    <CardDescription>Monthly inventory levels vs targets</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={inventoryData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stackId="1"
                          stroke="#3b82f6"
                          fill="#3b82f6"
                          fillOpacity={0.6}
                        />
                        <Area
                          type="monotone"
                          dataKey="target"
                          stackId="2"
                          stroke="#10b981"
                          fill="#10b981"
                          fillOpacity={0.3}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Expiring Items Timeline</CardTitle>
                    <CardDescription>Items expiring by timeframe</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={expiringData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="critical" stackId="a" fill="#ef4444" />
                        <Bar dataKey="warning" stackId="a" fill="#f59e0b" />
                        <Bar dataKey="normal" stackId="a" fill="#10b981" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="categories" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Category Distribution</CardTitle>
                    <CardDescription>Inventory breakdown by category</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${((percent as number) * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Category Performance</CardTitle>
                    <CardDescription>Stock levels by category</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {categoryData.map((category) => (
                        <div key={category.name} className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm font-medium">{category.name}</span>
                            <span className="text-sm text-gray-500">{category.value}%</span>
                          </div>
                          <Progress value={category.value} className="h-2" />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="value" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle>High Value Items</CardTitle>
                    <CardDescription>Most expensive inventory</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Premium Beef</span>
                        <span className="font-semibold">$2,450</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Organic Salmon</span>
                        <span className="font-semibold">$1,890</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Truffle Oil</span>
                        <span className="font-semibold">$1,200</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Value at Risk</CardTitle>
                    <CardDescription>Items expiring soon</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Fresh Salmon</span>
                        <span className="font-semibold text-red-600">$340</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Organic Produce</span>
                        <span className="font-semibold text-yellow-600">$180</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Dairy Products</span>
                        <span className="font-semibold text-yellow-600">$95</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Cost Savings</CardTitle>
                    <CardDescription>This month</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Bulk Purchasing</span>
                        <span className="font-semibold text-green-600">+$1,240</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Waste Reduction</span>
                        <span className="font-semibold text-green-600">+$890</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Early Bird Discounts</span>
                        <span className="font-semibold text-green-600">+$340</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="suppliers" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Supplier Performance</CardTitle>
                  <CardDescription>Key metrics for active suppliers</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {supplierData.map((supplier) => (
                      <div key={supplier.name} className="p-4 border rounded-lg">
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="font-semibold">{supplier.name}</h3>
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            {supplier.performance}% Performance
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500">Orders</p>
                            <p className="font-semibold">{supplier.orders}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">On-Time Delivery</p>
                            <p className="font-semibold">{supplier.onTime}%</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Quality Score</p>
                            <p className="font-semibold">{supplier.performance}%</p>
                          </div>
                        </div>
                        <Progress value={supplier.performance} className="mt-3 h-2" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
