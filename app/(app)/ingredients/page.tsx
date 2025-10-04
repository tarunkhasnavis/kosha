"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MainNav } from "@/components/main-nav"
import { Search, Plus, Download, Edit, Save, X, AlertTriangle } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface Ingredient {
  id: number
  name: string
  description: string
  sku: string
  category: string
  unit: string
  cost_per_unit: number
  supplier: string
  current_stock: number
  minimum_stock: number
  maximum_stock: number
  location: string
  expiry_date: string
  batch_number: string
  allergens: string[]
  storage_conditions: string
  nutritional_info: any
  image_url?: string
}


export default function IngredientsPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [filteredIngredients, setFilteredIngredients] = useState<Ingredient[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [stockFilter, setStockFilter] = useState("all")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editData, setEditData] = useState<Partial<Ingredient>>({})

  // Add ingredient dialog state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newIngredient, setNewIngredient] = useState({
    name: "",
    description: "",
    sku: "",
    category: "",
    unit: "kg",
    cost_per_unit: 0,
    supplier: "",
    current_stock: 0,
    minimum_stock: 0,
    maximum_stock: 0,
    location: "",
    expiry_date: "",
    batch_number: "",
    allergens: [] as string[],
    storage_conditions: "",
    nutritional_info: {}
  })

  // Note: API endpoints need to be implemented
  const fetchIngredients = async () => {
    // Placeholder for when API is implemented
    // For now, just set empty array
    setIngredients([])
  }

  useEffect(() => {
    fetchIngredients()
  }, [])

  useEffect(() => {
    let filtered = ingredients

    if (searchTerm) {
      filtered = filtered.filter(ingredient =>
        ingredient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ingredient.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ingredient.sku.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (categoryFilter !== "all") {
      filtered = filtered.filter(ingredient => ingredient.category === categoryFilter)
    }

    if (stockFilter === "low") {
      filtered = filtered.filter(ingredient => ingredient.current_stock <= ingredient.minimum_stock)
    } else if (stockFilter === "out") {
      filtered = filtered.filter(ingredient => ingredient.current_stock === 0)
    }

    setFilteredIngredients(filtered)
  }, [ingredients, searchTerm, categoryFilter, stockFilter])

  const handleEdit = (ingredient: Ingredient) => {
    setEditingId(ingredient.id)
    setEditData(ingredient)
  }

  const handleSave = async (id: number) => {
    // Update locally for now since API is not implemented
    setIngredients(prev => prev.map(ing => 
      ing.id === id ? { ...ing, ...editData } : ing
    ))
    setEditingId(null)
    setEditData({})
  }

  const handleCancel = () => {
    setEditingId(null)
    setEditData({})
  }

  const handleAddIngredient = async () => {
    // Add locally for now since API is not implemented
    const newId = Math.max(0, ...ingredients.map(i => i.id)) + 1
    const ingredient = { ...newIngredient, id: newId } as Ingredient
    setIngredients(prev => [...prev, ingredient])
    setIsAddDialogOpen(false)
    setNewIngredient({
      name: "",
      description: "",
      sku: "",
      category: "",
      unit: "kg",
      cost_per_unit: 0,
      supplier: "",
      current_stock: 0,
      minimum_stock: 0,
      maximum_stock: 0,
      location: "",
      expiry_date: "",
      batch_number: "",
      allergens: [],
      storage_conditions: "",
      nutritional_info: {}
    })
  }

  const exportToCSV = () => {
    const headers = ["Name", "Description", "SKU", "Category", "Current Stock", "Unit", "Cost", "Supplier"]
    const csvData = filteredIngredients.map(ingredient => [
      ingredient.name,
      ingredient.description,
      ingredient.sku,
      ingredient.category,
      ingredient.current_stock,
      ingredient.unit,
      ingredient.cost_per_unit,
      ingredient.supplier
    ])

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(","))
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `ingredients-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const getStockStatus = (ingredient: Ingredient) => {
    if (ingredient.current_stock === 0) return { status: 'out', color: 'bg-red-100 text-red-800' }
    if (ingredient.current_stock <= ingredient.minimum_stock) return { status: 'low', color: 'bg-yellow-100 text-yellow-800' }
    return { status: 'good', color: 'bg-green-100 text-green-800' }
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <MainNav />
        <main className="flex-1 ml-64 flex items-center justify-center">
          <div className="text-center">
            <div className="h-12 w-12 text-gray-400 mx-auto mb-4 animate-pulse">📦</div>
            <p className="text-gray-500">Loading ingredients...</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <MainNav />

      <main className="flex-1 ml-64 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Ingredient Management</h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage your ingredient inventory and stock levels ({filteredIngredients.length} total)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Ingredient
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add New Ingredient</DialogTitle>
                    <DialogDescription>
                      Enter the details for the new ingredient.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Name *</Label>
                        <Input
                          id="name"
                          value={newIngredient.name}
                          onChange={(e) => setNewIngredient(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Ingredient name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sku">SKU *</Label>
                        <Input
                          id="sku"
                          value={newIngredient.sku}
                          onChange={(e) => setNewIngredient(prev => ({ ...prev, sku: e.target.value }))}
                          placeholder="SKU-001"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={newIngredient.description}
                        onChange={(e) => setNewIngredient(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Ingredient description"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="category">Category</Label>
                        <Input
                          id="category"
                          value={newIngredient.category}
                          onChange={(e) => setNewIngredient(prev => ({ ...prev, category: e.target.value }))}
                          placeholder="Dry Goods"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="unit">Unit</Label>
                        <Select value={newIngredient.unit} onValueChange={(value) => setNewIngredient(prev => ({ ...prev, unit: value }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="kg">kg</SelectItem>
                            <SelectItem value="g">g</SelectItem>
                            <SelectItem value="L">L</SelectItem>
                            <SelectItem value="mL">mL</SelectItem>
                            <SelectItem value="pcs">pcs</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cost_per_unit">Cost per Unit</Label>
                        <Input
                          id="cost_per_unit"
                          type="number"
                          step="0.01"
                          value={newIngredient.cost_per_unit}
                          onChange={(e) => setNewIngredient(prev => ({ ...prev, cost_per_unit: Number(e.target.value) }))}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="current_stock">Current Stock</Label>
                        <Input
                          id="current_stock"
                          type="number"
                          value={newIngredient.current_stock}
                          onChange={(e) => setNewIngredient(prev => ({ ...prev, current_stock: Number(e.target.value) }))}
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="minimum_stock">Min Stock</Label>
                        <Input
                          id="minimum_stock"
                          type="number"
                          value={newIngredient.minimum_stock}
                          onChange={(e) => setNewIngredient(prev => ({ ...prev, minimum_stock: Number(e.target.value) }))}
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="maximum_stock">Max Stock</Label>
                        <Input
                          id="maximum_stock"
                          type="number"
                          value={newIngredient.maximum_stock}
                          onChange={(e) => setNewIngredient(prev => ({ ...prev, maximum_stock: Number(e.target.value) }))}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddIngredient} disabled={!newIngredient.name || !newIngredient.sku}>
                      Add Ingredient
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="border-b bg-white px-6 py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search ingredients, SKU, or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="Dry Goods">Dry Goods</SelectItem>
                  <SelectItem value="Dairy">Dairy</SelectItem>
                  <SelectItem value="Sweeteners">Sweeteners</SelectItem>
                </SelectContent>
              </Select>
              <Select value={stockFilter} onValueChange={setStockFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Stock" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stock</SelectItem>
                  <SelectItem value="low">Low Stock</SelectItem>
                  <SelectItem value="out">Out of Stock</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={exportToCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Ingredients Table */}
        <div className="flex-1 overflow-auto p-6">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-gray-900 w-48">Name</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900 w-64">Description</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900 w-32">SKU</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900 w-24">Stock</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900 w-16">Unit</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900 w-20">Cost</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900 w-24">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900 w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIngredients.map((ingredient) => {
                      const isEditing = editingId === ingredient.id
                      const stockStatus = getStockStatus(ingredient)
                      
                      return (
                        <tr key={ingredient.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4 align-top">
                            {isEditing ? (
                              <Input
                                value={editData.name || ''}
                                onChange={(e) => setEditData(prev => ({ ...prev, name: e.target.value }))}
                                className="w-full"
                              />
                            ) : (
                              <div className="font-medium text-sm leading-tight">{ingredient.name}</div>
                            )}
                          </td>
                          <td className="py-3 px-4 align-top">
                            {isEditing ? (
                              <Input
                                value={editData.description || ''}
                                onChange={(e) => setEditData(prev => ({ ...prev, description: e.target.value }))}
                                className="w-full"
                              />
                            ) : (
                              <div className="text-sm text-gray-600 leading-tight max-w-xs">
                                {ingredient.description}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 align-top">
                            {isEditing ? (
                              <Input
                                value={editData.sku || ''}
                                onChange={(e) => setEditData(prev => ({ ...prev, sku: e.target.value }))}
                                className="w-full"
                              />
                            ) : (
                              <div className="text-sm font-mono whitespace-nowrap">{ingredient.sku}</div>
                            )}
                          </td>
                          <td className="py-3 px-4 align-top">
                            {isEditing ? (
                              <Input
                                type="number"
                                value={editData.current_stock ?? ingredient.current_stock}
                                onChange={(e) => setEditData(prev => ({ ...prev, current_stock: Number(e.target.value) }))}
                                className="w-20"
                              />
                            ) : (
                              <div className="text-sm whitespace-nowrap">{ingredient.current_stock}</div>
                            )}
                          </td>
                          <td className="py-3 px-4 align-top">
                            <div className="text-sm whitespace-nowrap">{ingredient.unit}</div>
                          </td>
                          <td className="py-3 px-4 align-top">
                            {isEditing ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={editData.cost_per_unit ?? ingredient.cost_per_unit}
                                onChange={(e) => setEditData(prev => ({ ...prev, cost_per_unit: Number(e.target.value) }))}
                                className="w-20"
                              />
                            ) : (
                              <div className="text-sm whitespace-nowrap">${ingredient.cost_per_unit.toFixed(2)}</div>
                            )}
                          </td>
                          <td className="py-3 px-4 align-top">
                            <Badge className={`${stockStatus.color} whitespace-nowrap`}>
                              {stockStatus.status === 'out' && <AlertTriangle className="h-3 w-3 mr-1" />}
                              {stockStatus.status === 'out' ? 'Out of Stock' : 
                               stockStatus.status === 'low' ? 'Low Stock' : 'In Stock'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 align-top">
                            {isEditing ? (
                              <div className="flex gap-1">
                                <Button size="sm" onClick={() => handleSave(ingredient.id)}>
                                  <Save className="h-3 w-3" />
                                </Button>
                                <Button size="sm" variant="outline" onClick={handleCancel}>
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => handleEdit(ingredient)}>
                                <Edit className="h-3 w-3" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
