/**
 * QuickBooks Online OAuth Callback
 *
 * GET /api/integrations/quickbooks/callback
 *
 * Intuit redirects here after the user authorizes the app.
 * We exchange the auth code for tokens, fetch company info,
 * and store everything in organization_integrations.
 */

import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForTokens, getQBOBaseUrl } from '@/lib/integrations/providers/quickbooks-online/auth'
import { saveQBOIntegration } from '@/lib/integrations/providers/quickbooks-online/db'
import type { QBOConfig } from '@/lib/integrations/providers/quickbooks-online/types'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const realmId = searchParams.get('realmId')
  const state = searchParams.get('state')  // organizationId
  const error = searchParams.get('error')

  // Handle user denial or errors
  if (error) {
    console.error('QBO OAuth error:', error)
    return NextResponse.redirect(
      new URL('/settings?qbo_error=access_denied', request.url)
    )
  }

  if (!code || !realmId || !state) {
    console.error('QBO OAuth callback missing params:', { code: !!code, realmId: !!realmId, state: !!state })
    return NextResponse.redirect(
      new URL('/settings?qbo_error=missing_params', request.url)
    )
  }

  const organizationId = state

  try {
    // 1. Exchange auth code for tokens
    const tokens = await exchangeCodeForTokens(code, realmId)

    // 2. Fetch company info from QBO
    const baseUrl = getQBOBaseUrl()
    const companyResponse = await fetch(
      `${baseUrl}/v3/company/${realmId}/companyinfo/${realmId}`,
      {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          Accept: 'application/json',
        },
      }
    )

    let companyName = 'Unknown Company'
    if (companyResponse.ok) {
      const companyData = await companyResponse.json()
      companyName = companyData.CompanyInfo?.CompanyName || companyName
    }

    // 3. Determine environment
    const environment = process.env.QUICKBOOKS_ENVIRONMENT === 'sandbox' ? 'sandbox' : 'production'

    // 4. Save to database
    const config: QBOConfig = {
      realmId,
      companyName,
      environment: environment as 'sandbox' | 'production',
    }

    const result = await saveQBOIntegration(organizationId, config, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      refreshTokenExpiresIn: tokens.refreshTokenExpiresIn,
    })

    if (!result.success) {
      console.error('Failed to save QBO integration:', result.error)
      return NextResponse.redirect(
        new URL('/settings?qbo_error=save_failed', request.url)
      )
    }

    console.log(`QBO connected for org ${organizationId}: ${companyName} (realm: ${realmId})`)

    // 5. Redirect back to settings with success
    return NextResponse.redirect(
      new URL('/settings?qbo_connected=true', request.url)
    )
  } catch (err) {
    console.error('QBO OAuth callback error:', err)
    return NextResponse.redirect(
      new URL('/settings?qbo_error=exchange_failed', request.url)
    )
  }
}
