import { NextRequest } from 'next/server'
import db from '@/lib/db'
import { successResponse, errorResponse, ApiError } from '@/lib/api-response'

// POST /api/orders/[id]/reject - Reject an order
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { reason } = body
    
    if (!reason) {
      throw new ApiError(400, 'Rejection reason is required')
    }
    
    const order = await db.orders.findById(params.id)
    
    if (!order) {
      throw new ApiError(404, 'Order not found')
    }
    
    if (order.status !== 'waiting_review') {
      throw new ApiError(400, 'Order cannot be rejected in current status')
    }
    
    const updatedOrder = await db.orders.update(params.id, {
      status: 'rejected',
      rejectionReason: reason
    })
    
    // Here you could trigger notifications to the sender
    
    return successResponse(updatedOrder, 'Order rejected')
  } catch (error) {
    return errorResponse(error)
  }
}