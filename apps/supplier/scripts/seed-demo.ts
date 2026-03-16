/**
 * Demo Seed Script
 *
 * Seeds the database with realistic Tampa FL area demo data.
 *
 * Usage:
 *   ORG_ID=<your-org-id> USER_ID=<your-user-id> npx tsx apps/supplier/scripts/seed-demo.ts
 *
 * Requires:
 *   - NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// Load .env.local manually (no dotenv dependency needed)
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ORG_ID = process.env.ORG_ID
const USER_ID = process.env.USER_ID

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

if (!ORG_ID || !USER_ID) {
  console.error('Missing ORG_ID or USER_ID environment variables')
  console.error('Usage: ORG_ID=xxx USER_ID=yyy npx tsx apps/supplier/scripts/seed-demo.ts')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// --- Tampa FL Area Managed Accounts ---
const ACCOUNTS = [
  { name: "Salty Shamrock Irish Pub", address: "6186 N US Hwy 41, Apollo Beach, FL 33572", industry: "Bar", premise_type: "on_premise", lat: 27.7718, lng: -82.3945 },
  { name: "Mango Jo's Bar and Liquors", address: "2500 N Westshore Blvd, Tampa, FL 33607", industry: "Bar", premise_type: "on_premise", lat: 27.9575, lng: -82.5232 },
  { name: "Apollo Beach Society Wine Bar", address: "138 Harbor Village Ln, Apollo Beach, FL 33572", industry: "Bar", premise_type: "on_premise", lat: 27.7695, lng: -82.3962 },
  { name: "Beef 'O' Brady's", address: "5765 US 41, Apollo Beach, FL 33572", industry: "Restaurant", premise_type: "on_premise", lat: 27.7752, lng: -82.3942 },
  { name: "Circles Waterfront Restaurant", address: "5102 Interbay Blvd, Tampa, FL 33611", industry: "Restaurant", premise_type: "on_premise", lat: 27.8863, lng: -82.4985 },
  { name: "Hattricks Tavern", address: "107 S Franklin St, Tampa, FL 33602", industry: "Bar", premise_type: "on_premise", lat: 27.9466, lng: -82.4579 },
  { name: "The Bricks of Ybor", address: "1327 E 7th Ave, Tampa, FL 33605", industry: "Bar", premise_type: "on_premise", lat: 27.9604, lng: -82.4389 },
  { name: "Coppertail Brewing Co", address: "2601 E 2nd Ave, Tampa, FL 33605", industry: "Brewery", premise_type: "on_premise", lat: 27.9557, lng: -82.4350 },
  { name: "Cigar City Brewing", address: "3924 W Spruce St, Tampa, FL 33607", industry: "Brewery", premise_type: "on_premise", lat: 27.9535, lng: -82.5110 },
  { name: "Total Wine & More", address: "1501 N Dale Mabry Hwy, Tampa, FL 33607", industry: "Liquor Store", premise_type: "off_premise", lat: 27.9525, lng: -82.5044 },
  { name: "ABC Fine Wine & Spirits", address: "8340 N Dale Mabry Hwy, Tampa, FL 33614", industry: "Liquor Store", premise_type: "off_premise", lat: 28.0230, lng: -82.5040 },
  { name: "Bern's Steak House", address: "1208 S Howard Ave, Tampa, FL 33606", industry: "Restaurant", premise_type: "on_premise", lat: 27.9347, lng: -82.4823 },
  { name: "Columbia Restaurant", address: "2117 E 7th Ave, Tampa, FL 33605", industry: "Restaurant", premise_type: "on_premise", lat: 27.9601, lng: -82.4331 },
  { name: "Ulele", address: "1810 N Highland Ave, Tampa, FL 33602", industry: "Restaurant", premise_type: "on_premise", lat: 27.9565, lng: -82.4577 },
  { name: "Wawa - Riverview", address: "10655 Bloomingdale Ave, Riverview, FL 33578", industry: "Convenience Store", premise_type: "off_premise", lat: 27.8585, lng: -82.3285 },
  { name: "The Grand Hyatt Tampa Bay", address: "2900 Bayport Dr, Tampa, FL 33607", industry: "Hotel", premise_type: "on_premise", lat: 27.9170, lng: -82.5425 },
  { name: "Epicurean Hotel", address: "1207 S Howard Ave, Tampa, FL 33606", industry: "Hotel", premise_type: "on_premise", lat: 27.9350, lng: -82.4822 },
  { name: "Duckweed Urban Grocery", address: "947 E Columbus Dr, Tampa, FL 33602", industry: "Convenience Store", premise_type: "off_premise", lat: 27.9560, lng: -82.4510 },
]

// --- Discovered Accounts (not yet managed) ---
const DISCOVERED_ACCOUNTS = [
  // Bars
  { name: "MacDinton's Irish Pub", address: "405 S Howard Ave, Tampa, FL 33606", category: "bar", lat: 27.9408, lng: -82.4825, rating: 4.3, reviews: 892, score: 88, reasons: ["High foot traffic SoHo district", "Strong happy hour crowd", "No existing supplier coverage"], phone: "(813) 251-8999", website: "https://macdintons.com", hours: "Mon–Thu 11am–3am\nFri–Sat 11am–3am\nSun 11am–3am" },
  { name: "The Patio", address: "6002 S Dale Mabry Hwy, Tampa, FL 33611", category: "bar", lat: 27.8810, lng: -82.5055, rating: 4.1, reviews: 312, score: 75, reasons: ["Busy neighborhood bar", "Growing craft cocktail program", "Owner receptive to new brands"], phone: "(813) 832-0008", website: "https://thepatiotampa.com", hours: "Mon–Thu 4pm–2am\nFri 4pm–3am\nSat 12pm–3am\nSun 12pm–12am" },
  { name: "Yeoman's Cask & Lion", address: "202 N Morgan St, Tampa, FL 33602", category: "bar", lat: 27.9482, lng: -82.4612, rating: 4.4, reviews: 1245, score: 92, reasons: ["Downtown location with high volume", "Premium spirits focus", "Events venue driving demand"], phone: "(813) 999-8363", website: "https://yeomanscaskandlion.com", hours: "Mon–Thu 11am–12am\nFri–Sat 11am–2am\nSun 11am–10pm" },
  { name: "Hub Bar & Grill", address: "719 N Franklin St, Tampa, FL 33602", category: "bar", lat: 27.9510, lng: -82.4584, rating: 4.2, reviews: 567, score: 81, reasons: ["Busy lunch and after-work crowd", "Good existing tap selection", "Room for premium spirit placement"], phone: "(813) 229-1553", website: "https://hubdowntown.com", hours: "Mon–Fri 11am–3am\nSat 12pm–3am\nSun 12pm–12am" },
  { name: "Anise Global Gastrobar", address: "1924 S 12th St, Tampa, FL 33605", category: "bar", lat: 27.9383, lng: -82.4445, rating: 4.5, reviews: 234, score: 79, reasons: ["Upscale cocktail program", "Growing reputation", "Chef-driven menu pairs well with spirits"], phone: "(813) 241-3335", website: "https://aniseglobal.com", hours: "Tue–Thu 5pm–10pm\nFri–Sat 5pm–11pm\nSun–Mon Closed" },
  { name: "The Sail Pavilion", address: "333 S Franklin St, Tampa, FL 33602", category: "bar", lat: 27.9440, lng: -82.4580, rating: 4.0, reviews: 1890, score: 85, reasons: ["Waterfront venue with massive volume", "Tourist and event traffic", "Year-round outdoor seating"], phone: "(813) 251-0566", website: "https://sailpavilion.com", hours: "Mon–Thu 11am–11pm\nFri–Sat 11am–1am\nSun 11am–10pm" },
  { name: "Pier House 60", address: "60 Pier, Clearwater Beach, FL 33767", category: "bar", lat: 27.9756, lng: -82.8291, rating: 4.3, reviews: 2100, score: 90, reasons: ["Beach tourism hotspot", "Hotel bar with high margins", "Clearwater Beach premium pricing"], phone: "(727) 461-0668", website: "https://pierhouse60.com", hours: "Daily 11am–11pm" },
  { name: "Whiskey Joe's", address: "7720 W Courtney Campbell Causeway, Tampa, FL 33607", category: "bar", lat: 27.9645, lng: -82.5670, rating: 4.1, reviews: 3500, score: 87, reasons: ["High-volume waterfront bar", "Multiple bars on property", "Strong weekend traffic"], phone: "(813) 281-0770", website: "https://whiskeyjoes.com", hours: "Mon–Thu 11am–12am\nFri–Sat 11am–2am\nSun 10am–12am" },

  // Restaurants
  { name: "Datz", address: "2616 S MacDill Ave, Tampa, FL 33629", category: "restaurant", lat: 27.9220, lng: -82.4935, rating: 4.5, reviews: 1400, score: 84, reasons: ["Award-winning restaurant", "Strong beverage program", "High-margin craft cocktails"], phone: "(813) 831-7000", website: "https://datztampa.com", hours: "Mon–Thu 11am–10pm\nFri–Sat 11am–11pm\nSun 10am–10pm" },
  { name: "Armature Works", address: "1910 N Ola Ave, Tampa, FL 33602", category: "restaurant", lat: 27.9550, lng: -82.4615, rating: 4.4, reviews: 4200, score: 91, reasons: ["Multi-venue food hall", "Multiple bar concepts under one roof", "Major event space"], phone: "(813) 250-3725", website: "https://armaborworks.com", hours: "Mon–Thu 11am–10pm\nFri–Sat 11am–11pm\nSun 10am–9pm" },
  { name: "On Swann", address: "1501 W Swann Ave, Tampa, FL 33606", category: "restaurant", lat: 27.9388, lng: -82.4890, rating: 4.6, reviews: 560, score: 83, reasons: ["Fine dining with extensive wine list", "High-spending clientele", "Chef-sommelier collaboration"], phone: "(813) 251-0110", website: "https://onswann.com", hours: "Tue–Thu 5pm–10pm\nFri–Sat 5pm–11pm\nSun 5pm–9pm\nMon Closed" },
  { name: "Eddie V's", address: "4400 W Boy Scout Blvd, Tampa, FL 33607", category: "restaurant", lat: 27.9510, lng: -82.5180, rating: 4.5, reviews: 890, score: 86, reasons: ["Upscale chain with premium spirits", "Strong corporate dining", "Live jazz bar draws evening crowd"], phone: "(813) 968-8881", website: "https://eddiev.com", hours: "Mon–Thu 4pm–10pm\nFri–Sat 4pm–11pm\nSun 4pm–9pm" },
  { name: "Oak & Ola", address: "860 Channelside Dr, Tampa, FL 33602", category: "restaurant", lat: 27.9430, lng: -82.4500, rating: 4.3, reviews: 310, score: 78, reasons: ["JW Marriott hotel restaurant", "Conference and tourism traffic", "Premium cocktail program"], phone: "(813) 229-8791", website: "https://oakandola.com", hours: "Daily 6:30am–10pm" },
  { name: "Rooster & the Till", address: "6500 N Florida Ave, Tampa, FL 33604", category: "restaurant", lat: 27.9850, lng: -82.4580, rating: 4.7, reviews: 670, score: 82, reasons: ["James Beard nominated", "Craft cocktail bar component", "Foodie destination driving traffic"], phone: "(813) 374-8940", website: "https://roosterandthetill.com", hours: "Tue–Sat 5pm–10pm\nSun–Mon Closed" },

  // Liquor Stores
  { name: "Luekens Wine & Spirits", address: "2232 S Dale Mabry Hwy, Tampa, FL 33629", category: "liquor_store", lat: 27.9280, lng: -82.5045, rating: 4.6, reviews: 340, score: 88, reasons: ["Premium spirits retailer", "Strong local following", "Active sampling and events program"], phone: "(813) 831-0123", website: "https://luekensliquors.com", hours: "Mon–Sat 10am–9pm\nSun 12pm–6pm" },
  { name: "Crown Wine & Spirits", address: "2201 N Westshore Blvd, Tampa, FL 33607", category: "liquor_store", lat: 27.9545, lng: -82.5230, rating: 4.2, reviews: 180, score: 72, reasons: ["High-traffic Westshore corridor", "Business district clientele", "Growing craft spirits section"], phone: "(813) 872-0700", website: "https://crownwineandspirits.com", hours: "Mon–Sat 9am–10pm\nSun 11am–8pm" },
  { name: "ABC Fine Wine Carrollwood", address: "14332 N Dale Mabry Hwy, Tampa, FL 33618", category: "liquor_store", lat: 28.0580, lng: -82.5040, rating: 4.3, reviews: 220, score: 76, reasons: ["Affluent suburban area", "Strong wine club membership", "Room for new spirit placements"], phone: "(813) 960-1614", website: "https://abcfws.com", hours: "Mon–Sat 9am–10pm\nSun 10am–9pm" },

  // Breweries
  { name: "Angry Chair Brewing", address: "6401 N Florida Ave, Tampa, FL 33604", category: "brewery", lat: 27.9845, lng: -82.4582, rating: 4.7, reviews: 1800, score: 85, reasons: ["Nationally recognized stout program", "High taproom traffic", "Distribution partnership potential"], phone: "(813) 238-1122", website: "https://angrychairbrewing.com", hours: "Wed–Fri 3pm–10pm\nSat 12pm–10pm\nSun 12pm–8pm\nMon–Tue Closed" },
  { name: "Hidden Springs Ale Works", address: "1631 N Franklin St, Tampa, FL 33602", category: "brewery", lat: 27.9540, lng: -82.4580, rating: 4.5, reviews: 450, score: 77, reasons: ["Downtown location", "Growing events program", "Complementary spirit service"], phone: "(813) 489-4030", website: "https://hiddenspringsaleworks.com", hours: "Tue–Thu 3pm–10pm\nFri 3pm–11pm\nSat 12pm–11pm\nSun 12pm–8pm\nMon Closed" },
  { name: "Motorworks Brewing", address: "1014 9th St W, Bradenton, FL 34205", category: "brewery", lat: 27.4985, lng: -82.5755, rating: 4.6, reviews: 920, score: 74, reasons: ["Large venue with event space", "Expanding beyond beer", "Bradenton market expansion"], phone: "(941) 567-6218", website: "https://motorworksbrewing.com", hours: "Mon–Thu 11am–10pm\nFri–Sat 11am–11pm\nSun 11am–9pm" },

  // Hotels
  { name: "Tampa Marriott Water Street", address: "505 Water St, Tampa, FL 33602", category: "hotel", lat: 27.9420, lng: -82.4535, rating: 4.4, reviews: 1200, score: 89, reasons: ["Convention center hotel", "Multiple bars and restaurants", "High corporate event volume"], phone: "(813) 221-4900", website: "https://marriott.com/hotels/travel/tpamc", hours: "Front Desk: 24 hours\nBar: 4pm–12am daily" },
  { name: "The Westin Tampa Waterside", address: "725 S Harbour Island Blvd, Tampa, FL 33602", category: "hotel", lat: 27.9390, lng: -82.4510, rating: 4.3, reviews: 980, score: 82, reasons: ["Premium waterfront property", "Active pool bar program", "Corporate and wedding events"], phone: "(813) 229-5000", website: "https://marriott.com/hotels/travel/tpawi", hours: "Front Desk: 24 hours\nPool Bar: 11am–7pm daily" },
  { name: "Aloft Tampa Downtown", address: "100 W Kennedy Blvd, Tampa, FL 33602", category: "hotel", lat: 27.9470, lng: -82.4620, rating: 4.2, reviews: 540, score: 71, reasons: ["Trendy downtown boutique", "WXYZ Bar concept", "Younger affluent demographic"], phone: "(813) 680-8008", website: "https://marriott.com/hotels/travel/tpaal", hours: "Front Desk: 24 hours\nWXYZ Bar: 5pm–12am daily" },

  // Convenience Stores
  { name: "Circle K - Channelside", address: "800 Channelside Dr, Tampa, FL 33602", category: "convenience_store", lat: 27.9435, lng: -82.4495, rating: 3.8, reviews: 90, score: 65, reasons: ["High foot traffic downtown", "Event day volume spikes", "Premium cooler space available"], phone: "(813) 223-0012", website: "https://circlek.com", hours: "Daily 24 hours" },
  { name: "7-Eleven - Davis Islands", address: "237 E Davis Blvd, Tampa, FL 33606", category: "convenience_store", lat: 27.9210, lng: -82.4560, rating: 3.5, reviews: 45, score: 58, reasons: ["Affluent residential area", "Beach and boating traffic", "Premium product positioning"], phone: "(813) 254-7811", website: "https://7-eleven.com", hours: "Daily 24 hours" },
  { name: "Wawa - Brandon", address: "2034 W Brandon Blvd, Brandon, FL 33511", category: "convenience_store", lat: 27.9350, lng: -82.3070, rating: 4.5, reviews: 320, score: 68, reasons: ["High-volume Wawa location", "Strong beer and seltzer sales", "Growing premium RTD category"], phone: "(813) 655-2190", website: "https://wawa.com", hours: "Daily 24 hours" },
]

// --- Tasks ---
function generateTasks(accountIds: Record<string, string>) {
  const today = new Date()

  const taskDate = (daysFromToday: number) => {
    const d = new Date(today)
    d.setDate(d.getDate() + daysFromToday)
    return d.toISOString().split('T')[0]
  }

  return [
    // Overdue
    { account_key: "Salty Shamrock Irish Pub", task: "Address VitaBlend placement with Marcus — he mentioned competitor gaining shelf space", due_date: taskDate(-5), priority: "high" },
    { account_key: "Total Wine & More", task: "Submit updated pricing sheet for Q2 promotional program", due_date: taskDate(-3), priority: "high" },
    { account_key: "Beef 'O' Brady's", task: "Follow up on draft beer line cleaning schedule discussion", due_date: taskDate(-2), priority: "medium" },
    { account_key: "ABC Fine Wine & Spirits", task: "Send ROI analysis for premium bourbon end-cap display", due_date: taskDate(-1), priority: "medium" },

    // Today
    { account_key: "Circles Waterfront Restaurant", task: "Follow up with Diane on inventory order — she mentioned running low on Modelo", due_date: taskDate(0), priority: "high" },
    { account_key: "Hattricks Tavern", task: "Drop off new seasonal cocktail menu cards for bartenders", due_date: taskDate(0), priority: "medium" },
    { account_key: "Coppertail Brewing Co", task: "Confirm tasting event date for March 20th", due_date: taskDate(0), priority: "medium" },
    { account_key: "Bern's Steak House", task: "Send wine list update for spring menu pairing", due_date: taskDate(0), priority: "low" },
    { account_key: "Columbia Restaurant", task: "Review placement performance from last month's promotion", due_date: taskDate(0), priority: "medium" },

    // This Week
    { account_key: "Cigar City Brewing", task: "Coordinate tap takeover event for new IPA launch", due_date: taskDate(2), priority: "high" },
    { account_key: "The Grand Hyatt Tampa Bay", task: "Meet with events manager about summer pool bar program", due_date: taskDate(3), priority: "high" },
    { account_key: "Ulele", task: "Send updated spirit menu photography for their website", due_date: taskDate(3), priority: "low" },
    { account_key: "Apollo Beach Society Wine Bar", task: "Deliver wine tasting samples — 6 bottles Chardonnay", due_date: taskDate(4), priority: "medium" },
    { account_key: "Epicurean Hotel", task: "Set up meeting with new beverage director", due_date: taskDate(5), priority: "medium" },
    { account_key: "Mango Jo's Bar and Liquors", task: "Check on premium shelf display compliance", due_date: taskDate(6), priority: "low" },

    // Wholesaler action items
    { account_key: "ABC Fine Wine & Spirits", task: "Restock White Claw Mango 12pk — out of stock 4+ days", due_date: taskDate(1), priority: "high" },
    { account_key: "Salty Shamrock Irish Pub", task: "Restock Mango facing on end cap display", due_date: taskDate(1), priority: "medium" },
    { account_key: "Hattricks Tavern", task: "Expedite Mike's Harder Strawberry delivery — missed last shipment", due_date: taskDate(1), priority: "high" },
    { account_key: "Columbia Restaurant", task: "Send updated shelf reset planogram to reclaim lost facing", due_date: taskDate(2), priority: "medium" },

    // Later
    { account_key: "The Bricks of Ybor", task: "Prepare Ybor district multi-venue proposal for Q3", due_date: taskDate(10), priority: "low" },
    { account_key: "Wawa - Riverview", task: "Annual account review meeting", due_date: taskDate(14), priority: "medium" },
    { account_key: "Duckweed Urban Grocery", task: "Submit local craft spirits proposal for summer display", due_date: taskDate(20), priority: "low" },
    { account_key: "Salty Shamrock Irish Pub", task: "Plan St. Patrick's Day 2027 promotional calendar", due_date: taskDate(30), priority: "low" },
  ]
}

// --- Visits (some past, some today/tomorrow for Plan Mode) ---
function generateVisits(accountIds: Record<string, string>) {
  const today = new Date()

  const visitDate = (daysFromToday: number, hour = 10) => {
    const d = new Date(today)
    d.setDate(d.getDate() + daysFromToday)
    d.setHours(hour, 0, 0, 0)
    return d.toISOString()
  }

  return [
    // Past visits
    { account_key: "Salty Shamrock Irish Pub", visit_date: visitDate(-7, 9), notes: "Checked shelf placement, discussed VitaBlend visibility" },
    { account_key: "Total Wine & More", visit_date: visitDate(-5, 14), notes: "Quarterly review with store manager" },
    { account_key: "Coppertail Brewing Co", visit_date: visitDate(-4, 11), notes: "Toured new taproom expansion, great energy" },
    { account_key: "Bern's Steak House", visit_date: visitDate(-3, 15), notes: "Wine cellar walkthrough with sommelier" },
    { account_key: "Columbia Restaurant", visit_date: visitDate(-2, 10), notes: "Lunch meeting with regional buyer, very positive" },
    { account_key: "Hattricks Tavern", visit_date: visitDate(-1, 13), notes: "Dropped off new menu cards, bartender loved the designs" },

    // Today visits (for Plan Mode demo)
    { account_key: "Circles Waterfront Restaurant", visit_date: visitDate(0, 9), notes: "Morning check-in with Diane on inventory" },
    { account_key: "Cigar City Brewing", visit_date: visitDate(0, 11), notes: "Tap takeover planning session" },
    { account_key: "Ulele", visit_date: visitDate(0, 13), notes: "Lunch meeting — spirit menu photography" },
    { account_key: "The Grand Hyatt Tampa Bay", visit_date: visitDate(0, 15), notes: "Pool bar summer program kickoff" },
    { account_key: "Epicurean Hotel", visit_date: visitDate(0, 16), notes: "Meet new beverage director" },

    // Tomorrow visits
    { account_key: "Apollo Beach Society Wine Bar", visit_date: visitDate(1, 10), notes: "Wine tasting delivery" },
    { account_key: "Salty Shamrock Irish Pub", visit_date: visitDate(1, 12), notes: "Address placement concerns with Marcus" },
    { account_key: "Mango Jo's Bar and Liquors", visit_date: visitDate(1, 14), notes: "Shelf display audit" },
  ]
}

// --- Captures (sample conversations) ---
const CAPTURES = [
  {
    account_key: "Salty Shamrock Irish Pub",
    summary: "Discussed VitaBlend placement with Marcus. He's concerned about competitor gaining shelf space near the entrance. Agreed to revisit placement strategy next week.",
    transcript: "Rep: Hey Marcus, how are things going at the Shamrock?\nMarcus: Good, good. Listen, I wanted to talk to you about that VitaBlend display.\nRep: Sure, what's on your mind?\nMarcus: Our competitor just put their stuff right near the entrance. Your display is getting less foot traffic now.\nRep: I see. Let me take a look and we can figure out a better spot.\nMarcus: That'd be great. Maybe near the bar where people actually sit?\nRep: Smart. I'll put together some options and we can review next week.",
  },
  {
    account_key: "Circles Waterfront Restaurant",
    summary: "Diane mentioned they're running low on Modelo and want to increase the standing order. Also interested in trying a new craft IPA for the summer menu.",
    transcript: "Rep: Hi Diane, how's the waterfront treating you?\nDiane: Busy! We've been slammed every weekend. Actually, I need to talk to you about our Modelo order.\nRep: What's going on?\nDiane: We ran out twice last month. I think we need to bump up our standing order.\nRep: Absolutely. I can increase it by 20% starting next delivery. Sound right?\nDiane: Perfect. Oh, and do you have any craft IPAs? We're building a summer menu.\nRep: I've got a great one from Coppertail. I'll bring some samples Thursday.",
  },
  {
    account_key: "Coppertail Brewing Co",
    summary: "Toured the new taproom expansion. They're adding 4 more taps and want to feature partner brands. Great opportunity for a tap takeover event in March.",
    transcript: "Rep: This new space looks incredible!\nBrewer: Thanks! We're adding four more taps next month. We want to mix in some partner brands.\nRep: That's exciting. Have you considered a tap takeover format?\nBrewer: Like a featured brand for a week? That could work.\nRep: Exactly. We could do it during spring break when foot traffic peaks.\nBrewer: Let's plan for mid-March. Can you send me a proposal?",
  },
  {
    account_key: "Total Wine & More",
    summary: "Quarterly review meeting. Premium bourbon sales up 15%. Manager wants end-cap display for Father's Day. Need to submit ROI analysis.",
    transcript: "Rep: Let's look at the numbers from last quarter.\nManager: Premium bourbon is up 15%, which is great.\nRep: That's above the market average. The tasting events are really driving trial.\nManager: Agreed. I want to do an end-cap display for Father's Day.\nRep: Love it. I'll put together an ROI analysis so we can get budget approval.\nManager: Get it to me by end of week if you can.",
  },
  {
    account_key: "Bern's Steak House",
    summary: "Wine cellar walkthrough with head sommelier. They're refreshing the wine list for spring. Interested in our new Napa Valley Cabernet allocation.",
    transcript: "Sommelier: We're refreshing the wine list to match our spring tasting menu.\nRep: I've got a new Napa Cabernet allocation that would pair beautifully with your new short rib dish.\nSommelier: Tell me more about the producer.\nRep: Small family vineyard, 2022 vintage. 95 points from Wine Advocate.\nSommelier: Send me two bottles for tasting. If it's as good as you say, I'll take a case for our top-tier list.",
  },
]

// --- Insights ---
function generateInsights(accountIds: Record<string, string>) {
  return [
    { account_key: "Salty Shamrock Irish Pub", type: "competitive", description: "Competitor has moved premium spirits display to prime entrance location, reducing visibility for our brands", sub_category: "shelf_placement", suggested_action: "Negotiate new high-traffic placement near bar area" },
    { account_key: "Circles Waterfront Restaurant", type: "demand", description: "Modelo running out twice monthly — need to increase standing order by 20%", sub_category: "reorder_rate", suggested_action: "Increase standing order and monitor sell-through rate" },
    { account_key: "Circles Waterfront Restaurant", type: "expansion", description: "Building summer menu with focus on craft IPA — opportunity to introduce Coppertail products", sub_category: "new_product", suggested_action: "Arrange tasting samples for summer menu development" },
    { account_key: "Coppertail Brewing Co", type: "expansion", description: "Adding 4 new taps in expanded taproom — interested in featuring partner brands", sub_category: "new_distribution", suggested_action: "Submit tap takeover proposal for March" },
    { account_key: "Total Wine & More", type: "demand", description: "Premium bourbon sales up 15% QoQ — outperforming market average", sub_category: "growth_trend", suggested_action: "Propose Father's Day end-cap display to capitalize on momentum" },
    { account_key: "Bern's Steak House", type: "relationship", description: "Head sommelier refreshing spring wine list — interested in our Napa Cabernet allocation", sub_category: "buyer_relationship", suggested_action: "Send tasting samples of 2022 Napa Cabernet" },
    { account_key: "Cigar City Brewing", type: "promotion", description: "Spring break tap takeover opportunity — high foot traffic period", sub_category: "event_opportunity", suggested_action: "Coordinate mid-March tap takeover with new IPA launch" },
    { account_key: "The Grand Hyatt Tampa Bay", type: "expansion", description: "Summer pool bar program launching — events manager wants premium spirit partnerships", sub_category: "seasonal_program", suggested_action: "Prepare premium spirit package for pool bar program" },
    { account_key: "Columbia Restaurant", type: "demand", description: "Promotion drove 25% increase in featured cocktail sales last month", sub_category: "promotion_performance", suggested_action: "Propose extension and expansion to additional cocktails" },
    { account_key: "Hattricks Tavern", type: "relationship", description: "Bartenders responded very positively to new seasonal cocktail menu cards", sub_category: "staff_engagement", suggested_action: "Continue providing menu materials — builds brand advocacy" },
    { account_key: "Apollo Beach Society Wine Bar", type: "demand", description: "Chardonnay tasting requests doubled after our last sampling event", sub_category: "sampling_roi", suggested_action: "Schedule follow-up tasting with new varietals" },
    { account_key: "Epicurean Hotel", type: "relationship", description: "New beverage director started — opportunity to establish relationship and placement", sub_category: "new_buyer", suggested_action: "Schedule introductory meeting with portfolio overview" },
    { account_key: "Mango Jo's Bar and Liquors", type: "friction", description: "Premium shelf display not maintained per planogram — products moved to lower shelf", sub_category: "compliance", suggested_action: "Visit to reset display and discuss compliance with staff" },
    { account_key: "The Bricks of Ybor", type: "expansion", description: "Ybor district revival driving increased foot traffic — multi-venue opportunity", sub_category: "market_trend", suggested_action: "Develop district-wide proposal covering multiple Ybor venues" },
    { account_key: "ABC Fine Wine & Spirits", type: "promotion", description: "End-cap bourbon display showing 40% lift vs. regular shelf position", sub_category: "display_performance", suggested_action: "Propose expansion to additional store locations" },

    // CPG-specific insights (simulating VIP depletion + Tracks shelf data)
    { account_key: "Total Wine & More", type: "demand", description: "White Claw Mango 12pk: 52 cases/30 days, up 8% vs prior period", sub_category: "depletion_trend", suggested_action: "Maintain current inventory levels — strong velocity" },
    { account_key: "Total Wine & More", type: "competitive", description: "Mark Anthony shelf share: 34% (up from 31%). Gained 2 facings from Truly", sub_category: "shelf_share", suggested_action: "Lock in shelf space with updated planogram" },
    { account_key: "ABC Fine Wine & Spirits", type: "friction", description: "White Claw Mango 12pk out of stock for 4+ days", sub_category: "oos", suggested_action: "Contact wholesaler to expedite restock" },
    { account_key: "ABC Fine Wine & Spirits", type: "competitive", description: "Truly 12pk priced at $14.99 vs our $15.99 — $1 undercut on shelf", sub_category: "pricing_observation", suggested_action: "Review pricing strategy for competitive parity" },
    { account_key: "Salty Shamrock Irish Pub", type: "demand", description: "Mike's Harder Lemonade: top SKU, 18 cases/week at this location", sub_category: "velocity", suggested_action: "Ensure consistent supply and visibility" },
    { account_key: "Salty Shamrock Irish Pub", type: "competitive", description: "End cap display maintained — 5 of 6 SKUs faced correctly, missing Mango flavor", sub_category: "display_compliance", suggested_action: "Restock Mango facing on next delivery" },
    { account_key: "Circles Waterfront Restaurant", type: "demand", description: "White Claw Variety 24pk: 8 cases/week, strongest performer in on-premise", sub_category: "depletion_trend", suggested_action: "Propose featured placement on summer cocktail menu" },
    { account_key: "Hattricks Tavern", type: "friction", description: "Mike's Harder Strawberry out of stock — wholesaler delivery missed last week", sub_category: "oos", suggested_action: "Escalate to wholesaler rep for immediate restock" },
    { account_key: "Columbia Restaurant", type: "competitive", description: "Mark Anthony shelf share: 22% (down from 26%). Lost 1 facing to High Noon", sub_category: "shelf_share", suggested_action: "Schedule reset visit to reclaim shelf position" },
    { account_key: "Coppertail Brewing Co", type: "demand", description: "White Claw Surge 16oz: new addition, 12 cases/week after first month", sub_category: "sell_in", suggested_action: "Follow up on reorder and consider additional flavors" },
  ]
}

// --- Contacts ---
function generateContacts(accountIds: Record<string, string>) {
  return [
    { account_key: "Salty Shamrock Irish Pub", name: "Marcus Johnson", role: "Store Manager", phone: "(813) 645-8900", email: "marcus@saltyshamrock.com" },
    { account_key: "Salty Shamrock Irish Pub", name: "Ryan O'Brien", role: "Bar Manager", phone: "(813) 645-8901", email: "ryan@saltyshamrock.com" },
    { account_key: "Circles Waterfront Restaurant", name: "Diane Torres", role: "Buyer", phone: "(813) 253-0002", email: "diane@circleswaterfront.com" },
    { account_key: "Circles Waterfront Restaurant", name: "Tom Rivera", role: "General Manager", phone: "(813) 253-0001", email: "tom@circleswaterfront.com" },
    { account_key: "Total Wine & More", name: "Sarah Chen", role: "Store Manager", phone: "(813) 353-4600", email: "s.chen@totalwine.com" },
    { account_key: "Total Wine & More", name: "Mike Patel", role: "Spirits Buyer", phone: "(813) 353-4601", email: "m.patel@totalwine.com" },
    { account_key: "Coppertail Brewing Co", name: "Kent Bailey", role: "Head Brewer", phone: "(813) 247-1500", email: "kent@coppertailbrewing.com" },
    { account_key: "Bern's Steak House", name: "David Laurent", role: "Head Sommelier", phone: "(813) 251-2421", email: "d.laurent@bernssteakhouse.com" },
    { account_key: "Bern's Steak House", name: "Andrea Kim", role: "Beverage Director", phone: "(813) 251-2422", email: "a.kim@bernssteakhouse.com" },
    { account_key: "Columbia Restaurant", name: "Elena Gonzalez", role: "General Manager", phone: "(813) 248-4961", email: "elena@columbiarestaurant.com" },
    { account_key: "The Grand Hyatt Tampa Bay", name: "James Wright", role: "Events Manager", phone: "(813) 874-1234", email: "james.wright@hyatt.com" },
    { account_key: "The Grand Hyatt Tampa Bay", name: "Lisa Park", role: "Beverage Director", phone: "(813) 874-1235", email: "lisa.park@hyatt.com" },
    { account_key: "Cigar City Brewing", name: "Joey Redner", role: "Founder", phone: "(813) 348-6363", email: "joey@cigarcitybrewing.com" },
    { account_key: "Epicurean Hotel", name: "Chris Dawson", role: "Beverage Director", phone: "(813) 999-8700", email: "c.dawson@epicureanhotel.com" },
    { account_key: "Hattricks Tavern", name: "Nicole Harper", role: "Bar Manager", phone: "(813) 225-4288", email: "nicole@hattrickstavern.com" },
  ]
}

// --- Notes ---
function generateNotes(accountIds: Record<string, string>) {
  return [
    { account_key: "Salty Shamrock Irish Pub", content: "Good shelf placement for Modelo but competitor gaining space near entrance. Marcus is open to relocating our display closer to the bar. Need to bring updated planogram." },
    { account_key: "Salty Shamrock Irish Pub", content: "St. Patrick's Day planning starts early here — Marcus mentioned wanting to discuss promotional program by October at latest." },
    { account_key: "Circles Waterfront Restaurant", content: "Diane is a strong advocate for our brands. She personally recommends our products to customers. Worth investing in the relationship with exclusive tastings." },
    { account_key: "Total Wine & More", content: "Store is well-organized. Premium bourbon section is in a great location. Sarah is data-driven — always have numbers ready when meeting." },
    { account_key: "Coppertail Brewing Co", content: "Taproom expansion looks amazing. Kent is excited about collaborations. Their customer base skews younger and adventurous — perfect for new product launches." },
    { account_key: "Bern's Steak House", content: "The wine cellar is legendary — over 6,000 labels. David is extremely knowledgeable. Come prepared with detailed producer stories and tasting notes." },
    { account_key: "Columbia Restaurant", content: "The oldest restaurant in Florida. Elena values tradition but is open to innovation. Best time to visit is Tuesday/Wednesday when it's less busy." },
    { account_key: "The Grand Hyatt Tampa Bay", content: "James handles all event beverage contracts. Pool bar program runs April through October. High-volume opportunity — prepare premium packages." },
  ]
}

// --- Main Seed Function ---
async function seed() {
  console.log('Starting demo seed...\n')

  // 0. Clean existing data for this org (order matters for foreign keys)
  console.log('Cleaning existing data...')
  const tables = [
    'account_notes',
    'account_contacts',
    'account_photos',
    'insights',
    'tasks',
    'captures',
    'visits',
    'discovered_accounts',
    'accounts',
  ]
  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('organization_id', ORG_ID!)
    if (error) {
      console.warn(`  Warning: could not clean ${table}:`, error.message)
    }
  }
  console.log('  Cleaned all tables\n')

  // 1. Insert managed accounts
  console.log('Seeding managed accounts...')
  const accountRows = ACCOUNTS.map((a) => ({
    organization_id: ORG_ID,
    user_id: USER_ID,
    name: a.name,
    address: a.address,
    industry: a.industry,
    premise_type: a.premise_type,
    latitude: a.lat,
    longitude: a.lng,
  }))

  const { data: insertedAccounts, error: accountError } = await supabase
    .from('accounts')
    .insert(accountRows)
    .select('id, name')

  if (accountError) {
    console.error('Account insert error:', accountError)
    return
  }

  const accountIds: Record<string, string> = {}
  for (const a of insertedAccounts || []) {
    accountIds[a.name] = a.id
  }

  console.log(`  ${Object.keys(accountIds).length} accounts ready`)

  // 2. Insert discovered accounts
  console.log('Seeding discovered accounts...')
  const discoveredRows = DISCOVERED_ACCOUNTS.map((d) => ({
    organization_id: ORG_ID,
    name: d.name,
    address: d.address,
    category: d.category,
    latitude: d.lat,
    longitude: d.lng,
    google_rating: d.rating,
    google_review_count: d.reviews,
    ai_score: d.score,
    ai_reasons: d.reasons,
    phone: d.phone,
    website: d.website,
    hours: d.hours,
    is_claimed: false,
  }))

  const { error: discoveredError } = await supabase
    .from('discovered_accounts')
    .insert(discoveredRows)

  if (discoveredError) {
    console.error('Discovered accounts error:', discoveredError)
  } else {
    console.log(`  ${discoveredRows.length} discovered accounts seeded`)
  }

  // 3. Insert tasks
  console.log('Seeding tasks...')
  const tasks = generateTasks(accountIds)
  const taskRows = tasks
    .filter((t) => accountIds[t.account_key])
    .map((t) => ({
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
  if (taskError) {
    console.error('Tasks error:', taskError)
  } else {
    console.log(`  ${taskRows.length} tasks seeded`)
  }

  // 4. Insert visits
  console.log('Seeding visits...')
  const visits = generateVisits(accountIds)
  const visitRows = visits
    .filter((v) => accountIds[v.account_key])
    .map((v) => ({
      organization_id: ORG_ID,
      user_id: USER_ID,
      account_id: accountIds[v.account_key],
      account_name: v.account_key,
      visit_date: v.visit_date,
      notes: v.notes,
    }))

  const { error: visitError } = await supabase.from('visits').insert(visitRows)
  if (visitError) {
    console.error('Visits error:', visitError)
  } else {
    console.log(`  ${visitRows.length} visits seeded`)
  }

  // 5. Insert captures
  console.log('Seeding captures...')
  const captureRows = CAPTURES
    .filter((c) => accountIds[c.account_key])
    .map((c) => ({
      organization_id: ORG_ID,
      user_id: USER_ID,
      account_id: accountIds[c.account_key],
      account_name: c.account_key,
      summary: c.summary,
      transcript: c.transcript,
    }))

  const { error: captureError } = await supabase.from('captures').insert(captureRows)
  if (captureError) {
    console.error('Captures error:', captureError)
  } else {
    console.log(`  ${captureRows.length} captures seeded`)
  }

  // 6. Insert insights
  console.log('Seeding insights...')
  const insights = generateInsights(accountIds)
  const insightRows = insights
    .filter((i) => accountIds[i.account_key])
    .map((i) => ({
      organization_id: ORG_ID,
      user_id: USER_ID,
      account_id: accountIds[i.account_key],
      account_name: i.account_key,
      insight_type: i.type,
      description: i.description,
      sub_category: i.sub_category,
      suggested_action: i.suggested_action,
    }))

  const { error: insightError } = await supabase.from('insights').insert(insightRows)
  if (insightError) {
    console.error('Insights error:', insightError)
  } else {
    console.log(`  ${insightRows.length} insights seeded`)
  }

  // 7. Insert contacts
  console.log('Seeding contacts...')
  const contacts = generateContacts(accountIds)
  const contactRows = contacts
    .filter((c) => accountIds[c.account_key])
    .map((c) => ({
      organization_id: ORG_ID,
      account_id: accountIds[c.account_key],
      name: c.name,
      role: c.role,
      phone: c.phone,
      email: c.email,
    }))

  const { error: contactError } = await supabase.from('account_contacts').insert(contactRows)
  if (contactError) {
    console.error('Contacts error:', contactError)
  } else {
    console.log(`  ${contactRows.length} contacts seeded`)
  }

  // 8. Insert notes
  console.log('Seeding notes...')
  const notes = generateNotes(accountIds)
  const noteRows = notes
    .filter((n) => accountIds[n.account_key])
    .map((n) => ({
      organization_id: ORG_ID,
      account_id: accountIds[n.account_key],
      user_id: USER_ID,
      content: n.content,
    }))

  const { error: noteError } = await supabase.from('account_notes').insert(noteRows)
  if (noteError) {
    console.error('Notes error:', noteError)
  } else {
    console.log(`  ${noteRows.length} notes seeded`)
  }

  console.log('\nDemo seed complete!')
  console.log(`\nSummary:`)
  console.log(`  Managed accounts: ${Object.keys(accountIds).length}`)
  console.log(`  Discovered accounts: ${discoveredRows.length}`)
  console.log(`  Tasks: ${taskRows.length}`)
  console.log(`  Visits: ${visitRows.length} (${visits.filter(v => v.visit_date.includes('T') && new Date(v.visit_date).toDateString() === new Date().toDateString()).length} today)`)
  console.log(`  Captures: ${captureRows.length}`)
  console.log(`  Insights: ${insightRows.length}`)
  console.log(`  Contacts: ${contactRows.length}`)
  console.log(`  Notes: ${noteRows.length}`)
}

seed().catch(console.error)
