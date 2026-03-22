/**
 * Enrich target accounts with Google Places data (nearest location to territory).
 *
 * Usage: npx tsx apps/supplier/scripts/enrich-target-accounts.ts
 *
 * Outputs SQL INSERT statements with enriched data.
 */

const API_KEY = process.env.GOOGLE_PLACES_API_KEY || 'AIzaSyB1kmSNVCEvZFNoDWvwmvXg0XHPogpLT7o'

// Territory center: Dallas, TX
const TERRITORY_LAT = 32.7767
const TERRITORY_LNG = -96.7970

const TARGET_ACCOUNTS = [
  { name: 'Aimbridge', type: 'Hotel', contact: { name: 'Danny Caffall', role: 'Director of Beverage', email: 'Danny.Caffall@aimbridge.com' } },
  { name: 'Accor Hotels', type: 'Hotel', contact: { name: 'Shayna Kaufman', role: 'Beverage Manager', email: 'shayna.kaufman@accor.com' } },
  { name: 'Alterra Mountain Group', type: 'Resort' },
  { name: 'American Social', type: 'Restaurant' },
  { name: 'Atrium Hospitality', type: 'Hotel' },
  { name: 'Benchmark Pyramid', type: 'Hotel' },
  { name: 'Black Rock Coffee', type: 'Restaurant' },
  { name: 'Bloomin Brands Flemmings', type: 'Restaurant' },
  { name: 'BlueStone Lane', type: 'Restaurant' },
  { name: 'Cameron Mitchell Restaurants', type: 'Restaurant' },
  { name: 'Caribbean Restaurants Applebees', type: 'Restaurant' },
  { name: 'Charlestowne Hotels', type: 'Hotel' },
  { name: 'Chick-fil-A', type: 'Restaurant' },
  { name: 'Chipotle', type: 'Restaurant' },
  { name: 'ClubCorp Invited', type: 'Restaurant' },
  { name: 'Compass Group Flik', type: 'Concessions' },
  { name: 'Compass Group Levy', type: 'Concessions' },
  { name: 'Compass Group Restaurant Associates', type: 'Concessions' },
  { name: 'Delaware North', type: 'Concessions' },
  { name: 'Del Friscos Restaurant Group', type: 'Restaurant' },
  { name: 'Dine Brands', type: 'Restaurant' },
  { name: 'Dunkin', type: 'Restaurant' },
  { name: 'Einstein Bros Bagels', type: 'Restaurant' },
  { name: 'Elior North America', type: 'Concessions' },
  { name: 'Eurest', type: 'Concessions' },
  { name: 'Fogo de Chao', type: 'Restaurant' },
  { name: 'Four Seasons Hotels', type: 'Hotel' },
  { name: 'Fox Restaurant Concepts', type: 'Restaurant' },
  { name: 'Great Wolf Lodge', type: 'Hotel' },
  { name: 'Hard Rock Cafe', type: 'Restaurant' },
  { name: 'Hilton Hotels', type: 'Hotel' },
  { name: 'Hyatt Hotels', type: 'Hotel' },
  { name: 'IHG Hotels', type: 'Hotel' },
  { name: 'Jamba Juice', type: 'Restaurant' },
  { name: 'Joe & The Juice', type: 'Restaurant' },
  { name: 'Kimpton Hotels', type: 'Hotel' },
  { name: 'Krispy Kreme', type: 'Restaurant' },
  { name: 'Landrys Restaurants', type: 'Restaurant' },
  { name: 'Loews Hotels', type: 'Hotel' },
  { name: 'Marriott Hotels', type: 'Hotel' },
  { name: 'McDonalds', type: 'Restaurant' },
  { name: 'MGM Resorts', type: 'Hotel' },
  { name: 'Noble House Hotels', type: 'Hotel' },
  { name: 'Omni Hotels', type: 'Hotel' },
  { name: 'Outback Steakhouse', type: 'Restaurant' },
  { name: 'Panera Bread', type: 'Restaurant' },
  { name: 'Peets Coffee', type: 'Restaurant' },
  { name: 'PF Changs', type: 'Restaurant' },
  { name: 'Raising Canes', type: 'Restaurant' },
  { name: 'Red Lobster', type: 'Restaurant' },
  { name: 'Ritz Carlton', type: 'Hotel' },
  { name: 'Sage Hospitality', type: 'Hotel' },
  { name: 'Shake Shack', type: 'Restaurant' },
  { name: 'Sodexo', type: 'Concessions' },
  { name: 'Starbucks', type: 'Restaurant' },
  { name: 'Subway', type: 'Restaurant' },
  { name: 'Sweetgreen', type: 'Restaurant' },
  { name: 'Taco Bell', type: 'Restaurant' },
  { name: 'Texas Roadhouse', type: 'Restaurant' },
  { name: 'The Cheesecake Factory', type: 'Restaurant' },
  { name: 'The Indigo Road Hospitality Group', type: 'Restaurant' },
  { name: 'The Palm Restaurant', type: 'Restaurant' },
  { name: 'The Ritz-Carlton Yacht Collection', type: 'Hotel' },
  { name: 'Troon Golf', type: 'Concessions' },
  { name: 'United Clubs Lounges', type: 'Concessions' },
  { name: 'Vail Resorts', type: 'Resort', contact: { name: 'Chelsie Miller Zoller', role: 'Senior Manager of Beverage' } },
  { name: 'W Hotel', type: 'Hotel' },
]

type PlaceResult = {
  displayName?: { text: string }
  formattedAddress?: string
  location?: { latitude: number; longitude: number }
  nationalPhoneNumber?: string
  websiteUri?: string
}

async function searchPlace(query: string): Promise<PlaceResult | null> {
  const url = 'https://places.googleapis.com/v1/places:searchText'
  const body = {
    textQuery: query,
    locationBias: {
      circle: {
        center: { latitude: TERRITORY_LAT, longitude: TERRITORY_LNG },
        radius: 50000, // 50km radius (API max)
      },
    },
    maxResultCount: 1,
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.nationalPhoneNumber,places.websiteUri',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    console.error(`Failed to search for "${query}": ${res.status}`)
    return null
  }

  const data = await res.json()
  return data.places?.[0] || null
}

function escapeSql(str: string): string {
  return str.replace(/'/g, "''")
}

async function main() {
  const results: Array<{
    name: string
    type: string
    address: string | null
    lat: number | null
    lng: number | null
    phone: string | null
    website: string | null
    contact?: { name: string; role: string; email?: string }
  }> = []

  console.error('Enriching target accounts via Google Places...\n')

  for (const account of TARGET_ACCOUNTS) {
    // Add a small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 200))

    const place = await searchPlace(account.name)

    if (place) {
      console.error(`✓ ${account.name} → ${place.formattedAddress || 'no address'}`)
      results.push({
        name: account.name,
        type: account.type,
        address: place.formattedAddress || null,
        lat: place.location?.latitude || null,
        lng: place.location?.longitude || null,
        phone: place.nationalPhoneNumber || null,
        website: place.websiteUri || null,
        contact: (account as Record<string, unknown>).contact as typeof results[0]['contact'],
      })
    } else {
      console.error(`✗ ${account.name} — not found`)
      results.push({
        name: account.name,
        type: account.type,
        address: null,
        lat: null,
        lng: null,
        phone: null,
        website: null,
        contact: (account as Record<string, unknown>).contact as typeof results[0]['contact'],
      })
    }
  }

  // Generate SQL
  console.log('-- ============================================================================')
  console.log('-- Target Accounts: National chains enriched via Google Places (nearest to Cumming, GA)')
  console.log('-- Run in Supabase SQL Editor')
  console.log('-- ============================================================================')
  console.log('')
  console.log('DO $$')
  console.log('DECLARE')
  console.log('  org UUID;')
  console.log('  uid UUID;')
  console.log('  acc_id UUID;')
  console.log('BEGIN')
  console.log('  SELECT id INTO org FROM organizations LIMIT 1;')
  console.log('  SELECT id INTO uid FROM supplier_profiles WHERE organization_id = org LIMIT 1;')
  console.log('')
  console.log('  IF org IS NULL OR uid IS NULL THEN')
  console.log('    RAISE EXCEPTION \'No organization or user found.\';')
  console.log('  END IF;')
  console.log('')

  for (const r of results) {
    const lat = r.lat !== null ? r.lat.toFixed(4) : 'NULL'
    const lng = r.lng !== null ? r.lng.toFixed(4) : 'NULL'
    const addr = r.address ? `'${escapeSql(r.address)}'` : 'NULL'
    const phone = r.phone ? `'${escapeSql(r.phone)}'` : 'NULL'
    const website = r.website ? `'${escapeSql(r.website)}'` : 'NULL'

    console.log(`  INSERT INTO accounts (organization_id, user_id, name, address, industry, premise_type, latitude, longitude, phone, website)`)
    console.log(`  VALUES (org, uid, '${escapeSql(r.name)}', ${addr}, '${escapeSql(r.type)}', 'on_premise', ${lat}, ${lng}, ${phone}, ${website})`)

    if (r.contact) {
      console.log(`  RETURNING id INTO acc_id;`)
      const cName = `'${escapeSql(r.contact.name)}'`
      const cRole = `'${escapeSql(r.contact.role)}'`
      const cEmail = r.contact.email ? `'${escapeSql(r.contact.email)}'` : 'NULL'
      console.log(`  INSERT INTO account_contacts (organization_id, account_id, name, role, email) VALUES (org, acc_id, ${cName}, ${cRole}, ${cEmail});`)
    } else {
      console.log(`  ;`)
    }
    console.log('')
  }

  console.log('  RAISE NOTICE \'Inserted %s target accounts\', ' + results.length + ';')
  console.log('END $$;')

  console.error(`\nDone! ${results.length} accounts processed.`)
}

main().catch(console.error)
