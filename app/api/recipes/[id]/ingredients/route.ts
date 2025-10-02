import { NextRequest } from 'next/server'
import db from '@/lib/db'
import { successResponse, errorResponse, ApiError } from '@/lib/api-response'
import { addRecipeIngredientSchema } from '@/lib/validations'

// POST /api/recipes/[id]/ingredients - Add ingredient to recipe
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    
    // Validate request body
    const validatedData = addRecipeIngredientSchema.parse(body)
    
    const recipe = await db.recipes.findById(params.id)
    if (!recipe) {
      throw new ApiError(404, 'Recipe not found')
    }
    
    // Add ingredient to recipe
    const newIngredient = {
      id: `ing-${Date.now()}`,
      ...validatedData,
      created_at: new Date().toISOString()
    }
    
    const ingredients = recipe.ingredients || []
    ingredients.push(newIngredient)
    
    const updatedRecipe = await db.recipes.update(params.id, {
      ingredients,
      updated_at: new Date().toISOString()
    })
    
    return successResponse(newIngredient, 'Ingredient added successfully')
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return errorResponse(new ApiError(400, 'Invalid ingredient data', error), 400)
    }
    return errorResponse(error)
  }
}