/**
 * Geocoding Utility
 *
 * Converts street addresses to latitude/longitude coordinates.
 * Currently uses Mapbox Geocoding API. Designed to be swappable
 * for Google Geocoding or other providers in the future.
 */

interface GeocodingResult {
  latitude: number
  longitude: number
}

/**
 * Geocode an address string into lat/lng coordinates.
 * Returns null if the address cannot be geocoded.
 */
export async function geocodeAddress(
  address: string
): Promise<GeocodingResult | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  if (!token) {
    console.warn('NEXT_PUBLIC_MAPBOX_TOKEN not set, skipping geocoding')
    return null
  }

  const encoded = encodeURIComponent(address.trim())
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${token}&limit=1`

  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.error('Geocoding request failed:', res.status)
      return null
    }

    const data = await res.json()
    const feature = data.features?.[0]
    if (!feature?.center) {
      return null
    }

    // Mapbox returns [longitude, latitude]
    const [longitude, latitude] = feature.center
    return { latitude, longitude }
  } catch (error) {
    console.error('Geocoding error:', error)
    return null
  }
}
