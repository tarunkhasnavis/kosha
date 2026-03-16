import { NextRequest, NextResponse } from 'next/server'
import { getVisitsForDate } from '@/lib/visits/queries'

/**
 * GET /api/visits?date=YYYY-MM-DD
 *
 * Returns visits for a given date with account location data.
 */
export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date')
  if (!date) {
    return NextResponse.json({ error: 'date parameter required' }, { status: 400 })
  }

  const { visits, error } = await getVisitsForDate(date)
  if (error) {
    return NextResponse.json({ error }, { status: 500 })
  }

  return NextResponse.json({ visits })
}
