# Kosha Voice Agent — Master Testing Plan

## How to Use This Plan

Each test has:
- **Setup** — what to select/configure before starting
- **You say** — exact script to follow (say these words)
- **Agent should** — expected behavior
- **Pass/Fail** — how to judge

Tests are grouped by skill, then edge cases. Run them in order within each section — some build on each other.

---

## Quick Reference: All 4 Skills

| Skill | Triggers | Saves? | Uses Tools? |
|-------|----------|--------|-------------|
| Prep | "brief me", "heading to", "what should I know" | mode: prep (no data) | No |
| Debrief | "just visited", "came from", "had a meeting" | mode: debrief (insights, tasks, summary) | No |
| Note | Quick facts, no visit context | mode: note (auto-save) | No |
| Discovery | "prospects", "who to go after", "expand", "pitch" | No save | search_discovery_accounts, get_account_details |

---

## SECTION 1: SKILL ROUTING

> Does the agent correctly identify which skill to use?

### 1.1 — Debrief trigger
- **Setup:** Select "Salty Shamrock Irish Pub"
- **You say:** "I just visited Salty Shamrock"
- **Agent should:** Ask an open-ended question like "What happened during the visit?"
- **Pass:** Opens debrief flow
- **Fail:** Gives a briefing, says "Saved", or asks about prospects

### 1.2 — Prep trigger
- **Setup:** Select "Bern's Steak House"
- **You say:** "I'm heading to Bern's Steak House, brief me"
- **Agent should:** Deliver a ~60-second briefing with contacts, insights, talking points
- **Pass:** Concise briefing with real account data
- **Fail:** Starts asking debrief questions or searching for prospects

### 1.3 — Note trigger
- **Setup:** Select "Coppertail Brewing Co"
- **You say:** "Their loading dock is around the back of the building"
- **Agent should:** Say "Saved." with minimal response. No follow-up questions.
- **Pass:** Immediate save, minimal response
- **Fail:** Asks follow-up questions or tries to extract insights

### 1.4 — Discovery trigger
- **Setup:** No account selected
- **You say:** "Who should I be going after this week?"
- **Agent should:** Call search_discovery_accounts and return top prospects with scores and reasons
- **Pass:** Returns real discovered account names with scores
- **Fail:** Asks about a visit, tries to debrief, or makes up accounts

### 1.5 — Ambiguous intent (fallback question)
- **Setup:** Select "Columbia Restaurant"
- **You say:** "Hey, so Columbia Restaurant..."
- **Agent should:** Ask a clarifying question — "What can I help with — prepping for a visit, debriefing after one, finding new prospects, or jotting a quick note?"
- **Pass:** Asks for clarification with all 4 options
- **Fail:** Assumes a mode incorrectly

### 1.6 — Completely ambiguous (no account, no intent)
- **Setup:** No account selected
- **You say:** "Hey Kosha"
- **Agent should:** Ask what you need help with
- **Pass:** Prompts for intent and/or account
- **Fail:** Picks a random skill or stays silent

---

## SECTION 2: PRE-VISIT PREP

### 2.1 — Full prep with rich account
- **Setup:** Select "Salty Shamrock Irish Pub"
- **You say:** "Brief me on Salty Shamrock, I'm heading there now"
- **Agent should:** Mention key contacts (Marcus Johnson), open tasks, last visit date, and suggest 2-3 talking points
- **Pass:** Briefing includes real data points from the account
- **Fail:** Generic response with no account-specific info

### 2.2 — Prep for account with minimal data
- **Setup:** Select an account you know has little/no history
- **You say:** "What should I know about this account before I go in?"
- **Agent should:** Acknowledge limited info, give general framework or say what it doesn't have
- **Pass:** Honest about data gaps, still helpful
- **Fail:** Makes up fake contacts or history

### 2.3 — Prep follow-up question
- **Setup:** Select "Total Wine & More"
- **You say:** "I'm prepping for Total Wine. What's the situation?"
- **Wait for briefing, then say:** "Who's the main buyer there?"
- **Agent should:** Reference contact data (e.g., Sarah Chen, Store Manager) if it exists
- **Pass:** Answers from real data
- **Fail:** Makes up a name or says it doesn't know when data exists

### 2.4 — Prep by account name (no pre-selection)
- **Setup:** No account selected
- **You say:** "Prep me for Bern's"
- **Agent should:** Match to "Bern's Steak House" and deliver prep
- **Pass:** Correct account matched, delivers briefing
- **Fail:** Says it can't find "Bern's"

### 2.5 — Prep with upcoming visit context
- **Setup:** Select an account that has a visit scheduled today or tomorrow
- **You say:** "Brief me on my next visit"
- **Agent should:** Reference the scheduled visit and relevant account context
- **Pass:** Connects scheduled visit data with account prep
- **Fail:** Ignores the scheduled visit

### 2.6 — Prep with pending tasks
- **Setup:** Select an account that has open tasks
- **You say:** "What do I need to know before I walk in?"
- **Agent should:** Surface open tasks alongside contacts and insights
- **Pass:** Mentions pending tasks with priorities
- **Fail:** Omits tasks from the briefing

---

## SECTION 3: POST-VISIT DEBRIEF

### 3.1 — Simple debrief (single insight)
- **Setup:** Select "Circles Waterfront Restaurant"
- **You say:** "Just came from Circles Waterfront"
- **Wait for open-ended question, then say:** "It went well. Diane mentioned they're looking to add a new wine by the glass option for summer. She wants something light, maybe a rosé."
- **Agent should:** May ask 1-2 follow-ups, then reads back: 1 DEMAND insight (rosé/wine interest), possibly a task (follow up with rosé options)
- **Pass:** Correctly identifies DEMAND insight type, creates actionable task
- **Fail:** Misclassifies or misses the insight

### 3.2 — Complex debrief (multiple insight types)
- **Setup:** Select "Salty Shamrock Irish Pub"
- **You say:** "I just left Salty Shamrock"
- **Wait for question, then say:** "So Marcus told me they're losing customers to the new craft beer bar down the street. They dropped two of our SKUs last week because of it. But on the bright side, he's opening a second location in South Tampa next quarter and wants us to be the primary supplier there. Oh, and he was kind of cold today — I think he's frustrated about the late delivery last Thursday."
- **Agent should:** Extract:
  - COMPETITIVE insight (losing customers, dropped 2 SKUs)
  - EXPANSION insight (new South Tampa location)
  - RELATIONSHIP insight (frustration, cold demeanor)
  - FRICTION insight (late delivery)
  - Tasks: follow up on delivery issue (HIGH), prepare proposal for new location (HIGH)
- **Pass:** Gets at least 3 of 4 insight types, creates relevant tasks
- **Fail:** Misses major insights or conflates them

### 3.3 — Debrief with vague info (probing)
- **Setup:** Select "Mango Jo's Bar and Liquors"
- **You say:** "Just visited Mango Jo's"
- **Wait, then say:** "Yeah it was fine, nothing major"
- **Agent should:** Ask a targeted follow-up — "Any changes in what they're ordering?" or "How was the mood compared to last time?"
- **Pass:** Asks a specific, useful follow-up (not generic)
- **Fail:** Just says "OK, saving" with nothing captured

### 3.4 — Debrief confirmation and save
- **Setup:** Select "Hattricks Tavern"
- **You say:** "Just came back from Hattricks"
- **Then say:** "They want to try our new IPA on tap. Manager said they'd take 2 cases to start."
- **Wait for readback, then say:** "Yeah that's right, save it"
- **Agent should:** Call save_capture with mode "debrief", summary, DEMAND insight, and a task
- **Pass:** Data saves successfully, you see the review screen with correct data
- **Fail:** Save fails or data is wrong

### 3.5 — Debrief correction before save
- **Setup:** Select "Apollo Beach Society Wine Bar"
- **You say:** "Just visited Apollo Beach Society"
- **Then say:** "They want to order 5 cases of Cabernet"
- **Wait for readback, then say:** "Actually it was 3 cases, not 5"
- **Agent should:** Correct the quantity and read back again
- **Pass:** Updated readback shows 3 cases
- **Fail:** Saves with 5 cases or ignores correction

### 3.6 — Promotional insight extraction
- **Setup:** Select "Beef 'O' Brady's"
- **You say:** "Just left Beef O Brady's"
- **Then say:** "They're interested in running a happy hour promo with our lager. They want table tents and maybe a display near the entrance for the month of April."
- **Agent should:** Extract PROMOTION insight (happy hour promo, display program), task to prepare promo materials
- **Pass:** Correctly identifies PROMOTION type
- **Fail:** Classifies as DEMAND or misses promo angle

### 3.7 — Relationship insight extraction
- **Setup:** Select "The Bricks of Ybor"
- **You say:** "Just came from The Bricks"
- **Then say:** "The new manager seems really disengaged. Barely gave me 5 minutes. I think they might be looking at switching suppliers honestly."
- **Agent should:** Extract RELATIONSHIP insight (disengaged new manager, churn risk) with HIGH priority task to address
- **Pass:** Captures churn risk signal
- **Fail:** Misses the relationship warning signs

### 3.8 — Competitive intelligence extraction
- **Setup:** Select "Cigar City Brewing"
- **You say:** "Just visited Cigar City"
- **Then say:** "They told me that Southern Tier is offering them 15% below our price on the pale ale. They're considering switching their house draft."
- **Agent should:** Extract COMPETITIVE insight (competitor pricing undercut), FRICTION insight (price sensitivity), task to respond with competitive pricing
- **Pass:** Captures both the competitive threat and the pricing friction
- **Fail:** Misses the competitor name or pricing detail

### 3.9 — Multi-item demand extraction
- **Setup:** Select "Ulele"
- **You say:** "Just left Ulele"
- **Then say:** "They want to add three new cocktails to the summer menu. Need our premium vodka, the elderflower liqueur, and they asked about our tonic water line. Oh and they also want to double their order of the house red."
- **Agent should:** Extract multiple DEMAND insights (new cocktails, premium vodka, elderflower, tonic, doubled red wine order)
- **Pass:** Captures at least 3 distinct demand signals
- **Fail:** Lumps everything into one vague insight

### 3.10 — Debrief rejection (don't save)
- **Setup:** Select "Columbia Restaurant"
- **You say:** "Just came from Columbia"
- **Then say:** "They mentioned maybe doing a tasting event"
- **Wait for readback, then say:** "Actually don't save that, I want to think about it first"
- **Agent should:** NOT call save_capture. Acknowledge and ask if there's anything else.
- **Pass:** Does not save, respects the rejection
- **Fail:** Saves anyway

---

## SECTION 4: QUICK NOTES

### 4.1 — Single quick note
- **Setup:** Select "Ulele"
- **You say:** "Their happy hour is 4 to 7 Tuesday through Friday"
- **Agent should:** Say "Saved." — minimal response, no probing
- **Pass:** Immediate save, no follow-up questions
- **Fail:** Asks follow-up questions

### 4.2 — Multiple quick notes in sequence
- **Setup:** Select "The Grand Hyatt Tampa Bay"
- **You say:** "Deliveries go through the service entrance on the west side"
- **Wait for "Saved", then say:** "Ask for Roberto at the front desk, he handles all beverage orders"
- **Wait for "Saved", then say:** "They close their kitchen at 11pm"
- **Agent should:** Each note saved individually with minimal response
- **Pass:** 3 separate saves, no unnecessary commentary
- **Fail:** Agent tries to batch them or starts asking questions

### 4.3 — Note vs debrief boundary
- **Setup:** Select "Epicurean Hotel"
- **You say:** "Their parking garage has a 6 foot clearance limit for delivery trucks"
- **Agent should:** Treat as note (saved immediately), not a debrief trigger
- **Pass:** "Saved." — no debrief flow
- **Fail:** Agent starts asking about a visit

### 4.4 — Note with contact info
- **Setup:** Select "Coppertail Brewing Co"
- **You say:** "The new head brewer's name is Jake, he works Tuesday through Saturday"
- **Agent should:** Save as a note with the factual info intact
- **Pass:** "Saved." with no alteration
- **Fail:** Tries to add Jake as a contact or asks for more details

### 4.5 — Note with operational detail
- **Setup:** Select "Duckweed Urban Grocery"
- **You say:** "They restock all coolers Monday and Thursday mornings before 8am"
- **Agent should:** "Saved."
- **Pass:** Quick save, no commentary
- **Fail:** Asks why or when you learned this

---

## SECTION 5: ACCOUNT DISCOVERY & PROSPECTING

### 5.1 — General prospecting (no filters)
- **Setup:** No account selected
- **You say:** "Give me my top prospects to hit this week"
- **Agent should:** Call search_discovery_accounts (no filters), return top discovered accounts by score — names, scores, reasons
- **Pass:** Returns real discovered account names ranked by score
- **Fail:** Makes up accounts or gives generic advice without calling the tool

### 5.2 — Category-filtered prospecting (bars)
- **Setup:** No account selected
- **You say:** "What bars should I be going after in my territory?"
- **Agent should:** Call search_discovery_accounts with category "bar". Return Yeoman's Cask & Lion (92), Pier House 60 (90), MacDinton's (88), Whiskey Joe's (87), etc.
- **Pass:** Filtered to bars only, ranked by score
- **Fail:** Mixes in restaurants or other categories

### 5.3 — Category-filtered prospecting (restaurants)
- **Setup:** No account selected
- **You say:** "Give me 5 restaurants I should reach out to and why"
- **Agent should:** Call search_discovery_accounts with category "restaurant", limit 5. Return Armature Works (91), Eddie V's (86), Datz (84), On Swann (83), Rooster & the Till (82)
- **Pass:** Exactly 5 restaurants with reasons for each
- **Fail:** Wrong count or wrong category

### 5.4 — Category-filtered prospecting (breweries)
- **Setup:** No account selected
- **You say:** "Any breweries worth going after?"
- **Agent should:** Call search_discovery_accounts with category "brewery". Return Angry Chair (85), Hidden Springs (77), Motorworks (74)
- **Pass:** Returns brewery prospects with scores and reasons
- **Fail:** Returns non-brewery accounts

### 5.5 — Category-filtered prospecting (liquor stores)
- **Setup:** No account selected
- **You say:** "What liquor stores should I hit?"
- **Agent should:** Call search_discovery_accounts with category "liquor_store". Return Luekens (88), ABC Fine Wine Carrollwood (76), Crown Wine & Spirits (72)
- **Pass:** Returns liquor store prospects
- **Fail:** Wrong category or fabricated accounts

### 5.6 — Category-filtered prospecting (hotels)
- **Setup:** No account selected
- **You say:** "Any hotel opportunities in my territory?"
- **Agent should:** Call search_discovery_accounts with category "hotel". Return Tampa Marriott (89), Westin Tampa (82), Aloft Tampa (71)
- **Pass:** Returns hotel prospects with reasons
- **Fail:** Wrong category

### 5.7 — Category-filtered prospecting (convenience stores)
- **Setup:** No account selected
- **You say:** "Are there any convenience stores worth going after?"
- **Agent should:** Return convenience store discovered accounts — Wawa Brandon (68), Circle K Channelside (65), 7-Eleven Davis Islands (58). May note that scores are lower.
- **Pass:** Returns real data, possibly notes lower scores
- **Fail:** Makes up high-scoring convenience stores

### 5.8 — Discovery score reasoning
- **Setup:** No account selected
- **You say:** "Why is Yeoman's Cask and Lion ranked so high?"
- **Agent should:** Call search_discovery_accounts, find Yeoman's, and cite its ai_reasons — "Downtown location with high volume" — and score of 92
- **Pass:** Returns actual stored reasons and score
- **Fail:** Makes up reasons

### 5.9 — Outreach angle for a prospect
- **Setup:** No account selected
- **You say:** "I'm going to cold-call MacDinton's Irish Pub. What's my angle?"
- **Agent should:** Call search_discovery_accounts, find MacDinton's (score 88, "High foot traffic SoHo district", category bar), and suggest a tailored outreach approach based on the data
- **Pass:** Specific angle using real prospect data (location, foot traffic, category)
- **Fail:** Generic cold-call script not tied to the prospect

### 5.10 — Competitive prospecting
- **Setup:** No account selected
- **You say:** "Which of my prospects would be easiest to flip from a competitor?"
- **Agent should:** Search discovery accounts and filter/reason about which ones mention competitor gaps or "no existing supplier coverage" in their ai_reasons
- **Pass:** Surfaces prospects with competitive opportunity signals
- **Fail:** Just returns top scores without reasoning about competitive angle

### 5.11 — Account expansion (existing account)
- **Setup:** Select "Salty Shamrock Irish Pub"
- **You say:** "Where's the easiest expansion opportunity at Salty Shamrock?"
- **Agent should:** Call get_account_details for Salty Shamrock, review existing insights, notes, visit history, and identify gaps or upsell opportunities grounded in the data
- **Pass:** Specific, actionable suggestion tied to actual account data
- **Fail:** Generic advice like "try to sell them more stuff"

### 5.12 — Account expansion with pitch suggestion
- **Setup:** Select "Coppertail Brewing Co"
- **You say:** "What should I pitch Coppertail next and why?"
- **Agent should:** Call get_account_details, reason over insights and relationship data, suggest a specific next product/service to pitch with rationale
- **Pass:** Specific pitch tied to account history
- **Fail:** Vague, ungrounded suggestion

### 5.13 — Discovery near existing account
- **Setup:** Select "Columbia Restaurant"
- **You say:** "What prospects are near Columbia that I could hit on the same trip?"
- **Agent should:** Call search_discovery_accounts to find prospects. May reference that Columbia is in Ybor City area and suggest nearby accounts.
- **Pass:** Suggests discovered accounts and acknowledges the geographic angle
- **Fail:** Ignores location entirely

### 5.14 — Already-managed account treated as prospect
- **Setup:** No account selected
- **You say:** "Should I go after Total Wine?"
- **Agent should:** Recognize "Total Wine & More" is already a managed account, not a prospect. Should say it's already in your book and maybe offer a prep or expansion conversation instead.
- **Pass:** Correctly identifies it's already managed
- **Fail:** Treats it as a prospect and gives discovery info

### 5.15 — Discovery then pivot to debrief
- **Setup:** No account selected
- **You say:** "Give me my top 3 bar prospects"
- **Wait for results, then say:** "Cool. Actually, let me debrief on Salty Shamrock real quick — I just came from there"
- **Agent should:** Seamlessly switch from discovery to debrief mode for Salty Shamrock
- **Pass:** Clean mode switch, opens debrief flow
- **Fail:** Confused state or tries to continue discovery

### 5.16 — Prospecting with follow-up drill-down
- **Setup:** No account selected
- **You say:** "Who should I go after?"
- **Wait for results, then say:** "Tell me more about Armature Works"
- **Agent should:** Either use the data already returned or call search_discovery_accounts/get_account_details to get more detail on Armature Works specifically
- **Pass:** Provides detailed info about that specific prospect
- **Fail:** Repeats the full list or says "I don't know"

---

## SECTION 6: ACCOUNT HANDLING & EDGE CASES

### 6.1 — Fake account name (does not exist)
- **Setup:** No account selected
- **You say:** "I just visited Thunderdome Sports Bar"
- **Agent should:** NOT recognize "Thunderdome Sports Bar" as a known account. Should say it can't find that account or ask to clarify.
- **Pass:** Flags that it doesn't recognize the account
- **Fail:** Proceeds as if it's a real account and makes up data

### 6.2 — Another fake account
- **Setup:** No account selected
- **You say:** "Brief me on Golden Dragon Chinese Restaurant"
- **Agent should:** Says it can't find that account in your accounts list
- **Pass:** Clear "not found" response
- **Fail:** Fabricates a briefing

### 6.3 — Fake prospect name
- **Setup:** No account selected
- **You say:** "What do you know about Sunset Spirits Lounge?"
- **Agent should:** Doesn't find it in managed or discovered accounts. Says it has no info.
- **Pass:** Honest about not finding it
- **Fail:** Fabricates data about a nonexistent account

### 6.4 — Close name match (fuzzy — plural)
- **Setup:** No account selected
- **You say:** "I just left Salty Shamrocks"
- **Agent should:** Match to "Salty Shamrock Irish Pub" (fuzzy) or ask "Did you mean Salty Shamrock Irish Pub?"
- **Pass:** Correctly identifies the intended account
- **Fail:** Treats it as unknown or matches wrong account

### 6.5 — Partial name match
- **Setup:** No account selected
- **You say:** "Prepping for Bern's"
- **Agent should:** Match to "Bern's Steak House" and deliver prep
- **Pass:** Correct account matched
- **Fail:** Says it can't find "Bern's"

### 6.6 — Partial name match (common word)
- **Setup:** No account selected
- **You say:** "Brief me on the Grand Hyatt"
- **Agent should:** Match to "The Grand Hyatt Tampa Bay"
- **Pass:** Correct match
- **Fail:** Doesn't match or matches wrong hotel

### 6.7 — Account switch mid-debrief
- **Setup:** Select "Salty Shamrock Irish Pub"
- **You say:** "Just visited Salty Shamrock"
- **Then say:** "Marcus said they need more IPA inventory"
- **Then say:** "Oh also, I swung by Coppertail Brewing on the way back and they mentioned they're expanding their taproom"
- **Agent should:** STOP. Save current Salty Shamrock data first, then switch to Coppertail for new info.
- **Pass:** Data for each account kept separate
- **Fail:** Mixes insights between accounts

### 6.8 — Account switch mid-notes
- **Setup:** Select "Ulele"
- **You say:** "Their outdoor seating closes at 9pm"
- **Wait for "Saved", then say:** "Oh and for Columbia — they validate parking"
- **Agent should:** Save the Ulele note, then switch to Columbia for the new note
- **Pass:** Each note associated with correct account
- **Fail:** Columbia note saved under Ulele

### 6.9 — No account selected, no account mentioned
- **Setup:** No account selected
- **You say:** "I had a great meeting today"
- **Agent should:** Ask which account you're referring to
- **Pass:** Asks for account name
- **Fail:** Proceeds without knowing the account

### 6.10 — Discovered (non-managed) account mentioned for debrief
- **Setup:** No account selected
- **You say:** "I just had a meeting at MacDinton's Irish Pub"
- **Agent should:** MacDinton's is a "discovered" account, not managed. Agent should recognize it's not in managed accounts and let you know, or attempt to capture at org level.
- **Pass:** Handles gracefully
- **Fail:** Crashes or pretends it has full data

### 6.11 — Account name that matches multiple
- **Setup:** No account selected
- **You say:** "Brief me on ABC"
- **Agent should:** There's "ABC Fine Wine & Spirits" (managed) and "ABC Fine Wine Carrollwood" (discovered). Should clarify which one.
- **Pass:** Asks for clarification between matches
- **Fail:** Picks one without asking

---

## SECTION 7: TONE & BEHAVIOR RULES

### 7.1 — No filler or acknowledgment
- **Setup:** Select "Columbia Restaurant"
- **You say:** "Just came from Columbia"
- **Then say:** "They want 10 cases of Tempranillo for a wine dinner next month"
- **Agent should:** NOT say "Great!", "Got it!", "Sounds like a productive visit!". Should jump straight to next question or readback.
- **Pass:** Zero filler words or validation parroting
- **Fail:** Any "Great", "Awesome", "Sounds good", "Good to know" type responses

### 7.2 — Concise prep briefing
- **Setup:** Select any account with data
- **You say:** "Brief me"
- **Agent should:** Briefing should be ~60 seconds spoken, not a 3-minute monologue. Brisk pace.
- **Pass:** Under 90 seconds
- **Fail:** Rambling, overly detailed

### 7.3 — English only
- **Setup:** Select any account
- **You say:** (in Spanish) "Acabo de visitar el restaurante"
- **Agent should:** Respond in English only
- **Pass:** English response
- **Fail:** Switches to Spanish

### 7.4 — No over-processing notes
- **Setup:** Select "Epicurean Hotel"
- **You say:** "Marcus said call him Thursday"
- **Agent should:** Save the note exactly as stated. Not add commentary like "It sounds like you have a follow-up with Marcus scheduled."
- **Pass:** "Saved." and nothing more
- **Fail:** Adds analysis, commentary, or reformats the note

### 7.5 — Concise follow-up questions
- **Setup:** Select "Hattricks Tavern"
- **You say:** "Just came from Hattricks"
- **Then say:** "It was a good meeting, talked about a few things"
- **Agent should:** Ask ONE short follow-up question (1-2 sentences max). Not multiple questions at once.
- **Pass:** Single, focused question
- **Fail:** Multiple questions in one response, or a long response

---

## SECTION 8: TEXT CHAT FALLBACK

### 8.1 — Text debrief
- **Setup:** Select "Duckweed Urban Grocery", use text input
- **Type:** "Just visited Duckweed"
- **Agent should:** Same debrief flow as voice — asks what happened, extracts insights, reads back
- **Pass:** Full debrief flow works via text
- **Fail:** Broken flow or missing extraction

### 8.2 — Text quick note
- **Setup:** Select "Wawa - Riverview", use text input
- **Type:** "They restock sodas every Monday morning"
- **Agent should:** "Saved." — same as voice behavior
- **Pass:** Quick save, no probing
- **Fail:** Different behavior than voice

### 8.3 — Text discovery
- **Setup:** No account selected, use text input
- **Type:** "What are my top bar prospects?"
- **Agent should:** Return discovered bar accounts with scores (same as voice)
- **Pass:** Discovery works via text with real data
- **Fail:** Doesn't call the tool or returns empty

### 8.4 — Text prep
- **Setup:** Select "Bern's Steak House", use text input
- **Type:** "Brief me on Bern's"
- **Agent should:** Deliver briefing with contacts, insights, tasks
- **Pass:** Same quality as voice prep
- **Fail:** Missing data or broken flow

---

## SECTION 9: SAVE & DATA INTEGRITY

### 9.1 — Verify saved debrief data
- **Setup:** Complete a full debrief for "Circles Waterfront Restaurant"
- **After save:** Navigate to the account page and verify:
  - Capture appears in history with transcript
  - Summary matches what agent read back
  - Insights appear with correct types and descriptions
  - Tasks appear with correct priorities
- **Pass:** All data matches
- **Fail:** Missing or incorrect data

### 9.2 — Verify saved note data
- **Setup:** Save a note for "Ulele": "Chef prefers deliveries before 10am"
- **After save:** Check account notes for Ulele
- **Agent should:** Note appears exactly as stated
- **Pass:** Note saved accurately
- **Fail:** Note missing or altered

### 9.3 — Task due date calculation
- **Setup:** Complete a debrief that generates tasks with different priorities
- **Expected due dates:**
  - HIGH priority → 2 days from today
  - MEDIUM priority → 1 week from today
  - LOW priority → 2 weeks from today
- **Pass:** Due dates calculate correctly
- **Fail:** Wrong dates

### 9.4 — Discovery does NOT save
- **Setup:** No account selected
- **You say:** "Give me my top prospects"
- **Wait for results, then say:** "Thanks, that's helpful"
- **After conversation:** Check that no capture, insight, task, or note was created
- **Pass:** No data saved from discovery conversation
- **Fail:** Phantom save_capture call or data written

### 9.5 — Prep save (minimal)
- **Setup:** Select "Columbia Restaurant"
- **You say:** "Brief me"
- **Wait for briefing, then say:** "Great, thanks, I'm heading in"
- **Agent should:** Call save_capture with mode "prep" and no other fields
- **Pass:** Only mode: "prep" saved, no insights/tasks/summary
- **Fail:** Extracts insights from a prep conversation

---

## SECTION 10: MULTI-TURN CONVERSATION DEPTH

### 10.1 — Deep probing (debrief)
- **Setup:** Select "Cigar City Brewing"
- **You say:** "Just visited Cigar City"
- **Then say:** "Yeah we talked about some stuff"
- **Agent should:** Probe — "What topics came up?"
- **Then say:** "Pricing mostly"
- **Agent should:** Probe deeper — "Any specific products or changes discussed?"
- **Then say:** "Yeah they think our lager is too expensive compared to the local options"
- **Agent should:** Capture COMPETITIVE + FRICTION insights, ask if there's more
- **Pass:** Skillfully extracts real intelligence through 3 rounds of follow-ups
- **Fail:** Gives up after first vague answer

### 10.2 — Rapid mode switch: prep to debrief
- **Setup:** Select "Total Wine & More"
- **You say:** "Brief me on Total Wine"
- **Get the briefing, then say:** "Actually I already went. Let me debrief instead"
- **Agent should:** Switch from prep to debrief mode seamlessly
- **Pass:** Clean mode switch, opens debrief flow
- **Fail:** Confused state or mixed modes

### 10.3 — Rapid mode switch: debrief to discovery
- **Setup:** Select "Salty Shamrock Irish Pub"
- **You say:** "Just came from Salty Shamrock"
- **Then say:** "Actually — I'm done with Salty Shamrock. What new bars should I go after?"
- **Agent should:** Close out the Salty Shamrock conversation (save if needed), then switch to discovery for bars
- **Pass:** Clean transition, calls search_discovery_accounts for bars
- **Fail:** Mixes debrief with discovery or loses context

### 10.4 — Discovery then expansion
- **Setup:** No account selected
- **You say:** "Give me my top prospects"
- **Wait for results, then say:** "What about expansion at Salty Shamrock — what should I pitch them next?"
- **Agent should:** Switch from discovery to expansion mode. Call get_account_details for Salty Shamrock, reason about opportunities.
- **Pass:** Fetches real account data and gives grounded expansion suggestions
- **Fail:** Uses discovery data for an existing account or gives generic advice

### 10.5 — Multi-skill flow in one session
- **Setup:** Select "Circles Waterfront Restaurant"
- **You say:** "Brief me on Circles"
- **Get briefing, then say:** "Great. Also — their new sous chef's name is Maria, she started last week"
- **Wait for "Saved", then say:** "What bar prospects are near Circles?"
- **Agent should:** Handle all 3 skills in one session: prep → note → discovery
- **Pass:** Each skill handled correctly, no data mixing
- **Fail:** Gets confused about what mode it's in

### 10.6 — Long debrief (extended monologue)
- **Setup:** Select any account
- **Start a debrief and talk continuously for 3-4 minutes** covering: pricing discussion, a competitor mention, a new product request, delivery complaints, and a positive relationship moment
- **Agent should:** Capture all major points from the long monologue, extract 4-5 distinct insights
- **Pass:** Captures all major points
- **Fail:** Misses significant portions or only captures 1-2 insights

### 10.7 — Empty debrief (nothing happened)
- **Setup:** Select "The Bricks of Ybor"
- **You say:** "Just left The Bricks"
- **When asked what happened, say:** "Nothing really, just a routine check-in, everything's the same"
- **Agent should:** Probe once, then accept "nothing new" gracefully — save a minimal capture with "routine check-in" summary
- **Pass:** Doesn't force-extract nonexistent insights
- **Fail:** Fabricates insights from nothing

---

## SECTION 11: ERROR & RECOVERY

### 11.1 — Disconnect mid-conversation
- **Setup:** Start a voice debrief, give some info
- **Action:** Kill internet or close the tab
- **Expected:** When reconnecting, transcript triggers fallback extraction, or you can start fresh
- **Pass:** Graceful recovery
- **Fail:** Lost data with no fallback

### 11.2 — Tool call fails (network error)
- **Setup:** No account selected
- **You say:** "Give me my top prospects" (while offline or with API error)
- **Agent should:** Handle the error gracefully, tell the user it couldn't fetch the data
- **Pass:** Error message, no hallucinated data
- **Fail:** Makes up prospect data when the tool call fails

### 11.3 — Empty discovery results
- **Setup:** No account selected
- **You say:** "Show me all discovered pet stores"
- **Agent should:** "pet_store" is not a valid category. Should say it doesn't have that category or return no results.
- **Pass:** Honest about no results
- **Fail:** Makes up pet store accounts

---

## SECTION 12: COMBINED SCENARIOS (REAL-WORLD WORKFLOWS)

> These simulate how a rep would actually use the agent during a full day.

### 12.1 — Morning route prep
- **Setup:** No account selected
- **You say:** "What's on my calendar today?"
- **Agent should:** Reference upcoming visits from org context
- **Wait, then say:** "Brief me on the first one"
- **Agent should:** Deliver prep for that account
- **Pass:** Connects calendar to prep seamlessly
- **Fail:** Doesn't know about scheduled visits

### 12.2 — Between-stops prospecting
- **Setup:** No account selected
- **You say:** "I've got 30 minutes before my next meeting. Any prospects I could swing by near downtown?"
- **Agent should:** Search discovery accounts, present options
- **Pass:** Returns prospects, ideally noting downtown-area relevance
- **Fail:** Generic list without location awareness

### 12.3 — Post-visit full workflow
- **Setup:** Select "Circles Waterfront Restaurant"
- **You say:** "Just left Circles"
- **Complete a full debrief (give 3-4 insights worth of info)**
- **After save, say:** "Also, their back entrance code is 4521"
- **After "Saved", say:** "Where should I go next? Any restaurant leads nearby?"
- **Agent should:** Handle debrief → note → discovery in sequence, all cleanly
- **Pass:** 3 skills in one session, all correct
- **Fail:** Any data mixing or mode confusion

### 12.4 — Expansion research before a visit
- **Setup:** Select "Coppertail Brewing Co"
- **You say:** "I'm heading to Coppertail in an hour. What should I pitch them?"
- **Agent should:** This could trigger prep AND expansion. Should call get_account_details, deliver a briefing, and suggest expansion opportunities based on the data.
- **Pass:** Combines prep context with expansion analysis
- **Fail:** Does only one or the other

### 12.5 — End-of-day rapid notes
- **Setup:** No account selected
- **You say:** "Quick notes — Salty Shamrock: Marcus wants samples Thursday. Hattricks: new manager starts next week. Ulele: closed for renovation until April."
- **Agent should:** Handle multiple accounts and notes in rapid fire. Should save each note to the correct account.
- **Pass:** Each note saved to correct account
- **Fail:** Notes mixed between accounts or lost

---

## Testing Checklist

| # | Scenario | Category | Priority | Pass? |
|---|----------|----------|----------|-------|
| **ROUTING** | | | | |
| 1.1 | Debrief trigger | Routing | HIGH | |
| 1.2 | Prep trigger | Routing | HIGH | |
| 1.3 | Note trigger | Routing | HIGH | |
| 1.4 | Discovery trigger | Routing | HIGH | |
| 1.5 | Ambiguous intent | Routing | MEDIUM | |
| 1.6 | No account, no intent | Routing | MEDIUM | |
| **PREP** | | | | |
| 2.1 | Full prep with data | Prep | HIGH | |
| 2.2 | Prep with minimal data | Prep | MEDIUM | |
| 2.3 | Prep follow-up question | Prep | MEDIUM | |
| 2.4 | Prep by name (no selection) | Prep | MEDIUM | |
| 2.5 | Prep with upcoming visit | Prep | LOW | |
| 2.6 | Prep with pending tasks | Prep | MEDIUM | |
| **DEBRIEF** | | | | |
| 3.1 | Simple debrief | Debrief | HIGH | |
| 3.2 | Complex multi-insight debrief | Debrief | HIGH | |
| 3.3 | Vague debrief (probing) | Debrief | HIGH | |
| 3.4 | Debrief confirm and save | Debrief | HIGH | |
| 3.5 | Debrief correction | Debrief | HIGH | |
| 3.6 | Promotional insight | Debrief | MEDIUM | |
| 3.7 | Relationship insight | Debrief | MEDIUM | |
| 3.8 | Competitive insight | Debrief | MEDIUM | |
| 3.9 | Multi-item demand | Debrief | MEDIUM | |
| 3.10 | Debrief rejection | Debrief | HIGH | |
| **NOTES** | | | | |
| 4.1 | Single note | Notes | HIGH | |
| 4.2 | Multiple notes | Notes | MEDIUM | |
| 4.3 | Note vs debrief boundary | Notes | MEDIUM | |
| 4.4 | Note with contact info | Notes | LOW | |
| 4.5 | Note with operational detail | Notes | LOW | |
| **DISCOVERY** | | | | |
| 5.1 | General prospecting | Discovery | HIGH | |
| 5.2 | Category: bars | Discovery | HIGH | |
| 5.3 | Category: restaurants | Discovery | HIGH | |
| 5.4 | Category: breweries | Discovery | MEDIUM | |
| 5.5 | Category: liquor stores | Discovery | MEDIUM | |
| 5.6 | Category: hotels | Discovery | MEDIUM | |
| 5.7 | Category: convenience stores | Discovery | LOW | |
| 5.8 | Score reasoning | Discovery | MEDIUM | |
| 5.9 | Outreach angle | Discovery | HIGH | |
| 5.10 | Competitive prospecting | Discovery | MEDIUM | |
| 5.11 | Account expansion | Discovery | HIGH | |
| 5.12 | Expansion with pitch | Discovery | HIGH | |
| 5.13 | Discovery near account | Discovery | MEDIUM | |
| 5.14 | Already-managed as prospect | Discovery | HIGH | |
| 5.15 | Discovery → debrief pivot | Discovery | MEDIUM | |
| 5.16 | Drill-down on prospect | Discovery | MEDIUM | |
| **EDGE CASES** | | | | |
| 6.1 | Fake account (debrief) | Edge Case | HIGH | |
| 6.2 | Fake account (prep) | Edge Case | HIGH | |
| 6.3 | Fake prospect | Edge Case | HIGH | |
| 6.4 | Fuzzy name (plural) | Edge Case | MEDIUM | |
| 6.5 | Partial name | Edge Case | MEDIUM | |
| 6.6 | Partial name (common word) | Edge Case | MEDIUM | |
| 6.7 | Account switch mid-debrief | Edge Case | HIGH | |
| 6.8 | Account switch mid-notes | Edge Case | HIGH | |
| 6.9 | No account, no mention | Edge Case | MEDIUM | |
| 6.10 | Discovered account for debrief | Edge Case | MEDIUM | |
| 6.11 | Ambiguous account match | Edge Case | LOW | |
| **TONE** | | | | |
| 7.1 | No filler words | Tone | HIGH | |
| 7.2 | Concise briefing | Tone | MEDIUM | |
| 7.3 | English only | Tone | MEDIUM | |
| 7.4 | No over-processing notes | Tone | MEDIUM | |
| 7.5 | Concise follow-ups | Tone | MEDIUM | |
| **TEXT CHAT** | | | | |
| 8.1 | Text debrief | Text | MEDIUM | |
| 8.2 | Text note | Text | MEDIUM | |
| 8.3 | Text discovery | Text | MEDIUM | |
| 8.4 | Text prep | Text | MEDIUM | |
| **DATA INTEGRITY** | | | | |
| 9.1 | Verify debrief save | Data | HIGH | |
| 9.2 | Verify note save | Data | HIGH | |
| 9.3 | Task due dates | Data | MEDIUM | |
| 9.4 | Discovery no save | Data | HIGH | |
| 9.5 | Prep minimal save | Data | MEDIUM | |
| **MULTI-TURN** | | | | |
| 10.1 | Deep probing | Multi-turn | HIGH | |
| 10.2 | Prep → debrief switch | Multi-turn | MEDIUM | |
| 10.3 | Debrief → discovery switch | Multi-turn | MEDIUM | |
| 10.4 | Discovery → expansion | Multi-turn | MEDIUM | |
| 10.5 | 3-skill flow | Multi-turn | HIGH | |
| 10.6 | Long monologue | Multi-turn | MEDIUM | |
| 10.7 | Empty debrief | Multi-turn | MEDIUM | |
| **ERROR** | | | | |
| 11.1 | Disconnect recovery | Error | MEDIUM | |
| 11.2 | Tool call failure | Error | MEDIUM | |
| 11.3 | Invalid category | Error | LOW | |
| **REAL-WORLD** | | | | |
| 12.1 | Morning route prep | Workflow | HIGH | |
| 12.2 | Between-stops prospecting | Workflow | HIGH | |
| 12.3 | Post-visit full workflow | Workflow | HIGH | |
| 12.4 | Expansion before visit | Workflow | HIGH | |
| 12.5 | End-of-day rapid notes | Workflow | MEDIUM | |

---

**Total: 62 test scenarios**
- 23 HIGH priority (test these first)
- 27 MEDIUM priority
- 7 LOW priority
- 5 categories not yet implemented (route planning, deal math, synced+executed, find answers, would need separate features)
