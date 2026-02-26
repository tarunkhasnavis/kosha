/**
 * QuickBooks Online - Initiate OAuth Connection
 *
 * POST /api/integrations/quickbooks/connect
 *
 * Returns the Intuit OAuth authorization URL.
 * Keeps client secrets server-side.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getOrganizationId } from '@/lib/organizations/queries'
import { buildAuthorizationUrl } from '@/lib/integrations/providers/quickbooks-online/auth'

export async function POST(request: NextRequest) {
  try {
    // Verify the user is authenticated and has an organization
    const organizationId = await getOrganizationId()
    if (!organizationId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Build the Intuit OAuth URL
    const authUrl = buildAuthorizationUrl(organizationId)

    return NextResponse.json({ authUrl })
  } catch (error) {
    console.error('Failed to initiate QBO connection:', error)
    return NextResponse.json(
      { error: 'Failed to initiate connection' },
      { status: 500 }
    )
  }
}
