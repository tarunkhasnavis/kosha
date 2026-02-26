/**
 * QuickBooks Desktop - Initiate Conductor Auth Session
 *
 * POST /api/integrations/quickbooks-desktop/connect
 *
 * Creates a Conductor end user (if needed) and auth session,
 * then returns the authFlowUrl for the user to complete setup
 * on their Windows machine where QB Desktop is installed.
 *
 * Flow:
 * 1. Create Conductor end user (if not already created)
 * 2. Create auth session -> get authFlowUrl
 * 3. Return URL to frontend -> user opens on Windows machine
 * 4. Conductor walks user through Web Connector setup
 * 5. User is redirected back to /settings?qbd_connected=true
 */

import { NextRequest, NextResponse } from 'next/server'
import { getOrganizationId } from '@/lib/organizations/queries'
import { createEndUser, createAuthSession } from '@/lib/integrations/providers/quickbooks-desktop/client'
import { getQBDSettingsService, saveQBDIntegration } from '@/lib/integrations/providers/quickbooks-desktop/db'
import { createServiceClient } from '@/utils/supabase/service'

export async function POST(request: NextRequest) {
  try {
    const organizationId = await getOrganizationId()
    if (!organizationId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Get organization name and email for creating the end user
    const supabase = createServiceClient()
    const { data: org } = await supabase
      .from('organizations')
      .select('name, gmail_email')
      .eq('id', organizationId)
      .single()

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Check if we already have a QBD integration with a Conductor end user
    let settings = await getQBDSettingsService(organizationId)
    let conductorEndUserId = settings?.conductorEndUserId

    // If no end user exists, create one in Conductor
    if (!conductorEndUserId) {
      const endUser = await createEndUser(
        organizationId,
        org.name || 'Unknown Company',
        org.gmail_email || 'noreply@kosha.app'
      )
      conductorEndUserId = endUser.id

      // Save the integration record (will be completed once auth flow finishes)
      await saveQBDIntegration(organizationId, {
        conductorEndUserId,
        companyName: org.name || 'Unknown Company',
      })
    }

    // Build the redirect URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const redirectUrl = `${baseUrl}/settings?qbd_connected=true`

    // Create auth session
    const { authFlowUrl } = await createAuthSession(conductorEndUserId, redirectUrl)

    return NextResponse.json({ authFlowUrl })
  } catch (error) {
    console.error('Failed to initiate QBD connection:', error)
    return NextResponse.json(
      { error: 'Failed to initiate connection' },
      { status: 500 }
    )
  }
}
