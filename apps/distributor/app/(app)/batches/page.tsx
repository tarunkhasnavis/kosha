"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowUpDown, ChevronDown, Download, Filter, Plus, Search, Eye, Edit, Trash2 } from 'lucide-react'

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kosha/ui"
import { toast } from "sonner"

interface Batch {
  id: string
  batchNumber: string
  product: string
  productionDate: string
  expiryDate: string
  quantity: number
  unit: string
  status: string
  qcStatus: string
  yieldPercentage?: number
  notes?: string
}

// Mock data for batches
const mockBatches: Batch[] = [
  {
    id: "1",
    batchNumber: "B2024-001",
    product: "Chocolate Chip Cookies",
    productionDate: "2024-08-01",
    expiryDate: "2024-08-15",
    quantity: 500,
    unit: "pieces",
    status: "completed",
    qcStatus: "Passed",
    yieldPercentage: 98.5
  },
  {
    id: "2",
    batchNumber: "B2024-002",
    product: "Vanilla Cupcakes",
    productionDate: "2024-08-02",
    expiryDate: "2024-08-16",
    quantity: 200,
    unit: "pieces",
    status: "in_progress",
    qcStatus: "Pending",
    yieldPercentage: 95.2
  },
  {
    id: "3",
    batchNumber: "B2024-003",
    product: "Sourdough Bread",
    productionDate: "2024-08-03",
    expiryDate: "2024-08-10",
    quantity: 50,
    unit: "loaves",
    status: "completed",
    qcStatus: "Passed",
    yieldPercentage: 97.8
  }
]

export default function BatchesPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [batches, setBatches] = useState<Batch[]>(mockBatches)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [recipes] = useState([
    { id: "1", name: "Chocolate Chip Cookies" },
    { id: "2", name: "Vanilla Cupcakes" },
    { id: "3", name: "Sourdough Bread" }
  ])
  const [units] = useState([
    { id: "1", name: "Pieces", abbreviation: "pcs" },
    { id: "2", name: "Loaves", abbreviation: "loaves" },
    { id: "3", name: "Kilograms", abbreviation: "kg" }
  ])
  const [newBatch, setNewBatch] = useState({
    recipe_id: "",
    planned_quantity: 0,
    production_date: new Date().toISOString().split("T")[0],
    expiry_date: "",
    unit_id: "",
    production_notes: "",
  })

  const filteredBatches = batches.filter((batch) => {
    const matchesSearch = batch.batchNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         batch.product.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || batch.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const handleAddBatch = () => {
    // Create a new batch with mock data
    const selectedRecipe = recipes.find(r => r.id === newBatch.recipe_id)
    const selectedUnit = units.find(u => u.id === newBatch.unit_id)
    
    const newBatchData: Batch = {
      id: Date.now().toString(),
      batchNumber: `B${new Date().getFullYear()}-${String(batches.length + 1).padStart(3, '0')}`,
      product: selectedRecipe?.name || "",
      productionDate: newBatch.production_date,
      expiryDate: newBatch.expiry_date,
      quantity: newBatch.planned_quantity,
      unit: selectedUnit?.abbreviation || "",
      status: "planned",
      qcStatus: "Pending",
      notes: newBatch.production_notes
    }
    
    setBatches(prev => [...prev, newBatchData])
    setIsAddDialogOpen(false)
    setNewBatch({
      recipe_id: "",
      planned_quantity: 0,
      production_date: new Date().toISOString().split("T")[0],
      expiry_date: "",
      unit_id: "",
      production_notes: "",
    })
    toast.success("Batch created successfully")
  }

  const exportBatches = () => {
    const csvContent = [
      ["Batch Number", "Product", "Production Date", "Expiry Date", "Quantity", "Unit", "Status", "QC Status"].join(","),
      ...filteredBatches.map((batch) =>
        [
          batch.batchNumber,
          batch.product,
          batch.productionDate,
          batch.expiryDate,
          batch.quantity,
          batch.unit,
          batch.status,
          batch.qcStatus,
        ].join(",")
      ),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `batches-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
    toast.success("Batches exported successfully!")
  }

  const statuses = ["planned", "in_progress", "completed", "on_hold", "cancelled"]

  return (
    <div className="flex min-h-screen w-full">
      <main className="flex-1 overflow-auto md:pl-60">
        <div className="container mx-auto py-10 px-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Production Batches</h1>
              <p className="text-muted-foreground">
                Track and manage your production batches ({batches.length} total)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={exportBatches}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New Batch
              </Button>
            </div>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Production Batches</CardTitle>
              <CardDescription>
                Track and manage your production batches
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Search batches..."
                      className="pl-8 w-[250px] sm:w-[300px]"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-9">
                        <Filter className="mr-2 h-4 w-4" />
                        Filter
                        <ChevronDown className="ml-2 h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[200px]">
                      <DropdownMenuCheckboxItem
                        checked={statusFilter === "all"}
                        onCheckedChange={() => setStatusFilter("all")}
                      >
                        All Statuses
                      </DropdownMenuCheckboxItem>
                      {statuses.map((status) => (
                        <DropdownMenuCheckboxItem
                          key={status}
                          checked={statusFilter === status}
                          onCheckedChange={() => setStatusFilter(status)}
                        >
                          {status.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Batch Number</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Production Date</TableHead>
                      <TableHead>Expiry Date</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>QC Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBatches.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No batches found. Click "New Batch" to create your first production batch.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredBatches.map((batch) => (
                        <TableRow key={batch.id}>
                          <TableCell className="font-medium">
                            <Link href={`/batches/${batch.id}`} className="text-primary hover:underline">
                              {batch.batchNumber}
                            </Link>
                          </TableCell>
                          <TableCell>{batch.product}</TableCell>
                          <TableCell>{new Date(batch.productionDate).toLocaleDateString()}</TableCell>
                          <TableCell>{new Date(batch.expiryDate).toLocaleDateString()}</TableCell>
                          <TableCell>{batch.quantity} {batch.unit}</TableCell>
                          <TableCell>
                            <BatchStatusBadge status={batch.status} />
                          </TableCell>
                          <TableCell>
                            <QCStatusBadge status={batch.qcStatus} />
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link href={`/batches/${batch.id}`}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    View Details
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit Batch
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-red-600">
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Cancel Batch
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Add Batch Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Batch</DialogTitle>
            <DialogDescription>
              Enter the details for the new production batch.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="recipe" className="text-right">
                Recipe *
              </Label>
              <Select
                value={newBatch.recipe_id}
                onValueChange={(value) => setNewBatch({ ...newBatch, recipe_id: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a recipe" />
                </SelectTrigger>
                <SelectContent>
                  {recipes.map((recipe) => (
                    <SelectItem key={recipe.id} value={recipe.id}>
                      {recipe.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="quantity" className="text-right">
                Planned Quantity *
              </Label>
              <Input
                id="quantity"
                type="number"
                value={newBatch.planned_quantity}
                onChange={(e) => setNewBatch({ ...newBatch, planned_quantity: Number.parseFloat(e.target.value) })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="unit" className="text-right">
                Unit *
              </Label>
              <Select
                value={newBatch.unit_id}
                onValueChange={(value) => setNewBatch({ ...newBatch, unit_id: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a unit" />
                </SelectTrigger>
                <SelectContent>
                  {units.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.name} ({unit.abbreviation})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="production_date" className="text-right">
                Production Date *
              </Label>
              <Input
                id="production_date"
                type="date"
                value={newBatch.production_date}
                onChange={(e) => setNewBatch({ ...newBatch, production_date: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="expiry_date" className="text-right">
                Expiry Date
              </Label>
              <Input
                id="expiry_date"
                type="date"
                value={newBatch.expiry_date}
                onChange={(e) => setNewBatch({ ...newBatch, expiry_date: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="notes" className="text-right">
                Notes
              </Label>
              <Input
                id="notes"
                value={newBatch.production_notes}
                onChange={(e) => setNewBatch({ ...newBatch, production_notes: e.target.value })}
                className="col-span-3"
                placeholder="Production notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddBatch} disabled={!newBatch.recipe_id || !newBatch.planned_quantity}>
              Create Batch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function BatchStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "planned":
      return <Badge className="bg-blue-500">Planned</Badge>
    case "in_progress":
      return <Badge className="bg-yellow-500">In Progress</Badge>
    case "completed":
      return <Badge className="bg-green-500">Completed</Badge>
    case "on_hold":
      return <Badge className="bg-orange-500">On Hold</Badge>
    case "cancelled":
      return <Badge className="bg-red-500">Cancelled</Badge>
    default:
      return <Badge>{status}</Badge>
  }
}

function QCStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "Passed":
      return <Badge className="bg-green-500">Passed</Badge>
    case "Failed":
      return <Badge className="bg-red-500">Failed</Badge>
    case "Pending":
      return <Badge className="bg-yellow-500">Pending</Badge>
    default:
      return <Badge>{status}</Badge>
  }
}
