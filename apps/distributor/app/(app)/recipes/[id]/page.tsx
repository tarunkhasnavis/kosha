"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button, Input, Label, Textarea, Card, CardContent, CardDescription, CardHeader, CardTitle, Badge, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, useToast } from "@kosha/ui"
import { AddIngredientDialog } from "@/app/(app)/recipes/components/add-ingredient-dialog"
import { AddStepDialog } from "@/app/(app)/recipes/components/add-step-dialog"
import { Clock, Users, ChefHat, Edit2, Save, X, Package, Utensils, BookOpen, AlertCircle } from "lucide-react"

interface RecipeIngredient {
  id: string
  ingredient_id: string
  ingredient_name: string
  quantity: number
  unit: string
  preparation_notes?: string
}

interface RecipeStep {
  id: string
  step_number: number
  instruction: string
  duration_minutes?: number
  temperature?: number
  equipment?: string
}

interface Recipe {
  id: string
  name: string
  description?: string
  prep_time_minutes?: number
  cook_time_minutes?: number
  servings?: number
  difficulty_level?: string
  category?: string
  instructions?: string
  ingredients: RecipeIngredient[]
  steps: RecipeStep[]
  created_at: string
  updated_at: string
}

export default function RecipeDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { toast } = useToast()
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editingIngredient, setEditingIngredient] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Recipe>>({})
  const [editIngredientForm, setEditIngredientForm] = useState<Partial<RecipeIngredient>>({})
  const [isAddStepOpen, setIsAddStepOpen] = useState(false)

  const fetchRecipe = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/recipes/${params.id}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch recipe: ${response.statusText}`)
      }
      const data = await response.json()
      setRecipe(data)
      setEditForm(data)
    } catch (error) {
      console.error("Error fetching recipe:", error)
      setError(error instanceof Error ? error.message : "Failed to fetch recipe")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRecipe()
  }, [params.id])

  const handleSaveRecipe = async () => {
    try {
      const response = await fetch(`/api/recipes/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      })

      if (!response.ok) {
        throw new Error("Failed to update recipe")
      }

      await fetchRecipe()
      setIsEditing(false)
      toast({ title: "Success", description: "Recipe updated successfully" })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update recipe",
        variant: "destructive",
      })
    }
  }

  const handleAddIngredient = async (ingredientData: {
    ingredient_id: string
    quantity: number
    unit: string
    preparation_notes?: string
  }) => {
    try {
      const response = await fetch(`/api/recipes/${params.id}/ingredients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ingredientData),
      })

      if (!response.ok) {
        throw new Error("Failed to add ingredient")
      }

      await fetchRecipe()
      toast({ title: "Success", description: "Ingredient added successfully" })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add ingredient",
        variant: "destructive",
      })
    }
  }

  const handleEditIngredient = (ingredient: RecipeIngredient) => {
    setEditingIngredient(ingredient.id)
    setEditIngredientForm(ingredient)
  }

  const handleSaveIngredient = async () => {
    if (!editingIngredient) return

    try {
      const response = await fetch(`/api/recipes/${params.id}/ingredients/${editingIngredient}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editIngredientForm),
      })

      if (!response.ok) {
        throw new Error("Failed to update ingredient")
      }

      await fetchRecipe()
      setEditingIngredient(null)
      setEditIngredientForm({})
      toast({ title: "Success", description: "Ingredient updated successfully" })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update ingredient",
        variant: "destructive",
      })
    }
  }

  const handleRemoveIngredient = async (ingredientId: string) => {
    try {
      const response = await fetch(`/api/recipes/${params.id}/ingredients/${ingredientId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to remove ingredient")
      }

      await fetchRecipe()
      toast({ title: "Success", description: "Ingredient removed successfully" })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove ingredient",
        variant: "destructive",
      })
    }
  }

  const handleAddStep = async (stepData: {
    id: string
    stepNumber: number
    instruction: string
    time?: string
    temperature?: string
  }) => {
    try {
      // Convert the AddStepDialog format to API format
      const apiData = {
        instruction: stepData.instruction,
        step_number: stepData.stepNumber,
        duration_minutes: stepData.time ? parseInt(stepData.time) : undefined,
        temperature: stepData.temperature ? parseInt(stepData.temperature) : undefined,
      }
      
      const response = await fetch(`/api/recipes/${params.id}/steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiData),
      })

      if (!response.ok) {
        throw new Error("Failed to add step")
      }

      await fetchRecipe()
      toast({ title: "Success", description: "Step added successfully" })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add step",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen w-full">
        <main className="flex-1 overflow-auto md:pl-60">
          <div className="container mx-auto py-10 px-6">
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <ChefHat className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
                <p className="text-muted-foreground">Loading recipe...</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (error || !recipe) {
    return (
      <div className="flex min-h-screen w-full">
        <main className="flex-1 overflow-auto md:pl-60">
          <div className="container mx-auto py-10 px-6">
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
                <p className="text-red-600 mb-4">Error loading recipe: {error}</p>
                <Button onClick={fetchRecipe} variant="outline">
                  Try Again
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen w-full">
      <main className="flex-1 overflow-auto md:pl-60">
        <div className="container mx-auto py-10 px-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              {isEditing ? (
                <div className="space-y-2">
                  <Input
                    value={editForm.name || ""}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="text-3xl font-bold border-none p-0 h-auto"
                    placeholder="Recipe name"
                  />
                  <Textarea
                    value={editForm.description || ""}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    placeholder="Recipe description"
                    className="text-muted-foreground"
                  />
                </div>
              ) : (
                <>
                  <h1 className="text-3xl font-bold">{recipe.name}</h1>
                  <p className="text-muted-foreground mt-2">{recipe.description}</p>
                </>
              )}
            </div>
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button onClick={handleSaveRecipe}>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <Button onClick={() => setIsEditing(true)}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit Recipe
                </Button>
              )}
            </div>
          </div>

          {/* Recipe Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="flex items-center p-4">
                <Clock className="h-8 w-8 text-blue-500 mr-3" />
                <div>
                  <p className="text-sm text-muted-foreground">Prep Time</p>
                  {isEditing ? (
                    <Input
                      type="number"
                      value={editForm.prep_time_minutes || ""}
                      onChange={(e) =>
                        setEditForm({ ...editForm, prep_time_minutes: Number.parseInt(e.target.value) || 0 })
                      }
                      className="h-6 text-lg font-semibold"
                    />
                  ) : (
                    <p className="text-lg font-semibold">{recipe.prep_time_minutes || 0} min</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center p-4">
                <ChefHat className="h-8 w-8 text-orange-500 mr-3" />
                <div>
                  <p className="text-sm text-muted-foreground">Cook Time</p>
                  {isEditing ? (
                    <Input
                      type="number"
                      value={editForm.cook_time_minutes || ""}
                      onChange={(e) =>
                        setEditForm({ ...editForm, cook_time_minutes: Number.parseInt(e.target.value) || 0 })
                      }
                      className="h-6 text-lg font-semibold"
                    />
                  ) : (
                    <p className="text-lg font-semibold">{recipe.cook_time_minutes || 0} min</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center p-4">
                <Users className="h-8 w-8 text-green-500 mr-3" />
                <div>
                  <p className="text-sm text-muted-foreground">Servings</p>
                  {isEditing ? (
                    <Input
                      type="number"
                      value={editForm.servings || ""}
                      onChange={(e) => setEditForm({ ...editForm, servings: Number.parseInt(e.target.value) || 0 })}
                      className="h-6 text-lg font-semibold"
                    />
                  ) : (
                    <p className="text-lg font-semibold">{recipe.servings || 0}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center p-4">
                <BookOpen className="h-8 w-8 text-purple-500 mr-3" />
                <div>
                  <p className="text-sm text-muted-foreground">Difficulty</p>
                  {isEditing ? (
                    <Select
                      value={editForm.difficulty_level || ""}
                      onValueChange={(value) => setEditForm({ ...editForm, difficulty_level: value })}
                    >
                      <SelectTrigger className="h-6 text-lg font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Easy">Easy</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="Hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline" className="text-lg">
                      {recipe.difficulty_level || "Not set"}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Ingredients */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="flex items-center">
                      <Package className="h-5 w-5 mr-2" />
                      Ingredients ({recipe.ingredients.length})
                    </CardTitle>
                    <CardDescription>Recipe ingredients and quantities</CardDescription>
                  </div>
                  <AddIngredientDialog onAdd={handleAddIngredient} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recipe.ingredients.map((ingredient) => (
                    <div key={ingredient.id} className="flex items-center justify-between p-3 border rounded-lg">
                      {editingIngredient === ingredient.id ? (
                        <div className="flex-1 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Quantity</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={editIngredientForm.quantity || ""}
                                onChange={(e) =>
                                  setEditIngredientForm({
                                    ...editIngredientForm,
                                    quantity: Number.parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="h-8"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Unit</Label>
                              <Select
                                value={editIngredientForm.unit || ""}
                                onValueChange={(value) => setEditIngredientForm({ ...editIngredientForm, unit: value })}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
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
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs">Preparation Notes</Label>
                            <Input
                              value={editIngredientForm.preparation_notes || ""}
                              onChange={(e) =>
                                setEditIngredientForm({ ...editIngredientForm, preparation_notes: e.target.value })
                              }
                              placeholder="e.g., diced, chopped, etc."
                              className="h-8"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={handleSaveIngredient}>
                              <Save className="h-3 w-3 mr-1" />
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingIngredient(null)
                                setEditIngredientForm({})
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1">
                            <div className="font-medium">{ingredient.ingredient_name}</div>
                            <div className="text-sm text-muted-foreground">
                              {ingredient.quantity} {ingredient.unit}
                              {ingredient.preparation_notes && ` • ${ingredient.preparation_notes}`}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditIngredient(ingredient)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveIngredient(ingredient.id)}
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  {recipe.ingredients.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No ingredients added yet</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Steps */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="flex items-center">
                      <Utensils className="h-5 w-5 mr-2" />
                      Instructions ({recipe.steps.length})
                    </CardTitle>
                    <CardDescription>Step-by-step cooking instructions</CardDescription>
                  </div>
                  <Button onClick={() => setIsAddStepOpen(true)} size="sm">
                    Add Step
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recipe.steps
                    .sort((a, b) => a.step_number - b.step_number)
                    .map((step, index) => (
                      <div key={step.id} className="flex gap-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold text-sm">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm leading-relaxed">{step.instruction}</p>
                          {(step.duration_minutes || step.temperature || step.equipment) && (
                            <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                              {step.duration_minutes && (
                                <span className="flex items-center">
                                  <Clock className="h-3 w-3 mr-1" />
                                  {step.duration_minutes} min
                                </span>
                              )}
                              {step.temperature && <span>🌡️ {step.temperature}°C</span>}
                              {step.equipment && <span>🔧 {step.equipment}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  {recipe.steps.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Utensils className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No instructions added yet</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        
        {/* Add Step Dialog */}
        <AddStepDialog
          open={isAddStepOpen}
          onOpenChange={setIsAddStepOpen}
          onAddStep={handleAddStep}
          currentStepCount={recipe?.steps.length || 0}
        />
      </main>
    </div>
  )
}
