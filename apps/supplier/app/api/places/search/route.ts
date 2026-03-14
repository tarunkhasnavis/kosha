import { NextRequest, NextResponse } from 'next/server'

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY

export interface PlaceResult {
  place_id: string
  name: string
  address: string
  latitude: number
  longitude: number
  rating: number | null
  review_count: number | null
  phone: string | null
  website: string | null
  hours: string[] | null
  types: string[]
}

export async function GET(request: NextRequest) {
  if (!GOOGLE_PLACES_API_KEY) {
    return NextResponse.json({ error: 'Google Places API key not configured' }, { status: 503 })
  }

  const query = request.nextUrl.searchParams.get('q')
  if (!query || query.trim().length < 2) {
    return NextResponse.json({ results: [] })
  }

  const lat = request.nextUrl.searchParams.get('lat') || '27.9506'
  const lng = request.nextUrl.searchParams.get('lng') || '-82.4572'

  try {
    // Use Places API (New) Text Search
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.nationalPhoneNumber,places.websiteUri,places.currentOpeningHours,places.types',
      },
      body: JSON.stringify({
        textQuery: query,
        locationBias: {
          circle: {
            center: { latitude: parseFloat(lat), longitude: parseFloat(lng) },
            radius: 50000,
          },
        },
        maxResultCount: 10,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Google Places API error:', response.status, errorText)
      return NextResponse.json({ error: 'Places search failed' }, { status: 502 })
    }

    const data = await response.json()
    const places = data.places || []

    const results: PlaceResult[] = places.map((place: {
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
    }) => ({
      place_id: place.id,
      name: place.displayName?.text || '',
      address: place.formattedAddress || '',
      latitude: place.location?.latitude || 0,
      longitude: place.location?.longitude || 0,
      rating: place.rating || null,
      review_count: place.userRatingCount || null,
      phone: place.nationalPhoneNumber || null,
      website: place.websiteUri || null,
      hours: place.currentOpeningHours?.weekdayDescriptions || null,
      types: place.types || [],
    }))

    return NextResponse.json({ results })
  } catch (err) {
    console.error('Places search error:', err)
    return NextResponse.json({ error: 'Places search failed' }, { status: 500 })
  }
}
