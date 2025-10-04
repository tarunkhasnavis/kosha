"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowUpDown, ChevronDown, Download, Filter, Plus, Search, Edit, Trash2 } from 'lucide-react'

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { MainNav } from "@/components/main-nav"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"

// Define recipe type
interface Recipe {
  id: string
  name: string
  category: string
  version: string
  ingredientCount: number
  allergens: string[]
  status: string
  description?: string
  instructions?: string[]
  yield_quantity?: number
  yield_unit?: string
  prep_time?: number
  cook_time?: number
  created_at?: string
  updated_at?: string
}

// Mock recipe data
const mockRecipes: Recipe[] = [
  {
    id: "1",
    name: "Chocolate Chip Cookies",
    category: "Cookies",
    version: "1.0",
    ingredientCount: 8,
    allergens: ["Wheat", "Eggs", "Milk"],
    status: "active",
    description: "Classic chocolate chip cookies",
    yield_quantity: 24,
    yield_unit: "pieces",
    prep_time: 15,
    cook_time: 12
  },
  {
    id: "2",
    name: "Vanilla Cupcakes",
    category: "Cakes",
    version: "2.1",
    ingredientCount: 10,
    allergens: ["Wheat", "Eggs", "Milk"],
    status: "active",
    description: "Light and fluffy vanilla cupcakes",
    yield_quantity: 12,
    yield_unit: "pieces",
    prep_time: 20,
    cook_time: 18
  },
  {
    id: "3",
    name: "Sourdough Bread",
    category: "Bread",
    version: "1.5",
    ingredientCount: 4,
    allergens: ["Wheat"],
    status: "active",
    description: "Traditional sourdough bread",
    yield_quantity: 2,
    yield_unit: "loaves",
    prep_time: 30,
    cook_time: 45
  }
]

export default function RecipesPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [recipes, setRecipes] = useState<Recipe[]>(mockRecipes)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [currentRecipe, setCurrentRecipe] = useState<Recipe | null>(null)
  const [newRecipe, setNewRecipe] = useState<Partial<Recipe>>({
    name: "",
    category: "Cookies",
    version: "1.0",
    ingredientCount: 0,
    allergens: [],
    status: "draft",
  })


  const filteredRecipes = recipes.filter((recipe) => {
    const matchesSearch = recipe.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = categoryFilter === "all" || recipe.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  const handleExport = () => {
    // Create CSV content
    const headers = ["ID", "Recipe Name", "Category", "Version", "Ingredients", "Allergens", "Status"]
    const csvContent = [
      headers.join(","),
      ...filteredRecipes.map((recipe) =>
        [
          recipe.id,
          `"${recipe.name}"`, // Quote names to handle commas
          recipe.category,
          recipe.version,
          recipe.ingredientCount,
          `"${recipe.allergens.join(", ")}"`,
          recipe.status,
        ].join(","),
      ),
    ].join("\n")

    // Create a blob and download link
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", "recipes.csv")
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleAddRecipe = () => {
    // Add to local state (mock functionality)
    const newRecipeWithId: Recipe = {
      ...newRecipe as Recipe,
      id: Date.now().toString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    setRecipes(prev => [...prev, newRecipeWithId])
    
    setIsAddDialogOpen(false)
    setNewRecipe({
      name: "",
      category: "Cookies",
      version: "1.0",
      ingredientCount: 0,
      allergens: [],
      status: "draft",
    })
    
    toast.success("Recipe added successfully!")
  }

  const handleEditRecipe = () => {
    if (!currentRecipe) return
    
    // Update local state (mock functionality)
    setRecipes(prev => prev.map(r => 
      r.id === currentRecipe.id ? { ...currentRecipe, updated_at: new Date().toISOString() } : r
    ))
    
    setIsEditDialogOpen(false)
    setCurrentRecipe(null)
    toast.success("Recipe updated successfully!")
  }

  const handleDeleteRecipe = () => {
    if (!currentRecipe) return
    
    // Remove from local state (mock functionality)
    setRecipes(prev => prev.filter(r => r.id !== currentRecipe.id))
    
    setIsDeleteDialogOpen(false)
    setCurrentRecipe(null)
    toast.success("Recipe deleted successfully!")
  }

  const openEditDialog = (recipe: Recipe) => {
    setCurrentRecipe({ ...recipe })
    setIsEditDialogOpen(true)
  }

  const openDeleteDialog = (recipe: Recipe) => {
    setCurrentRecipe(recipe)
    setIsDeleteDialogOpen(true)
  }

  const handleViewRecipe = (recipeId: string) => {
    router.push(`/recipes/${recipeId}`)
  }

  const categories = ["Cookies", "Bread", "Cakes", "Pastries", "Muffins", "Uncategorized"]
  const statuses = [
    { label: "Active", value: "active" },
    { label: "Draft", value: "draft" },
    { label: "Archived", value: "archived" },
    { label: "Completed", value: "completed" },
  ]
  const allergenOptions = ["Wheat", "Milk", "Eggs", "Soy", "Nuts", "Peanuts", "Fish", "Shellfish", "Sesame"]


  return (
    <div className="flex min-h-screen w-full">
      <MainNav />
      <main className="flex-1 overflow-auto pl-64">
        <div className="flex flex-col gap-4 p-4 md:gap-8 md:p-8 px-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Recipe Management</h1>
              <p className="text-muted-foreground">
                Manage your product recipes and formulations ({recipes.length} total)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New Recipe
              </Button>
            </div>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Production Recipes</CardTitle>
              <CardDescription>Manage your product recipes and formulations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Search recipes..."
                      className="pl-8 w-[250px] sm:w-[300px]"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-9 bg-transparent">
                        <Filter className="mr-2 h-4 w-4" />
                        Filter
                        <ChevronDown className="ml-2 h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[200px]">
                      <DropdownMenuCheckboxItem
                        checked={categoryFilter === "all"}
                        onCheckedChange={() => setCategoryFilter("all")}
                      >
                        All Categories
                      </DropdownMenuCheckboxItem>
                      {categories.map((category) => (
                        <DropdownMenuCheckboxItem
                          key={category}
                          checked={categoryFilter === category}
                          onCheckedChange={() => setCategoryFilter(category)}
                        >
                          {category}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <div className="mt-4 rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">ID</TableHead>
                      <TableHead>
                        <div className="flex items-center gap-1">
                          Recipe Name
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Ingredients</TableHead>
                      <TableHead>Allergens</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecipes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No recipes found. Click "New Recipe" to add your first recipe.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRecipes.map((recipe) => (
                        <TableRow key={recipe.id}>
                          <TableCell className="font-medium">{recipe.id}</TableCell>
                          <TableCell>
                            <button
                              onClick={() => handleViewRecipe(recipe.id)}
                              className="text-primary hover:underline"
                            >
                              {recipe.name}
                            </button>
                          </TableCell>
                          <TableCell>{recipe.category}</TableCell>
                          <TableCell>v{recipe.version}</TableCell>
                          <TableCell>{recipe.ingredientCount}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {recipe.allergens.map((allergen, index) => (
                                <Badge key={index} variant="outline" className="border-red-500 text-red-500 text-xs">
                                  {allergen}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <RecipeStatusBadge status={recipe.status} />
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <ChevronDown className="h-4 w-4" />
                                  <span className="sr-only">Actions</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleViewRecipe(recipe.id)}>
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openEditDialog(recipe)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit Recipe
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openDeleteDialog(recipe)} className="text-red-600">
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete Recipe
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

      {/* Add Recipe Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Recipe</DialogTitle>
            <DialogDescription>Enter the details for the new recipe. Click save when you're done.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={newRecipe.name}
                onChange={(e) => setNewRecipe({ ...newRecipe, name: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="category" className="text-right">
                Category
              </Label>
              <Select
                value={newRecipe.category}
                onValueChange={(value) => setNewRecipe({ ...newRecipe, category: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="version" className="text-right">
                Version
              </Label>
              <Input
                id="version"
                value={newRecipe.version}
                onChange={(e) => setNewRecipe({ ...newRecipe, version: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="allergens" className="text-right pt-2">
                Allergens
              </Label>
              <div className="col-span-3 grid grid-cols-2 gap-2">
                {allergenOptions.map((allergen) => (
                  <div key={allergen} className="flex items-center space-x-2">
                    <Checkbox
                      id={`allergen-${allergen}`}
                      checked={(newRecipe.allergens ?? []).includes(allergen)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setNewRecipe({
                            ...newRecipe,
                            allergens: [...(newRecipe.allergens || []), allergen],
                          })
                        } else {
                          setNewRecipe({
                            ...newRecipe,
                            allergens: newRecipe.allergens?.filter((a) => a !== allergen) || [],
                          })
                        }
                      }}
                    />
                    <label
                      htmlFor={`allergen-${allergen}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {allergen}
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="status" className="text-right">
                Status
              </Label>
              <Select value={newRecipe.status} onValueChange={(value) => setNewRecipe({ ...newRecipe, status: value })}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a status" />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddRecipe}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Recipe Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Recipe</DialogTitle>
            <DialogDescription>Update the recipe details. Click save when you're done.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-name" className="text-right">
                Name
              </Label>
              <Input
                id="edit-name"
                value={currentRecipe?.name || ""}
                onChange={(e) => setCurrentRecipe({ ...currentRecipe!, name: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-category" className="text-right">
                Category
              </Label>
              <Select
                value={currentRecipe?.category || ""}
                onValueChange={(value) => setCurrentRecipe({ ...currentRecipe!, category: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-version" className="text-right">
                Version
              </Label>
              <Input
                id="edit-version"
                value={currentRecipe?.version || ""}
                onChange={(e) => setCurrentRecipe({ ...currentRecipe!, version: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="edit-allergens" className="text-right pt-2">
                Allergens
              </Label>
              <div className="col-span-3 grid grid-cols-2 gap-2">
                {allergenOptions.map((allergen) => (
                  <div key={allergen} className="flex items-center space-x-2">
                    <Checkbox
                      id={`edit-allergen-${allergen}`}
                      checked={(currentRecipe?.allergens ?? []).includes(allergen)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setCurrentRecipe({
                            ...currentRecipe!,
                            allergens: [...(currentRecipe!.allergens ?? []), allergen],
                          })
                        } else {
                          setCurrentRecipe({
                            ...currentRecipe!,
                            allergens: (currentRecipe!.allergens ?? []).filter((a) => a !== allergen),
                          })
                        }
                      }}
                    />
                    <label
                      htmlFor={`edit-allergen-${allergen}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {allergen}
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-status" className="text-right">
                Status
              </Label>
              <Select
                value={currentRecipe?.status || ""}
                onValueChange={(value) => setCurrentRecipe({ ...currentRecipe!, status: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a status" />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditRecipe}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the recipe "{currentRecipe?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteRecipe}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function RecipeStatusBadge({ status }: { status: string }) {
  switch (status.toLowerCase()) {
    case "active":
      return <Badge className="bg-green-500">Active</Badge>
    case "draft":
      return <Badge className="bg-yellow-500">Draft</Badge>
    case "archived":
      return <Badge className="bg-gray-500">Archived</Badge>
    case "completed":
      return <Badge className="bg-blue-500">Completed</Badge>
    default:
      return <Badge>{status}</Badge>
  }
}
