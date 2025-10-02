import { NextRequest } from 'next/server'
import { successResponse } from '@/lib/api-response'

// GET /api/health - Health check endpoint
export async function GET(request: NextRequest) {
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      database: 'connected',
      api: 'operational'
    }
  }
  
  return successResponse(healthData)
}