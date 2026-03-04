"use client"

import { useState, useEffect } from "react"
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Badge, Tabs, TabsContent, TabsList, TabsTrigger, Progress, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@kosha/ui"
import { Play, Pause, Square, Settings, Thermometer, Users, Clock, TrendingUp, AlertTriangle, CheckCircle, Activity, BarChart3, Calendar, ChevronDown } from 'lucide-react'
import { TemperatureHistory } from "@/app/(app)/production/components/temperature-history"

interface ProductionLine {
  id: string
  name: string
  status: 'running' | 'idle' | 'maintenance' | 'stopped'
  currentProduct: string
  efficiency: number
  outputRate: number
  targetRate: number
  temperature: number
  lastMaintenance: string
  nextMaintenance: string
  operatorCount: number
}

interface ProductionMetrics {
  totalOutput: number
  efficiency: number
  qualityRate: number
  downtime: number
  activeLines: number
  totalLines: number
}

const productionLines: ProductionLine[] = [
  {
    id: "line-1",
    name: "Baking Line A",
    status: "running",
    currentProduct: "Chocolate Chip Cookies",
    efficiency: 94.5,
    outputRate: 850,
    targetRate: 900,
    temperature: 185,
    lastMaintenance: "2024-08-01",
    nextMaintenance: "2024-08-15",
    operatorCount: 3
  },
  {
    id: "line-2", 
    name: "Mixing Line B",
    status: "running",
    currentProduct: "Vanilla Cupcake Batter",
    efficiency: 87.2,
    outputRate: 420,
    targetRate: 480,
    temperature: 22,
    lastMaintenance: "2024-07-28",
    nextMaintenance: "2024-08-12",
    operatorCount: 2
  },
  {
    id: "line-3",
    name: "Packaging Line C", 
    status: "idle",
    currentProduct: "Sourdough Bread",
    efficiency: 0,
    outputRate: 0,
    targetRate: 300,
    temperature: 18,
    lastMaintenance: "2024-08-03",
    nextMaintenance: "2024-08-17",
    operatorCount: 4
  },
  {
    id: "line-4",
    name: "Decorating Line D",
    status: "maintenance", 
    currentProduct: "Birthday Cakes",
    efficiency: 0,
    outputRate: 0,
    targetRate: 120,
    temperature: 16,
    lastMaintenance: "2024-08-06",
    nextMaintenance: "2024-08-20",
    operatorCount: 1
  }
]

const productionMetrics: ProductionMetrics = {
  totalOutput: 1270,
  efficiency: 90.8,
  qualityRate: 98.2,
  downtime: 2.5,
  activeLines: 2,
  totalLines: 4
}

export default function ProductionPage() {
  const [batches, setBatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBatches = async () => {
      try {
        const response = await fetch("/api/batches")
        if (response.ok) {
          const data = await response.json()
          // Filter for active/planned batches only
          const activeBatches = data.filter((batch: any) => 
            batch.status === 'in_progress' || batch.status === 'planned'
          )
          setBatches(activeBatches)
        }
      } catch (error) {
        console.error("Error fetching batches:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchBatches()
  }, [])

  const getStatusBadge = (status: string) => {
    const variants = {
      running: "bg-green-100 text-green-800",
      idle: "bg-yellow-100 text-yellow-800", 
      maintenance: "bg-red-100 text-red-800",
      stopped: "bg-gray-100 text-gray-800"
    }
    
    const icons = {
      running: <Activity className="h-3 w-3 mr-1" />,
      idle: <Clock className="h-3 w-3 mr-1" />,
      maintenance: <Settings className="h-3 w-3 mr-1" />,
      stopped: <Square className="h-3 w-3 mr-1" />
    }

    return (
      <Badge className={variants[status as keyof typeof variants]}>
        {icons[status as keyof typeof icons]}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  const handleLineAction = (lineId: string, action: string) => {
    console.log(`${action} action for line ${lineId}`)
    // Implement line control logic here
  }

  return (
    <div className="flex min-h-screen w-full">
      <main className="flex-1 overflow-auto md:pl-60">
        <div className="container mx-auto py-10 px-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Production Operations</h1>
              <p className="text-muted-foreground">Monitor production lines, equipment status, and operational metrics</p>
            </div>
          </div>

          {/* Production Metrics Overview */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Output Today</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{productionMetrics.totalOutput.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">units produced</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Overall Efficiency</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{productionMetrics.efficiency}%</div>
                <Progress value={productionMetrics.efficiency} className="mt-2" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Quality Rate</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{productionMetrics.qualityRate}%</div>
                <p className="text-xs text-muted-foreground">pass rate</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Lines</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{productionMetrics.activeLines}/{productionMetrics.totalLines}</div>
                <p className="text-xs text-muted-foreground">lines operational</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="lines" className="space-y-4">
            <TabsList>
              <TabsTrigger value="lines">Production Lines</TabsTrigger>
              <TabsTrigger value="schedule">Production Schedule</TabsTrigger>
              <TabsTrigger value="temperature">Temperature Monitoring</TabsTrigger>
              <TabsTrigger value="quality">Quality Control</TabsTrigger>
            </TabsList>

            <TabsContent value="lines" className="space-y-4">
              <div className="grid gap-4">
                {productionLines.map((line) => (
                  <Card key={line.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CardTitle className="text-lg">{line.name}</CardTitle>
                          {getStatusBadge(line.status)}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              Actions <ChevronDown className="ml-2 h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => handleLineAction(line.id, 'start')}>
                              <Play className="mr-2 h-4 w-4" />
                              Start Line
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleLineAction(line.id, 'pause')}>
                              <Pause className="mr-2 h-4 w-4" />
                              Pause Line
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleLineAction(line.id, 'stop')}>
                              <Square className="mr-2 h-4 w-4" />
                              Stop Line
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleLineAction(line.id, 'maintenance')}>
                              <Settings className="mr-2 h-4 w-4" />
                              Schedule Maintenance
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <CardDescription>Currently producing: {line.currentProduct}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-4">
                        <div>
                          <div className="text-sm font-medium text-muted-foreground">Efficiency</div>
                          <div className="text-2xl font-bold">{line.efficiency}%</div>
                          <Progress value={line.efficiency} className="mt-1" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-muted-foreground">Output Rate</div>
                          <div className="text-2xl font-bold">{line.outputRate}</div>
                          <div className="text-xs text-muted-foreground">/ {line.targetRate} target</div>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-muted-foreground">Temperature</div>
                          <div className="text-2xl font-bold flex items-center">
                            <Thermometer className="h-4 w-4 mr-1" />
                            {line.temperature}°C
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-muted-foreground">Operators</div>
                          <div className="text-2xl font-bold flex items-center">
                            <Users className="h-4 w-4 mr-1" />
                            {line.operatorCount}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="schedule" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Active Production Schedule
                  </CardTitle>
                  <CardDescription>Current and upcoming production batches</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
                      <p className="text-muted-foreground">Loading production schedule...</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left py-3 px-4 font-medium text-gray-900 w-32">Batch Number</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-900 w-48">Product</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-900 w-32">Production Date</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-900 w-24">Quantity</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-900 w-24">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {batches.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="text-center py-8 text-muted-foreground">
                                No active production batches scheduled
                              </td>
                            </tr>
                          ) : (
                            batches.map((batch) => (
                              <tr key={batch.id} className="border-b hover:bg-gray-50">
                                <td className="py-3 px-4 align-top">
                                  <div className="font-medium text-sm whitespace-nowrap">{batch.batchNumber}</div>
                                </td>
                                <td className="py-3 px-4 align-top">
                                  <div className="text-sm">{batch.product}</div>
                                </td>
                                <td className="py-3 px-4 align-top">
                                  <div className="text-sm whitespace-nowrap">
                                    {new Date(batch.productionDate).toLocaleDateString()}
                                  </div>
                                </td>
                                <td className="py-3 px-4 align-top">
                                  <div className="text-sm whitespace-nowrap">{batch.quantity} {batch.unit}</div>
                                </td>
                                <td className="py-3 px-4 align-top">
                                  <Badge className={batch.status === 'in_progress' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}>
                                    {batch.status === 'in_progress' ? 'In Progress' : 'Planned'}
                                  </Badge>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="temperature" className="space-y-4">
              <TemperatureHistory />
            </TabsContent>

            <TabsContent value="quality" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Quality Pass Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">98.2%</div>
                    <Progress value={98.2} className="mt-2" />
                    <p className="text-xs text-muted-foreground mt-1">Last 24 hours</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Defect Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">1.8%</div>
                    <Progress value={1.8} className="mt-2" />
                    <p className="text-xs text-muted-foreground mt-1">Within acceptable limits</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Inspections Today</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">47</div>
                    <div className="flex items-center gap-2 mt-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-600">45 passed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <span className="text-sm text-red-600">2 failed</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
