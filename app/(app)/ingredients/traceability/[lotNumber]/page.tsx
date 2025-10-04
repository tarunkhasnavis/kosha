"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { MainNav } from "@/components/main-nav"

interface PageProps {
  params: {
    lotNumber: string
  }
}

interface Ingredient {
  name: string
  lotNumber: string
  supplier: string
  receivedDate: string
  expiryDate: string
  unit: string
  status: string
}

interface Batch {
  id: string
  batchNumber: string
  product: string
  productionDate: string
  status: string
  ingredientUsage: number
}

export default function IngredientTraceabilityPage({ params }: PageProps) {
  const lotNumber = params.lotNumber
  const ingredient = getIngredientByLotNumber(lotNumber)

  if (!ingredient) {
    return <div>Ingredient lot not found</div>
  }

  const relatedBatches = getRelatedBatches(lotNumber)

  return (
    <div className="flex min-h-screen w-full">
      <MainNav />
      <main className="flex-1 overflow-auto pl-64">
        <div className="flex flex-col gap-4 p-4 md:gap-8 md:p-8">
          <div className="flex items-center gap-2">
            <Link href="/ingredients">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Back</span>
              </Button>
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">Ingredient Traceability</h1>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Ingredient Details</CardTitle>
              <CardDescription>Information about this ingredient lot</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-3">
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-muted-foreground">Name</dt>
                  <dd className="mt-1 text-sm">{ingredient.name}</dd>
                </div>
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-muted-foreground">Lot Number</dt>
                  <dd className="mt-1 text-sm">{ingredient.lotNumber}</dd>
                </div>
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-muted-foreground">Supplier</dt>
                  <dd className="mt-1 text-sm">{ingredient.supplier}</dd>
                </div>
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-muted-foreground">Received Date</dt>
                  <dd className="mt-1 text-sm">{ingredient.receivedDate}</dd>
                </div>
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-muted-foreground">Expiry Date</dt>
                  <dd className="mt-1 text-sm">{ingredient.expiryDate}</dd>
                </div>
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-muted-foreground">Status</dt>
                  <dd className="mt-1 text-sm">
                    <Badge className={ingredient.status === "Active" ? "bg-green-500" : "bg-red-500"}>
                      {ingredient.status}
                    </Badge>
                  </dd>
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
                  {relatedBatches.map((batch) => (
                    <TableRow key={batch.batchNumber}>
                      <TableCell className="font-medium">{batch.batchNumber}</TableCell>
                      <TableCell>{batch.product}</TableCell>
                      <TableCell>{batch.productionDate}</TableCell>
                      <TableCell>
                        <BatchStatusBadge status={batch.status} />
                      </TableCell>
                      <TableCell>
                        {batch.ingredientUsage} {ingredient.unit}
                      </TableCell>
                      <TableCell>
                        <Link href={`/batches/${batch.id}`}>
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
      </main>
    </div>
  )
}

function BatchStatusBadge({ status }: { status: string }) {
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

function getIngredientByLotNumber(lotNumber: string): Ingredient | null {
  // This would normally fetch from an API or database
  const ingredientMap: Record<string, Ingredient> = {
    "FL-2025-0342": {
      name: "Flour (All-Purpose)",
      lotNumber: "FL-2025-0342",
      supplier: "Premium Flour Mills",
      receivedDate: "2025-03-10",
      expiryDate: "2025-09-15",
      unit: "kg",
      status: "Active",
    },
    "SG-2025-0156": {
      name: "Sugar (Granulated)",
      lotNumber: "SG-2025-0156",
      supplier: "Sweet Supplies Inc.",
      receivedDate: "2025-03-05",
      expiryDate: "2025-12-10",
      unit: "kg",
      status: "Active",
    },
    "CC-2025-0089": {
      name: "Chocolate Chips",
      lotNumber: "CC-2025-0089",
      supplier: "Cocoa Delights",
      receivedDate: "2025-03-08",
      expiryDate: "2025-08-20",
      unit: "kg",
      status: "Active",
    },
    "BT-2025-0211": {
      name: "Butter",
      lotNumber: "BT-2025-0211",
      supplier: "Dairy Fresh",
      receivedDate: "2025-03-15",
      expiryDate: "2025-05-15",
      unit: "kg",
      status: "Active",
    },
    "EG-2025-0422": {
      name: "Eggs",
      lotNumber: "EG-2025-0422",
      supplier: "Farm Fresh Eggs",
      receivedDate: "2025-03-20",
      expiryDate: "2025-04-10",
      unit: "kg",
      status: "Active",
    },
  }

  return ingredientMap[lotNumber] || null
}

function getRelatedBatches(ingredientLotNumber: string): Batch[] {
  // This would normally fetch from an API or database
  // For now, we'll return mock data based on the ingredient lot number

  // Common batches that will appear for any ingredient
  const commonBatches: Batch[] = [
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
  const specificBatches: Record<string, Batch[]> = {
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
