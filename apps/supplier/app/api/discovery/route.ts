import { getUser } from '@kosha/supabase'
import { NextResponse } from 'next/server'
import { getDiscoveredAccounts } from '@/lib/discovery/queries'
import type { DiscoveryCategory } from '@kosha/types'

const VALID_CATEGORIES = ['bar', 'restaurant', 'liquor_store', 'brewery', 'hotel', 'convenience_store']

/**
 * GET /api/discovery?category=bar&north=28&south=27&east=-82&west=-83
 *
 * Fetches discovered accounts filtered by category and map viewport bounds.
 */
export async function GET(request: Request) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const url = new URL(request.url)
  const category = url.searchParams.get('category')
  const north = url.searchParams.get('north')
  const south = url.searchParams.get('south')
  const east = url.searchParams.get('east')
  const west = url.searchParams.get('west')

  const validCategory = category && VALID_CATEGORIES.includes(category)
    ? (category as DiscoveryCategory)
    : undefined

  const bounds = north && south && east && west
    ? {
        north: parseFloat(north),
        south: parseFloat(south),
        east: parseFloat(east),
        west: parseFloat(west),
      }
    : undefined

  const result = await getDiscoveredAccounts(validCategory, bounds)

  return NextResponse.json({ accounts: result.accounts })
}
