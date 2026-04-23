/**
 * TinilandiaSales Seed Script — Cumming GA Area
 *
 * Seeds 15 accounts, 7 days of visit routes, tasks, contacts, and sample captures.
 *
 * Usage:
 *   npx tsx apps/supplier/scripts/seed-tinilandia.ts
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname2 = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname2, '../.env.local')
try {
  const envFile = readFileSync(envPath, 'utf-8')
  for (const line of envFile.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex).trim()
    const value = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
} catch {
  console.warn('Could not read .env.local at', envPath)
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ORG_ID = 'f7fdf374-a14a-493a-8bdb-d91c44186caf'
const USER_ID = 'e3a22083-455a-4edc-b8fe-904f8245b899'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// --- 15 Cumming GA Area Accounts ---
const ACCOUNTS = [
  { name: "Tam's Backstage", address: "490 Peachtree Pkwy, Cumming, GA 30041", industry: "Bar", premise_type: "on_premise", lat: 34.2070, lng: -84.1280, distributor: "Republic National" },
  { name: "Coal Mountain Grill", address: "3500 Coal Mountain Dr, Cumming, GA 30028", industry: "Restaurant", premise_type: "on_premise", lat: 34.2495, lng: -84.1350, distributor: "Breakthru Beverage" },
  { name: "Crust Pizza Bar", address: "410 Peachtree Pkwy Ste 100, Cumming, GA 30041", industry: "Restaurant", premise_type: "on_premise", lat: 34.2065, lng: -84.1275, distributor: "Republic National" },
  { name: "Monkey Joe's Sports Bar", address: "6025 Lake Lanier Islands Pkwy, Buford, GA 30518", industry: "Bar", premise_type: "on_premise", lat: 34.1685, lng: -83.9980, distributor: "Breakthru Beverage" },
  { name: "Frog Rock Brewing Co", address: "550 Tribble Gap Rd, Cumming, GA 30040", industry: "Brewery", premise_type: "on_premise", lat: 34.2105, lng: -84.1395, distributor: "Self-distributed" },
  { name: "The Twisted Tavern", address: "302 E Main St, Cumming, GA 30040", industry: "Bar", premise_type: "on_premise", lat: 34.2072, lng: -84.1360, distributor: "Republic National" },
  { name: "Total Wine & More — Cumming", address: "2155 Market Place Blvd, Cumming, GA 30041", industry: "Liquor Store", premise_type: "off_premise", lat: 34.1890, lng: -84.1310, distributor: "Breakthru Beverage" },
  { name: "Package Store 400", address: "1460 Atlanta Hwy, Cumming, GA 30040", industry: "Liquor Store", premise_type: "off_premise", lat: 34.2250, lng: -84.1480, distributor: "Republic National" },
  { name: "Kona Ice of Forsyth County", address: "Forsyth County Farmers Market, Cumming, GA 30040", industry: "Convenience Store", premise_type: "off_premise", lat: 34.2068, lng: -84.1380, distributor: "Republic National" },
  { name: "Marlow's Tavern — The Collection", address: "410 Peachtree Pkwy Ste 318, Cumming, GA 30041", industry: "Restaurant", premise_type: "on_premise", lat: 34.2060, lng: -84.1270, distributor: "Breakthru Beverage" },
  { name: "Taqueria Tsunami — Cumming", address: "545 Atlanta Hwy, Cumming, GA 30040", industry: "Restaurant", premise_type: "on_premise", lat: 34.2150, lng: -84.1440, distributor: "Republic National" },
  { name: "Crave Pie Studio", address: "437 Atlanta Hwy Ste 185, Cumming, GA 30040", industry: "Restaurant", premise_type: "on_premise", lat: 34.2120, lng: -84.1420, distributor: "Breakthru Beverage" },
  { name: "Hampton Inn Lake Lanier", address: "2755 Buford Dam Rd, Buford, GA 30518", industry: "Hotel", premise_type: "on_premise", lat: 34.1600, lng: -84.0680, distributor: "Breakthru Beverage" },
  { name: "QT — GA 400 & Bald Ridge", address: "2040 Bald Ridge Marina Rd, Cumming, GA 30041", industry: "Convenience Store", premise_type: "off_premise", lat: 34.1920, lng: -84.1050, distributor: "Republic National" },
  { name: "Vinny's Italian Kitchen", address: "2470 Bethelview Rd, Cumming, GA 30040", industry: "Restaurant", premise_type: "on_premise", lat: 34.2340, lng: -84.1510, distributor: "Breakthru Beverage" },
]

// --- Tasks ---
function generateTasks(accountIds: Record<string, string>) {
  const today = new Date()
  const taskDate = (d: number) => {
    const dt = new Date(today); dt.setDate(dt.getDate() + d)
    return dt.toISOString().split('T')[0]
  }
  return [
    { account_key: "Tam's Backstage", task: "Check on draft line placement for new seasonal lager", due_date: taskDate(0), priority: "high" },
    { account_key: "Total Wine & More — Cumming", task: "Submit shelf reset planogram for summer displays", due_date: taskDate(1), priority: "high" },
    { account_key: "Coal Mountain Grill", task: "Follow up with manager on craft cocktail menu addition", due_date: taskDate(1), priority: "medium" },
    { account_key: "Frog Rock Brewing Co", task: "Discuss co-branded tap takeover event for June", due_date: taskDate(2), priority: "medium" },
    { account_key: "Marlow's Tavern — The Collection", task: "Bring wine samples for summer menu tasting", due_date: taskDate(3), priority: "medium" },
    { account_key: "The Twisted Tavern", task: "Audit shelf compliance — check competitor facings", due_date: taskDate(3), priority: "high" },
    { account_key: "Vinny's Italian Kitchen", task: "Drop off updated wine list for Italian pairing menu", due_date: taskDate(4), priority: "low" },
    { account_key: "Package Store 400", task: "Negotiate end-cap display for holiday weekend", due_date: taskDate(5), priority: "medium" },
    { account_key: "Hampton Inn Lake Lanier", task: "Meet with F&B manager about pool bar spirit package", due_date: taskDate(6), priority: "medium" },
    { account_key: "Taqueria Tsunami — Cumming", task: "Check if margarita mix reorder went through", due_date: taskDate(2), priority: "low" },
    { account_key: "Crust Pizza Bar", task: "Confirm keg delivery schedule for next week", due_date: taskDate(-1), priority: "high" },
    { account_key: "Monkey Joe's Sports Bar", task: "Restock promotional coasters and table tents", due_date: taskDate(-2), priority: "medium" },
  ]
}

// --- Visits: 7 days of routes ---
function generateVisits(accountIds: Record<string, string>) {
  const today = new Date()
  const visitDate = (daysFromToday: number, hour = 10) => {
    const d = new Date(today)
    d.setDate(d.getDate() + daysFromToday)
    d.setHours(hour, 0, 0, 0)
    return d.toISOString()
  }

  return [
    // Day 1 (today)
    { account_key: "Tam's Backstage", visit_date: visitDate(0, 9), notes: "Check draft lines, discuss seasonal lager placement" },
    { account_key: "Crust Pizza Bar", visit_date: visitDate(0, 11), notes: "Confirm keg delivery, review menu placement" },
    { account_key: "Total Wine & More — Cumming", visit_date: visitDate(0, 14), notes: "Summer shelf reset walkthrough with store manager" },

    // Day 2
    { account_key: "Coal Mountain Grill", visit_date: visitDate(1, 9), notes: "Craft cocktail menu discussion with GM" },
    { account_key: "The Twisted Tavern", visit_date: visitDate(1, 11), notes: "Shelf compliance audit" },
    { account_key: "Package Store 400", visit_date: visitDate(1, 14), notes: "End-cap negotiation for holiday weekend" },

    // Day 3
    { account_key: "Frog Rock Brewing Co", visit_date: visitDate(2, 10), notes: "Tap takeover planning for June" },
    { account_key: "Taqueria Tsunami — Cumming", visit_date: visitDate(2, 12), notes: "Margarita mix reorder check" },
    { account_key: "Marlow's Tavern — The Collection", visit_date: visitDate(2, 14), notes: "Wine tasting for summer menu" },

    // Day 4
    { account_key: "Monkey Joe's Sports Bar", visit_date: visitDate(3, 9), notes: "Restock promo materials, check on sales velocity" },
    { account_key: "Vinny's Italian Kitchen", visit_date: visitDate(3, 11), notes: "Wine list drop-off for pairing menu" },
    { account_key: "Crave Pie Studio", visit_date: visitDate(3, 13), notes: "Intro meeting — explore dessert wine pairing opportunity" },

    // Day 5
    { account_key: "Hampton Inn Lake Lanier", visit_date: visitDate(4, 10), notes: "Pool bar spirit package meeting with F&B manager" },
    { account_key: "QT — GA 400 & Bald Ridge", visit_date: visitDate(4, 12), notes: "Cooler audit and RTD placement check" },
    { account_key: "Kona Ice of Forsyth County", visit_date: visitDate(4, 14), notes: "Discuss event partnership for summer festivals" },

    // Day 6
    { account_key: "Tam's Backstage", visit_date: visitDate(5, 10), notes: "Follow-up on seasonal lager feedback" },
    { account_key: "Total Wine & More — Cumming", visit_date: visitDate(5, 13), notes: "Verify shelf reset completed correctly" },
    { account_key: "The Twisted Tavern", visit_date: visitDate(5, 15), notes: "Check shelf compliance corrections from earlier visit" },

    // Day 7
    { account_key: "Coal Mountain Grill", visit_date: visitDate(6, 9), notes: "Deliver cocktail menu proofs" },
    { account_key: "Frog Rock Brewing Co", visit_date: visitDate(6, 11), notes: "Finalize tap takeover event details" },
    { account_key: "Package Store 400", visit_date: visitDate(6, 14), notes: "Set up holiday weekend end-cap display" },
  ]
}

// --- Contacts ---
function generateContacts(accountIds: Record<string, string>) {
  return [
    { account_key: "Tam's Backstage", name: "Brian Calloway", role: "Owner", phone: "(770) 555-0101", email: "brian@tamsbackstage.com" },
    { account_key: "Coal Mountain Grill", name: "Patricia Vance", role: "General Manager", phone: "(770) 555-0102", email: "patricia@coalmountaingrill.com" },
    { account_key: "Crust Pizza Bar", name: "Derek Simmons", role: "Bar Manager", phone: "(770) 555-0103", email: "derek@crustpizzabar.com" },
    { account_key: "Total Wine & More — Cumming", name: "Karen Lee", role: "Store Manager", phone: "(770) 555-0104", email: "k.lee@totalwine.com" },
    { account_key: "Frog Rock Brewing Co", name: "Matt Henderson", role: "Head Brewer", phone: "(770) 555-0105", email: "matt@frogrockbrewing.com" },
    { account_key: "The Twisted Tavern", name: "Alicia Moreno", role: "Owner", phone: "(770) 555-0106", email: "alicia@twistedtavern.com" },
    { account_key: "Package Store 400", name: "Raj Patel", role: "Owner", phone: "(770) 555-0107", email: "raj@packagestore400.com" },
    { account_key: "Marlow's Tavern — The Collection", name: "Steve Nakamura", role: "Beverage Director", phone: "(770) 555-0108", email: "steve@marlowstavern.com" },
    { account_key: "Vinny's Italian Kitchen", name: "Vinny DeLuca", role: "Owner/Chef", phone: "(770) 555-0109", email: "vinny@vinnyskitchen.com" },
    { account_key: "Hampton Inn Lake Lanier", name: "Julie Frampton", role: "F&B Manager", phone: "(770) 555-0110", email: "j.frampton@hilton.com" },
    { account_key: "Monkey Joe's Sports Bar", name: "Tony Willis", role: "Bar Manager", phone: "(770) 555-0111", email: "tony@monkeyjoes.com" },
    { account_key: "Taqueria Tsunami — Cumming", name: "Carlos Reyes", role: "Manager", phone: "(770) 555-0112", email: "carlos@taqueriatsunamicumming.com" },
  ]
}

// --- Sample Captures ---
const CAPTURES = [
  {
    account_key: "Tam's Backstage",
    summary: "Checked draft lines with Brian. Seasonal lager tap handle in good position but competitor IPA moved closer to the bar entrance. Agreed to revisit placement next week.",
    transcript: "Rep: Hey Brian, how's the new seasonal lager doing?\nBrian: Selling well actually. But I noticed that Sweetwater IPA got moved right near the entrance.\nRep: Yeah I see that. Let me talk to my team about getting a better tap position.\nBrian: That'd be great. The regulars are asking for it by name now.",
  },
  {
    account_key: "Total Wine & More — Cumming",
    summary: "Met with Karen about summer shelf reset. She wants more end-cap space for seltzers and RTDs. Agreed to submit planogram by end of week.",
    transcript: "Rep: Karen, thanks for making time.\nKaren: Of course. So summer is coming and I need to rethink the seltzer section.\nRep: What are you seeing in terms of velocity?\nKaren: RTDs are up 20% year over year. I want a full end-cap dedicated to it.\nRep: I can put together a planogram. When do you need it?\nKaren: Friday at the latest. We reset shelves Monday.",
  },
  {
    account_key: "Coal Mountain Grill",
    summary: "Patricia is interested in adding craft cocktails to the dinner menu. Wants to feature local spirits. Good opportunity to place our portfolio.",
    transcript: "Rep: Patricia, I heard you're looking at the cocktail menu?\nPatricia: Yes! We want to go more upscale for dinner service. Local spirits are a big draw right now.\nRep: I've got some great options. Can I bring samples next week?\nPatricia: Absolutely. Tuesday works best for me.",
  },
]

// --- Notes ---
function generateNotes(accountIds: Record<string, string>) {
  return [
    { account_key: "Tam's Backstage", content: "Brian is the key decision maker. Likes craft lagers and seasonal rotations. Best time to visit is before 11am on weekdays." },
    { account_key: "Total Wine & More — Cumming", content: "Karen is data-driven. Always bring sell-through numbers. Store resets happen on Mondays." },
    { account_key: "Coal Mountain Grill", content: "Patricia values local partnerships. Restaurant is busiest on weekends — visit on Tuesday or Wednesday." },
    { account_key: "Frog Rock Brewing Co", content: "Matt is open to collabs but protective of tap space. Build relationship first before pitching hard." },
    { account_key: "The Twisted Tavern", content: "Alicia runs a tight ship. Shelf compliance is important to her — always check facings when visiting." },
    { account_key: "Marlow's Tavern — The Collection", content: "Steve handles all beverage decisions for the Cumming location. Wine-focused but open to spirits." },
  ]
}

// --- Main ---
async function seed() {
  console.log('Seeding TinilandiaSales — Cumming GA area...\n')

  // Clean existing data for this org
  console.log('Cleaning existing data...')
  const tables = ['account_notes', 'account_contacts', 'account_photos', 'insights', 'tasks', 'captures', 'visits', 'discovered_accounts', 'accounts']
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq('organization_id', ORG_ID)
    if (error) console.warn(`  Warning: could not clean ${table}:`, error.message)
  }
  console.log('  Cleaned all tables\n')

  // 1. Accounts
  console.log('Seeding accounts...')
  const accountRows = ACCOUNTS.map((a) => ({
    organization_id: ORG_ID,
    user_id: USER_ID,
    name: a.name,
    address: a.address,
    industry: a.industry,
    premise_type: a.premise_type,
    latitude: a.lat,
    longitude: a.lng,
    distributor_name: a.distributor,
  }))

  const { data: insertedAccounts, error: accountError } = await supabase
    .from('accounts')
    .insert(accountRows)
    .select('id, name')

  if (accountError) { console.error('Account insert error:', accountError); return }

  const accountIds: Record<string, string> = {}
  for (const a of insertedAccounts || []) accountIds[a.name] = a.id
  console.log(`  ${Object.keys(accountIds).length} accounts seeded`)

  // 2. Tasks
  console.log('Seeding tasks...')
  const tasks = generateTasks(accountIds)
  const taskRows = tasks.filter((t) => accountIds[t.account_key]).map((t) => ({
    organization_id: ORG_ID,
    user_id: USER_ID,
    account_id: accountIds[t.account_key],
    account_name: t.account_key,
    task: t.task,
    due_date: t.due_date,
    priority: t.priority,
    completed: false,
  }))

  const { error: taskError } = await supabase.from('tasks').insert(taskRows)
  if (taskError) console.error('Tasks error:', taskError)
  else console.log(`  ${taskRows.length} tasks seeded`)

  // 3. Visits (7 days)
  console.log('Seeding visits (7-day route)...')
  const visits = generateVisits(accountIds)
  const visitRows = visits.filter((v) => accountIds[v.account_key]).map((v) => ({
    organization_id: ORG_ID,
    user_id: USER_ID,
    account_id: accountIds[v.account_key],
    account_name: v.account_key,
    visit_date: v.visit_date,
    notes: v.notes,
  }))

  const { error: visitError } = await supabase.from('visits').insert(visitRows)
  if (visitError) console.error('Visits error:', visitError)
  else console.log(`  ${visitRows.length} visits seeded across 7 days`)

  // 4. Captures
  console.log('Seeding captures...')
  const captureRows = CAPTURES.filter((c) => accountIds[c.account_key]).map((c) => ({
    organization_id: ORG_ID,
    user_id: USER_ID,
    account_id: accountIds[c.account_key],
    account_name: c.account_key,
    summary: c.summary,
    transcript: c.transcript,
  }))

  const { error: captureError } = await supabase.from('captures').insert(captureRows)
  if (captureError) console.error('Captures error:', captureError)
  else console.log(`  ${captureRows.length} captures seeded`)

  // 5. Contacts
  console.log('Seeding contacts...')
  const contacts = generateContacts(accountIds)
  const contactRows = contacts.filter((c) => accountIds[c.account_key]).map((c) => ({
    organization_id: ORG_ID,
    account_id: accountIds[c.account_key],
    name: c.name,
    role: c.role,
    phone: c.phone,
    email: c.email,
  }))

  const { error: contactError } = await supabase.from('account_contacts').insert(contactRows)
  if (contactError) console.error('Contacts error:', contactError)
  else console.log(`  ${contactRows.length} contacts seeded`)

  // 6. Notes
  console.log('Seeding notes...')
  const notes = generateNotes(accountIds)
  const noteRows = notes.filter((n) => accountIds[n.account_key]).map((n) => ({
    organization_id: ORG_ID,
    account_id: accountIds[n.account_key],
    user_id: USER_ID,
    content: n.content,
  }))

  const { error: noteError } = await supabase.from('account_notes').insert(noteRows)
  if (noteError) console.error('Notes error:', noteError)
  else console.log(`  ${noteRows.length} notes seeded`)

  // --- Verify persistence ---
  console.log('\n--- Verifying persistence ---')
  const checks = [
    { table: 'accounts', label: 'Accounts' },
    { table: 'tasks', label: 'Tasks' },
    { table: 'visits', label: 'Visits' },
    { table: 'captures', label: 'Captures' },
    { table: 'account_contacts', label: 'Contacts' },
    { table: 'account_notes', label: 'Notes' },
  ]
  for (const { table, label } of checks) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', ORG_ID)
    if (error) {
      console.error(`  ${label}: FAILED to verify — ${error.message}`)
    } else {
      console.log(`  ${label}: ${count} rows confirmed in DB`)
    }
  }

  console.log('\nSeed complete!')
}

seed().catch(console.error)
