"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { IngredientImageUpload } from "@/app/ingredients/components/ingredient-image-upload"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { Pencil, ArrowLeft, Package } from "lucide-react"
import { MainNav } from "@/components/main-nav"
import Link from "next/link"

interface Ingredient {
  id: string
  name: string
  description?: string
  unit?: string
  cost_per_unit?: number
  image_url?: string
  image_description?: string
  storage_instructions?: string
  is_allergen?: boolean
  allergen_type?: string
  shelf_life_days?: number
  category?: string
  supplier?: string
  quantity: number
  minimum_stock: number
  expiry_date: string
  storage_location: string
}

// Mock ingredients data - in a real app, this would come from your API
const mockIngredients: Record<string, Ingredient> = {
  "1": {
    id: "1",
    name: "Flour (All-Purpose)",
    description: "Premium all-purpose wheat flour for general baking needs",
    unit: "kg",
    cost_per_unit: 1.2,
    image_url: "/bag-of-flour.png",
    image_description:
      "Fine, white powdered flour with consistent texture. Should be free of lumps, foreign particles, and have a neutral white color without any discoloration or off-odors.",
    storage_instructions: "Store in a cool, dry place away from strong odors",
    is_allergen: true,
    allergen_type: "Wheat",
    shelf_life_days: 180,
    category: "Baking",
    supplier: "Premium Flour Mills",
    quantity: 50,
    minimum_stock: 10,
    expiry_date: "2025-12-31",
    storage_location: "Dry Storage A1",
  },
  "2": {
    id: "2",
    name: "Sugar (Granulated)",
    description: "Fine white granulated sugar for baking and cooking",
    unit: "kg",
    cost_per_unit: 0.8,
    image_url: "/granulated-sugar.png",
    image_description:
      "Pure white, fine granulated sugar with uniform crystal size. Should be free-flowing without clumps, completely white in color, and have a sweet taste without any off-flavors.",
    storage_instructions: "Store in a dry environment to prevent clumping",
    is_allergen: false,
    shelf_life_days: 730,
    category: "Baking",
    supplier: "Sweet Supply Co",
    quantity: 25,
    minimum_stock: 15,
    expiry_date: "2026-06-30",
    storage_location: "Dry Storage A2",
  },
  "3": {
    id: "3",
    name: "Milk (Whole)",
    description: "Fresh whole milk for dairy applications",
    unit: "L",
    cost_per_unit: 1.5,
    image_url: "/glass-of-milk.png",
    image_description:
      "Pure white, creamy whole milk with rich consistency. Should have a fresh, clean dairy aroma and taste. No separation, lumps, or off-odors should be present.",
    storage_instructions: "Keep refrigerated at 2-4°C at all times",
    is_allergen: true,
    allergen_type: "Dairy",
    shelf_life_days: 7,
    category: "Dairy",
    supplier: "Fresh Dairy Farms",
    quantity: 12,
    minimum_stock: 20,
    expiry_date: "2025-01-20",
    storage_location: "Cold Storage B1",
  },
  "4": {
    id: "4",
    name: "Eggs (Large)",
    description: "Fresh large eggs from free-range chickens",
    unit: "dozen",
    cost_per_unit: 3.2,
    image_description:
      "Clean, uncracked eggs with intact shells. Shell should be smooth and free of cracks, dirt, or stains. Eggs should feel heavy for their size.",
    storage_instructions: "Refrigerate immediately, store pointed end down",
    is_allergen: true,
    allergen_type: "Eggs",
    shelf_life_days: 28,
    category: "Dairy",
    supplier: "Farm Fresh Eggs",
    quantity: 8,
    minimum_stock: 12,
    expiry_date: "2025-01-25",
    storage_location: "Cold Storage B2",
  },
  "5": {
    id: "5",
    name: "Vanilla Extract",
    description: "Pure vanilla extract for flavoring",
    unit: "ml",
    cost_per_unit: 0.15,
    image_description:
      "Dark amber colored liquid with rich vanilla aroma. Should be clear without sediment and have a strong, sweet vanilla scent.",
    storage_instructions: "Store in a cool, dark place away from heat",
    is_allergen: false,
    shelf_life_days: 1095,
    category: "Spices",
    supplier: "Flavor Masters",
    quantity: 500,
    minimum_stock: 200,
    expiry_date: "2027-03-15",
    storage_location: "Spice Rack C1",
  },
  "6": {
    id: "6",
    name: "Butter (Unsalted)",
    description: "Premium unsalted butter for baking",
    unit: "kg",
    cost_per_unit: 4.5,
    image_description:
      "Pale yellow, smooth butter with consistent texture. Should be firm when cold, spreadable at room temperature, with a fresh, creamy aroma.",
    storage_instructions: "Keep refrigerated, can be frozen for longer storage",
    is_allergen: true,
    allergen_type: "Dairy",
    shelf_life_days: 30,
    category: "Dairy",
    supplier: "Creamy Delights",
    quantity: 3,
    minimum_stock: 8,
    expiry_date: "2025-02-10",
    storage_location: "Cold Storage B3",
  },
}

export default function IngredientPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { toast } = useToast()

  const [ingredient, setIngredient] = useState<Ingredient | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [unit, setUnit] = useState("")
  const [costPerUnit, setCostPerUnit] = useState(0)
  const [quantity, setQuantity] = useState(0)
  const [minimumStock, setMinimumStock] = useState(0)
  const [imageUrl, setImageUrl] = useState("")
  const [imageDescription, setImageDescription] = useState("")

  useEffect(() => {
    // Simulate fetching ingredient data based on ID
    const fetchIngredient = async () => {
      setLoading(true)

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 500))

      const foundIngredient = mockIngredients[params.id]

      if (foundIngredient) {
        setIngredient(foundIngredient)
        setName(foundIngredient.name)
        setDescription(foundIngredient.description || "")
        setUnit(foundIngredient.unit || "")
        setCostPerUnit(foundIngredient.cost_per_unit || 0)
        setQuantity(foundIngredient.quantity || 0)
        setMinimumStock(foundIngredient.minimum_stock || 0)
        setImageUrl(foundIngredient.image_url || "")
        setImageDescription(foundIngredient.image_description || "")
      } else {
        toast({
          title: "Error",
          description: "Ingredient not found",
          variant: "destructive",
        })
      }

      setLoading(false)
    }

    fetchIngredient()
  }, [params.id, toast])

  const handleImageUploadComplete = (newImageUrl: string, newImageDescription: string) => {
    setImageUrl(newImageUrl)
    setImageDescription(newImageDescription)
    toast({
      title: "Image updated",
      description: "Ingredient image has been updated successfully",
    })
  }

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Update the ingredient data
      if (ingredient) {
        const updatedIngredient = {
          ...ingredient,
          name,
          description,
          unit,
          cost_per_unit: costPerUnit,
          quantity,
          minimum_stock: minimumStock,
        }
        setIngredient(updatedIngredient)
        mockIngredients[params.id] = updatedIngredient
      }

      toast({
        title: "Success",
        description: "Ingredient updated successfully.",
      })
      setIsEditing(false)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update ingredient.",
        variant: "destructive",
      })
    }
  }

  const getStockStatus = (item: Ingredient) => {
    if (item.quantity <= item.minimum_stock * 0.5) {
      return { status: "critical", color: "destructive" }
    } else if (item.quantity <= item.minimum_stock) {
      return { status: "low", color: "warning" }
    }
    return { status: "good", color: "default" }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen w-full">
        <MainNav />
        <main className="flex-1 overflow-auto pl-64">
          <div className="container mx-auto py-10">
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading ingredient...</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (!ingredient) {
    return (
      <div className="flex min-h-screen w-full">
        <MainNav />
        <main className="flex-1 overflow-auto pl-64">
          <div className="container mx-auto py-10">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-4">Ingredient Not Found</h1>
              <p className="text-muted-foreground mb-4">The ingredient you're looking for doesn't exist.</p>
              <Link href="/ingredients">
                <Button>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Ingredients
                </Button>
              </Link>
            </div>
          </div>
        </main>
      </div>
    )
  }

  const stockStatus = getStockStatus(ingredient)

  return (
    <div className="flex min-h-screen w-full">
      <MainNav />
      <main className="flex-1 overflow-auto pl-64">
        <div className="container mx-auto py-10">
          <div className="mb-6">
            <Link href="/ingredients">
              <Button variant="ghost" className="mb-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Ingredients
              </Button>
            </Link>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">{ingredient.name}</h1>
                <p className="text-muted-foreground">{ingredient.description}</p>
              </div>
              <Button onClick={() => setIsEditing(!isEditing)}>
                {isEditing ? "Cancel" : "Edit"} <Pencil className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Stock Status Card */}
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center">
                    <Package className="h-8 w-8 text-gray-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Current Stock</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={stockStatus.color as any} className="text-xs">
                        {stockStatus.status === "critical" && "Critical"}
                        {stockStatus.status === "low" && "Low Stock"}
                        {stockStatus.status === "good" && "Good"}
                      </Badge>
                      <span className="text-muted-foreground text-sm">
                        {ingredient.storage_location} • Expires: {new Date(ingredient.expiry_date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold">
                    {ingredient.quantity} <span className="text-lg">{ingredient.unit}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Min: {ingredient.minimum_stock} {ingredient.unit}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="details" className="w-full space-y-4">
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="traceability">Traceability</TabsTrigger>
              <TabsTrigger value="visual-specs">Visual Specs</TabsTrigger>
            </TabsList>
            <Separator />

            <TabsContent value="details" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Ingredient Information</CardTitle>
                  <CardDescription>Manage ingredient details and information.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <form onSubmit={onSubmit} className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor="name">Name</Label>
                        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} disabled={!isEditing} />
                      </div>
                      <div>
                        <Label htmlFor="unit">Unit</Label>
                        <Input id="unit" value={unit} onChange={(e) => setUnit(e.target.value)} disabled={!isEditing} />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        disabled={!isEditing}
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <Label htmlFor="cost">Cost per Unit</Label>
                        <Input
                          type="number"
                          step="0.01"
                          id="cost"
                          value={costPerUnit}
                          onChange={(e) => setCostPerUnit(Number(e.target.value))}
                          disabled={!isEditing}
                        />
                      </div>
                      <div>
                        <Label htmlFor="quantity">Current Quantity</Label>
                        <Input
                          type="number"
                          id="quantity"
                          value={quantity}
                          onChange={(e) => setQuantity(Number(e.target.value))}
                          disabled={!isEditing}
                        />
                      </div>
                      <div>
                        <Label htmlFor="minimum_stock">Minimum Stock</Label>
                        <Input
                          type="number"
                          id="minimum_stock"
                          value={minimumStock}
                          onChange={(e) => setMinimumStock(Number(e.target.value))}
                          disabled={!isEditing}
                        />
                      </div>
                    </div>
                    {isEditing && <Button type="submit">Update Ingredient</Button>}
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="traceability">
              <Card>
                <CardHeader>
                  <CardTitle>Traceability Information</CardTitle>
                  <CardDescription>View the history and origin of this ingredient.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground">Supplier</h3>
                        <p>{ingredient.supplier}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground">Category</h3>
                        <p>{ingredient.category}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground">Shelf Life</h3>
                        <p>{ingredient.shelf_life_days} days</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground">Allergen</h3>
                        <p>{ingredient.is_allergen ? `Yes (${ingredient.allergen_type})` : "No"}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground">Storage Location</h3>
                        <p>{ingredient.storage_location}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground">Expiry Date</h3>
                        <p>{new Date(ingredient.expiry_date).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Storage Instructions</h3>
                      <p>{ingredient.storage_instructions}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="visual-specs" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Visual Specifications</CardTitle>
                  <CardDescription>
                    Upload and manage images for visual inspection and specification purposes
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <IngredientImageUpload
                    ingredientId={params.id}
                    existingImageUrl={imageUrl}
                    existingImageDescription={imageDescription}
                    onUploadComplete={handleImageUploadComplete}
                  />

                  {imageUrl && (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-medium mb-2">Current Specification Image</h3>
                        <div className="relative aspect-video w-full max-w-2xl overflow-hidden rounded-md border">
                          <img
                            src={imageUrl || "/placeholder.svg"}
                            alt={`${ingredient.name} specification`}
                            className="h-full w-full object-contain bg-gray-50"
                          />
                        </div>
                      </div>

                      {imageDescription && (
                        <div>
                          <h3 className="text-lg font-medium mb-2">Visual Description</h3>
                          <div className="p-4 bg-gray-50 rounded-md">
                            <p className="text-sm text-gray-700">{imageDescription}</p>
                          </div>
                        </div>
                      )}

                      <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">Quality Checkpoints</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ul className="space-y-2 text-sm">
                              <li className="flex items-center gap-2">
                                <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                                Color consistency
                              </li>
                              <li className="flex items-center gap-2">
                                <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                                Texture appearance
                              </li>
                              <li className="flex items-center gap-2">
                                <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                                Particle size distribution
                              </li>
                              <li className="flex items-center gap-2">
                                <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                                Foreign matter detection
                              </li>
                              <li className="flex items-center gap-2">
                                <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                                Package integrity
                              </li>
                            </ul>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">Inspection Notes</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              <div className="text-sm">
                                <span className="font-medium">Last Inspection:</span>
                                <span className="ml-2 text-gray-600">2025-04-01</span>
                              </div>
                              <div className="text-sm">
                                <span className="font-medium">Inspector:</span>
                                <span className="ml-2 text-gray-600">Quality Team</span>
                              </div>
                              <div className="text-sm">
                                <span className="font-medium">Status:</span>
                                <Badge className="ml-2 bg-green-500">Approved</Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
