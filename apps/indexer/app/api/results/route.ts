import { NextResponse } from 'next/server'
import { getPriceResults, getResultsSummary } from '@/lib/db'

export async function GET() {
  try {
    const [results, summary] = await Promise.all([
      getPriceResults(),
      getResultsSummary(),
    ])

    return NextResponse.json({ results, summary })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to fetch results', details: String(err) },
      { status: 500 },
    )
  }
}
