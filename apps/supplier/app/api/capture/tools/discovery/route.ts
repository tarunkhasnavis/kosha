import { getUser } from '@kosha/supabase'
import { getOrganizationId } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { getDiscoveredAccounts, getTopDiscoveredAccounts } from '@/lib/discovery/queries'
import type { DiscoveryCategory } from '@kosha/types'

const VALID_CATEGORIES = ['bar', 'restaurant', 'liquor_store', 'brewery', 'hotel', 'convenience_store']

/**
 * POST /api/capture/tools/discovery
 *
 * Called by the voice agent when the LLM invokes the search_discovery_accounts tool.
 * Returns discovered accounts filtered by category, ordered by AI score.
 */
export async function POST(request: Request) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const orgId = await getOrganizationId()
  if (!orgId) {
    return NextResponse.json({ error: 'No organization found' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const { category, limit = 10 } = body as { category?: string; limit?: number }

  const validCategory = category && VALID_CATEGORIES.includes(category)
    ? (category as DiscoveryCategory)
    : undefined

  const clampedLimit = Math.min(Math.max(limit || 10, 1), 25)

  const result = validCategory
    ? await getTopDiscoveredAccounts(validCategory, clampedLimit)
    : await getDiscoveredAccounts()

  // Return concise shape — only what the LLM needs to speak about
  const accounts = result.accounts.slice(0, clampedLimit).map((a) => ({
    discovered_account_id: a.id,
    name: a.name,
    address: a.address,
    category: a.category,
    ai_score: a.ai_score,
    ai_reasons: a.ai_reasons,
    google_rating: a.google_rating,
    phone: a.phone,
    website: a.website,
  }))

  return NextResponse.json({ accounts })
}
