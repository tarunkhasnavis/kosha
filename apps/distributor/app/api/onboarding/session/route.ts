/**
 * Onboarding Session API
 *
 * GET - Retrieve current session state
 * PUT - Update session state
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getOrCreateOnboardingSession,
  updateOnboardingSession,
} from '@/lib/onboarding/actions'
import { OnboardingStage, ChatMessage, OrgData } from '@/lib/onboarding/types'

/**
 * GET /api/onboarding/session
 * Get or create onboarding session for the current user
 */
export async function GET() {
  try {
    const { session, error } = await getOrCreateOnboardingSession()

    if (error) {
      return NextResponse.json({ error }, { status: 401 })
    }

    if (!session) {
      return NextResponse.json({ error: 'Failed to get session' }, { status: 500 })
    }

    return NextResponse.json({ session })
  } catch (error) {
    console.error('[Onboarding Session] GET error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/onboarding/session
 * Update onboarding session
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      sessionId,
      currentStage,
      organizationId,
      orgData,
      productsImported,
      orderExampleSaved,
      chatSummary,
      lastMessages,
    } = body as {
      sessionId: string
      currentStage?: OnboardingStage
      organizationId?: string
      orgData?: OrgData
      productsImported?: number
      orderExampleSaved?: boolean
      chatSummary?: string
      lastMessages?: ChatMessage[]
    }

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
    }

    const updates: Parameters<typeof updateOnboardingSession>[1] = {}

    if (currentStage !== undefined) updates.currentStage = currentStage
    if (organizationId !== undefined) updates.organizationId = organizationId
    if (orgData !== undefined) updates.orgData = orgData
    if (productsImported !== undefined) updates.productsImported = productsImported
    if (orderExampleSaved !== undefined) updates.orderExampleSaved = orderExampleSaved
    if (chatSummary !== undefined) updates.chatSummary = chatSummary
    if (lastMessages !== undefined) updates.lastMessages = lastMessages

    const { success, error } = await updateOnboardingSession(sessionId, updates)

    if (!success) {
      return NextResponse.json({ error: error || 'Failed to update session' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Onboarding Session] PUT error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
