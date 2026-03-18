# Kosha Voice Agent — Testing Plan

## Quick Reference: Skill Lifecycles

| Skill | Triggers | "Saving to X" | Review Screen | After Conversation |
|-------|----------|---------------|---------------|-------------------|
| Prep | "brief me", "heading to" | No | No | Toast → home |
| Note | Quick facts, no visit context | Yes | Yes (notes list) | Review → save → done |
| Debrief | "just visited", "came from" | Yes | Yes (insights + tasks) | Review → save → done |
| Discovery | "prospects", "who to go after" | No | No | Home |

---

## SECTION 1: SKILL ROUTING & FLOWS

### 1.1 — Prep: No banner, no review, straight to home
- **Setup:** Select "Bern's Steak House"
- **You say:** "I'm heading to Bern's Steak House, brief me"
- **Pass:** No "Saving to" banner shown. Agent delivers briefing. When done, toast "Good luck!" and returns to home screen (no review/done screen).
- **Fail:** Shows "Saving to" banner, shows review screen, or stays on done screen

### 1.2 — Note: Banner shown, review screen with notes
- **Setup:** Select "Coppertail Brewing Co"
- **You say:** "Their loading dock is around the back of the building"
- **Agent says:** "Got it. Anything else?"
- **You say:** "Yeah, the head brewer's name is Jake"
- **Agent says:** "Got it. Anything else?"
- **You say:** "That's all"
- **Agent reads back:** "Here's what I have: Loading dock is around back, head brewer is Jake. Save these?"
- **You say:** "Yes"
- **Pass:** "Saving to Coppertail" banner shown during conversation. Review screen shows 2 editable notes. After save → done screen.
- **Fail:** Notes auto-saved without review, no banner shown, or no readback

### 1.3 — Debrief: Banner shown, structured questions, review screen
- **Setup:** Select "Salty Shamrock Irish Pub"
- **You say:** "I just visited Salty Shamrock"
- **Pass:** "Saving to Salty Shamrock" banner shown. Agent asks structured questions. After completion, review screen shows insights/tasks.
- **Fail:** No banner, no structured questions, or skips review

### 1.4 — Discovery: No banner, no save, straight to home
- **Setup:** No account selected
- **You say:** "Who should I be going after this week?"
- **Pass:** No "Saving to" banner. Returns prospect data. When conversation ends (stop button), goes straight to home. No review screen.
- **Fail:** Shows banner, shows review screen, or tries to save

### 1.5 — Fake account
- **Setup:** No account selected
- **You say:** "I just visited Thunderdome Sports Bar"
- **Pass:** Agent flags it doesn't recognize the account
- **Fail:** Makes up data

---

## SECTION 2: DEBRIEF DEPTH

### 2.1 — Complex debrief (multiple insights)
- **Setup:** Select "Salty Shamrock Irish Pub"
- **You say:** "I just left Salty Shamrock"
- **Then say:** "Marcus told me they're losing customers to the craft beer bar down the street. They dropped two SKUs. But he's opening a second location in South Tampa. And he was frustrated about the late delivery."
- **Pass:** Review screen shows 3+ insights (competitive, expansion, friction), creates follow-up tasks
- **Fail:** Misses major insights

### 2.2 — Debrief correction
- **Setup:** Select "Apollo Beach Society Wine Bar"
- **You say:** "Just visited Apollo Beach Society"
- **Then say:** "They want 5 cases of Cabernet"
- **Wait for readback, say:** "Actually it was 3 cases, not 5"
- **Pass:** Corrected in readback
- **Fail:** Saves 5 cases

### 2.3 — CPG: Out-of-stock extraction
- **Setup:** Select "ABC Fine Wine & Spirits"
- **You say:** "Just came from ABC Fine Wine"
- **Then say:** "White Claw Mango was out of stock again, been empty for almost a week"
- **Pass:** Review shows friction/oos insight with SKU detail, restock task
- **Fail:** Generic "stock issue" without SKU

### 2.4 — CPG: Pricing + sell-in in one debrief
- **Setup:** Select "Hattricks Tavern"
- **You say:** "Just came from Hattricks"
- **Then say:** "Mike's Harder Strawberry was out of stock, the display was only half set up, Truly is 2 bucks cheaper, but I sold in 2 cases of the sampler pack."
- **Pass:** Review shows 3+ insights (oos, display, pricing, sell-in)
- **Fail:** Fewer than 3

---

## SECTION 3: DAILY SUMMARY & WHOLESALER SHARE

### 3.1 — Summary shows distributor grouping
- **Setup:** Open territory page, tap ClipboardList button
- **Pass:** Sheet shows data grouped by distributor (Southern Glazer's, Republic National), each with "Send to" button, action items first
- **Fail:** Data not grouped or no action items

### 3.2 — Summary respects Plan mode date
- **Setup:** Switch to Plan mode, pick a past date with visits
- **Pass:** Summary shows that date's data, not today's
- **Fail:** Shows today regardless

### 3.3 — Wholesaler share email
- **Setup:** Open summary, tap "Send to [distributor]"
- **Pass:** Email form appears with pre-filled recap (action items leading), editable body, mailto: opens email client
- **Fail:** Empty body or doesn't open

---

## SECTION 4: SETTINGS & INTEGRATIONS

### 4.1 — All integrations visible
- **Setup:** Go to Settings
- **Pass:** See Salesforce, Outlook, VIP, Snowflake, Tracks, PowerBI — all "Connected"
- **Fail:** Missing integrations

---

## SECTION 5: DEMO SCRIPTS

Two scripted conversations that showcase the full product to Mark Anthony.

---

### DEMO 1: Post-Visit Debrief at ABC Fine Wine

> **Shows:** Voice capture → CPG extraction → wholesaler-ready output

**Setup:** Select "ABC Fine Wine & Spirits"

**You say:** "Just came from ABC Fine Wine"

**Agent asks:** "What happened during the visit?"

**You say:** "Met with the store manager. Our White Claw Mango 12-pack has been out of stock for about 5 days now — the shelf was completely empty. I talked to him about getting it restocked ASAP. I also noticed Truly has us undercut by a dollar — they're at 14.99 and we're at 15.99 on the 12-pack. On the bright side, I sold in 2 cases of the new White Claw Surge 16-ounce cans. He's going to put them on the cold shelf near the register. Display looked decent overall but only 4 of our 6 SKUs were faced right."

**Answer follow-ups naturally:**
- Competition: "Yeah Truly is pushing hard, they had a new end-cap that wasn't there last time"
- Next steps: "I need the wholesaler to restock Mango ASAP and we should look at our pricing"

**Agent reads back, you say:** "Yeah save it"

**Verify:**
- "Saving to ABC Fine Wine" banner visible during conversation
- Review screen shows 4+ insights: oos, pricing, sell-in, display
- Tasks include restock + pricing follow-up
- Done screen appears after save
- Open daily summary → ABC Fine Wine appears under Republic National with action items

**What this shows Mark Anthony:**
- 60-second voice capture replaces typing
- OOS/pricing/sell-in/display all extracted automatically
- Wholesaler action items generated from natural speech

---

### DEMO 2: Pre-Visit Prep for Total Wine

> **Shows:** AI briefing replaces 10 minutes of dashboard digging

**Setup:** Select "Total Wine & More"

**You say:** "I'm heading to Total Wine, brief me"

**Agent delivers briefing including:**
- Contacts: Sarah Chen (Store Manager), Mike Patel (Spirits Buyer)
- Depletion: White Claw Mango 52 cases/30 days, up 8%
- Shelf share: 34%, up from 31%
- Open tasks: Q2 pricing sheet
- Talking points

**You say:** "Who's the spirits buyer?"

**Agent:** References Mike Patel

**You say:** "Great, I'm heading in"

**Verify:**
- NO "Saving to" banner during conversation
- NO review screen
- Toast "Good luck!" → straight back to home
- Transcript appears in Recent Conversations (hamburger menu)

**What this shows Mark Anthony:**
- Pre-visit brief with VIP depletion + Tracks shelf data
- Contacts by name and role
- Rep walks in prepared — no PowerBI needed

---

### DEMO 3: End-of-Day Flow

> **Shows:** Daily summary → distributor recap → email

1. Open territory map → tap ClipboardList button
2. Summary grouped by distributor:
   - **Republic National:** ABC Fine Wine OOS + pricing issues + restock tasks
   - **Southern Glazer's:** Other visits
3. Tap "Send to Republic National"
4. Email form shows action-first recap — editable
5. Tap "Open Email Client" → email opens pre-filled

**What this shows Mark Anthony:**
- Automatic daily recap from voice conversations
- Grouped by distributor — right data to right wholesaler
- Action items lead the email — wholesaler knows what to do
- Entire workflow: prep → visit → debrief → recap → send

---

## Checklist

| # | Test | Priority |
|---|------|----------|
| 1.1 | Prep: no banner, no review, home | HIGH |
| 1.2 | Note: banner, readback, review | HIGH |
| 1.3 | Debrief: banner, questions, review | HIGH |
| 1.4 | Discovery: no banner, no save, home | HIGH |
| 1.5 | Fake account | MEDIUM |
| 2.1 | Complex debrief | HIGH |
| 2.2 | Debrief correction | MEDIUM |
| 2.3 | CPG: OOS extraction | HIGH |
| 2.4 | CPG: Multi-observation | HIGH |
| 3.1 | Summary distributor grouping | HIGH |
| 3.2 | Summary date picker | MEDIUM |
| 3.3 | Wholesaler share email | HIGH |
| 4.1 | Mock integrations | MEDIUM |
| 5.1 | Demo: Debrief script | HIGH |
| 5.2 | Demo: Prep script | HIGH |
| 5.3 | Demo: End-of-day flow | HIGH |

**Total: 18 tests** (14 HIGH, 4 MEDIUM)

---

## SECTION 7: MARK ANTHONY DEMO — FULL SCRIPTED FLOW

Two voice conversations + one visual walkthrough. This is the exact sequence to run during the demo.

---

### CONVERSATION 1: Pre-Visit Prep + Knowledge + Discovery

> **Features displayed:** Pre-meeting briefing, knowledge retrieval, account discovery
> **Time:** ~90 seconds

**Setup:** Select "Bern's Steak House" from the account dropdown before starting.

**You say:** "I'm heading to Bern's Steak House. Give me a quick briefing."

**Agent delivers prep including:**
- Key contacts: David Laurent (Head Sommelier), Andrea Kim (Beverage Director)
- Recent insights: spring wine list refresh, interested in Napa Cabernet allocation
- Open tasks: send wine list update
- Last visit context
- 2-3 talking points

**You say:** "What should I lead with when I talk to David?"

**Agent suggests** talking points grounded in account data (e.g., the Napa Cabernet interest, spring menu refresh)

**You say:** "Any restaurant prospects nearby I should hit while I'm in the area?"

**Agent calls** `search_discovery_accounts` with category "restaurant" and returns top prospects with scores and reasons (e.g., On Swann, Eddie V's, Datz)

**You say:** "Great, thanks"

**Conversation ends** → toast "Good luck!" → back to home screen. Transcript saved in Recent Conversations.

**What this shows Mark Anthony:**
- 30-second briefing replaces 10 minutes of PowerBI/Salesforce digging
- Contacts surfaced by name and role
- VIP depletion data + Tracks shelf share in the brief (simulated)
- Specific talking points grounded in data
- Discovery of nearby prospects without leaving the app
- Rep walks in prepared and confident

---

### VISUAL: Territory Map + Route Planning

> **Features displayed:** Route planning, territory visualization
> **Time:** ~60 seconds
> **Not a voice conversation — this is a visual walkthrough on the territory map**

1. Open the **Territory** page
2. Switch to **Plan** mode
3. Show today's scheduled visits as numbered stops on the map
4. Highlight the **route line** connecting all stops with distance/duration
5. Tap a stop to show the **account detail panel** (contacts, insights, tasks)
6. Tap the **Google Maps button** to show navigation opens in Maps
7. Point out **discovered accounts** (gray pins) near the route — prospects the rep could swing by

**What this shows Mark Anthony:**
- Visual route optimization — reps see their day at a glance
- One tap to navigate to any stop
- Discovered prospects visible on the map near existing routes
- No separate route planning app needed

---

### CONVERSATION 2: Post-Visit Debrief (CPG-Specific)

> **Features displayed:** Voice capture, CPG field report extraction, wholesaler-ready output
> **Time:** ~2 minutes

**Setup:** Select "ABC Fine Wine & Spirits" from the account dropdown before starting.

**You say:** "Just came from ABC Fine Wine"

**Agent asks:** "What happened during the visit?"

**You say:** "Met with the store manager. Our White Claw Mango 12-pack has been out of stock for about 5 days now — the shelf was completely empty. I talked to him about getting it restocked ASAP. I also noticed Truly has us undercut by a dollar — they're at 14.99 and we're at 15.99 on the 12-pack. On the bright side, I sold in 2 cases of the new White Claw Surge 16-ounce cans. He's going to put them on the cold shelf near the register. Display looked decent overall but only 4 of our 6 SKUs were faced right."

**Agent asks follow-ups — answer naturally:**
- If asked about competition: "Yeah Truly is really pushing hard here. They had a new end-cap that wasn't there last time."
- If asked about next steps: "I need the wholesaler to restock the Mango ASAP and we should probably look at our pricing on the 12-pack."

**Agent reads back summary + insights + tasks. You say:** "Yeah save it"

**Review screen shows:**
- Summary of the visit
- Insights: OOS (Mango 12pk), pricing ($14.99 vs $15.99), sell-in (2 cases Surge), display (4/6 SKUs)
- Tasks: restock Mango, review competitive pricing

**Tap Save → Done screen.**

**What this shows Mark Anthony:**
- 60-second voice capture replaces manual typing
- OOS, pricing, sell-in, display compliance all auto-extracted
- Specific SKU names and quantities captured
- Wholesaler action items generated automatically
- Clean structured output from natural messy speech

---

### VISUAL: Daily Summary + Wholesaler Share

> **Features displayed:** End-of-day summary, distributor grouping, email sharing
> **Time:** ~60 seconds
> **Do this right after the debrief conversation above**

1. Open the **Territory** page
2. Tap the **ClipboardList** button (daily summary)
3. Show the summary grouped by distributor:
   - **Republic National:** ABC Fine Wine insights + restock/pricing tasks
   - **Southern Glazer's:** Other account activity
4. Point out **action items listed first** — this is what the wholesaler needs to act on
5. Tap **"Send to Republic National"**
6. Show the **pre-filled email form**:
   - Action items leading the body
   - Visit details as context below
   - Editable before sending
7. Tap **"Open Email Client"** → show it opens with everything pre-filled

**What this shows Mark Anthony:**
- Automatic daily recap generated from voice conversations
- Grouped by distributor — the right data goes to the right wholesaler
- Action items lead the email — wholesaler knows exactly what to do
- Editable before sending — rep stays in control
- No manual recap creation — the entire day's work is captured and shareable

---

### DEMO FLOW SUMMARY

| Step | Type | Duration | Features |
|------|------|----------|----------|
| 1 | Voice: Prep + Discovery | ~90 sec | Pre-visit brief, knowledge retrieval, prospect search |
| 2 | Visual: Territory Map | ~60 sec | Route planning, navigation, territory visualization |
| 3 | Voice: CPG Debrief | ~2 min | Voice capture, OOS/pricing/sell-in/display extraction |
| 4 | Visual: Daily Summary | ~60 sec | Distributor grouping, wholesaler email, action items |
| **Total** | | **~5 min** | |
