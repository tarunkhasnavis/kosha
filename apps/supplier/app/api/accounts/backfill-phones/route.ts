import { NextResponse } from 'next/server'
import { createClient } from '@kosha/supabase/server'
import { getUser } from '@kosha/supabase'
import { getOrganizationId } from '@/lib/auth'

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY

/**
 * POST /api/accounts/backfill-phones
 *
 * Backfills phone numbers for accounts that don't have one
 * by looking them up via Google Places API using name + coordinates.
 */
export async function POST() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const orgId = await getOrganizationId()
  if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  if (!GOOGLE_PLACES_API_KEY) {
    return NextResponse.json({ error: 'Google Places API key not configured' }, { status: 503 })
  }

  const supabase = await createClient()

  // Fetch accounts without phone numbers
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('id, name, address, latitude, longitude')
    .eq('organization_id', orgId)
    .is('phone', null)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 })
  }

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ message: 'All accounts already have phone numbers', updated: 0 })
  }

  let updated = 0
  const results: { name: string; phone: string | null; status: string }[] = []

  for (const account of accounts) {
    try {
      const lat = account.latitude || 27.9506
      const lng = account.longitude || -82.4572

      const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask': 'places.displayName,places.nationalPhoneNumber,places.websiteUri,places.formattedAddress',
        },
        body: JSON.stringify({
          textQuery: account.name,
          locationBias: {
            circle: {
              center: { latitude: lat, longitude: lng },
              radius: 5000,
            },
          },
          maxResultCount: 1,
        }),
      })

      if (!response.ok) {
        results.push({ name: account.name, phone: null, status: 'api_error' })
        continue
      }

      const data = await response.json()
      const place = data.places?.[0]

      if (!place?.nationalPhoneNumber) {
        results.push({ name: account.name, phone: null, status: 'no_phone_found' })
        continue
      }

      const updateData: { phone: string; website?: string } = {
        phone: place.nationalPhoneNumber,
      }

      // Also backfill website if missing
      if (place.websiteUri) {
        const { data: current } = await supabase
          .from('accounts')
          .select('website')
          .eq('id', account.id)
          .single()
        if (!current?.website) {
          updateData.website = place.websiteUri
        }
      }

      const { error: updateError } = await supabase
        .from('accounts')
        .update(updateData)
        .eq('id', account.id)

      if (updateError) {
        results.push({ name: account.name, phone: place.nationalPhoneNumber, status: 'update_failed' })
      } else {
        updated++
        results.push({ name: account.name, phone: place.nationalPhoneNumber, status: 'updated' })
      }

      // Small delay to avoid rate limiting
      await new Promise((r) => setTimeout(r, 200))
    } catch {
      results.push({ name: account.name, phone: null, status: 'error' })
    }
  }

  return NextResponse.json({
    message: `Updated ${updated} of ${accounts.length} accounts`,
    updated,
    total: accounts.length,
    results,
  })
}
