import { NextRequest, NextResponse } from 'next/server'
import { backfillCustomersFromOrders, previewCustomerBackfill } from '@/lib/customers/backfill'
import { getUser } from '@/lib/auth'

/**
 * POST /api/admin/backfill-customers
 *
 * Backfill customers from existing orders.
 *
 * Query params:
 * - organizationId: Optional - limit to specific org
 * - dryRun: If 'true', preview without making changes
 *
 * Requires authenticated admin user.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authenticated user
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query params
    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organizationId') || undefined
    const dryRun = searchParams.get('dryRun') === 'true'

    // Run backfill
    const result = dryRun
      ? await previewCustomerBackfill(organizationId)
      : await backfillCustomersFromOrders({ organizationId })

    return NextResponse.json({
      success: result.success,
      message: dryRun ? 'Dry run complete' : 'Backfill complete',
      stats: {
        customersCreated: result.customersCreated,
        ordersLinked: result.ordersLinked,
        duplicatesMerged: result.duplicatesMerged
      },
      errors: result.errors,
      details: result.details
    })

  } catch (error) {
    console.error('Backfill error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/backfill-customers
 *
 * Preview what the backfill would do (dry run).
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authenticated user
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query params
    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organizationId') || undefined

    // Run preview
    const result = await previewCustomerBackfill(organizationId)

    return NextResponse.json({
      success: result.success,
      message: 'Preview complete (no changes made)',
      stats: {
        customersToCreate: result.customersCreated,
        ordersToLink: result.ordersLinked,
        duplicatesToMerge: result.duplicatesMerged
      },
      errors: result.errors,
      details: result.details
    })

  } catch (error) {
    console.error('Backfill preview error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
