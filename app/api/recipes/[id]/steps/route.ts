import { NextRequest } from 'next/server'
import db from '@/lib/db'
import { successResponse, errorResponse, ApiError } from '@/lib/api-response'
import { addRecipeStepSchema } from '@/lib/validations'

// POST /api/recipes/[id]/steps - Add step to recipe
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    
    // Validate request body
    const validatedData = addRecipeStepSchema.parse(body)
    
    const recipe = await db.recipes.findById(params.id)
    if (!recipe) {
      throw new ApiError(404, 'Recipe not found')
    }
    
    // Add step to recipe
    const newStep = {
      id: `step-${Date.now()}`,
      ...validatedData,
      created_at: new Date().toISOString()
    }
    
    const steps = recipe.steps || []
    steps.push(newStep)
    
    const updatedRecipe = await db.recipes.update(params.id, {
      steps: steps.sort((a, b) => a.step_number - b.step_number),
      updated_at: new Date().toISOString()
    })
    
    return successResponse(newStep, 'Step added successfully')
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return errorResponse(new ApiError(400, 'Invalid step data', error), 400)
    }
    return errorResponse(error)
  }
}