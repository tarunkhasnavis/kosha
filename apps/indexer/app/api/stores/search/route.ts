import { NextResponse } from 'next/server'
import { searchStores } from '@/lib/places'

export async function GET() {
  try {
    const stores = await searchStores()
    return NextResponse.json({ stores, count: stores.length })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to search stores', details: String(err) },
      { status: 500 },
    )
  }
}
