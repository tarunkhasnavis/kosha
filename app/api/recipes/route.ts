import { NextRequest } from 'next/server'
import db from '@/lib/db'
import { successResponse, errorResponse, ApiError } from '@/lib/api-response'
import { createRecipeSchema } from '@/lib/validations'

// GET /api/recipes - Get all recipes
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    
    // Mock data for now
    const recipes = await db.recipes.findMany()
    
    // Filter if needed
    let filteredRecipes = recipes
    if (category) {
      filteredRecipes = filteredRecipes.filter(r => r.category === category)
    }
    if (search) {
      filteredRecipes = filteredRecipes.filter(r => 
        r.name.toLowerCase().includes(search.toLowerCase())
      )
    }
    
    return successResponse(filteredRecipes)
  } catch (error) {
    return errorResponse(error)
  }
}

// POST /api/recipes - Create new recipe
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate request body
    const validatedData = createRecipeSchema.parse(body)
    
    // Create recipe in database
    const newRecipe = await db.recipes.create({
      ...validatedData,
      ingredients: [],
      steps: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    
    return successResponse(newRecipe, 'Recipe created successfully')
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return errorResponse(new ApiError(400, 'Invalid recipe data', error), 400)
    }
    return errorResponse(error)
  }
}