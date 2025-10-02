import { NextRequest } from 'next/server'
import db from '@/lib/db'
import { successResponse, errorResponse, ApiError } from '@/lib/api-response'
import { createOrderSchema } from '@/lib/validations'
import type { Order, OrderStats } from '@/types/orders'

// GET /api/orders - Get all orders with stats
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const limit = searchParams.get('limit')
    
    // For now, return mock data
    // Replace with actual database query
    const mockOrders: Order[] = [
      {
        id: "1",
        orderNumber: "ORD-2024-001",
        companyName: "Acme Restaurant",
        source: "email",
        status: "waiting_review",
        items: [
          { name: "Organic Tomatoes", quantity: "50 lbs", unit_price: 2.50, total: 125.00 },
          { name: "Fresh Basil", quantity: "10 bunches", unit_price: 3.00, total: 30.00 }
        ],
        orderValue: 155.00,
        itemCount: 2,
        receivedDate: new Date().toISOString()
      }
    ]
    
    const stats: OrderStats = {
      waitingReview: mockOrders.filter(o => o.status === 'waiting_review').length,
      uploadSuccessful: mockOrders.filter(o => o.status === 'approved').length,
      totalToday: mockOrders.length,
      processingTime: "2 min"
    }
    
    return successResponse({ orders: mockOrders, stats })
  } catch (error) {
    return errorResponse(error)
  }
}

// POST /api/orders - Create new order
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate request body
    const validatedData = createOrderSchema.parse(body)
    
    // Create order in database
    const newOrder = await db.orders.create({
      ...validatedData,
      status: 'waiting_review',
      receivedDate: new Date().toISOString(),
      orderValue: validatedData.items.reduce((sum, item) => sum + item.total, 0),
      itemCount: validatedData.items.length
    })
    
    return successResponse(newOrder, 'Order created successfully')
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return errorResponse(new ApiError(400, 'Invalid request data', error), 400)
    }
    return errorResponse(error)
  }
}