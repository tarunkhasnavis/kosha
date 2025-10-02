import { NextRequest } from 'next/server'
import db from '@/lib/db'
import { successResponse, errorResponse, ApiError } from '@/lib/api-response'

// POST /api/orders/[id]/approve - Approve an order
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const order = await db.orders.findById(params.id)
    
    if (!order) {
      throw new ApiError(404, 'Order not found')
    }
    
    if (order.status !== 'waiting_review') {
      throw new ApiError(400, 'Order cannot be approved in current status')
    }
    
    const updatedOrder = await db.orders.update(params.id, {
      status: 'approved'
    })
    
    // Here you could trigger additional actions:
    // - Send to inventory system
    // - Notify suppliers
    // - Update accounting
    
    return successResponse(updatedOrder, 'Order approved successfully')
  } catch (error) {
    return errorResponse(error)
  }
}