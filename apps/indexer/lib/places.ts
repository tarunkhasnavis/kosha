import type { Store, StoreType } from './types'

const GOOGLE_PLACES_URL = 'https://places.googleapis.com/v1/places:searchNearby'

// Chicago neighborhoods — spread across the city for coverage
const CHICAGO_ZONES = [
  { name: 'Loop / Downtown', lat: 41.8781, lng: -87.6298 },
  { name: 'Lincoln Park', lat: 41.9214, lng: -87.6513 },
  { name: 'Wicker Park / Bucktown', lat: 41.9088, lng: -87.6796 },
  { name: 'Lakeview / Wrigleyville', lat: 41.9434, lng: -87.6553 },
  { name: 'River North', lat: 41.8922, lng: -87.6320 },
  { name: 'West Loop / Fulton', lat: 41.8865, lng: -87.6534 },
  { name: 'Logan Square', lat: 41.9234, lng: -87.7083 },
  { name: 'Hyde Park', lat: 41.7943, lng: -87.5907 },
  { name: 'Pilsen / Bridgeport', lat: 41.8525, lng: -87.6614 },
  { name: 'Uptown / Andersonville', lat: 41.9659, lng: -87.6574 },
  { name: 'South Loop', lat: 41.8569, lng: -87.6247 },
  { name: 'Old Town / Gold Coast', lat: 41.9086, lng: -87.6354 },
]

// Place types that would sell seltzers
const PLACE_TYPE_MAP: Record<string, StoreType> = {
  bar: 'bar',
  night_club: 'bar',
  liquor_store: 'liquor_store',
  grocery_or_supermarket: 'grocery',
  supermarket: 'grocery',
  gas_station: 'gas_station',
  convenience_store: 'convenience',
}

const SEARCH_TYPES = [
  'liquor_store',
  'grocery_or_supermarket',
  'convenience_store',
]

type PlaceResult = {
  id: string
  displayName?: { text: string }
  formattedAddress?: string
  nationalPhoneNumber?: string
  internationalPhoneNumber?: string
  location?: { latitude: number; longitude: number }
  primaryType?: string
}

type NearbySearchResponse = {
  places?: PlaceResult[]
}

function toStore(place: PlaceResult): Store | null {
  const phone = place.internationalPhoneNumber || place.nationalPhoneNumber
  if (!phone) return null

  const cleanPhone = phone.replace(/[\s()-]/g, '')
  if (cleanPhone.length < 10) return null

  const storeType = place.primaryType
    ? PLACE_TYPE_MAP[place.primaryType] ?? 'other'
    : 'other'

  return {
    id: place.id,
    name: place.displayName?.text ?? 'Unknown',
    phone: cleanPhone.startsWith('+') ? cleanPhone : `+1${cleanPhone}`,
    address: place.formattedAddress ?? '',
    lat: place.location?.latitude ?? 0,
    lng: place.location?.longitude ?? 0,
    type: storeType,
    place_id: place.id,
  }
}

async function searchZone(
  apiKey: string,
  lat: number,
  lng: number,
  placeType: string,
  radius: number,
): Promise<PlaceResult[]> {
  const body = {
    includedTypes: [placeType],
    maxResultCount: 20,
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius,
      },
    },
  }

  const res = await fetch(GOOGLE_PLACES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.location,places.primaryType',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error(`Places API error for ${placeType}:`, err)
    return []
  }

  const data: NearbySearchResponse = await res.json()
  return data.places ?? []
}

export async function searchStores(options?: {
  zones?: { lat: number; lng: number }[]
  radiusMeters?: number
  types?: string[]
}): Promise<Store[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) throw new Error('Missing GOOGLE_PLACES_API_KEY')

  const zones = options?.zones ?? CHICAGO_ZONES
  const radius = options?.radiusMeters ?? 3000
  const types = options?.types ?? SEARCH_TYPES

  const allStores: Store[] = []
  const seenIds = new Set<string>()
  const seenPhones = new Set<string>()

  // Search each zone × type combination
  // Batch in groups to avoid rate limits
  for (const zone of zones) {
    const zoneResults = await Promise.all(
      types.map((type) => searchZone(apiKey, zone.lat, zone.lng, type, radius)),
    )

    for (const places of zoneResults) {
      for (const place of places) {
        if (seenIds.has(place.id)) continue
        seenIds.add(place.id)

        const store = toStore(place)
        if (!store) continue

        // Dedupe by phone number too
        if (seenPhones.has(store.phone)) continue
        seenPhones.add(store.phone)

        allStores.push(store)
      }
    }
  }

  console.log(`[places] Found ${allStores.length} unique stores across ${zones.length} zones`)
  return allStores
}
