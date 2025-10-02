import { NextRequest } from 'next/server'
import db from '@/lib/db'
import { successResponse, errorResponse, ApiError } from '@/lib/api-response'
import { createInventoryItemSchema } from '@/lib/validations'

// GET /api/inventory - Get all inventory items
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const category = searchParams.get('category')
    const lowStock = searchParams.get('lowStock')
    
    let items = await db.inventory.findMany()
    
    // Filter by category
    if (category) {
      items = items.filter(item => item.category === category)
    }
    
    // Filter low stock items
    if (lowStock === 'true') {
      items = items.filter(item => item.quantity <= item.minimum_quantity)
    }
    
    // Calculate stats
    const stats = {
      totalItems: items.length,
      lowStockItems: items.filter(i => i.quantity <= i.minimum_quantity).length,
      outOfStock: items.filter(i => i.quantity === 0).length,
      totalValue: items.reduce((sum, item) => 
        sum + (item.quantity * (item.cost_per_unit || 0)), 0
      )
    }
    
    return successResponse({ items, stats })
  } catch (error) {
    return errorResponse(error)
  }
}

// POST /api/inventory - Create new inventory item
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate request body
    const validatedData = createInventoryItemSchema.parse(body)
    
    // Create inventory item
    const newItem = await db.inventory.create({
      ...validatedData,
      last_restock_date: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    
    return successResponse(newItem, 'Inventory item created successfully')
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return errorResponse(new ApiError(400, 'Invalid inventory data', error), 400)
    }
    return errorResponse(error)
  }
}