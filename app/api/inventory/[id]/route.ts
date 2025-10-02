import { NextRequest } from 'next/server'
import db from '@/lib/db'
import { successResponse, errorResponse, ApiError } from '@/lib/api-response'
import { updateInventoryQuantitySchema } from '@/lib/validations'

// GET /api/inventory/[id] - Get single inventory item
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const item = await db.inventory.findById(params.id)
    
    if (!item) {
      throw new ApiError(404, 'Inventory item not found')
    }
    
    return successResponse(item)
  } catch (error) {
    return errorResponse(error)
  }
}

// PUT /api/inventory/[id] - Update inventory item
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    
    const item = await db.inventory.findById(params.id)
    if (!item) {
      throw new ApiError(404, 'Inventory item not found')
    }
    
    const updatedItem = await db.inventory.update(params.id, {
      ...body,
      updated_at: new Date().toISOString()
    })
    
    return successResponse(updatedItem, 'Inventory item updated successfully')
  } catch (error) {
    return errorResponse(error)
  }
}

// PATCH /api/inventory/[id] - Update inventory quantity
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    
    // Validate request body
    const validatedData = updateInventoryQuantitySchema.parse(body)
    
    const item = await db.inventory.findById(params.id)
    if (!item) {
      throw new ApiError(404, 'Inventory item not found')
    }
    
    // Update quantity and track history
    const updatedItem = await db.inventory.updateQuantity(
      params.id, 
      validatedData.quantity
    )
    
    // Here you could log the quantity change for audit
    
    // Check if low stock alert needed
    if (updatedItem.quantity <= updatedItem.minimum_quantity) {
      // Trigger low stock notification
      console.log(`Low stock alert: ${updatedItem.name} - ${updatedItem.quantity} ${updatedItem.unit} remaining`)
    }
    
    return successResponse(updatedItem, 'Quantity updated successfully')
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return errorResponse(new ApiError(400, 'Invalid quantity data', error), 400)
    }
    return errorResponse(error)
  }
}