import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@kosha/supabase/service'
import { getUser } from '@kosha/supabase'
import { getOrganizationId } from '@/lib/auth'
import { geocodeAddress } from '@/lib/geocoding'

const FIRST_NAMES = [
  'James', 'Maria', 'David', 'Sarah', 'Michael', 'Jessica', 'Robert', 'Ashley',
  'Carlos', 'Emily', 'Daniel', 'Lisa', 'Anthony', 'Nicole', 'Marcus', 'Rachel',
  'Kevin', 'Angela', 'Brian', 'Megan', 'Jason', 'Lauren', 'Chris', 'Stephanie',
]

const LAST_NAMES = [
  'Johnson', 'Rodriguez', 'Williams', 'Chen', 'Smith', 'Martinez', 'Brown', 'Davis',
  'Garcia', 'Miller', 'Wilson', 'Anderson', 'Taylor', 'Thomas', 'Jackson', 'White',
  'Harris', 'Martin', 'Thompson', 'Robinson', 'Clark', 'Lewis', 'Lee', 'Walker',
]

const ROLES = [
  'Owner', 'Manager', 'General Manager', 'Bar Manager', 'Head Bartender',
  'Beverage Director', 'Purchasing Manager', 'Assistant Manager',
  'Floor Manager', 'Operations Manager',
]

function randomPhone(): string {
  const area = 200 + Math.floor(Math.random() * 800)
  const mid = 200 + Math.floor(Math.random() * 800)
  const end = 1000 + Math.floor(Math.random() * 9000)
  return `(${area}) ${mid}-${end}`
}

function randomEmail(first: string, last: string): string | null {
  // ~70% chance of having email
  if (Math.random() > 0.7) return null
  const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'icloud.com']
  const domain = domains[Math.floor(Math.random() * domains.length)]
  return `${first.toLowerCase()}.${last.toLowerCase()}@${domain}`
}

/**
 * POST /api/seed-visits
 *
 * Seeds scheduled visits across all accounts for the next 1.5 weeks (~11 days)
 * and 1-2 contacts per account.
 */
export async function POST() {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const orgId = await getOrganizationId()
  if (!orgId) {
    return NextResponse.json({ error: 'No organization found' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Get all accounts
  const { data: allAccountsRaw, error: accountsError } = await supabase
    .from('accounts')
    .select('id, name, address, latitude, longitude')
    .eq('organization_id', orgId)

  if (accountsError || !allAccountsRaw || allAccountsRaw.length === 0) {
    return NextResponse.json(
      { error: 'No accounts found' },
      { status: 400 }
    )
  }

  // Geocode any accounts missing coordinates
  let geocoded = 0
  for (const acct of allAccountsRaw) {
    if (acct.latitude == null && acct.longitude == null && acct.address) {
      const coords = await geocodeAddress(acct.address)
      if (coords) {
        await supabase
          .from('accounts')
          .update({ latitude: coords.latitude, longitude: coords.longitude })
          .eq('id', acct.id)
        acct.latitude = coords.latitude
        acct.longitude = coords.longitude
        geocoded++
      }
    }
  }

  const accounts = allAccountsRaw.filter(
    (a) => a.latitude != null && a.longitude != null
  )

  // --- Seed Visits ---

  // Delete all existing visits to avoid duplicates
  await supabase
    .from('visits')
    .delete()
    .eq('organization_id', orgId)
    .neq('id', '00000000-0000-0000-0000-000000000000') // force non-empty filter for supabase

  const PAST_DAYS = 14
  const FUTURE_DAYS = 11
  const MIN_VISITS_PER_DAY = 3
  const MAX_VISITS_PER_DAY = 6

  const visits: {
    user_id: string
    organization_id: string
    account_id: string
    account_name: string
    visit_date: string
    notes: string | null
  }[] = []

  const shuffled = [...accounts].sort(() => Math.random() - 0.5)
  let accountIndex = 0

  const visitNotes = [
    'Quarterly check-in',
    'Product demo and tasting',
    'Follow up on last order',
    'New product introduction',
    'Account review meeting',
    'Seasonal menu planning',
    'Inventory check',
    'Pricing discussion',
    'Promotional setup',
    'Relationship building visit',
    null,
    null,
  ]

  for (let dayOffset = -PAST_DAYS; dayOffset < FUTURE_DAYS; dayOffset++) {
    const visitDate = new Date()
    visitDate.setDate(visitDate.getDate() + dayOffset)

    const dayOfWeek = visitDate.getDay()
    if (dayOfWeek === 0 || dayOfWeek === 6) continue

    const visitsForDay =
      MIN_VISITS_PER_DAY +
      Math.floor(Math.random() * (MAX_VISITS_PER_DAY - MIN_VISITS_PER_DAY + 1))

    for (let i = 0; i < visitsForDay; i++) {
      const account = shuffled[accountIndex % shuffled.length]
      accountIndex++

      const hour = 9 + Math.floor((i / visitsForDay) * 7)
      const minute = Math.floor(Math.random() * 60)
      visitDate.setHours(hour, minute, 0, 0)

      visits.push({
        user_id: user.id,
        organization_id: orgId,
        account_id: account.id,
        account_name: account.name,
        visit_date: visitDate.toISOString(),
        notes: visitNotes[Math.floor(Math.random() * visitNotes.length)],
      })
    }
  }

  const { error: insertError } = await supabase.from('visits').insert(visits)

  if (insertError) {
    console.error('Failed to seed visits:', insertError)
    return NextResponse.json({ error: 'Failed to seed visits' }, { status: 500 })
  }

  // --- Seed Contacts ---

  const accountsForContacts = allAccountsRaw

  // Delete existing contacts to avoid duplicates
  for (const acct of accountsForContacts) {
    await supabase
      .from('account_contacts')
      .delete()
      .eq('account_id', acct.id)
  }

  const contacts: {
    organization_id: string
    account_id: string
    name: string
    role: string
    phone: string | null
    email: string | null
  }[] = []

  for (const account of accountsForContacts) {
    // 1-2 contacts per account
    const contactCount = 1 + Math.floor(Math.random() * 2)
    const usedNames = new Set<string>()

    for (let i = 0; i < contactCount; i++) {
      let first: string, last: string, fullName: string
      do {
        first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]
        last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]
        fullName = `${first} ${last}`
      } while (usedNames.has(fullName))
      usedNames.add(fullName)

      const role = i === 0
        ? ROLES[Math.floor(Math.random() * 3)] // Owner/Manager/GM for primary
        : ROLES[3 + Math.floor(Math.random() * (ROLES.length - 3))]

      contacts.push({
        organization_id: orgId,
        account_id: account.id,
        name: fullName,
        role,
        phone: Math.random() > 0.15 ? randomPhone() : null, // 85% have phone
        email: randomEmail(first, last),
      })
    }
  }

  // Insert in smaller batches to avoid payload limits
  let contactsInserted = 0
  const BATCH_SIZE = 50
  for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
    const batch = contacts.slice(i, i + BATCH_SIZE)
    const { error: contactsError } = await supabase.from('account_contacts').insert(batch)
    if (contactsError) {
      console.error('Failed to seed contacts batch:', contactsError)
      return NextResponse.json({
        error: `Contacts failed at batch ${i}: ${contactsError.message}`,
        details: contactsError,
        visitCount: visits.length,
        contactsInsertedSoFar: contactsInserted,
        totalContactsAttempted: contacts.length,
        sampleContact: contacts[0],
      }, { status: 500 })
    }
    contactsInserted += batch.length
  }

  // Revalidate cached pages
  revalidatePath('/accounts', 'layout')
  revalidatePath('/territory')
  revalidatePath('/visits')
  revalidatePath('/next-steps')

  return NextResponse.json({
    success: true,
    visitCount: visits.length,
    contactCount: contacts.length,
    totalAccounts: accountsForContacts.length,
    pastDays: PAST_DAYS,
    futureDays: FUTURE_DAYS,
    geocodedAccounts: geocoded,
    message: `Seeded ${visits.length} visits, ${contacts.length} contacts across ${accountsForContacts.length} accounts (geocoded ${geocoded} accounts)`,
  })
}
