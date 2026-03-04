/**
 * Cron Job: Renew Gmail Watch Subscriptions
 *
 * Gmail watch subscriptions expire after ~7 days. This cron job
 * renews any watches that are about to expire.
 *
 * Recommended schedule: Daily (once per day is sufficient)
 */

import { NextRequest, NextResponse } from 'next/server'
import { renewExpiringWatches } from '@/lib/email/gmail/watch'

/**
 * GET /api/cron/renew-watches
 *
 * Called by Vercel Cron to renew expiring Gmail watches
 */
export async function GET(request: NextRequest) {
  // Verify cron secret (optional but recommended)
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.log('Unauthorized cron request')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('Starting Gmail watch renewal...')

  try {
    const result = await renewExpiringWatches()

    console.log(`Watch renewal complete: ${result.renewed} renewed, ${result.failed} failed`)

    return NextResponse.json({
      success: result.failed === 0,
      renewed: result.renewed,
      failed: result.failed,
      errors: result.errors.length > 0 ? result.errors : undefined,
    })
  } catch (error) {
    console.error('Watch renewal error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/cron/renew-watches
 *
 * Allow manual triggering via POST as well
 */
export async function POST(request: NextRequest) {
  return GET(request)
}
