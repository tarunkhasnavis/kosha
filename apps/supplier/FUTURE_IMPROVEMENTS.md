# Future Improvements — Supplier App

Everything needed to take this from demo to production.

---

## Priority 1: Core Gaps (Demo Workarounds)

### 1. Text Input Mode
**Files:** `components/voice-agent.tsx`, `app/api/capture/session/route.ts`
- Text input field renders but `handleTextSend()` just calls `startCapture()` which initiates WebRTC voice — text is ignored
- **Build:** OpenAI Chat Completions endpoint for text conversations, same extraction pipeline, render as chat transcript without orb animation

### 2. Auto-Detect Account from Conversation
**Files:** `app/api/capture/session/route.ts`, `components/voice-agent.tsx`
- Account is selected manually before conversation. The system prompt never instructs AI to identify the account
- **Build:** Update system prompt to ask "which account is this about?", fuzzy-match mentioned names against managed accounts, return detected `account_name` in extraction, link on save

### 3. Add Task Form (Next Steps FAB)
**File:** `components/next-steps-list.tsx`
- FAB links to `/next-steps?add=true` but the query param is never read — nothing opens
- `createTask()` server action already exists in `lib/tasks/actions.ts`
- **Build:** `<AddTaskDialog>` component with account selector, description, due date picker, priority. Parse `?add=true` to auto-open

### 4. Reschedule Overdue Tasks
**File:** `components/next-steps-list.tsx`
- "Reschedule" is static text (`<span>`), not a button
- **Build:** Make it a button that opens a date picker, create `rescheduleTask(taskId, newDueDate)` server action

### 5. Account Linking on Captures
**File:** `app/api/capture/save/route.ts`
- `account_id` can be null if user skips selection — capture is orphaned
- **Build:** Post-capture "Which account was this for?" dialog if `account_id` is null, allow editing account on saved captures

---

## Priority 2: Discovery & Enrichment (Static Data → Live APIs)

### 6. Google Places Integration (Account Discovery)
**Files:** `lib/discovery/queries.ts`, `components/territory-map.tsx`
- `discovered_accounts` table is pre-seeded with static data. No live API calls
- **Build:** `/api/territory/discover` endpoint using Google Places Nearby Search, scheduled re-scan job, manual "Refresh" button in UI, enrichment pipeline for phone/hours/ratings

### 7. AI Scoring Engine
**Files:** `scripts/seed-demo.ts` (scores hardcoded)
- `ai_score` and `ai_reasons` are static values inserted at seed time
- **Build:** Scoring logic based on: Google rating/review count, category fit, proximity to existing accounts, competitor density, market size. Expose as `/api/territory/calculate-score`. Allow user feedback to improve model

### 8. Last Contact Auto-Update
**File:** `lib/accounts/actions.ts`
- `last_contact` field exists but is never automatically updated when a capture is saved or visit is logged
- **Build:** Update `last_contact = now()` in `/api/capture/save` and in visit creation action

---

## Priority 3: Missing CRUD Operations

### 9. Photo Upload
**File:** `components/account-detail.tsx`
- "Add Photo" button shows "Coming soon" toast. `account_photos` table exists but no upload flow
- **Build:** File input with preview, Supabase Storage bucket, upload handler, store URL in `account_photos`, grid display with delete

### 10. Add/Edit/Delete Contacts
**File:** `components/account-detail.tsx`
- Contacts tab shows list but has no "Add Contact" button, no edit, no delete
- **Build:** `<AddContactDialog>` with name/role/phone/email fields, `createAccountContact()` action, edit/delete actions, swipe-to-delete on mobile

### 11. Edit/Delete Notes
**File:** `components/account-detail.tsx`
- Notes can be added but not edited or deleted
- **Build:** `updateAccountNote()` and `deleteAccountNote()` server actions, edit button on each note, delete with confirmation

### 12. Edit Insights
**File:** `components/account-detail.tsx`
- Insights are read-only after extraction
- **Build:** Edit button on insight cards, `updateInsight()` server action, inline editing or modal

### 13. Delete/Export Conversations
**File:** `components/conversation-list.tsx`
- Past conversations can be viewed but not deleted, exported, or shared
- **Build:** Delete with confirmation, export transcript as PDF/text, copy to clipboard, action buttons in conversation dialog

---

## Priority 4: Map & Route Enhancements

### 14. Open Route in Navigation App
**File:** `components/territory-map.tsx`
- Route displays on map but can't be exported to Google Maps/Apple Maps for turn-by-turn
- **Build:** "Open in Maps" button that generates Google Maps directions URL with all waypoints, deep link to Apple Maps on iOS

### 15. Schedule Visits from Map
**File:** `components/territory-map.tsx`
- Plan mode shows existing visits but can't create new ones
- **Build:** "Add Visit" button in plan mode, pick account from list or tap pin, set date/time, `createVisit()` action, auto-rebuild route

### 16. Multi-Day Route Planning
**File:** `components/territory-map.tsx`
- Only Today/Tomorrow available as plan dates
- **Build:** Full date picker, week view of planned visits, drag-and-drop reordering

### 17. Geocoding Failure Handling
**File:** `lib/accounts/actions.ts`
- If auto-geocoding fails, account is created without coordinates (silently missing from map)
- **Build:** Toast notification on geocoding failure, manual "Set Location" option with map pin drop, batch fix page for unmapped accounts

---

## Priority 5: Polish & Robustness

### 18. Voice Agent Error Recovery
**File:** `components/voice-agent.tsx`
- Basic error handling exists but no retry logic, no mid-conversation recovery
- **Build:** Exponential backoff retry for session creation, periodic transcript checkpoint to localStorage, reconnect on WebRTC drop, graceful fallback to text mode if mic denied

### 19. Map Mode Persistence
**File:** `components/territory-map.tsx`
- Browse/Plan mode resets to "browse" on page reload
- **Build:** Save to localStorage or user preferences

### 20. Settings Integrations
**File:** `app/(app)/settings/page.tsx`
- CRM Sync shows "Coming Soon", Route Optimization shows "Connected" — both are cosmetic
- **Build:** CRM integration (Salesforce/HubSpot API), real route optimization settings/preferences

### 21. Offline Support
- No service worker, no offline data caching
- **Build:** PWA manifest, service worker for core pages, IndexedDB cache for accounts/tasks, sync queue for offline captures

### 22. Push Notifications
- No notifications for overdue tasks, upcoming visits, or new insights
- **Build:** Web push notification setup, notification preferences in settings, trigger notifications from server actions

---

## Architecture Notes

- All database tables and RLS policies exist — the schema is production-ready
- Server actions pattern (`lib/*/actions.ts`) is consistent — new CRUD operations follow the same pattern
- The extraction pipeline (voice → transcript → insights/tasks) is the core IP — text mode should reuse it
- Discovery should be a background job, not blocking UI — consider Supabase Edge Functions or a cron
