import { getUser } from '@kosha/supabase'
import { getOrganizationId } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createClient } from '@kosha/supabase/server'

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY

/**
 * Category → Google Places text query mapping
 * These queries produce the most relevant results per category
 */
const CATEGORY_QUERIES: Record<string, string> = {
  bar: 'bars and pubs',
  restaurant: 'restaurants',
  liquor_store: 'liquor store wine spirits',
  brewery: 'brewery taproom',
  hotel: 'hotels',
  convenience_store: 'convenience store gas station',
}

/**
 * Simple scoring heuristic based on Google data
 * Higher rating + more reviews + certain types = higher score
 */
function computeScore(place: {
  rating: number | null
  reviewCount: number | null
  types: string[]
}): { score: number; reasons: string[] } {
  let score = 50
  const reasons: string[] = []

  // Rating boost (0-20 points)
  if (place.rating) {
    const ratingBoost = Math.round((place.rating - 3) * 10)
    score += Math.max(0, Math.min(20, ratingBoost))
    if (place.rating >= 4.5) reasons.push(`Highly rated (${place.rating} stars)`)
    else if (place.rating >= 4.0) reasons.push(`Well rated (${place.rating} stars)`)
  }

  // Review volume boost (0-20 points)
  if (place.reviewCount) {
    if (place.reviewCount >= 500) {
      score += 20
      reasons.push(`High volume venue (${place.reviewCount}+ reviews)`)
    } else if (place.reviewCount >= 200) {
      score += 15
      reasons.push(`Established venue (${place.reviewCount} reviews)`)
    } else if (place.reviewCount >= 50) {
      score += 8
      reasons.push('Growing customer base')
    }
  }

  // Type-based boost
  const premiumTypes = ['fine_dining_restaurant', 'steak_house', 'wine_bar', 'cocktail_bar']
  const hasPremium = place.types.some((t) => premiumTypes.includes(t))
  if (hasPremium) {
    score += 10
    reasons.push('Premium venue — higher margin opportunity')
  }

  if (reasons.length === 0) {
    reasons.push('Potential new account in your territory')
  }

  return { score: Math.min(100, Math.max(1, score)), reasons }
}

/**
 * GET /api/discovery/live?category=bar&lat=34.22&lng=-84.13&radius=10000
 *
 * Searches Google Places for real businesses in the specified area,
 * filters out already-managed accounts, scores results, and returns them.
 */
export async function GET(request: Request) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  if (!GOOGLE_PLACES_API_KEY) {
    return NextResponse.json({ error: 'Google Places API key not configured' }, { status: 503 })
  }

  const orgId = await getOrganizationId()
  if (!orgId) {
    return NextResponse.json({ error: 'No organization found' }, { status: 403 })
  }

  const url = new URL(request.url)
  const category = url.searchParams.get('category')
  const lat = url.searchParams.get('lat')
  const lng = url.searchParams.get('lng')
  const radius = url.searchParams.get('radius') || '15000'

  if (!category || !CATEGORY_QUERIES[category]) {
    return NextResponse.json({ error: 'Valid category is required' }, { status: 400 })
  }

  if (!lat || !lng) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 })
  }

  try {
    // 1. Search Google Places
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.nationalPhoneNumber,places.websiteUri,places.currentOpeningHours,places.types',
      },
      body: JSON.stringify({
        textQuery: CATEGORY_QUERIES[category],
        locationBias: {
          circle: {
            center: { latitude: parseFloat(lat), longitude: parseFloat(lng) },
            radius: Math.min(parseInt(radius), 50000),
          },
        },
        maxResultCount: 20,
      }),
    })

    if (!response.ok) {
      console.error('Google Places API error:', response.status, await response.text())
      return NextResponse.json({ error: 'Places search failed' }, { status: 502 })
    }

    const data = await response.json()
    const places = data.places || []

    // 2. Get existing managed account names to filter out
    const supabase = await createClient()
    const { data: existingAccounts } = await supabase
      .from('accounts')
      .select('name')
      .eq('organization_id', orgId)

    const managedNames = new Set(
      (existingAccounts || []).map((a) => a.name.toLowerCase().trim())
    )

    // 3. Map, filter, and score results
    const accounts = places
      .map((place: {
        id: string
        displayName?: { text: string }
        formattedAddress?: string
        location?: { latitude: number; longitude: number }
        rating?: number
        userRatingCount?: number
        nationalPhoneNumber?: string
        websiteUri?: string
        currentOpeningHours?: { weekdayDescriptions?: string[] }
        types?: string[]
      }) => {
        const name = place.displayName?.text || ''
        const address = place.formattedAddress || ''

        // Skip if already managed
        if (managedNames.has(name.toLowerCase().trim())) return null

        // Skip if no location
        if (!place.location?.latitude || !place.location?.longitude) return null

        const { score, reasons } = computeScore({
          rating: place.rating || null,
          reviewCount: place.userRatingCount || null,
          types: place.types || [],
        })

        return {
          id: place.id,
          organization_id: orgId,
          name,
          address,
          category,
          latitude: place.location.latitude,
          longitude: place.location.longitude,
          google_place_id: place.id,
          google_rating: place.rating || null,
          google_review_count: place.userRatingCount || null,
          ai_score: score,
          ai_reasons: reasons,
          phone: place.nationalPhoneNumber || null,
          website: place.websiteUri || null,
          hours: place.currentOpeningHours?.weekdayDescriptions?.join('\n') || null,
          is_claimed: false,
          created_at: new Date().toISOString(),
        }
      })
      .filter(Boolean)
      .sort((a: { ai_score: number }, b: { ai_score: number }) => b.ai_score - a.ai_score)

    return NextResponse.json({ accounts })
  } catch (err) {
    console.error('Live discovery error:', err)
    return NextResponse.json({ error: 'Discovery search failed' }, { status: 500 })
  }
}
