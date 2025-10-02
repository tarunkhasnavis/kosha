"use client"

import Link from "next/link"
import { useState } from "react"
import { ArrowLeft, Calendar, CheckCircle, Download, FileText, Info, Package, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MainNav } from "@/components/main-nav"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export default function BatchDetailPage({ params }) {
  const batchId = params.id
  const batch = getBatchById(batchId)
  const [selectedIngredient, setSelectedIngredient] = useState(null)

  if (!batch) {
    return <div>Batch not found</div>
  }

  return (
    <div className="flex min-h-screen w-full">
      <MainNav />
      <main className="flex-1 overflow-auto pl-64">
        <div className="flex flex-col gap-4 p-4 md:gap-8 md:p-8">
          <div className="flex items-center gap-2">
            <Link href="/batches">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Back</span>
              </Button>
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">Batch {batchId}</h1>
            <BatchStatusBadge status={batch.status} />
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Button size="sm">
                <FileText className="mr-2 h-4 w-4" />
                Generate Report
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Product</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{batch.product}</div>
                <p className="text-xs text-muted-foreground">
                  SKU: PRD-{batch.product.substring(0, 3).toUpperCase()}-001
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Production Date</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{batch.productionDate}</div>
                <p className="text-xs text-muted-foreground">Expires: {batch.expiryDate}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Quantity</CardTitle>
                <Info className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">
                  {batch.quantity} {batch.unit}
                </div>
                <p className="text-xs text-muted-foreground">Lot size: {batch.quantity} units</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">QC Status</CardTitle>
                {batch.qcStatus === "Passed" ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : batch.qcStatus === "Failed" ? (
                  <XCircle className="h-4 w-4 text-red-500" />
                ) : (
                  <Info className="h-4 w-4 text-yellow-500" />
                )}
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{batch.qcStatus}</div>
                <p className="text-xs text-muted-foreground">Last checked: {batch.lastQCDate}</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="ingredients" className="space-y-4">
            <TabsList>
              <TabsTrigger value="ingredients">Ingredients</TabsTrigger>
              <TabsTrigger value="quality">Quality Control</TabsTrigger>
              <TabsTrigger value="allergens">Allergen Info</TabsTrigger>
              <TabsTrigger value="traceability">Traceability</TabsTrigger>
            </TabsList>
            <TabsContent value="ingredients" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Batch Ingredients</CardTitle>
                  <CardDescription>Ingredients used in this production batch</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ingredient</TableHead>
                        <TableHead>Batch/Lot #</TableHead>
                        <TableHead>Quantity Used</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Expiry Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batch.ingredients.map((ingredient) => (
                        <TableRow key={ingredient.name}>
                          <TableCell className="font-medium">{ingredient.name}</TableCell>
                          <TableCell>{ingredient.lotNumber}</TableCell>
                          <TableCell>
                            {ingredient.quantityUsed} {ingredient.unit}
                          </TableCell>
                          <TableCell>{ingredient.supplier}</TableCell>
                          <TableCell>{ingredient.expiryDate}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedIngredient(ingredient)}>
                              Trace
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="quality" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Quality Control Tests</CardTitle>
                  <CardDescription>Quality control test results for this batch</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Test</TableHead>
                        <TableHead>Result</TableHead>
                        <TableHead>Specification</TableHead>
                        <TableHead>Tested By</TableHead>
                        <TableHead>Test Date</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batch.qualityTests.map((test) => (
                        <TableRow key={test.name}>
                          <TableCell className="font-medium">{test.name}</TableCell>
                          <TableCell>{test.result}</TableCell>
                          <TableCell>{test.specification}</TableCell>
                          <TableCell>{test.testedBy}</TableCell>
                          <TableCell>{test.testDate}</TableCell>
                          <TableCell>
                            {test.status === "Pass" ? (
                              <Badge className="bg-green-500">Pass</Badge>
                            ) : test.status === "Fail" ? (
                              <Badge className="bg-red-500">Fail</Badge>
                            ) : (
                              <Badge className="bg-yellow-500">Pending</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="allergens" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Allergen Information</CardTitle>
                  <CardDescription>Allergen profile for this product batch</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-medium">Contains</h3>
                      <Separator className="my-2" />
                      <div className="flex flex-wrap gap-2 mt-2">
                        {batch.allergens.contains.map((allergen) => (
                          <Badge key={allergen} variant="outline" className="border-red-500 text-red-500">
                            {allergen}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-lg font-medium">May Contain (Cross-Contamination)</h3>
                      <Separator className="my-2" />
                      <div className="flex flex-wrap gap-2 mt-2">
                        {batch.allergens.mayContain.map((allergen) => (
                          <Badge key={allergen} variant="outline" className="border-yellow-500 text-yellow-500">
                            {allergen}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-lg font-medium">Allergen Control Measures</h3>
                      <Separator className="my-2" />
                      <ul className="list-disc pl-5 space-y-1">
                        {batch.allergens.controlMeasures.map((measure, index) => (
                          <li key={index} className="text-sm">
                            {measure}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="traceability" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Traceability Information</CardTitle>
                  <CardDescription>Complete traceability data for this batch</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium">Production Information</h3>
                      <Separator className="my-2" />
                      <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 mt-2">
                        <div className="sm:col-span-1">
                          <dt className="text-sm font-medium text-muted-foreground">Production Line</dt>
                          <dd className="mt-1 text-sm">{batch.traceability.productionLine}</dd>
                        </div>
                        <div className="sm:col-span-1">
                          <dt className="text-sm font-medium text-muted-foreground">Shift</dt>
                          <dd className="mt-1 text-sm">{batch.traceability.shift}</dd>
                        </div>
                        <div className="sm:col-span-1">
                          <dt className="text-sm font-medium text-muted-foreground">Production Manager</dt>
                          <dd className="mt-1 text-sm">{batch.traceability.productionManager}</dd>
                        </div>
                        <div className="sm:col-span-1">
                          <dt className="text-sm font-medium text-muted-foreground">Recipe Version</dt>
                          <dd className="mt-1 text-sm">{batch.traceability.recipeVersion}</dd>
                        </div>
                      </dl>
                    </div>

                    <div>
                      <h3 className="text-lg font-medium">Process Parameters</h3>
                      <Separator className="my-2" />
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Process Step</TableHead>
                            <TableHead>Parameter</TableHead>
                            <TableHead>Value</TableHead>
                            <TableHead>Specification</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {batch.traceability.processParameters.map((param, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{param.step}</TableCell>
                              <TableCell>{param.parameter}</TableCell>
                              <TableCell>{param.value}</TableCell>
                              <TableCell>{param.specification}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div>
                      <h3 className="text-lg font-medium">Distribution Information</h3>
                      <Separator className="my-2" />
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Shipment ID</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Quantity</TableHead>
                            <TableHead>Ship Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {batch.traceability.distribution.map((dist, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{dist.shipmentId}</TableCell>
                              <TableCell>{dist.customer}</TableCell>
                              <TableCell>
                                {dist.quantity} {batch.unit}
                              </TableCell>
                              <TableCell>{dist.shipDate}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Ingredient Traceability Dialog */}
      <Dialog open={!!selectedIngredient} onOpenChange={() => setSelectedIngredient(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Ingredient Traceability</DialogTitle>
            <DialogDescription>
              Tracking ingredient: {selectedIngredient?.name} (Lot: {selectedIngredient?.lotNumber})
            </DialogDescription>
          </DialogHeader>

          {selectedIngredient && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Ingredient Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-muted-foreground">Name</dt>
                      <dd className="mt-1 text-sm">{selectedIngredient.name}</dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-muted-foreground">Lot Number</dt>
                      <dd className="mt-1 text-sm">{selectedIngredient.lotNumber}</dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-muted-foreground">Supplier</dt>
                      <dd className="mt-1 text-sm">{selectedIngredient.supplier}</dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-muted-foreground">Expiry Date</dt>
                      <dd className="mt-1 text-sm">{selectedIngredient.expiryDate}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Batches Using This Ingredient</CardTitle>
                  <CardDescription>All product batches that used this ingredient lot</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Batch Number</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Production Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Quantity Used</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getRelatedBatches(selectedIngredient.lotNumber).map((relatedBatch) => (
                        <TableRow key={relatedBatch.batchNumber}>
                          <TableCell className="font-medium">{relatedBatch.batchNumber}</TableCell>
                          <TableCell>{relatedBatch.product}</TableCell>
                          <TableCell>{relatedBatch.productionDate}</TableCell>
                          <TableCell>
                            <BatchStatusBadge status={relatedBatch.status} />
                          </TableCell>
                          <TableCell>
                            {relatedBatch.ingredientUsage} {selectedIngredient.unit}
                          </TableCell>
                          <TableCell>
                            <Link href={`/batches/${relatedBatch.id}`}>
                              <Button variant="outline" size="sm">
                                View
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function BatchStatusBadge({ status }) {
  switch (status) {
    case "In Production":
      return <Badge className="bg-blue-500">{status}</Badge>
    case "Completed":
      return <Badge className="bg-green-500">{status}</Badge>
    case "QC Pending":
      return <Badge className="bg-yellow-500">{status}</Badge>
    case "Released":
      return <Badge className="bg-emerald-500">{status}</Badge>
    case "On Hold":
      return <Badge className="bg-red-500">{status}</Badge>
    default:
      return <Badge>{status}</Badge>
  }
}

function getBatchById(id) {
  // This would normally fetch from an API or database
  const batch = {
    batchNumber: "B2025-0001",
    product: "Chocolate Chip Cookies",
    productionDate: "2025-03-25",
    expiryDate: "2025-06-25",
    quantity: 500,
    unit: "boxes",
    status: "Released",
    qcStatus: "Passed",
    lastQCDate: "2025-03-26",
    ingredients: [
      {
        name: "Flour (All-Purpose)",
        lotNumber: "FL-2025-0342",
        quantityUsed: 125,
        unit: "kg",
        supplier: "Premium Flour Mills",
        expiryDate: "2025-09-15",
      },
      {
        name: "Sugar (Granulated)",
        lotNumber: "SG-2025-0156",
        quantityUsed: 80,
        unit: "kg",
        supplier: "Sweet Supplies Inc.",
        expiryDate: "2025-12-10",
      },
      {
        name: "Chocolate Chips",
        lotNumber: "CC-2025-0089",
        quantityUsed: 60,
        unit: "kg",
        supplier: "Cocoa Delights",
        expiryDate: "2025-08-20",
      },
      {
        name: "Butter",
        lotNumber: "BT-2025-0211",
        quantityUsed: 45,
        unit: "kg",
        supplier: "Dairy Fresh",
        expiryDate: "2025-05-15",
      },
      {
        name: "Eggs",
        lotNumber: "EG-2025-0422",
        quantityUsed: 30,
        unit: "kg",
        supplier: "Farm Fresh Eggs",
        expiryDate: "2025-04-10",
      },
    ],
    qualityTests: [
      {
        name: "Moisture Content",
        result: "4.2%",
        specification: "≤ 5.0%",
        testedBy: "John Smith",
        testDate: "2025-03-26",
        status: "Pass",
      },
      {
        name: "Weight Check",
        result: "252g",
        specification: "250g ± 5g",
        testedBy: "John Smith",
        testDate: "2025-03-26",
        status: "Pass",
      },
      {
        name: "Microbiological Test",
        result: "< 10 CFU/g",
        specification: "< 100 CFU/g",
        testedBy: "Sarah Johnson",
        testDate: "2025-03-26",
        status: "Pass",
      },
      {
        name: "Sensory Evaluation",
        result: "8.5/10",
        specification: "≥ 7/10",
        testedBy: "Taste Panel",
        testDate: "2025-03-26",
        status: "Pass",
      },
      {
        name: "Metal Detection",
        result: "No detection",
        specification: "No metal > 2.0mm",
        testedBy: "Quality Team",
        testDate: "2025-03-26",
        status: "Pass",
      },
    ],
    allergens: {
      contains: ["Wheat", "Milk", "Eggs"],
      mayContain: ["Nuts", "Soy"],
      controlMeasures: [
        "Dedicated production line for allergen control",
        "Thorough cleaning between production runs",
        "Allergen testing of finished product",
        "Staff training on allergen handling protocols",
        "Separate storage of allergenic ingredients",
      ],
    },
    traceability: {
      productionLine: "Line 3",
      shift: "Morning Shift (6AM-2PM)",
      productionManager: "Michael Rodriguez",
      recipeVersion: "CC-Cookie-v2.3",
      processParameters: [
        {
          step: "Mixing",
          parameter: "Time",
          value: "12 minutes",
          specification: "10-15 minutes",
        },
        {
          step: "Mixing",
          parameter: "Temperature",
          value: "22°C",
          specification: "20-24°C",
        },
        {
          step: "Baking",
          parameter: "Temperature",
          value: "175°C",
          specification: "170-180°C",
        },
        {
          step: "Baking",
          parameter: "Time",
          value: "12 minutes",
          specification: "11-13 minutes",
        },
        {
          step: "Cooling",
          parameter: "Time",
          value: "30 minutes",
          specification: "≥ 25 minutes",
        },
      ],
      distribution: [
        {
          shipmentId: "SH-2025-0089",
          customer: "GroceryMart Chain",
          quantity: 300,
          shipDate: "2025-03-28",
        },
        {
          shipmentId: "SH-2025-0092",
          customer: "CafeFresh Stores",
          quantity: 150,
          shipDate: "2025-03-29",
        },
        {
          shipmentId: "SH-2025-0095",
          customer: "School District #42",
          quantity: 50,
          shipDate: "2025-03-30",
        },
      ],
    },
  }

  return batch
}

function getRelatedBatches(ingredientLotNumber) {
  // This would normally fetch from an API or database
  // For now, we'll return mock data based on the ingredient lot number

  // Common batches that will appear for any ingredient
  const commonBatches = [
    {
      id: "1",
      batchNumber: "B2025-0001",
      product: "Chocolate Chip Cookies",
      productionDate: "2025-03-25",
      status: "Released",
      ingredientUsage: 125,
    },
  ]

  // Specific batches based on ingredient lot
  const specificBatches = {
    "FL-2025-0342": [
      {
        id: "2",
        batchNumber: "B2025-0008",
        product: "Sugar Cookies",
        productionDate: "2025-03-27",
        status: "Released",
        ingredientUsage: 80,
      },
      {
        id: "3",
        batchNumber: "B2025-0012",
        product: "Shortbread Cookies",
        productionDate: "2025-03-28",
        status: "QC Pending",
        ingredientUsage: 60,
      },
    ],
    "SG-2025-0156": [
      {
        id: "4",
        batchNumber: "B2025-0009",
        product: "Vanilla Cupcakes",
        productionDate: "2025-03-27",
        status: "Released",
        ingredientUsage: 45,
      },
      {
        id: "5",
        batchNumber: "B2025-0015",
        product: "Birthday Cake",
        productionDate: "2025-03-29",
        status: "In Production",
        ingredientUsage: 30,
      },
    ],
    "CC-2025-0089": [
      {
        id: "6",
        batchNumber: "B2025-0010",
        product: "Double Chocolate Brownies",
        productionDate: "2025-03-27",
        status: "Released",
        ingredientUsage: 40,
      },
      {
        id: "7",
        batchNumber: "B2025-0016",
        product: "Chocolate Muffins",
        productionDate: "2025-03-29",
        status: "Completed",
        ingredientUsage: 25,
      },
    ],
    "BT-2025-0211": [
      {
        id: "8",
        batchNumber: "B2025-0011",
        product: "Butter Croissants",
        productionDate: "2025-03-28",
        status: "Released",
        ingredientUsage: 35,
      },
      {
        id: "9",
        batchNumber: "B2025-0017",
        product: "Danish Pastries",
        productionDate: "2025-03-30",
        status: "QC Pending",
        ingredientUsage: 20,
      },
    ],
    "EG-2025-0422": [
      {
        id: "10",
        batchNumber: "B2025-0013",
        product: "Egg Custard Tarts",
        productionDate: "2025-03-28",
        status: "Released",
        ingredientUsage: 25,
      },
      {
        id: "11",
        batchNumber: "B2025-0018",
        product: "Meringue Cookies",
        productionDate: "2025-03-30",
        status: "In Production",
        ingredientUsage: 15,
      },
    ],
  }

  // Return the common batches plus any specific batches for this ingredient lot
  return [...commonBatches, ...(specificBatches[ingredientLotNumber] || [])]
}
