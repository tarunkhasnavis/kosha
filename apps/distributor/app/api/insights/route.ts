/**
 * Insights Chat API Route
 *
 * POST /api/insights
 * Handles chat messages for the insights assistant.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@kosha/supabase'
import { getUserOrganization } from '@/lib/organizations/queries'
import { callInsightsAgent } from '@/lib/analytics-chat/agent'
import type { AnalyticsChatRequest, AnalyticsChatResponse } from '@/lib/analytics-chat/types'

export async function POST(request: NextRequest): Promise<NextResponse<AnalyticsChatResponse>> {
  const startTime = Date.now()

  try {
    // Auth check
    const user = await getUser()
    if (!user) {
      return NextResponse.json(
        {
          message: '',
          error: 'Not authenticated',
          latency_ms: Date.now() - startTime,
        },
        { status: 401 }
      )
    }

    // Get organization
    const org = await getUserOrganization()
    if (!org?.id) {
      return NextResponse.json(
        {
          message: '',
          error: 'No organization found',
          latency_ms: Date.now() - startTime,
        },
        { status: 403 }
      )
    }

    // Parse request body
    const body = (await request.json()) as AnalyticsChatRequest
    const { message, conversation_history } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        {
          message: '',
          error: 'Message is required',
          latency_ms: Date.now() - startTime,
        },
        { status: 400 }
      )
    }

    // Call the insights agent
    const result = await callInsightsAgent({
      userMessage: message,
      conversationHistory: conversation_history || [],
      organizationId: org.id,
      organizationName: org.name || 'Your Organization',
    })

    return NextResponse.json({
      message: result.response,
      data: result.analyticsData,
      latency_ms: result.latencyMs,
    })
  } catch (error) {
    console.error('[Insights API] Error:', error)

    return NextResponse.json(
      {
        message: '',
        error: error instanceof Error ? error.message : 'Internal server error',
        latency_ms: Date.now() - startTime,
      },
      { status: 500 }
    )
  }
}
