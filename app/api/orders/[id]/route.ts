import { NextRequest } from 'next/server'
import db from '@/lib/db'
import { successResponse, errorResponse, ApiError } from '@/lib/api-response'
import { updateOrderStatusSchema } from '@/lib/validations'

// GET /api/orders/[id] - Get single order
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const order = await db.orders.findById(params.id)
    
    if (!order) {
      throw new ApiError(404, 'Order not found')
    }
    
    return successResponse(order)
  } catch (error) {
    return errorResponse(error)
  }
}

// PUT /api/orders/[id] - Update order
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    
    const order = await db.orders.findById(params.id)
    if (!order) {
      throw new ApiError(404, 'Order not found')
    }
    
    const updatedOrder = await db.orders.update(params.id, body)
    
    return successResponse(updatedOrder, 'Order updated successfully')
  } catch (error) {
    return errorResponse(error)
  }
}

// DELETE /api/orders/[id] - Delete order
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const order = await db.orders.findById(params.id)
    if (!order) {
      throw new ApiError(404, 'Order not found')
    }
    
    await db.orders.delete(params.id)
    
    return successResponse(null, 'Order deleted successfully')
  } catch (error) {
    return errorResponse(error)
  }
}