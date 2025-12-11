import { NextResponse } from 'next/server'
import { syncAllOrganizationEmails } from '@/lib/workers/emailSync'

/**
 * Email Sync Cron Endpoint
 *
 * This endpoint triggers email synchronization for all organizations.
 * It should be called periodically by a cron job.
 *
 * Setup with Vercel Cron:
 * 1. Add to vercel.json:
 *    {
 *      "crons": [{
 *        "path": "/api/cron/email-sync",
 *        "schedule": "every 5 minutes"
 *      }]
 *    }
 * 2. Deploy to Vercel
 *
 * Security:
 * - Vercel Cron sends special headers for authentication
 * - You can also add a secret token check for extra security
 */
export async function GET(request: Request) {
  try {
    // Optional: Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('Starting email sync cron job...')

    const result = await syncAllOrganizationEmails()

    if (result.success) {
      return NextResponse.json({
        message: `Processed ${result.totalProcessed} emails across ${result.organizationsProcessed} organizations`,
        ...result,
      })
    } else {
      return NextResponse.json({
        message: 'Email sync completed with errors',
        ...result,
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Error in email sync cron:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// Allow POST as well (for manual triggers)
export async function POST(request: Request) {
  return GET(request)
}
