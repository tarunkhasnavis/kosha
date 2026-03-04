"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button, Input, Label, Textarea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@kosha/ui"
import { Plus } from "lucide-react"

interface Ingredient {
  id: string
  name: string
  unit: string
}

interface AddIngredientDialogProps {
  onAdd: (ingredient: {
    ingredient_id: string
    quantity: number
    unit: string
    preparation_notes?: string
  }) => void
}

export function AddIngredientDialog({ onAdd }: AddIngredientDialogProps) {
  const [open, setOpen] = useState(false)
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    ingredient_id: "",
    quantity: 0,
    unit: "",
    preparation_notes: "",
  })

  const fetchIngredients = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/ingredients")
      if (response.ok) {
        const data = await response.json()
        setIngredients(data)
      }
    } catch (error) {
      console.error("Failed to fetch ingredients:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      fetchIngredients()
    }
  }, [open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.ingredient_id && formData.quantity > 0 && formData.unit) {
      onAdd(formData)
      setFormData({
        ingredient_id: "",
        quantity: 0,
        unit: "",
        preparation_notes: "",
      })
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Ingredient
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Ingredient</DialogTitle>
          <DialogDescription>Add an ingredient to this recipe with quantity and preparation notes.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="ingredient">Ingredient</Label>
            <Select
              value={formData.ingredient_id}
              onValueChange={(value) => {
                const ingredient = ingredients.find((ing) => ing.id === value)
                setFormData({
                  ...formData,
                  ingredient_id: value,
                  unit: ingredient?.unit || "",
                })
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an ingredient" />
              </SelectTrigger>
              <SelectContent>
                {loading ? (
                  <SelectItem value="loading" disabled>
                    Loading ingredients...
                  </SelectItem>
                ) : (
                  ingredients.map((ingredient) => (
                    <SelectItem key={ingredient.id} value={ingredient.id}>
                      {ingredient.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                min="0"
                value={formData.quantity || ""}
                onChange={(e) => setFormData({ ...formData, quantity: Number.parseFloat(e.target.value) || 0 })}
                placeholder="0"
                required
              />
            </div>
            <div>
              <Label htmlFor="unit">Unit</Label>
              <Select value={formData.unit} onValueChange={(value) => setFormData({ ...formData, unit: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">Kilogram</SelectItem>
                  <SelectItem value="g">Gram</SelectItem>
                  <SelectItem value="L">Liter</SelectItem>
                  <SelectItem value="ml">Milliliter</SelectItem>
                  <SelectItem value="pcs">Pieces</SelectItem>
                  <SelectItem value="cups">Cups</SelectItem>
                  <SelectItem value="tbsp">Tablespoon</SelectItem>
                  <SelectItem value="tsp">Teaspoon</SelectItem>
                  <SelectItem value="oz">Ounce</SelectItem>
                  <SelectItem value="lbs">Pounds</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="preparation_notes">Preparation Notes (Optional)</Label>
            <Textarea
              id="preparation_notes"
              value={formData.preparation_notes}
              onChange={(e) => setFormData({ ...formData, preparation_notes: e.target.value })}
              placeholder="e.g., diced, chopped, minced, etc."
              className="min-h-[80px]"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!formData.ingredient_id || !formData.quantity || !formData.unit}>
              Add Ingredient
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
