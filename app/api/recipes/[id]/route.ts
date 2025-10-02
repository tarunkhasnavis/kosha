import { NextRequest } from 'next/server'
import db from '@/lib/db'
import { successResponse, errorResponse, ApiError } from '@/lib/api-response'

// GET /api/recipes/[id] - Get single recipe
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const recipe = await db.recipes.findById(params.id)
    
    if (!recipe) {
      throw new ApiError(404, 'Recipe not found')
    }
    
    // Mock enriched data
    const enrichedRecipe = {
      ...recipe,
      ingredients: recipe.ingredients || [],
      steps: recipe.steps || []
    }
    
    return successResponse(enrichedRecipe)
  } catch (error) {
    return errorResponse(error)
  }
}

// PUT /api/recipes/[id] - Update recipe
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    
    const recipe = await db.recipes.findById(params.id)
    if (!recipe) {
      throw new ApiError(404, 'Recipe not found')
    }
    
    const updatedRecipe = await db.recipes.update(params.id, {
      ...body,
      updated_at: new Date().toISOString()
    })
    
    return successResponse(updatedRecipe, 'Recipe updated successfully')
  } catch (error) {
    return errorResponse(error)
  }
}

// DELETE /api/recipes/[id] - Delete recipe
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const recipe = await db.recipes.findById(params.id)
    if (!recipe) {
      throw new ApiError(404, 'Recipe not found')
    }
    
    await db.recipes.delete(params.id)
    
    return successResponse(null, 'Recipe deleted successfully')
  } catch (error) {
    return errorResponse(error)
  }
}