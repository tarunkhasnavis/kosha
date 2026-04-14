# FINAL PRODUCT AND IMPLEMENTATION SPEC

Single source of truth for building field-rep-mobile. Product decisions, engineering architecture, and implementation tasks — all in one document.

Supersedes all previous documents (01-04, 06, 07).

---

## Product Overview

A mobile voice-first capture tool for field sales reps. The rep opens the app, talks about what happened in a meeting, and an AI agent (Kosha) guides them toward better, more detailed notes. After the conversation ends, the system classifies, extracts, organizes, and syncs everything to CRM automatically.

The rep's only job is to talk. Everything else happens behind the scenes.

### v1 Scope: Two Input Modes + Account Browsing

**Voice Debrief** — Rep taps the mic, starts talking. Kosha listens and asks follow-up questions to draw out better notes. One button. Tap to start. Talk. Tap to end.

**Text Debrief** — Same as voice but typed. Chat interface. For when the rep can't talk out loud.

**Account Browsing** — Rep can browse all their accounts, view AI-generated summaries, see linked tasks and past conversations. Accounts are never manually created — they're extracted automatically during post-processing. On first use, the rep has zero accounts. They build up naturally as the rep has conversations.

---

## Identity

- Name: Kosha
- Voice: Warm, casual colleague. Like a friendly coworker, not an assistant
- Personality: Supportive, slightly informal, never corporate
- Response style: Super short in pull mode (drawing out info from the rep). Slightly longer in push mode (answering questions). Never verbose

---

## Architecture: Three Layers

### Layer 1: Context (before conversation)
- On app open, fetch ALL account summaries for this rep from Supabase
- Store in local memory (JavaScript variable)
- ~20-50 accounts at ~80-100 tokens each = ~2,000-5,000 tokens total
- When rep mentions an account name, app code matches it and injects summary into Claude's system prompt
- No API calls during the conversation. All context is pre-loaded

### Layer 2: Conversation (during)
- Agent has a natural conversation. No mode-switching. No data decisions
- Responds appropriately to whatever the rep says — debrief info, questions, or both
- Uses pre-loaded account context to ask smarter questions and give gentle nudges
- Zero mid-conversation API calls beyond the core voice loop (Deepgram, Claude, ElevenLabs)

### Layer 3: Processing (after conversation)
- App sends transcript to Vercel API route, which saves to Supabase and triggers an Inngest background job
- Inngest job runs the full pipeline: classify, extract, match accounts, update summaries, sync to CRM
- Rep's phone doesn't need to be involved. Background job with automatic retry logic
- See the "Vercel API Routes" and "Engineering Architecture" sections below for full backend detail

---

## Conversation Flow

### Turn-Taking
- Silence threshold: 2-3 seconds of silence = agent's turn to speak
- Agent responds with a short follow-up question or acknowledgment
- If the rep pauses longer (thinking), the VAD endpointing at ~1500ms triggers the turn

### Backchanneling
- No audio backchanneling. Agent stays completely silent while rep is talking
- No "mm-hmm," "got it," or "okay" during the rep's turn
- Visual waveform shows the mic is active — that's the only feedback

### Barge-In
- Fully supported. If rep starts talking while agent is speaking, agent stops immediately
- Agent's unfinished thought is dropped from speech but remembered internally
- If the unasked question is still relevant later, agent can ask it at the next natural pause
- Agent never says "as I was saying" or references the interruption

### Silence Handling
- 2-3 seconds silence after rep finishes: agent takes its turn
- If rep is trailing off ("the meeting was... I dunno..."): wait an extra 2-3 seconds beyond normal threshold, then if still silent, ask about something else entirely. Don't try to finish their thought for them
- Extended silence (30+ seconds from both sides): agent says "alright, I think we're good — talk later!" and ends the session

### Filler Tolerance
- "Um," "uh," "like," "you know" — treated as non-content. Not transcribed as meaningful input
- Deepgram's smart_format handles most of this

### Session Start
- When rep starts a conversation, agent is silent by default
- If the rep doesn't say anything for ~5 seconds, agent throws out a greeting: "Hey, how's it going?"
- Only greets once. If rep still doesn't talk after the greeting, wait in silence

### Session End
- Rep taps end button: session ends immediately
- Farewell phrases end the session: "goodbye," "see you later," "let's chat later," "okay stop recording," "that's it," "I think that covers it" — detected locally on the transcript (no API call) for instant response. Agent says brief sign-off ("sounds good, got it all") and session ends
- Extended mutual silence (30+ seconds): agent auto-ends with brief sign-off
- App crash: whatever was captured gets saved silently, sent to post-processing. No resume prompt on reopen

---

## Audio Pipeline

### Mic Capture
- Format: 16kHz mono PCM
- Permissions: Request on first use with clear explanation
- Background recording: Keep capturing audio even when app is backgrounded
- Use iOS foreground audio service / Android foreground service to maintain recording

### Audio Routing
- Support: phone speaker, earpiece, wired headphones, Bluetooth
- If audio source switches mid-session (Bluetooth dies, etc.): seamless switch, keep going
- No notification to rep about the switch. Just handle it silently

### Echo Cancellation
- Rely on device built-in AEC (iOS/Android hardware-level)
- No app-level echo cancellation in v1
- If echo issues arise in testing, add software AEC later

### Noise Suppression
- Rely on Deepgram Nova-2's built-in noise robustness
- No app-level noise suppression in v1
- Onboarding tip: "Find a quiet spot for best results" (soft suggestion, not a requirement)

### Audio Ducking
- When agent audio is playing and VAD detects rep starting to speak:
  - Immediately stop agent audio playback (barge-in)
  - Switch to listening mode
- No gradual volume reduction. Hard stop on agent audio

### Gain Control
- Rely on device OS automatic gain control
- No manual gain adjustment in v1

### Visual Feedback
- Waveform indicator showing mic is active and capturing audio
- No live transcript on screen. Waveform only
- Status text: "Listening..." / "Thinking..." to show agent state (subtle, not prominent)

---

## Speech-to-Text (Deepgram Nova-2)

### Connection
- Streaming via WebSocket (not batch)
- Open connection when conversation starts, close when it ends
- Reconnection with exponential backoff on disconnect (max 5 retries in 15 seconds)
- Buffer audio locally during disconnect for replay on reconnect

### Configuration
- Model: Nova-2
- Encoding: linear16 (PCM)
- Sample rate: 16000
- Channels: 1 (mono)
- smart_format: true
- punctuate: true
- utterances: true
- endpointing: 1500 (ms of silence to trigger end-of-utterance)
- interim_results: true (for live feedback, but not shown to rep)

### Transcript Handling
- Interim results: used internally for VAD-like behavior, not displayed
- Final results: appended to conversation transcript buffer
- Confidence scores: logged but not surfaced to rep. Used in post-processing for quality assessment

### Custom Vocabulary
- Not in v1. Add when specific customer jargon causes consistent transcription errors

---

## Language Model (Claude Sonnet)

### System Prompt Structure
```
[Agent identity and behavior rules]
[Response style: short in pull, slightly longer in push]
[Sales debrief guide: what good notes cover — people, numbers, decisions, next steps, blockers]
[Account context: dynamically injected matched account summary]
[Conversation transcript: full history of this session]
```

Note: There is no extraction schema in the system prompt. The agent doesn't need to know about CRM fields. It just needs to know what makes a good debrief — who was there, what was discussed, what decisions were made, what happens next, what's blocking progress. The CRM connector handles structured extraction separately after the conversation.

### Response Format
Claude returns plain text. No JSON, no structured output. The response IS what gets spoken to the rep via TTS.

The system prompt gives Kosha enough guidance (identity, debrief guide, account context, full conversation history) to ask good follow-up questions naturally. Claude can see the entire transcript — it doesn't need a separate data structure to track what's been covered. Its own reasoning handles that.

### Streaming
- Use Claude streaming API
- Stream text tokens directly to ElevenLabs as they arrive
- No parsing step between Claude and TTS — tokens flow straight through
- Don't wait for full response before starting TTS

### Context Management
- System prompt + account context + debrief guide: ~2,000-4,000 tokens
- Conversation history grows with each turn: ~100-200 tokens per turn
- For a 3-minute debrief (~10-15 turns): ~2,000-3,000 tokens of history
- Total per-request: ~5,000-8,000 tokens. Well within 200k window
- No summarization or truncation needed for v1 session lengths

### Guardrails
- Agent can give gentle context-aware nudges based on pre-loaded data
  (e.g., "interesting — last time you mentioned they needed board approval, did that change?")
- Agent never makes promises on behalf of the rep or the company
- Agent never invents information it doesn't have
- Agent never gives strategic advice ("you should lower the price")
- Agent stays in its role: listener, question-asker, information-provider

### Temperature
- Low temperature (~0.3) for consistent, predictable responses
- Higher temperature causes rambling and inconsistency in a voice context

---

## Text-to-Speech (ElevenLabs Turbo v2.5)

### Voice Selection
- Warm, casual, colleague-like voice
- Test multiple options with real reps before launch
- Select one default voice for v1 (no per-rep customization)

### Streaming
- Use WebSocket streaming for lowest latency
- Begin playback as soon as first audio chunk arrives
- Don't wait for full TTS response

### Thinking Indicator (Audio)
- If Claude reasoning takes > 1.5 seconds (latency spike), play a subtle repeating beep
- Soft, low-pitched tone that repeats every ~1 second — signals "thinking, don't speak yet"
- Stops immediately when Claude's first TTS audio chunk arrives
- This prevents the rep from thinking the agent didn't hear them and repeating themselves
- No pre-recorded voice fillers ("hmm," "let me think") — the beep is less jarring and doesn't pretend to be human

### Pronunciation
- Use ElevenLabs text normalization (ElevenLabs mode, not system prompt mode)
- Numbers converted naturally: "$150k" → "a hundred and fifty K"
- Add pronunciation dictionary entries only if testing reveals issues

### Speed Control
- Default speed. No dynamic adjustment in v1
- If testing shows the voice sounds too fast or slow, adjust globally in ElevenLabs settings

---

## Latency Budget

Target: Under 900ms from rep finishing speech to agent starting response.

| Stage | Target | Component |
|-------|--------|-----------|
| VAD end-of-speech detection | 100ms | Silero VAD (on-device) |
| Deepgram final transcript | 200ms | Nova-2 streaming |
| Claude first token | 300ms | Sonnet streaming |
| ElevenLabs first audio chunk | 200ms | Turbo v2.5 streaming |
| Audio playback start | 100ms | React Native audio |
| **Total** | **900ms** | |

Key principle: stream at every stage. Never wait for a complete result.

If total latency exceeds 1.5 seconds on any turn, play filler audio.

---

## State Management

### Session Lifecycle
States: IDLE → ACTIVE → ENDING → COMPLETE

- IDLE: Home screen. No active session
- ACTIVE: Conversation in progress. Audio pipeline running. Claude responding
- ENDING: Rep tapped end or agent detected natural ending. Final processing
- COMPLETE: Transcript sent to post-processing. Session saved. Back to home

### Crash Recovery
- Auto-save transcript to SQLite every 10 seconds during active session
- If app crashes: whatever was saved gets sent to post-processing silently on next app open
- No resume prompt. No "pick up where you left off." Just save what we have and move on

### App Backgrounding
- Keep recording audio in background (foreground service)
- The full conversation continues while backgrounded — mic stays active, Deepgram keeps transcribing, Claude keeps responding
- TTS playback continues in background (agent can still speak to the rep via earpiece/speaker)
- iOS shows the orange mic indicator in the status bar automatically
- If backgrounded > 5 minutes: auto-end session, send to post-processing

### Lock Screen Controls
- When an active conversation is running and the phone is locked, show media controls on the lock screen via iOS Now Playing widget
- Controls: mute/unmute mic, end session
- Lock screen only shows controls for active conversations — cannot start a new conversation from lock screen
- Requires development build (Phase 7) — uses MPNowPlayingInfoCenter and MPRemoteCommandCenter
- Display: "kosha — Listening..." as the Now Playing title

### Phone Call Interruption
- Detect incoming call: pause audio recording
- When call ends: resume recording if session was < 5 minutes backgrounded
- If call was long (> 5 minutes): auto-end session

### Concurrent Sessions
- Only one active session at a time
- If rep tries to start a new session while one is active: "You have a session in progress. End it first?"
- Enforce in app logic and DB constraint

---

## Post-Processing Pipeline

Runs on server (Vercel API Route triggers Inngest background job). Rep's phone not involved.

### Design Philosophy
Don't prematurely structure what you don't understand yet. The transcript is the source of truth. Only extract things that need to exist independently because they're browsed or acted on: accounts and tasks. Everything else (contacts, sentiment, competitive mentions, insights) lives in the transcript and gets generated on-demand when viewing an account.

### Step 1: Account Extraction
Identify accounts/businesses mentioned in the transcript.
- Match against existing accounts in Supabase by name
- If new account mentioned: create placeholder
- If multiple accounts mentioned: tag session with all of them
- Output: array of account IDs linked to this session

### Step 2: Task Extraction
Extract action items with due dates from the transcript.
- Only extract things that are clearly actionable ("send them the revised proposal by Friday")
- Each task gets: description, due_date (if mentioned), priority (inferred), account_id
- Tasks are created as independent records the rep can browse and check off

### Step 3: Account Summary Update
Regenerate the account summary from ALL transcripts tagged to this account.
- Pull every session associated with this account
- Ask Claude to produce a fresh summary incorporating the new conversation
- This keeps pre-loaded context fresh for the next conversation
- Summary format: short bullet points — deal stage, key contacts, recent activity, open items, next steps. Scannable in 5 seconds. Not prose

### Step 4: Embedding Generation
Generate vector embeddings of the transcript.
Store in Supabase pgvector.
Not used in v1 conversations, but available for future deep retrieval features.

### Step 5: CRM Connector (if CRM connected)
The CRM connector is a separate agent that dynamically maps transcripts to CRM fields.
See "CRM Integration" section below for full detail.

### Step 6: Storage
Store in Supabase:
- Full transcript with timestamps and speaker labels
- Account associations
- Extracted tasks
- CRM sync status
- Embedding references (pgvector)

Idempotency key per session to prevent duplicates on retry.
Exponential backoff retry: max 5 attempts over 24 hours.
On persistent failure: badge on home screen, rep can manually retry.

---

## CRM Integration

### Design Philosophy
No hardcoded extraction schema. No predetermined field mapping. The CRM connector reads the customer's actual CRM structure and uses THAT as the extraction template. A medical device company with a `regulatory_status` custom field on their Salesforce Opportunity gets that extracted automatically without anyone configuring anything.

### Supported CRMs
- HubSpot (pilot customer) — v3 API
- Salesforce — REST API

### How the Connector Works

**Schema Read (on every sync):**
1. Connector calls CRM schema API to get current object structure
2. HubSpot: `GET /crm/v3/properties/{objectType}` for Deal, Contact, Company
3. Salesforce: `GET /services/data/v59.0/sobjects/{objectType}/describe/` for Opportunity, Contact, Account
4. Returns all fields with types, picklist values, required flags
5. Stores as JSON in `voice.crm_schemas` (cache, re-read on every sync)

**Dynamic Extraction:**
1. Takes the transcript(s) for an account + the CRM schema
2. Sends to Claude: "Given this conversation and this CRM structure, populate whatever fields you can confidently fill from what the rep said. Do not guess."
3. Claude returns CRM-shaped data — field names and values matching the actual CRM structure
4. Connector pushes to CRM via API

**What this eliminates:**
- No hardcoded extraction schema in our codebase
- No per-org schema customization needed
- No field mapping layer (extraction already outputs CRM-shaped data)
- No admin UI for schema management — the CRM admin IS the config

### Auth
- OAuth flow for CRM connection (one-time setup in Settings)
- Tokens stored securely in Supabase
- Auto-refresh before expiry
- On auth failure: badge on home screen, "Reconnect HubSpot" prompt

### Manual Retry
- If sync fails, session appears in history with "sync failed" status
- Rep taps to retry
- Badge count on home screen shows pending syncs

### No CRM Connected
If the rep hasn't connected a CRM, the pipeline still runs steps 1-4 (account extraction, task extraction, summary update, embeddings). The CRM connector step is skipped. The app is fully functional without CRM — accounts, tasks, and transcripts all work standalone.

---

## Mobile App Screens

### 1. Home Screen (Walkie-Talkie Pattern)
Designed for field reps doing 5-15 stops per day. The most common action is "I just left an account and need to capture what happened NOW." The home screen optimizes for this single action.

**Idle state** (session not active):
- Kosha logo/name at top (subtle, establishes identity)
- One big mic button dominating the center of the screen (primary action)
- "Type instead" link below the button (secondary, for when rep can't talk)
- Recent sessions section at bottom showing last 2-3 sessions as small cards:
  - Account name, time ago, sync status icon (✓ synced, ⚠ failed, spinner processing)
  - Tappable to view transcript
  - "See all" link to full session history
- Badge count on failed syncs
- Settings icon (top corner, subtle)

**Active state** (voice session in progress — same screen, no navigation):
- Mic button morphs into waveform indicator (in-place animation)
- "Type instead" link, recent sessions, settings icon all fade out
- Subtle status text appears: "Listening..." / "Kosha is thinking..."
- End button appears below the waveform (prominent, same position as mic button area)
- No transcript visible. Just waveform, status, and end button

**Transition — tap to start:**
1. Rep taps mic → expo-av audio capture starts immediately (< 100ms)
2. Screen transforms in place: mic → waveform, surrounding UI fades out
3. Heavier initialization happens in background while rep is already talking:
   - Deepgram WebSocket opens
   - VAD begins processing (audio is buffered locally until ready)
   - System prompt assembled with pre-loaded context
4. Rep doesn't notice the background setup — they're talking for 2-3 seconds before the pipeline needs to act

**Transition — tap to end (or auto-end):**
1. Waveform morphs back into mic button
2. Recent sessions reappear with new session card at top showing "processing..." status
3. Surrounding UI fades back in

**Why no navigation:** A screen push means unmount home → mount voice screen → initialize components. Even on native that's a visible beat of dead air. The in-place transformation means the mic is hot the instant the rep taps. The voice "screen" is just a visual state of the home tab, driven by the session store (`IDLE` = home view, `ACTIVE` = voice view).

Design principle: One primary action. No decisions. Rep opens the app, thumb goes to the same spot every time. Muscle memory by day two. Tap → recording. No loading state, no transition, no delay.

### 2. Text Conversation Screen
- Standard chat interface
- Rep's messages on one side, Kosha's on the other
- Text input at bottom
- End conversation button
- Accessed via "type instead" from home screen
- This IS a separate screen (navigation push) — text mode doesn't need instant-start since the rep is typing, not talking

### 3. Accounts Tab
- List of all accounts for this rep, sorted by most recently active
- Each card shows: account name, industry (if known), last conversation date
- Search bar at top for filtering by name
- On first use: empty state explaining "Your accounts will appear here as you have conversations"
- Accounts are NEVER manually created — they come from post-processing
- Tapping an account opens the account detail page

### 4. Account Detail Page (`app/account/[id].tsx`)
- Account name as header
- AI-generated summary (bullet points — deal stage, key contacts, recent activity, open items, next steps)
- Industry, address (if known from conversations)
- Tasks section: all open tasks linked to this account, tappable to mark complete
- Conversation history: list of all sessions tagged to this account, tappable to view transcript
- CRM sync status indicator (if CRM connected)

### 5. Session History (accessed via "see all" from home)
- Full list of past sessions
- Each shows: date/time, matched account name(s), session type (voice/text), sync status
- Tappable to view conversation transcript
- Pull-type conversations (where rep asked questions) more useful to revisit
- Push-type (debriefs) just show "synced to HubSpot"

### 6. Settings
- CRM connection (OAuth flow for HubSpot/Salesforce)
- Account management (sign out, org info)
- Notification preferences
- Recording consent status

### 7. Onboarding (First Launch)
- 3-screen tutorial: what Kosha does, how voice works, how text works
- ~30 seconds total
- Recording consent screen
- Then straight into the app

---

## Auth & Multi-tenancy

- Multiple users per organization
- Google + Microsoft sign-in via Supabase Auth (OAuth)
- Rep sees only their own sessions
- Manager sees their team's sessions (read-only, via separate web dashboard — not in mobile app)
- Supabase Row Level Security enforces access at the database level
- No SSO (Okta/Azure AD) in v1

---

## Security & Privacy

### Recording Consent
- One-time consent on first app launch during onboarding
- "Kosha records and transcribes your voice to capture meeting notes. By continuing, you agree to audio processing."
- Consent timestamp stored in Supabase

### Data Storage
- Transcripts: stored in Supabase (encrypted at rest)
- No raw audio stored. Audio is processed through Deepgram and discarded
- Vector embeddings: stored in Supabase pgvector
- CRM tokens: encrypted in Supabase vault

### Vendor Data Policies
- Opt out of data retention with Deepgram, Claude, and ElevenLabs
- Verify no training on customer data
- Document in privacy policy

### PII
- Not handled in v1. Revisit when it becomes a real issue
- Sales debriefs rarely contain SSNs or credit card numbers

---

## Offline Behavior

- If internet drops mid-conversation: fall back to local voice recording
- Agent conversation stops (no Claude or TTS without internet)
- Audio continues recording locally
- When back online: recording sent to server for batch transcription + post-processing
- Rep gets push notification: "Your notes have been processed"

---

## What v1 Does NOT Include

- Live meeting recording mode
- Pre-briefs for upcoming meetings
- Account exploration via voice commands ("tell me about Acme" → pgvector deep retrieval)
- Route/daily planning
- Multi-language support
- SSO (Okta/Azure AD)
- Raw audio storage
- Review screen before CRM sync
- Manager analytics dashboard (separate project)
- Email/Slack sharing
- Practice/sandbox mode
- PII detection/redaction
- Custom vocabulary for Deepgram
- Per-rep voice selection
- App-level echo cancellation or noise suppression

---

## Testing Strategy

### Philosophy
- TDD (RED → GREEN → REFACTOR) for the entire voice pipeline and post-processing
- Lighter smoke/snapshot tests for UI components
- Test behavior, not implementation
- Every atomic function in the pipeline must have tests proving it works in isolation
- Integration tests prove the atoms work together
- Each build phase includes its own tests — no phase is "done" without passing tests

### Testing Tools
- **Jest** — test runner (standard for React Native, better ecosystem support than Vitest for mobile)
- **React Native Testing Library** — UI component tests
- **MSW (Mock Service Worker)** — mock Deepgram, Claude, and ElevenLabs API responses
- **Supertest** — API route integration tests (Vercel endpoints)
- **jest-websocket-mock** — mock WebSocket connections (Deepgram streaming)

### What Gets Full TDD (Pipeline)

**Audio Capture Module**
- Test: mic permission check returns correct state
- Test: audio stream outputs 16kHz mono PCM format
- Test: backgrounding pauses/resumes capture correctly
- Test: Bluetooth disconnect triggers fallback to phone mic
- Test: audio buffer maintains data during brief interruptions

**VAD (Voice Activity Detection)**
- Test: detects speech start within 100ms of audio input
- Test: detects speech end after configured silence threshold (1500ms)
- Test: ignores brief pauses (< 1000ms) as mid-sentence breathing
- Test: does not trigger on background noise below threshold
- Test: returns correct speech boundary timestamps

**Deepgram Streaming Connection**
- Test: WebSocket connects with correct parameters (16kHz, mono, smart_format, etc.)
- Test: sends audio chunks to WebSocket in correct format
- Test: parses interim transcript results correctly
- Test: parses final transcript results correctly
- Test: handles WebSocket disconnect — triggers reconnection with exponential backoff
- Test: buffers audio locally during disconnect
- Test: replays buffered audio on reconnect
- Test: max 5 reconnection attempts before failing gracefully

**Transcript Buffer**
- Test: appends final transcripts in order with timestamps
- Test: includes speaker labels (rep vs. agent)
- Test: auto-saves to SQLite every 10 seconds
- Test: recovers transcript from SQLite after crash
- Test: returns full conversation history for Claude context

**Account Name Matching**
- Test: matches exact account name ("Acme Corp") from pre-loaded summaries
- Test: matches partial name ("Acme") to full account name
- Test: handles no match gracefully (returns null, no error)
- Test: handles multiple mentions (second account adds to context)
- Test: case-insensitive matching

**Claude Reasoning Engine**
- Test: constructs correct system prompt with account context injected
- Test: sends full conversation history each turn
- Test: streams plain text response tokens correctly
- Test: handles streaming — emits tokens as they arrive
- Test: handles Claude API timeout — returns error after configured threshold
- Test: handles malformed response — falls back gracefully
- Test: does NOT make tool calls (no mid-conversation data operations)

**Conversation State Machine**
- Test: starts in IDLE state
- Test: transitions IDLE → ACTIVE when mic starts
- Test: transitions ACTIVE → ENDING when rep taps end
- Test: transitions ACTIVE → ENDING on natural conversation ending detected
- Test: transitions ACTIVE → ENDING on 30-second mutual silence
- Test: transitions ENDING → COMPLETE after sign-off
- Test: only one active session allowed at a time
- Test: barge-in — stops TTS playback when VAD detects speech during agent turn
- Test: barge-in — remembers interrupted question internally
- Test: filler audio triggers when Claude response exceeds 1.5 seconds

**ElevenLabs TTS Client**
- Test: sends text to ElevenLabs streaming API
- Test: receives and queues audio chunks for playback
- Test: starts playback on first chunk (doesn't wait for full response)
- Test: stops playback immediately on barge-in signal
- Test: handles ElevenLabs timeout — triggers filler audio
- Test: handles API error — conversation continues without TTS (text fallback or silence)

**Post-Processing Pipeline (Inngest Job)**
- Test: extracts account names from transcript correctly
- Test: matches known accounts, creates placeholders for new ones
- Test: handles multi-account conversation
- Test: extracts actionable tasks with due dates
- Test: ignores vague non-actionable statements
- Test: account summary regeneration includes new information from all sessions
- Test: embedding generation stores correctly in pgvector
- Test: retry logic — retries failed steps with exponential backoff
- Test: idempotency — running same transcript twice doesn't create duplicates
- Test: pipeline works without CRM connected (skips CRM steps)

**CRM Connector (Dynamic)**
- Test: reads HubSpot schema correctly (objects, fields, types, picklists)
- Test: reads Salesforce schema correctly
- Test: normalizes both to same internal shape
- Test: dynamic extraction populates CRM fields from transcript
- Test: does not hallucinate fields without evidence in transcript
- Test: validates picklist values against schema
- Test: pushes to HubSpot API correctly
- Test: pushes to Salesforce API correctly
- Test: attaches transcript as Note/Activity
- Test: handles OAuth token refresh when token expired
- Test: handles CRM API error — marks session as "failed," queues retry
- Test: idempotency key prevents duplicate records
- Test: logs every write to crm_sync_log

### What Gets Lighter Tests (UI)

**Home Screen (idle + active states)**
- Smoke test: idle state renders mic button, "type instead" link, recent sessions
- Test: tapping mic button transforms to active state (waveform, status, end button)
- Test: active state hides recent sessions and "type instead" link
- Test: end button transforms back to idle state with new session card
- Test: status text updates based on conversation state (Listening/Thinking)
- Test: failed sync badge shows correct count
- Test: tapping failed session triggers retry

**Text Conversation Screen**
- Smoke test: renders chat bubbles, text input, end button
- Test: sending message adds rep bubble and triggers Claude response
- Test: end button triggers session end flow

**Accounts Tab**
- Smoke test: renders account list sorted by last conversation
- Test: search filters accounts by name
- Test: empty state displays when rep has zero accounts
- Test: tapping account card navigates to detail page

**Account Detail Page**
- Smoke test: renders summary, tasks, conversation history
- Test: marking task complete updates state
- Test: tapping session navigates to transcript view

**Onboarding**
- Smoke test: renders 3 tutorial screens
- Test: consent screen stores consent timestamp

### Integration Tests (End-to-End Flows)

These test the full pipeline with mocked external services:

**Voice Debrief Flow**
1. Start session → mic captures audio → VAD detects speech end
2. → Deepgram returns transcript (mocked) → transcript buffer updates
3. → Claude returns follow-up question (mocked) → TTS plays response (mocked)
4. → Rep responds → loop repeats
5. → Session ends → transcript sent to Vercel endpoint
6. → Inngest job runs (mocked) → session status updates to "synced"
Assert: Full transcript stored, structured data extracted, CRM synced

**Barge-In Flow**
1. Agent is speaking (TTS playing)
2. VAD detects rep speech
3. → TTS stops immediately → rep's speech is captured
4. → New transcript appended → Claude responds to what rep said
Assert: No audio overlap, agent's interrupted thought stored internally

**Offline Fallback Flow**
1. Session active → network drops (mocked)
2. → Deepgram WebSocket disconnects → reconnection fails
3. → App falls back to local recording
4. → Network returns → recording sent for batch processing
Assert: No data lost, session eventually processed

**Crash Recovery Flow**
1. Session active → auto-save fires at 10-second interval
2. → App crashes (simulated)
3. → App reopens → detects saved transcript in SQLite
4. → Sends to post-processing
Assert: Transcript recovered, post-processing completes

### Latency Benchmarks (Performance Tests)

Run on real device (not simulator) to measure actual latency:
- VAD speech-end detection: < 100ms
- Deepgram final transcript delivery: < 300ms from speech end
- Claude first token: < 400ms from transcript sent
- ElevenLabs first audio chunk: < 300ms from text sent
- Total end-to-end: < 900ms

Log these metrics in every test run. Alert if any component regresses beyond threshold.

### Test Data

- Factory functions for generating test transcripts, account summaries, CRM schemas
- Fixture files for mock Deepgram responses, Claude responses, ElevenLabs audio chunks
- Mock account data matching Supabase schema

---

## Build Phases

### Phase 1 (Week 1): Audio Foundation
- Mic capture module (16kHz mono PCM)
- Audio playback module
- Audio session manager (backgrounding, phone calls, Bluetooth switching)
- Foreground service for background recording
- Error handler scaffold

### Phase 2 (Week 2): Speech Processing
- Silero VAD integration
- Deepgram streaming WebSocket with reconnection logic
- Transcript buffer (in-memory + SQLite auto-save)
- Network monitor

**Demo: App records speech, VAD detects turns, live transcription works.**

### Phase 3 (Week 3): Voice Conversation Loop
- Conversation state machine (IDLE → ACTIVE → ENDING → COMPLETE)
- Claude reasoning engine with streaming
- ElevenLabs TTS with streaming playback
- Barge-in handling (stop TTS on rep speech)
- Filler audio for latency spikes
- Silence-based auto-end (30 seconds)
- Home screen voice active state (in-place waveform + status)
- Account name matching from pre-loaded context

**Demo: Full voice conversation with Kosha. Agent asks follow-up questions.**

### Phase 4 (Week 4): Text Mode + Storage
- Text conversation screen (chat UI)
- Claude text reasoning (same prompt, no audio pipeline)
- SQLite local store with crash recovery
- Supabase backend (auth, session storage)
- Home screen with voice/text buttons and session history
- Accounts tab and account detail page (browsing extracted accounts, summaries, tasks)
- Context pre-loading on app open

**Demo: Both voice and text conversations working. Sessions persisted. Accounts browsable.**

### Phase 5 (Week 5): Post-Processing Pipeline
- Server-side processing (Vercel API Route + Inngest background job)
- Transcript classification (debrief/retrieval/mixed)
- Structured data extraction via Claude
- Account matching and multi-account splitting
- Account summary generation and update
- Conflict resolution with audit logging
- pgvector embedding storage

**Demo: Conversation ends → structured data appears in Supabase.**

### Phase 6 (Week 6): Polish
- Onboarding tutorial (3 screens)
- Settings screen (CRM connection, account)
- Offline fallback (local recording → batch process)
- Recording consent flow
- Push notifications (sync complete, sync failed)
- Error messaging throughout

### Phase 7 (Week 7): Polish + Native Refinements
- Lock screen media controls (mute/end session) via MPNowPlayingInfoCenter
- Background conversation persistence (full pipeline stays active when phone locked)
- Custom fonts (Bitter via expo-font config plugin)
- Onboarding tutorial (3 screens)
- Settings screen (CRM connection, account)
- Offline fallback (local recording → batch process)
- Recording consent flow
- Push notifications (sync complete, sync failed)
- Error messaging throughout

> **Note:** Development build, expo-audio-studio (real VAD + audio streaming), haptics, and Claude SSE streaming were integrated during Phase 3 implementation. These items were originally deferred to Phase 7 due to Expo Go limitations but were pulled forward when we switched to development builds.

### Phase 8 (Week 8): QA & Launch
- Edge case testing (see risk analysis document)
- Latency measurement and optimization
- Beta testing with real reps
- App store preparation (iOS + Android)

### Phase 9 (Post-Launch): CRM Integration
- HubSpot OAuth flow and sync engine
- Salesforce OAuth flow and sync engine
- Field mapping layer
- Idempotency and retry logic
- Manual retry from session history
- Home screen badge for failed syncs

**Demo: Complete flow — converse with Kosha → auto-extract → auto-sync to HubSpot.**

---

# Engineering Architecture

Everything below is the system design. The product and design sections above define WHAT to build. This section defines HOW.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        MOBILE CLIENT                            │
│  React Native + Expo                                            │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ UI Layer │  │ Voice    │  │ State    │  │ Local Storage │  │
│  │ (Expo    │  │ Pipeline │  │ Manager  │  │ (SQLite +     │  │
│  │  Router) │  │ (lib/)   │  │ (Zustand)│  │  SecureStore) │  │
│  └──────────┘  └──────────┘  └──────────┘  └───────────────┘  │
│                      │                                          │
└──────────────────────┼──────────────────────────────────────────┘
                       │
         ┌─────────────┼─────────────┬──────────────┐
         │ WebSocket    │ HTTPS        │ HTTPS         │ Direct reads
         ▼             ▼              ▼               ▼
   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐
   │ Deepgram │  │ Claude   │  │ Eleven-  │  │   Supabase   │
   │ Nova-2   │  │ Sonnet   │  │ Labs     │  │  (Auth + DB  │
   │ (STT)    │  │ (LLM)    │  │ (TTS)    │  │  + pgvector) │
   └──────────┘  └──────────┘  └──────────┘  └──────┬───────┘
                                                      │
                       On session end:                │
                       POST /api/capture/process      │
                                │                     │
                       ┌────────▼────────┐            │
                       │  Vercel API     │            │
                       │  Route          │────────────┘
                       └────────┬────────┘    reads/writes
                                │ triggers
                       ┌────────▼────────┐
                       │  Inngest        │
                       │  Background Job │───► HubSpot / Salesforce
                       │  (8 steps)      │
                       └─────────────────┘
```

### Key Architectural Decisions

**Direct-to-vendor from mobile.** The voice pipeline (Deepgram, Claude, ElevenLabs) connects directly from the phone. No proxy server in the middle. This eliminates a network hop and shaves ~50-100ms per round trip. The trade-off is API keys on the client — mitigated by Supabase Auth gating access and short-lived tokens.

**No backend during conversation.** The only server involvement during a live conversation is the three vendor APIs. Supabase reads happen before the conversation (context pre-load). Vercel/Inngest involvement happens after. This is the core latency principle.

**Zustand over Redux/Context.** Minimal boilerplate, no providers wrapping the tree, selectors prevent unnecessary re-renders. Voice pipeline state changes rapidly (multiple times per second during audio capture) — Zustand handles this without the overhead of Context re-rendering the entire tree.

**SQLite for crash recovery, not for app state.** SQLite is write-only during conversations (auto-save every 10s). It's never read during normal operation. It's only read on app open to check for orphaned sessions that need post-processing.

---

## Data Model

### Supabase Schema

All tables in the `voice` schema. RLS policies enforce tenant isolation. The data model is intentionally minimal — the transcript is the source of truth, and only accounts and tasks are extracted as independent records because they need to be browsed and acted on.

```sql
-- Organizations
CREATE TABLE voice.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  crm_type TEXT CHECK (crm_type IN ('hubspot', 'salesforce')),
  crm_tokens JSONB DEFAULT '{}',  -- OAuth tokens (encrypted via Supabase Vault)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Users (reps and managers)
CREATE TABLE voice.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  org_id UUID NOT NULL REFERENCES voice.organizations(id),
  role TEXT NOT NULL CHECK (role IN ('rep', 'manager')),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_users_org ON voice.users(org_id);

-- Accounts (extracted from conversations, never manually created)
CREATE TABLE voice.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES voice.organizations(id),
  user_id UUID NOT NULL REFERENCES voice.users(id),
  name TEXT NOT NULL,
  industry TEXT,  -- extracted from conversations if mentioned
  address TEXT,   -- extracted from conversations if mentioned
  crm_account_id TEXT,  -- external ID in HubSpot/Salesforce
  summary TEXT NOT NULL DEFAULT '',  -- regenerated from all transcripts, bullet-point format
  last_conversation_at TIMESTAMPTZ,  -- updated on each new session tagged to this account
  last_updated TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_accounts_user ON voice.accounts(user_id);
CREATE INDEX idx_accounts_name ON voice.accounts(name);
CREATE INDEX idx_accounts_last_conversation ON voice.accounts(last_conversation_at DESC);

-- Tasks (extracted action items)
CREATE TABLE voice.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES voice.organizations(id),
  user_id UUID NOT NULL REFERENCES voice.users(id),
  account_id UUID REFERENCES voice.accounts(id),
  session_id UUID NOT NULL REFERENCES voice.sessions(id),
  description TEXT NOT NULL,
  due_date DATE,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_tasks_user ON voice.tasks(user_id);
CREATE INDEX idx_tasks_account ON voice.tasks(account_id);
CREATE INDEX idx_tasks_completed ON voice.tasks(completed);

-- Sessions (one per conversation — the transcript is the source of truth)
CREATE TABLE voice.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES voice.users(id),
  org_id UUID NOT NULL REFERENCES voice.organizations(id),
  session_type TEXT NOT NULL CHECK (session_type IN ('voice', 'text')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'processing', 'synced', 'failed')),
  transcript JSONB,  -- array of {speaker, text, timestamp} objects
  account_ids UUID[],  -- references to voice.accounts
  account_context_used JSONB,  -- snapshot of what context was injected
  duration_seconds INTEGER,
  turn_count INTEGER,
  crm_sync_status TEXT DEFAULT 'pending'
    CHECK (crm_sync_status IN ('pending', 'synced', 'failed', 'skipped')),
  processing_error TEXT,
  idempotency_key TEXT UNIQUE,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_sessions_user ON voice.sessions(user_id);
CREATE INDEX idx_sessions_status ON voice.sessions(status);
CREATE INDEX idx_sessions_accounts ON voice.sessions USING GIN (account_ids);

-- CRM schema cache (re-read on every sync)
CREATE TABLE voice.crm_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES voice.organizations(id) UNIQUE,
  crm_type TEXT NOT NULL,
  schema_json JSONB NOT NULL,  -- full CRM object/field structure
  last_synced_at TIMESTAMPTZ DEFAULT now()
);

-- CRM sync audit log
CREATE TABLE voice.crm_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES voice.sessions(id),
  org_id UUID NOT NULL REFERENCES voice.organizations(id),
  crm_type TEXT NOT NULL,
  action TEXT NOT NULL,  -- 'create', 'update', 'attach_note'
  crm_object TEXT NOT NULL,  -- 'Deal', 'Contact', 'Opportunity', etc.
  crm_record_id TEXT,
  fields_written JSONB,  -- what was pushed to CRM
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_sync_log_session ON voice.crm_sync_log(session_id);

-- Vector embeddings for future retrieval
CREATE TABLE voice.embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES voice.sessions(id),
  org_id UUID NOT NULL REFERENCES voice.organizations(id),
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_embeddings_session ON voice.embeddings(session_id);
CREATE INDEX idx_embeddings_vector ON voice.embeddings
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### Row Level Security Policies

```sql
-- Reps see only their own data
ALTER TABLE voice.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sessions_rep_policy ON voice.sessions
  FOR ALL USING (user_id = auth.uid());

-- Managers see their org's data (read-only via web dashboard)
CREATE POLICY sessions_manager_policy ON voice.sessions
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM voice.users
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Same pattern for accounts, tasks, crm_sync_log, embeddings
```

### Local Storage (SQLite — crash recovery only)

```sql
-- Single table, write-only during conversation
CREATE TABLE pending_sessions (
  session_id TEXT PRIMARY KEY,
  transcript_json TEXT NOT NULL,  -- JSON string of transcript array
  account_context_json TEXT,
  session_type TEXT NOT NULL,
  started_at TEXT NOT NULL,
  last_saved_at TEXT NOT NULL
);
```

Written to every 10 seconds. Deleted after successful POST to `/api/capture/process`. Read only on app startup to check for orphans.

---

## Module Architecture

### Directory Structure and Dependency Rules

```
field-rep-mobile/              # Expo mobile app (React Native)
├── app/                       # Expo Router screens (UI only)
│   ├── (tabs)/
│   │   ├── index.tsx          # Home screen (idle state + voice active state — no navigation)
│   │   └── accounts.tsx       # Accounts list tab
│   ├── account/
│   │   └── [id].tsx           # Account detail page
│   ├── conversation/
│   │   └── text.tsx           # Text conversation screen (separate route, navigated to)
│   ├── history/
│   │   ├── index.tsx          # Session list
│   │   └── [id].tsx           # Session detail
│   ├── settings.tsx
│   └── onboarding.tsx
│
├── lib/                       # All business logic (fully testable, no UI)
│   ├── audio/
│   │   ├── capture.ts         # Mic input → PCM stream
│   │   ├── playback.ts        # Audio chunk → speaker output
│   │   └── routing.ts         # Bluetooth, earpiece, speaker switching
│   ├── vad/
│   │   └── silero.ts          # VAD wrapper → speech start/end events
│   ├── stt/
│   │   ├── deepgram.ts        # WebSocket client, reconnection, buffering
│   │   └── transcript.ts      # Transcript buffer, auto-save to SQLite
│   ├── llm/
│   │   ├── claude.ts          # Claude streaming client
│   │   └── prompt.ts          # System prompt builder (identity + context)
│   ├── tts/
│   │   ├── elevenlabs.ts      # ElevenLabs streaming client
│   │   └── filler.ts          # Filler audio manager (triggers on latency spike)
│   ├── conversation/
│   │   ├── machine.ts         # State machine (IDLE → ACTIVE → ENDING → COMPLETE)
│   │   ├── orchestrator.ts    # Wires audio → VAD → STT → LLM → TTS together
│   │   └── barge-in.ts        # Interrupt detection and TTS cancellation
│   ├── context/
│   │   ├── preload.ts         # Fetch all account summaries on app open
│   │   ├── matcher.ts         # String match account name → inject context
│   │   └── store.ts           # In-memory account summary store
│   ├── processing/
│   │   └── submit.ts          # POST transcript to Vercel, handle response
│   ├── storage/
│   │   ├── sqlite.ts          # SQLite crash recovery read/write
│   │   ├── supabase.ts        # Supabase client singleton
│   │   └── secure.ts          # SecureStore wrapper for tokens
│   └── crm/
│       └── status.ts          # Poll/subscribe to session sync status
│
├── components/                # Shared UI components
│   ├── Waveform.tsx
│   ├── MicButton.tsx
│   ├── SessionCard.tsx
│   └── StatusBadge.tsx
│
├── stores/                    # Zustand stores
│   ├── session.ts             # Active session state
│   ├── context.ts             # Pre-loaded account summaries
│   └── app.ts                 # App-level state (auth, connectivity)
│
└── __tests__/                 # Mirrors lib/ structure
    ├── lib/
    │   ├── audio/
    │   ├── vad/
    │   ├── stt/
    │   └── ...
    └── integration/
        ├── voice-debrief.test.ts
        ├── barge-in.test.ts
        ├── offline-fallback.test.ts
        └── crash-recovery.test.ts


Server-side code (Vercel — lives in existing Kosha web app repo, NOT inside field-rep-mobile):

apps/supplier/                 # or wherever the existing Vercel app lives
├── api/
│   └── capture/
│       ├── process.ts         # POST — receive transcript, trigger Inngest
│       └── status/
│           └── [sessionId].ts # GET — check processing status
│
└── inngest/
    ├── process-debrief.ts     # Main background job (accounts, tasks, summary, embeddings)
    └── crm-connector.ts      # CRM sync agent (schema read → dynamic extraction → push)

Shared types between mobile and server live in a shared package (e.g., packages/shared/types.ts)
or are duplicated minimally — whatever the existing monorepo structure supports.
```

### Dependency Rules

These are inviolable. If a module tries to import something it shouldn't, the code review catches it.

```
Mobile app (field-rep-mobile/):
  app/ → components/, stores/, lib/ (UI can use anything)
  components/ → stores/ (components can read state)
  stores/ → lib/ (stores can call business logic)
  lib/ → lib/ (modules can depend on each other)
  lib/ → NEVER app/, NEVER components/, NEVER stores/

Server-side (existing Vercel app):
  api/ → shared types only (no mobile lib/ imports)
  inngest/ → shared types only (no mobile lib/ imports)
```

**lib/ is the core of the mobile app.** It has zero dependencies on React, React Native, or any UI framework. Every file in lib/ is a pure TypeScript module that takes inputs and returns outputs. This is what makes it fully testable with Jest alone — no React Native Testing Library needed for pipeline tests.

**Server-side code deploys separately.** The API routes and Inngest jobs run on Vercel as part of the existing Kosha web app. They share TypeScript types with the mobile app (e.g., `ConversationMessage`, `SessionMetadata`, `AccountSummary`) but have no runtime dependency on mobile code.

### Key Interfaces

```typescript
// lib/audio/capture.ts
interface AudioCapture {
  start(): Promise<void>
  stop(): Promise<void>
  onChunk(callback: (pcm: ArrayBuffer) => void): void
  getState(): 'idle' | 'capturing' | 'paused'
}

// lib/vad/silero.ts
interface VADEvents {
  onSpeechStart: () => void
  onSpeechEnd: (audio: ArrayBuffer) => void
}

// lib/stt/deepgram.ts
interface DeepgramClient {
  connect(config: DeepgramConfig): Promise<void>
  sendAudio(chunk: ArrayBuffer): void
  onTranscript(callback: (result: TranscriptResult) => void): void
  disconnect(): void
  getState(): 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
}

interface TranscriptResult {
  text: string
  is_final: boolean
  confidence: number
  timestamp: number
}

// lib/llm/claude.ts
interface ClaudeClient {
  stream(params: {
    systemPrompt: string
    messages: ConversationMessage[]
  }): AsyncIterable<ClaudeChunk>
}

interface ClaudeChunk {
  type: 'text_delta' | 'done'
  content: string
}

// lib/tts/elevenlabs.ts
interface TTSClient {
  stream(text: AsyncIterable<string>): AsyncIterable<ArrayBuffer>
  cancel(): void
  getState(): 'idle' | 'streaming' | 'cancelled'
}

// lib/conversation/machine.ts
type SessionState = 'IDLE' | 'ACTIVE' | 'ENDING' | 'COMPLETE'
type SessionEvent =
  | { type: 'START_MIC' }
  | { type: 'SPEECH_DETECTED' }
  | { type: 'REP_TAP_END' }
  | { type: 'NATURAL_END_DETECTED' }
  | { type: 'MUTUAL_SILENCE_TIMEOUT' }
  | { type: 'SIGNOFF_COMPLETE' }
  | { type: 'BARGE_IN' }

interface ConversationMachine {
  getState(): SessionState
  send(event: SessionEvent): void
  onTransition(callback: (from: SessionState, to: SessionState) => void): void
}

// lib/conversation/orchestrator.ts — the critical piece
interface Orchestrator {
  start(config: { sessionType: 'voice' | 'text' }): Promise<void>
  stop(): Promise<void>
  injectContext(summary: AccountSummary): void
  getTranscript(): ConversationMessage[]
  onStateChange(callback: (state: SessionState) => void): void
}
```

---

## Voice Pipeline Data Flow (Detailed)

### Happy Path — Single Turn

```
1. Rep speaks: "Just left the Acme meeting, went really well"
   │
2. expo-av captures PCM audio chunks (16kHz, mono, 20ms frames)
   │
3. Silero VAD processes each frame
   ├── Speech detected → mark speech start timestamp
   └── 1500ms silence detected → fire onSpeechEnd
   │
4. During speech: PCM chunks stream to Deepgram WebSocket
   │  (sent as they arrive, not batched)
   │
5. Deepgram returns interim_results (ignored by UI, used for internal tracking)
   Deepgram returns is_final result:
   │  { text: "Just left the Acme meeting, went really well",
   │    confidence: 0.97, timestamp: 1712764800 }
   │
6. Transcript buffer appends final result with speaker label "rep"
   │
7. App code runs account matcher:
   │  "Acme" matches pre-loaded summary for "Acme Corp"
   │  → injects Acme Corp summary into Claude's system prompt
   │
8. Claude receives:
   │  System prompt (identity + debrief guide + Acme context)
   │  + conversation history (just this one turn so far)
   │  → streams plain text response
   │
9. Text tokens stream directly to ElevenLabs as they arrive
   │  "Nice — what were the key takeaways from the demo?"
   │  (no parsing — tokens flow straight from Claude to TTS)
    │
10. ElevenLabs returns audio chunks
    │  First chunk arrives → expo-av starts playback immediately
    │
11. Rep hears: "Nice — what were the key takeaways from the demo?"
    │
12. Transcript buffer appends agent response with speaker label "agent"
    │
13. VAD listens for next speech start → loop back to step 1
```

### Barge-In Path

```
1. Agent audio playing (step 11-12 above in progress)
   │
2. VAD detects rep speech start
   │
3. Orchestrator fires BARGE_IN event:
   ├── TTSClient.cancel() → stops ElevenLabs stream + audio playback
   ├── Stores interrupted response text internally (for barge-in handler tracking)
   └── Switches to listening mode
   │
4. Normal flow resumes from step 4 (capturing rep's new speech)
```

### Latency Spike Path

```
1. VAD fires onSpeechEnd (rep stopped talking)
   │
2. Deepgram returns final transcript
   │
3. Claude request sent → 1.5 seconds pass with no first token
   │
4. Filler manager triggers:
   ├── Plays pre-recorded filler audio ("hmm, let me think...")
   └── Sets flag: filler_playing = true
   │
5. Claude first token arrives:
   ├── If filler still playing → wait for filler to finish (it's short)
   └── Then stream Claude response to TTS as normal
```

---

## Connection Management

### Deepgram WebSocket Lifecycle

```
Session starts:
  → Open WebSocket with auth + config params
  → State: CONNECTING → CONNECTED
  → Begin sending audio chunks

On disconnect (network drop, server error):
  → State: RECONNECTING
  → Buffer audio chunks locally (in-memory array)
  → Attempt reconnect with exponential backoff:
      Attempt 1: wait 500ms
      Attempt 2: wait 1000ms
      Attempt 3: wait 2000ms
      Attempt 4: wait 4000ms
      Attempt 5: wait 8000ms (total ~15.5 seconds)
  → On reconnect: replay buffered audio, resume normal flow
  → On max retries exceeded:
      → If session < 30 seconds old: show error, end session
      → If session > 30 seconds: fall back to local recording mode

Session ends:
  → Send close frame
  → State: DISCONNECTED
```

### Claude API Connection

```
Each turn is a new HTTPS request (not a persistent connection).
  → POST to Claude streaming API
  → Read SSE stream for tokens
  → On timeout (10 seconds with no first token):
      → Trigger filler audio
      → Continue waiting up to 30 seconds total
      → On 30-second timeout: return fallback response
         "Sorry, I missed that — could you say that again?"
  → On 4xx error: log, return fallback response
  → On 5xx error: retry once after 1 second, then fallback
```

### ElevenLabs Connection

```
Per-turn WebSocket (open on each agent response, close when done):
  → Open WebSocket with voice_id + model_id
  → Stream text tokens as they arrive from Claude
  → Receive audio chunks → queue for playback
  → On disconnect mid-stream:
      → Play whatever audio was received (partial response is better than silence)
      → Log error, don't retry (agent will respond next turn anyway)
  → Close WebSocket when Claude's response is fully sent
```

### Supabase Connection

```
Singleton client initialized on app open.
  → Auth: Supabase Auth with Google/Microsoft OAuth tokens
  → Token refresh: automatic via Supabase SDK (before expiry)
  → Connection pooling: handled by Supabase SDK
  → All reads during app lifecycle use this single client
  → On auth failure: redirect to login screen
```

---

## Error Handling Strategy

### Error Taxonomy

```
RECOVERABLE (retry automatically):
  ├── Network timeout (Deepgram, Claude, ElevenLabs)
  ├── WebSocket disconnect
  ├── Supabase read timeout
  ├── CRM API rate limit (429)
  └── Inngest step failure

DEGRADED (continue with reduced functionality):
  ├── Claude timeout → filler audio + fallback response
  ├── ElevenLabs failure → text-only response (show on screen)
  ├── Network loss mid-conversation → local recording mode
  ├── Account match failure → continue without context
  └── Deepgram reconnect exceeded → local recording mode

FATAL (end session, save what we have):
  ├── Mic permission denied
  ├── Audio hardware failure
  ├── Auth token expired and refresh failed
  ├── App memory pressure (OS killing the app)
  └── Supabase write failure on session save (retry 3x, then save to SQLite)

SILENT (log, don't show to rep):
  ├── Confidence score low on transcript
  ├── Internal_notes parse failure
  ├── Embedding generation failure
  └── Analytics event drop
```

### Error Boundaries in React Native

```
App Level: catches any unhandled exception
  → Saves current session to SQLite
  → Shows "Something went wrong" screen
  → "Tap to restart" button

Conversation Level: wraps voice/text conversation screens
  → On error during active session:
    → Saves transcript to SQLite
    → Ends session gracefully
    → Shows "Your notes were saved" message
    → Returns to home screen

Component Level: individual components handle their own errors
  → Waveform animation fails → show static mic icon
  → Session card fails to load → show placeholder
```

---

## Security Architecture

### API Key Management

```
Problem: Mobile app connects directly to Deepgram, Claude, ElevenLabs.
  API keys can't be hardcoded in the app bundle.

Solution: Token vending via Supabase Edge Function (lightweight, one exception to "no edge functions" rule)
  → On session start, app requests short-lived tokens
  → Edge function validates Supabase auth, returns scoped tokens
  → Tokens expire after 10 minutes (longer than any session)
  → Tokens stored in memory only, never persisted

Alternative (simpler, evaluate first): Supabase Vault stores API keys,
  app reads them via authenticated Supabase query with RLS.
  → Simpler but keys have longer lifetime
  → Acceptable for v1 if token vending adds too much complexity
```

### Auth Flow

```
1. App opens → check SecureStore for Supabase session token
2. If valid → proceed to home screen, pre-load context
3. If expired → attempt silent refresh via Supabase SDK
4. If refresh fails → redirect to login screen
5. Login: Google or Microsoft OAuth via Supabase Auth
6. On success: store session in SecureStore, proceed to home
7. Session tokens auto-refresh (Supabase SDK handles this)
```

### Data in Transit

```
All connections use TLS 1.2+:
  → Deepgram WebSocket: wss://
  → Claude API: https://
  → ElevenLabs WebSocket: wss://
  → Supabase: https:// (PostgREST) + wss:// (Realtime, if used)
  → Vercel API routes: https://

No sensitive data in URL parameters.
No PII logging in production (transcript content is logged to Supabase only, not to console or external logging).
```

---

## Memory Management

### During Active Conversation

```
Audio buffer (Deepgram reconnection): max 15 seconds of PCM
  → 16,000 samples/sec × 2 bytes × 15 sec = ~480KB
  → Flushed on successful reconnect or session end

Transcript buffer: grows with conversation
  → ~100-200 tokens per turn × ~15 turns = ~3,000 tokens ≈ ~12KB
  → Negligible

Account summaries (pre-loaded): ~50 accounts × ~400 bytes = ~20KB
  → Loaded once on app open, held in Zustand store

Claude response buffer: one response at a time
  → Max ~500 tokens ≈ ~2KB, flushed each turn

TTS audio queue: ~2-3 seconds of audio buffered ahead
  → ~2 sec × 24,000 bytes/sec (MP3) ≈ ~48KB
  → Flushed on barge-in or turn end

Total active memory overhead: < 1MB
  → No memory pressure concerns on modern phones
```

### Cleanup

```
On session end:
  → Audio buffer cleared
  → TTS queue flushed
  → Transcript sent to server, local copy cleared
  → SQLite pending session row deleted

On app background (> 5 min):
  → Same as session end
  → Supabase connection held (SDK manages keepalive)

On app kill:
  → SQLite persists (checked on next app open)
  → Everything else in memory is lost (expected)
```

---

## Vercel API Routes

### POST /api/capture/process
Receives completed session from mobile app.
```
Input:  { transcript, sessionMetadata, accountContext }
Action: Save to Supabase (voice.sessions), trigger Inngest job "process-debrief"
Response: { status: "processing", sessionId }
```
On Supabase write failure: return 500.
On Inngest trigger failure: still return 200 (session is saved, can re-trigger manually).

### GET /api/capture/status/:sessionId
Polling endpoint for mobile app to check processing progress.
```
Response: { status: "processing" | "synced" | "failed", crm_sync_status }
Returns 404 if session not found.
```

### Inngest Job: process-debrief
Background job triggered by the process route. Each step is independently retryable.
```
Step 1: Extract accounts from transcript (Claude API)
Step 2: Extract tasks from transcript (Claude API)
Step 3: Update account summaries (Claude API + Supabase)
Step 4: Generate embeddings (embedding API + pgvector)
Step 5: CRM connector — if CRM connected (schema read → dynamic extraction → push)
Step 6: Update session status ('synced' or 'failed')

Retry policy: 5 attempts, exponential backoff per step
Timeout: 120 seconds per step
```

Existing Vercel routes for the Kosha web app stay as-is. New routes are additive.

---

## Observability

### What to Log (structured JSON, shipped to a logging service)

```
PER-SESSION:
  session_id, user_id, org_id, session_type,
  started_at, ended_at, duration_seconds, turn_count

PER-TURN:
  session_id, turn_index,
  vad_latency_ms, stt_latency_ms, llm_first_token_ms,
  tts_first_chunk_ms, total_latency_ms,
  transcript_confidence, filler_triggered (bool),
  barge_in (bool)

PER-ERROR:
  session_id, error_type, error_message, component,
  recoverable (bool), action_taken

PER-PROCESSING:
  session_id, step_name, duration_ms, retry_count,
  extracted_field_count, accounts_matched,
  crm_sync_status
```

### Alerts (v1 — simple thresholds)

```
- Average latency > 1.5 seconds over 5-minute window
- Error rate > 5% of turns in 5-minute window
- Inngest job failure rate > 10% over 1-hour window
- CRM sync backlog > 20 sessions
```

### Latency Tracking

Every voice turn logs a latency breakdown. These are stored in Supabase and aggregated for dashboards. The five numbers that matter:

```
VAD → STT → LLM → TTS → Playback = Total
Target: 100 + 200 + 300 + 200 + 100 = 900ms
```

If any component consistently exceeds its budget, it shows up in the per-turn logs before users notice.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native + Expo |
| Navigation | Expo Router (file-based) |
| Auth | Supabase Auth (Google + Microsoft OAuth) |
| Session Storage | SecureStore (persists across restarts) |
| Database | Supabase PostgreSQL (existing) |
| Vector Store | Supabase pgvector |
| Local Storage | SQLite (crash recovery) |
| STT | Deepgram Nova-2 (WebSocket streaming) |
| LLM | Claude Sonnet (streaming API) |
| TTS | ElevenLabs Turbo v2.5 (streaming) |
| VAD | @ricky0123/vad (Silero, client-side) |
| Audio | expo-av |
| API Routes | Vercel (existing deployment) |
| Background Jobs | Inngest (integrates with Vercel) |
| CRM | HubSpot v3 API + Salesforce REST API |
| Web App | Existing Vercel deployment (unchanged) |

---

## Analytics & Manager View

Separate web app (Next.js + Supabase), not part of the mobile app. Manager can browse team's captured data, extracted fields, and session history. Basic metrics: session count per rep, capture frequency, common themes. Build after mobile app is working.

---

## Future Features (architecture supports, not in v1)

- Live meeting recording (third input mode)
- Pre-briefs for upcoming meetings (calendar context + account summaries)
- Account exploration via voice commands ("tell me about Acme" → pgvector deep retrieval)
- Route/daily planning (territory + calendar context)
- Multi-language support
- Manager analytics dashboard (separate web app)
- CRM connector tuning UI (field priority, extraction rules)
- SSO (Okta/Azure AD)
- Email/Slack sharing of debrief summaries
- Practice/sandbox mode

---

## Design Decisions Log

Key conflicts between Claude Code's initial plan and our spec, and how they were resolved. These are final — don't revisit unless the product direction changes.

**No review/summary screen.** Claude Code suggested showing a summary card with extracted data for the rep to confirm before saving. Decision: no review screen. Rep's job is to capture. Session ends, data goes straight to post-processing. No confirmation step.

**Minimal tabs, not four-tab layout.** Claude Code suggested four tabs: Voice, Routes, Accounts, Tasks. Decision: Home tab (walkie-talkie mic) + Accounts tab only. No routes tab, no tasks tab in v1. Those stay on the web app.

**No mid-conversation tool calls.** Claude Code suggested Claude making tool calls during conversation (save notes, create tasks, set active account). Decision: zero data operations during conversation. All intelligence is in post-processing. This keeps latency minimal.

**No agent modes.** Claude Code suggested four explicit modes (Debrief, Note, Prep, General). Decision: one unified conversation. Agent responds to whatever the rep says. Post-processing classifies what it was about.

**No live transcript bubbles on voice screen.** Claude Code suggested showing live transcript. Decision: waveform + status text only. Keeps the rep focused on talking, reduces rendering work.

**Silent start, no beep.** Claude Code suggested a beep to confirm mic is live. Decision: silent start. If rep doesn't speak for 5 seconds, Kosha says a brief greeting. One time only.

**No account selection UI.** Claude Code suggested an account badge at top with auto-detect or manual pick. Decision: no selection UI. Agent auto-detects from conversation via pre-loaded summaries. No badge on the voice screen.

---

---

# Implementation Plan

Ordered task list for building with Claude Code. Each task is one module with its tests. Complete them in order — each task lists its dependencies.

**Rules for every task:**
- Read CLAUDE.md before writing any code
- Read the relevant section of this document for context
- TDD for all lib/ modules: write the test file first, watch it fail, then implement
- Lighter tests for UI: implement first, then add smoke/snapshot tests
- Every task ends with `npm test` passing
- Don't touch files from other tasks unless the interface contract requires it

---

## Phase 0: Project Scaffold

### Task 0.1 — Project Init
**Depends on:** Nothing
**Creates:** Project skeleton, config files, dependency installs

```
Initialize a new React Native + Expo project called field-rep-mobile using Expo Router.
Install all dependencies we'll need:

Core: expo, expo-router, expo-av, react-native, react
State: zustand
Storage: expo-sqlite, expo-secure-store
Networking: @supabase/supabase-js
Testing: jest, @testing-library/react-native, msw, jest-websocket-mock, supertest

Create the folder structure (empty files are fine, just the skeleton):
  app/ (Expo Router screens)
  lib/audio/, lib/vad/, lib/stt/, lib/llm/, lib/tts/
  lib/conversation/, lib/context/, lib/processing/, lib/storage/, lib/crm/
  components/, stores/, __tests__/ (mirrors lib/)

Note: api/ and inngest/ directories are server-side code that lives in
the existing Kosha Vercel app (apps/supplier), NOT in this Expo project.
Those get created in Phase 5 in the server repo.

Configure Jest for React Native. Configure TypeScript with strict mode.
Add a dummy test that passes to verify the test runner works.
Read CLAUDE.md for code style: no semicolons, single quotes, functional patterns.
```

### Task 0.2 — Zustand Stores (Shells)
**Depends on:** 0.1
**Creates:** `stores/session.ts`, `stores/context.ts`, `stores/app.ts`

```
Create three Zustand stores with their types but minimal logic.
Read this document's sections: "State Management" and "Module Architecture".

stores/session.ts:
  - activeSessionId: string | null
  - sessionState: 'IDLE' | 'ACTIVE' | 'ENDING' | 'COMPLETE'
  - sessionType: 'voice' | 'text' | null
  - transcript: ConversationMessage[] (array of {speaker, text, timestamp})
  - actions: startSession, endSession, addMessage, setSessionState

stores/context.ts:
  - accountSummaries: AccountSummary[] (array loaded on app open)
  - matchedAccount: AccountSummary | null
  - actions: loadSummaries, matchAccount, clearMatch

stores/app.ts:
  - isAuthenticated: boolean
  - isOnline: boolean
  - userId: string | null
  - orgId: string | null
  - actions: setAuth, setConnectivity

Define all TypeScript types in a shared types file (lib/types.ts).
Write basic tests: stores initialize with correct defaults, actions update state.
```

---

## Phase 1: Audio Foundation

### Task 1.1 — Audio Capture Module
**Depends on:** 0.1
**Creates:** `lib/audio/capture.ts`, `__tests__/lib/audio/capture.test.ts`

```
Build the audio capture module using expo-av. TDD — write tests first.
Read this document's section: "Audio Pipeline > Mic Capture".

Interface:
  start(): Promise<void>  — request mic permission, begin recording
  stop(): Promise<void>   — stop recording, clean up
  pause(): void           — pause capture (phone call interruption)
  resume(): void          — resume capture
  onChunk(callback: (pcm: ArrayBuffer) => void): void
  getState(): 'idle' | 'capturing' | 'paused' | 'error'

Requirements:
  - 16kHz sample rate, mono channel, PCM format
  - Emits audio chunks via callback (~20ms frames)
  - Handles mic permission denied gracefully (state → 'error')
  - Handles audio source switching (Bluetooth drop) silently
  - Pause/resume for phone call interruptions

Tests (write these FIRST, then implement):
  - mic permission check returns correct state
  - audio stream outputs correct format config
  - pause() changes state to 'paused', resume() back to 'capturing'
  - stop() cleans up recording and resets state to 'idle'
  - onChunk callback receives data when capturing
  - getState() reflects current state accurately

This is a lib/ module — no React imports, no UI. Pure TypeScript.
Mock expo-av in tests.
```

### Task 1.2 — Audio Playback Module
**Depends on:** 0.1
**Creates:** `lib/audio/playback.ts`, `__tests__/lib/audio/playback.test.ts`

```
Build the audio playback module using expo-av. TDD — write tests first.
Read this document's sections: "Audio Pipeline" and "Audio Ducking".

Interface:
  play(chunk: ArrayBuffer): Promise<void>  — queue and play audio chunk
  stop(): void                             — immediately stop all playback (barge-in)
  queueChunk(chunk: ArrayBuffer): void     — add to playback queue
  isPlaying(): boolean
  onFinished(callback: () => void): void   — fires when queue is drained

Requirements:
  - Accepts audio chunks from ElevenLabs TTS (MP3 or PCM)
  - Queues chunks and plays them seamlessly (no gaps between chunks)
  - stop() immediately halts playback and clears queue (for barge-in)
  - Supports streaming: start playing first chunk while more arrive
  - onFinished fires only when all queued audio has played

Tests (write these FIRST):
  - queueChunk adds to internal queue
  - play starts playback
  - stop() clears queue and stops immediately
  - isPlaying() reflects current state
  - onFinished callback fires after queue drains
  - stop() during playback: isPlaying() returns false immediately

Pure TypeScript, mock expo-av in tests.
```

### Task 1.3 — Audio Routing
**Depends on:** 0.1
**Creates:** `lib/audio/routing.ts`, `__tests__/lib/audio/routing.test.ts`

```
Build the audio routing module. TDD.
Read this document's section: "Audio Pipeline > Audio Routing".

Interface:
  getCurrentRoute(): AudioRoute  — 'speaker' | 'earpiece' | 'bluetooth' | 'wired'
  onRouteChange(callback: (route: AudioRoute) => void): void
  cleanup(): void

Requirements:
  - Detects current audio output route
  - Fires callback when route changes (Bluetooth disconnect, headphone plug/unplug)
  - No notification to user — just fires event so capture/playback can adapt
  - Cleanup removes listeners

Tests:
  - returns current route
  - fires callback on simulated route change
  - cleanup removes listener
  - handles rapid route changes without crashing

Pure TypeScript, mock expo-av audio session APIs.
```

---

## Phase 2: Speech Processing

### Task 2.1 — Silero VAD Integration
**Depends on:** 1.1
**Creates:** `lib/vad/silero.ts`, `__tests__/lib/vad/silero.test.ts`

```
Build the VAD wrapper around @ricky0123/vad (Silero). TDD.
Read this document's sections: "Conversation Flow > Turn-Taking" and "Testing Strategy > VAD".

Interface:
  start(audioStream: (callback: (pcm: ArrayBuffer) => void) => void): void
  stop(): void
  onSpeechStart(callback: () => void): void
  onSpeechEnd(callback: (audio: ArrayBuffer) => void): void
  setSilenceThreshold(ms: number): void  — default 1500ms

Requirements:
  - Processes PCM audio frames from capture module
  - Fires onSpeechStart when voice is detected
  - Fires onSpeechEnd after configured silence threshold (1500ms default)
  - Ignores brief pauses (< 1000ms) as mid-sentence breathing
  - Does not trigger on background noise below threshold
  - Returns speech boundary timestamps

Tests (write FIRST):
  - detects speech start within 100ms of audio input
  - detects speech end after configured silence threshold (1500ms)
  - ignores brief pauses (< 1000ms) as mid-sentence breathing
  - does not trigger on background noise below threshold
  - returns correct speech boundary timestamps
  - setSilenceThreshold changes the detection window

Mock @ricky0123/vad in tests. Pure TypeScript.
```

### Task 2.2 — Deepgram WebSocket Client
**Depends on:** 0.1
**Creates:** `lib/stt/deepgram.ts`, `__tests__/lib/stt/deepgram.test.ts`

```
Build the Deepgram streaming STT client. TDD.
Read this document's sections: "Speech-to-Text" and "Connection Management > Deepgram".

Interface:
  connect(config: DeepgramConfig): Promise<void>
  sendAudio(chunk: ArrayBuffer): void
  onTranscript(callback: (result: TranscriptResult) => void): void
  disconnect(): void
  getState(): 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

DeepgramConfig: { apiKey, model: 'nova-2', sampleRate: 16000, encoding: 'linear16',
  channels: 1, smartFormat: true, punctuate: true, utterances: true,
  endpointing: 1500, interimResults: true }

TranscriptResult: { text, isFinal, confidence, timestamp }

Requirements:
  - Opens WebSocket with auth and config params
  - Sends PCM audio chunks as binary frames
  - Parses interim and final transcript results
  - On disconnect: reconnect with exponential backoff (500ms, 1s, 2s, 4s, 8s — 5 attempts)
  - Buffers audio locally during disconnect, replays on reconnect
  - After max retries: state → 'disconnected', emit error event
  - disconnect() sends close frame and cleans up

Tests (write FIRST, use jest-websocket-mock):
  - connects with correct parameters
  - sends audio chunks in correct format
  - parses interim transcript results
  - parses final transcript results
  - handles disconnect → reconnects with exponential backoff
  - buffers audio during disconnect
  - replays buffered audio on reconnect
  - max 5 reconnection attempts before giving up
  - disconnect() cleans up properly
```

### Task 2.3 — Transcript Buffer
**Depends on:** 0.2 (types), 2.2
**Creates:** `lib/stt/transcript.ts`, `__tests__/lib/stt/transcript.test.ts`

```
Build the transcript buffer that accumulates the conversation. TDD.
Read this document's section: "Testing Strategy > Transcript Buffer".

Interface:
  append(entry: { speaker: 'rep' | 'agent', text: string }): void
  getHistory(): ConversationMessage[]
  getFormattedForClaude(): string  — returns transcript as formatted string for system prompt
  clear(): void
  toJSON(): string  — for SQLite serialization

ConversationMessage: { speaker, text, timestamp }

Requirements:
  - Appends messages with automatic timestamps
  - Maintains order
  - getFormattedForClaude() returns a string like:
    "Rep: Just left the Acme meeting\nKosha: How'd it go?\nRep: Really well..."
  - toJSON() serializes for SQLite storage
  - clear() resets buffer

Tests (write FIRST):
  - appends entries in order with timestamps
  - includes speaker labels
  - getFormattedForClaude returns correctly formatted string
  - toJSON and fromJSON round-trip correctly
  - clear resets to empty
  - returns full history via getHistory()
```

### Task 2.4 — SQLite Crash Recovery
**Depends on:** 2.3
**Creates:** `lib/storage/sqlite.ts`, `__tests__/lib/storage/sqlite.test.ts`

```
Build the SQLite crash recovery module. TDD.
Read this document's sections: "Crash Recovery" and "Data Model > Local Storage".

Interface:
  initDB(): Promise<void>
  saveSession(session: PendingSession): Promise<void>
  getOrphanedSessions(): Promise<PendingSession[]>
  deleteSession(sessionId: string): Promise<void>

PendingSession: { sessionId, transcriptJson, accountContextJson, sessionType, startedAt, lastSavedAt }

Requirements:
  - Creates pending_sessions table if not exists
  - saveSession upserts (insert or update by sessionId)
  - getOrphanedSessions returns all rows (called on app startup)
  - deleteSession removes after successful server submission
  - All operations are async

Tests (write FIRST):
  - initDB creates table
  - saveSession inserts new session
  - saveSession updates existing session (upsert)
  - getOrphanedSessions returns saved sessions
  - deleteSession removes the row
  - recovers transcript from SQLite correctly

Mock expo-sqlite in tests.
```

### Task 2.5 — Auto-Save Timer
**Depends on:** 2.3, 2.4
**Creates:** `lib/storage/autosave.ts`, `__tests__/lib/storage/autosave.test.ts`

```
Build the auto-save timer that writes transcript to SQLite every 10 seconds. TDD.

Interface:
  start(sessionId: string, getTranscript: () => string, getContext: () => string | null): void
  stop(): void
  isRunning(): boolean

Requirements:
  - Calls saveSession every 10 seconds with current transcript
  - stop() clears the interval and does one final save
  - Does not save if transcript hasn't changed since last save (skip unnecessary writes)
  - Handles errors silently (log, don't crash)

Tests (write FIRST, use jest.useFakeTimers):
  - starts saving on 10-second interval
  - calls saveSession with current transcript
  - stop() clears interval and does final save
  - skips save if transcript unchanged
  - handles save errors without crashing
```

### Task 2.6 — Network Monitor
**Depends on:** 0.2
**Creates:** `lib/storage/network.ts`, `__tests__/lib/storage/network.test.ts`

```
Build a simple network connectivity monitor. TDD.

Interface:
  startMonitoring(): void
  stopMonitoring(): void
  isOnline(): boolean
  onStatusChange(callback: (online: boolean) => void): void

Requirements:
  - Uses React Native NetInfo or equivalent to detect connectivity
  - Updates app store (stores/app.ts) isOnline flag
  - Fires callback on status change
  - Used by other modules to decide fallback behavior

Tests:
  - returns current connectivity state
  - fires callback on change
  - updates store correctly
  - cleanup on stopMonitoring
```

---

## Phase 3: Voice Conversation Loop

### Task 3.1 — Claude Streaming Client
**Depends on:** 0.1
**Creates:** `lib/llm/claude.ts`, `__tests__/lib/llm/claude.test.ts`

```
Build the Claude streaming API client. TDD.
Read this document's sections: "Language Model" and "Connection Management > Claude".

Interface:
  stream(params: { systemPrompt: string, messages: ConversationMessage[] }): AsyncIterable<ClaudeChunk>

ClaudeChunk: { type: 'text_delta' | 'done', content: string }

Requirements:
  - Makes streaming POST to Claude API (Anthropic SDK or raw fetch with SSE)
  - Yields text deltas as they arrive (async iterable)
  - Uses Claude Sonnet model, temperature 0.3
  - On timeout (10 seconds with no first token): yield error chunk
  - On 5xx: retry once after 1 second, then yield error chunk
  - On 4xx: yield error chunk immediately (don't retry)

Tests (write FIRST, use MSW to mock Claude API):
  - streams tokens correctly from mocked SSE response
  - handles timeout — yields error after 10 seconds
  - retries on 5xx once, then errors
  - does not retry on 4xx
  - yields 'done' chunk when stream completes
  - sends correct model, temperature, and message format
```

### Task 3.2 — System Prompt Builder
**Depends on:** 0.2 (types)
**Creates:** `lib/llm/prompt.ts`, `__tests__/lib/llm/prompt.test.ts`

```
Build the system prompt builder. TDD.
Read this document's sections: "Identity", "Language Model > System Prompt Structure", and "Guardrails".

Interface:
  buildSystemPrompt(params: {
    accountContext?: AccountSummary
    conversationHistory: string
  }): string

Requirements:
  - Assembles the full system prompt from parts:
    1. Agent identity and behavior rules (hardcoded in this module)
    2. Response style instructions
    3. Sales debrief guide (what good notes cover: people, numbers, decisions,
       next steps, blockers — NOT a rigid schema, just guidance)
    4. Account context (injected if matched, omitted if not)
    5. Conversation history reference
  - Identity: name is Kosha, warm casual colleague, short responses in pull mode, slightly longer in push mode
  - Guardrails baked in: no promises, no invented info, no strategic advice, stay in role
  - No extraction schema — the agent doesn't need to know about CRM fields
  - Returns a single string

Tests (write FIRST):
  - includes agent identity section
  - includes debrief guide
  - includes account context when provided
  - omits account context when null
  - includes guardrails
  - does NOT include any CRM-specific field names
  - output is a string under 4000 tokens for typical inputs
```

### Task 3.3 — ElevenLabs TTS Client
**Depends on:** 0.1
**Creates:** `lib/tts/elevenlabs.ts`, `__tests__/lib/tts/elevenlabs.test.ts`

```
Build the ElevenLabs streaming TTS client. TDD.
Read this document's sections: "Text-to-Speech" and "Connection Management > ElevenLabs".

Interface:
  stream(textStream: AsyncIterable<string>): AsyncIterable<ArrayBuffer>
  cancel(): void
  getState(): 'idle' | 'streaming' | 'cancelled'

Requirements:
  - Opens WebSocket to ElevenLabs streaming API per response
  - Streams text tokens as they arrive from Claude (doesn't wait for full text)
  - Yields audio chunks as they arrive from ElevenLabs
  - cancel() stops stream immediately and closes WebSocket (for barge-in)
  - On disconnect mid-stream: yield whatever was received, don't retry
  - Close WebSocket when text stream is done and all audio received

Tests (write FIRST, use jest-websocket-mock):
  - streams text to ElevenLabs WebSocket
  - yields audio chunks as they arrive
  - cancel() stops stream and closes connection
  - getState reflects current state
  - handles disconnect gracefully — yields partial audio
  - closes WebSocket after full response
```

### Task 3.4 — Filler Audio Manager
**Depends on:** 1.2
**Creates:** `lib/tts/filler.ts`, `__tests__/lib/tts/filler.test.ts`

```
Build the filler audio manager. TDD.
Read this document's section: "Text-to-Speech > Filler Audio".

Interface:
  startTimer(onTrigger: () => void): void  — starts 1.5s countdown
  cancelTimer(): void  — Claude responded in time, no filler needed
  getFillerAudio(): ArrayBuffer  — returns a random pre-recorded filler sound
  isPlaying(): boolean

Requirements:
  - On conversation turn: orchestrator starts the timer
  - If Claude first token arrives before 1.5s: cancelTimer(), no filler
  - If 1.5s passes: fire onTrigger → orchestrator plays filler audio
  - Filler plays once. If Claude still not ready after filler, wait in silence
  - Pre-load filler audio files on app start (small MP3s)
  - Rotate between 2-3 filler sounds randomly

Tests (write FIRST, use jest.useFakeTimers):
  - timer fires callback after 1500ms
  - cancelTimer prevents callback
  - getFillerAudio returns audio data
  - multiple calls return different fillers (rotation)
  - isPlaying reflects state
```

### Task 3.5 — Barge-In Handler
**Depends on:** 1.2, 2.1
**Creates:** `lib/conversation/barge-in.ts`, `__tests__/lib/conversation/barge-in.test.ts`

```
Build the barge-in handler. TDD.
Read this document's section: "Conversation Flow > Barge-In".

Interface:
  setup(params: {
    vad: VADEvents,
    ttsClient: TTSClient,
    playback: AudioPlayback,
    onBargeIn: (interruptedText: string) => void
  }): void
  getLastInterruptedText(): string | null
  cleanup(): void

Requirements:
  - Listens for VAD speech start events
  - If TTS is currently playing when speech detected:
    → Stop TTS stream (ttsClient.cancel())
    → Stop audio playback (playback.stop())
    → Store what the agent was saying as interrupted text
    → Fire onBargeIn callback
  - If TTS is NOT playing: do nothing (normal rep speech)
  - Never says "as I was saying" — the interrupted text is only for internal tracking

Tests (write FIRST):
  - detects barge-in when TTS is playing and VAD fires speech start
  - stops TTS and playback immediately
  - stores interrupted text
  - fires onBargeIn callback
  - does nothing when TTS is not playing
  - getLastInterruptedText returns correct value
  - cleanup removes listeners
```

### Task 3.6 — Conversation State Machine
**Depends on:** 0.2 (types)
**Creates:** `lib/conversation/machine.ts`, `__tests__/lib/conversation/machine.test.ts`

```
Build the conversation state machine. TDD.
Read this document's sections: "State Management > Session Lifecycle" and "Testing Strategy > Conversation State Machine".

Interface:
  createMachine(): ConversationMachine

  ConversationMachine:
    getState(): SessionState
    send(event: SessionEvent): void
    onTransition(callback: (from: SessionState, to: SessionState) => void): void
    reset(): void

  SessionState: 'IDLE' | 'ACTIVE' | 'ENDING' | 'COMPLETE'
  SessionEvent:
    | { type: 'START_MIC' }
    | { type: 'SPEECH_DETECTED' }
    | { type: 'REP_TAP_END' }
    | { type: 'NATURAL_END_DETECTED' }
    | { type: 'MUTUAL_SILENCE_TIMEOUT' }
    | { type: 'SIGNOFF_COMPLETE' }
    | { type: 'BARGE_IN' }

Valid transitions:
  IDLE → ACTIVE (on START_MIC)
  ACTIVE → ENDING (on REP_TAP_END, NATURAL_END_DETECTED, MUTUAL_SILENCE_TIMEOUT)
  ENDING → COMPLETE (on SIGNOFF_COMPLETE)
  COMPLETE → IDLE (on reset)
  Invalid events for current state are ignored (logged, not thrown)

Tests (write FIRST):
  - starts in IDLE
  - IDLE → ACTIVE on START_MIC
  - ACTIVE → ENDING on REP_TAP_END
  - ACTIVE → ENDING on NATURAL_END_DETECTED
  - ACTIVE → ENDING on MUTUAL_SILENCE_TIMEOUT
  - ENDING → COMPLETE on SIGNOFF_COMPLETE
  - invalid transitions are ignored (IDLE + REP_TAP_END = still IDLE)
  - onTransition fires with correct from/to states
  - reset returns to IDLE
  - only one session at a time (send START_MIC while ACTIVE = ignored)
```

### Task 3.7 — Account Name Matcher
**Depends on:** 0.2 (stores/context.ts)
**Creates:** `lib/context/matcher.ts`, `__tests__/lib/context/matcher.test.ts`

```
Build the account name matcher. TDD.
Read this document's section: "Architecture > Layer 1" and "Testing Strategy > Account Name Matching".

Interface:
  matchAccount(transcript: string, summaries: AccountSummary[]): AccountSummary | null

Requirements:
  - Simple string matching — check if any account name appears in the transcript text
  - Case-insensitive
  - Matches partial names ("Acme" matches "Acme Corp")
  - Returns the first match (or null if no match)
  - No API calls — pure function, works entirely on pre-loaded data
  - If called with new transcript that mentions a second account, return the new match

Tests (write FIRST):
  - matches exact account name
  - matches partial name ("Acme" → "Acme Corp")
  - case-insensitive matching
  - returns null when no match
  - handles multiple accounts — returns first match
  - handles empty transcript
  - handles empty summaries array
```

### Task 3.8 — Context Pre-Loader
**Depends on:** 0.2 (stores), 2.4 (supabase client reference)
**Creates:** `lib/context/preload.ts`, `__tests__/lib/context/preload.test.ts`

```
Build the context pre-loader that fetches account summaries on app open. TDD.
Read this document's section: "Architecture > Layer 1 > Context".

Interface:
  preloadContext(userId: string): Promise<AccountSummary[]>

Requirements:
  - Fetches all account summaries for this user from Supabase
  - Returns array of AccountSummary objects
  - Called once on app open, result stored in Zustand context store
  - Handles network error gracefully (returns empty array, app works without context)
  - Handles empty result (new user, no accounts yet)

Tests (write FIRST, use MSW to mock Supabase):
  - fetches summaries for user
  - returns correctly shaped AccountSummary objects
  - handles network error — returns empty array
  - handles empty result — returns empty array
  - handles large result (50 accounts)
```

### Task 3.9 — Orchestrator
**Depends on:** 1.1, 1.2, 2.1, 2.2, 2.3, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8
**Creates:** `lib/conversation/orchestrator.ts`, `__tests__/lib/conversation/orchestrator.test.ts`

```
Build the orchestrator that wires the entire voice pipeline together. TDD.
Read this document's section: "Voice Pipeline Data Flow" and the full Module Architecture.

This is the most critical module. It connects:
  Audio Capture → VAD → Deepgram → Transcript Buffer → Account Matcher →
  System Prompt Builder → Claude → ElevenLabs → Audio Playback
  (no parser — Claude's plain text streams directly to TTS)

Interface:
  createOrchestrator(deps: OrchestratorDeps): Orchestrator

  OrchestratorDeps: all the module instances (capture, vad, deepgram, claude, tts, playback, etc.)

  Orchestrator:
    start(sessionType: 'voice'): Promise<void>
    stop(): Promise<void>
    injectContext(summary: AccountSummary): void
    getTranscript(): ConversationMessage[]
    onStateChange(callback: (state: SessionState) => void): void

Requirements:
  - start() initializes all modules, opens connections, starts capture
  - Wires VAD → when speech ends, send to Deepgram, wait for final transcript
  - On final transcript: run account matcher, build prompt, call Claude, stream to TTS, play audio
  - Handles barge-in: stops TTS, switches back to listening
  - Handles filler: starts timer on each turn, cancels when Claude responds
  - Auto-saves transcript via autosave timer
  - Handles 30-second mutual silence: triggers session end
  - Handles 5-second initial silence: plays greeting
  - stop() ends all connections, saves transcript, sends to post-processing

Tests (write FIRST — integration-style, all deps mocked):
  - start initializes all modules
  - speech → transcript → Claude → TTS → playback flow works end to end
  - barge-in stops TTS and resumes listening
  - filler triggers on slow Claude response
  - 30-second silence triggers session end
  - stop cleans up everything
  - transcript is saved via autosave during session
```

---

## Phase 4: Text Mode + Storage

### Task 4.1 — Supabase Client Singleton
**Depends on:** 0.1
**Creates:** `lib/storage/supabase.ts`, `__tests__/lib/storage/supabase.test.ts`

```
Build the Supabase client singleton. TDD.
Read this document's section: "Connection Management > Supabase".

Interface:
  getSupabaseClient(): SupabaseClient
  initSupabase(url: string, anonKey: string): void

Requirements:
  - Creates a single Supabase client instance
  - Configures for React Native (AsyncStorage adapter for auth persistence)
  - Exposes the client for other modules to use
  - initSupabase called once on app startup

Tests:
  - returns same instance on multiple calls (singleton)
  - client is configured with correct URL and key
  - handles missing initialization gracefully
```

### Task 4.2 — Auth Module
**Depends on:** 4.1, 0.2 (stores/app.ts)
**Creates:** `lib/storage/auth.ts`, `__tests__/lib/storage/auth.test.ts`

```
Build the auth module. TDD.
Read this document's sections: "Auth & Multi-tenancy" and "Security Architecture > Auth Flow".

Interface:
  signInWithGoogle(): Promise<AuthResult>
  signInWithMicrosoft(): Promise<AuthResult>
  signOut(): Promise<void>
  getSession(): Promise<Session | null>
  onAuthStateChange(callback: (session: Session | null) => void): void

AuthResult: { success: boolean, error?: string }

Requirements:
  - Google and Microsoft OAuth via Supabase Auth
  - Stores session in SecureStore
  - Updates app store (stores/app.ts) on auth state change
  - Auto-refreshes tokens via Supabase SDK
  - getSession checks SecureStore on app startup

Tests (mock Supabase auth):
  - signIn returns success with valid session
  - signIn returns error on failure
  - signOut clears session
  - getSession returns stored session
  - onAuthStateChange fires on sign in/out
```

### Task 4.3 — Session Submit
**Depends on:** 4.1
**Creates:** `lib/processing/submit.ts`, `__tests__/lib/processing/submit.test.ts`

```
Build the module that submits completed sessions to the Vercel backend. TDD.
Read this document's section: "Post-Processing Pipeline" and "Vercel API Routes".

Interface:
  submitSession(params: {
    transcript: ConversationMessage[],
    sessionMetadata: SessionMetadata,
    accountContext: AccountSummary | null
  }): Promise<{ status: 'processing', sessionId: string }>

Requirements:
  - POST to /api/capture/process
  - Sends transcript, metadata, and account context
  - Returns sessionId for status polling
  - On network error: saves to SQLite for retry later
  - On 4xx: throws (bad request, don't retry)
  - On 5xx: retry once, then save to SQLite

Tests (write FIRST, use MSW):
  - submits session successfully
  - returns sessionId from response
  - retries on 5xx once
  - saves to SQLite on persistent failure
  - throws on 4xx (bad request)
```

### Task 4.4 — Sync Status Poller
**Depends on:** 4.1
**Creates:** `lib/crm/status.ts`, `__tests__/lib/crm/status.test.ts`

```
Build the sync status poller. TDD.
Read this document's section: "Vercel API Routes".

Interface:
  getSessionStatus(sessionId: string): Promise<SessionStatus>
  pollUntilComplete(sessionId: string, intervalMs?: number): Promise<SessionStatus>

SessionStatus: { status: 'processing' | 'synced' | 'failed', extractedData?: object }

Requirements:
  - GET /api/capture/status/:sessionId
  - pollUntilComplete polls every 5 seconds (default), resolves when status != 'processing'
  - Timeout after 5 minutes of polling (return whatever status we have)
  - Used by session history UI to update status indicators

Tests:
  - returns current status
  - polls until synced
  - polls until failed
  - times out after max duration
  - handles network error gracefully
```

---

## Phase 5: Post-Processing Pipeline (Server-Side)

### Task 5.1 — Vercel API Route: Process
**Depends on:** 0.2 (types)
**Creates:** `api/capture/process.ts`, `__tests__/api/capture/process.test.ts`

```
Build the Vercel API route that receives transcripts. TDD.
Read this document's sections: "Post-Processing Pipeline" and "Vercel API Routes".

This is a server-side file (runs on Vercel, not on mobile).

Requirements:
  - POST /api/capture/process
  - Validates input: transcript (required), sessionMetadata (required), accountContext (optional)
  - Generates idempotency key from session data
  - Saves raw session to Supabase (voice.sessions table)
  - Triggers Inngest job "process-debrief" with sessionId
  - Returns { status: 'processing', sessionId } immediately
  - On Supabase write failure: return 500
  - On Inngest trigger failure: still return 200 (session is saved, can re-trigger)

Tests (write FIRST, use Supertest + mock Supabase + mock Inngest):
  - accepts valid request, returns 200 with sessionId
  - saves session to Supabase
  - triggers Inngest job
  - returns 400 on missing transcript
  - generates idempotency key
  - handles Supabase error → 500
  - handles Inngest error → still returns 200
```

### Task 5.2 — Vercel API Route: Status
**Depends on:** 0.2 (types)
**Creates:** `api/capture/status/[sessionId].ts`, `__tests__/api/capture/status.test.ts`

```
Build the status endpoint. TDD.

Requirements:
  - GET /api/capture/status/:sessionId
  - Reads session from Supabase by ID
  - Returns { status, crm_sync_status }
  - Returns 404 if session not found

Tests:
  - returns processing status
  - returns synced status
  - returns failed status with error
  - returns 404 for unknown sessionId
```

### Task 5.3 — Inngest Job: Account Extraction
**Depends on:** 0.2 (types)
**Creates:** `inngest/steps/extract-accounts.ts`, `__tests__/inngest/steps/extract-accounts.test.ts`

```
Build the account extraction step. TDD.
Read this document's section: "Post-Processing Pipeline > Step 1: Account Extraction".

Interface:
  extractAccounts(transcript: ConversationMessage[], orgId: string, userId: string): Promise<AccountMatch[]>

AccountMatch: { accountId: string, accountName: string, isNew: boolean }

Requirements:
  - Send transcript to Claude: "Identify all businesses/accounts mentioned in this conversation"
  - Match against existing accounts in voice.accounts by name (case-insensitive, partial match)
  - If new account mentioned: create placeholder row in voice.accounts
  - If multiple accounts mentioned: return all matches
  - Tag the session with all matched account IDs
  - Update last_conversation_at on matched accounts

Tests (mock Claude + mock Supabase):
  - extracts account name from transcript
  - matches known account
  - creates placeholder for unknown account
  - handles multiple accounts in one transcript
  - handles transcript with no account mentioned
  - case-insensitive matching
  - updates last_conversation_at
```

### Task 5.4 — Inngest Job: Task Extraction
**Depends on:** 5.3
**Creates:** `inngest/steps/extract-tasks.ts`, `__tests__/inngest/steps/extract-tasks.test.ts`

```
Build the task extraction step. TDD.
Read this document's section: "Post-Processing Pipeline > Step 2: Task Extraction".

Interface:
  extractTasks(transcript: ConversationMessage[], accountMatches: AccountMatch[], sessionId: string): Promise<Task[]>

Task: { description, due_date, priority, account_id, session_id }

Requirements:
  - Send transcript to Claude: "Extract action items from this conversation.
    Only extract things that are clearly actionable."
  - Each task gets: description, due_date (if mentioned, null otherwise),
    priority (inferred: high/medium/low), linked account
  - Save tasks to voice.tasks table
  - If due date is relative ("by Friday"), resolve to absolute date

Tests (mock Claude + mock Supabase):
  - extracts clear action items
  - resolves relative due dates
  - links tasks to correct accounts
  - infers priority
  - ignores vague non-actionable statements
  - handles transcript with no tasks
```

### Task 5.5 — Inngest Job: Account Summary Update
**Depends on:** 5.3
**Creates:** `inngest/steps/update-summary.ts`, `__tests__/inngest/steps/update-summary.test.ts`

```
Build the account summary regeneration step. TDD.
Read this document's section: "Post-Processing Pipeline > Step 3: Account Summary Update".

Interface:
  updateAccountSummary(accountId: string): Promise<string>

Requirements:
  - Fetch ALL sessions tagged to this account from Supabase
  - Send all transcripts to Claude: "Produce a bullet-point account summary from these conversations.
    Include: current deal stage, key contacts, recent activity, open items, next steps.
    Keep it scannable — a rep should absorb it in 5 seconds."
  - Save the new summary to voice.accounts.summary
  - This keeps pre-loaded context fresh for the next conversation
  - Summary should be ~80-100 tokens, bullet points not prose

Tests (mock Claude + mock Supabase):
  - generates summary from single transcript
  - generates summary from multiple transcripts (incorporates all)
  - updates the account record
  - handles account with no prior sessions
  - summary stays concise (under 150 tokens)
```

### Task 5.6 — Inngest Job: Embedding Generation
**Depends on:** 0.2 (types)
**Creates:** `inngest/steps/embed.ts`, `__tests__/inngest/steps/embed.test.ts`

```
Build the embedding generation step. TDD.
Read this document's section: "Post-Processing Pipeline > Step 4".

Interface:
  generateEmbeddings(sessionId: string, transcript: ConversationMessage[]): Promise<void>

Requirements:
  - Chunks transcript into ~500 token segments
  - Generates embeddings via OpenAI ada-002 (or similar)
  - Stores in voice.embeddings table with pgvector
  - Not used in v1 conversations but stored for future features

Tests (mock embedding API + mock Supabase):
  - chunks transcript correctly
  - generates embeddings for each chunk
  - stores in Supabase with correct session reference
  - handles empty transcript
```

### Task 5.7 — Inngest Job: Pipeline Wiring (Pre-CRM)
**Depends on:** 5.3, 5.4, 5.5, 5.6
**Creates:** `inngest/process-debrief.ts`, `__tests__/inngest/process-debrief.test.ts`

```
Wire Inngest steps together into the process-debrief job (without CRM).
Read this document's section: "Post-Processing Pipeline".

Requirements:
  - Inngest function with steps (each independently retryable):
    Step 1: Extract accounts from transcript
    Step 2: Extract tasks from transcript
    Step 3: Update account summaries
    Step 4: Generate embeddings
    Step 5: Update session status ('processed' or 'failed')
  - CRM sync steps are added later in Phase 8
  - Retry policy: 5 attempts, exponential backoff per step
  - Timeout: 120 seconds per step
  - On persistent failure: update session status to 'failed' with error message

Tests (integration, all steps mocked):
  - runs all steps in order
  - sets status to 'processed' on success
  - retries failed step
  - sets status to 'failed' after max retries
  - idempotency — same session doesn't process twice
```

---

## Phase 6: UI Screens

### Task 6.1 — Home Screen (Idle + Voice Active States)
**Depends on:** 0.2 (stores), 3.8 (preload), 3.9 (orchestrator)
**Creates:** `app/(tabs)/index.tsx`, `components/MicButton.tsx`, `components/Waveform.tsx`, `components/SessionCard.tsx`, `components/StatusBadge.tsx`

```
Build the home screen with both idle and voice-active states. Lighter tests.
Read this document's section: "Mobile App Screens > Home Screen".

This is a single screen component with two visual states driven by
the session store (IDLE vs ACTIVE). No navigation for voice mode.

Idle state layout:
  - Kosha logo/name at top
  - One big mic button (center, dominant)
  - "Type instead" link below button
  - 2-3 recent sessions as small cards at bottom
  - Each card: account name, time ago, sync status icon
  - "See all" link to session history
  - Badge count on failed syncs
  - Settings icon (top corner)

Active state layout (in-place transformation, no navigation):
  - Mic button morphs into waveform indicator
  - "Type instead", recent sessions, settings all fade out
  - Status text: "Listening..." / "Kosha is thinking..."
  - End button appears below waveform

Tap-to-start behavior:
  1. Start expo-av audio capture IMMEDIATELY on tap (< 100ms)
  2. Transform UI: mic → waveform, fade out surrounding elements
  3. Background: open Deepgram WebSocket, start VAD, assemble prompt
  4. Audio is buffered locally until pipeline is ready — nothing lost

Tap-to-end behavior:
  1. Stop orchestrator
  2. Waveform morphs back to mic button
  3. Surrounding UI fades back in
  4. New session card appears at top of recent list with "processing..." status

Tests:
  - idle state: renders mic button, "type instead" link, recent sessions
  - tapping mic transforms to active state (waveform visible, idle UI hidden)
  - active state: status text updates with conversation state
  - tapping end transforms back to idle with new session card
  - failed sync badge shows correct count
  - tapping session card navigates to session detail
```

### Task 6.2 — Text Conversation Screen
**Depends on:** 3.1 (claude client), 3.2 (prompt builder), 0.2 (stores)
**Creates:** `app/conversation/text.tsx`

```
Build the text conversation screen. Lighter tests.
Read this document's section: "Mobile App Screens > Text Conversation Screen".

Layout:
  - Chat interface (rep messages right, Kosha messages left)
  - Text input at bottom
  - End conversation button

Behavior:
  - On send: add rep message to transcript, call Claude, add response
  - Same system prompt as voice mode (uses prompt builder)
  - No audio pipeline — just text in, text out
  - End button: submit session, navigate to home

Tests:
  - renders chat bubbles, text input, end button
  - sending message adds rep bubble and triggers response
  - end button triggers session end
```

### Task 6.3 — Accounts Tab
**Depends on:** 4.1 (supabase), 0.2 (stores)
**Creates:** `app/(tabs)/accounts.tsx`, `components/AccountCard.tsx`

```
Build the accounts list tab. Lighter tests.
Read this document's section: "Mobile App Screens > Accounts Tab".

Layout:
  - List of all accounts for this rep, sorted by last_conversation_at DESC
  - Each card: account name, industry (if known), last conversation date
  - Search bar at top for filtering by name
  - Empty state: "Your accounts will appear here as you have conversations"
  - Tapping card navigates to account detail page

Data:
  - Query voice.accounts WHERE user_id = current user, ORDER BY last_conversation_at DESC
  - No manual account creation — accounts only come from post-processing

Tests:
  - renders account list
  - search filters by name
  - empty state shows when no accounts
  - tapping card navigates to account/[id]
```

### Task 6.4 — Account Detail Page
**Depends on:** 6.3 (accounts tab), 4.1 (supabase)
**Creates:** `app/account/[id].tsx`

```
Build the account detail page. Lighter tests.
Read this document's section: "Mobile App Screens > Account Detail Page".

Layout:
  - Account name header
  - AI-generated summary (bullet points — deal stage, key contacts, recent activity, open items, next steps)
  - Industry, address (if known)
  - Tasks section: open tasks for this account, tappable to complete
  - Conversation history: sessions tagged to this account, tappable to view transcript
  - CRM sync status indicator

Data:
  - Account from voice.accounts by ID
  - Tasks from voice.tasks WHERE account_id = this account AND completed = false
  - Sessions from voice.sessions WHERE account_ids @> ARRAY[this account ID]

Tests:
  - renders account summary
  - renders task list
  - renders session history
  - marking task complete updates state
```

### Task 6.5 — Session History Screen
**Depends on:** 4.1 (supabase), 0.2 (stores)
**Creates:** `app/history/index.tsx`, `app/history/[id].tsx`

```
Build session history and detail screens. Lighter tests.
Read this document's section: "Mobile App Screens > Session History".

List view: date/time, account name, session type, sync status.
Detail view: full conversation transcript with speaker labels.

Tests:
  - renders session list
  - tapping session navigates to detail
  - detail shows transcript
```

### Task 6.6 — Settings Screen
**Depends on:** 4.2 (auth)
**Creates:** `app/settings.tsx`

```
Build settings screen (without CRM connection — that's added in Phase 8). Lighter tests.
Read this document's section: "Mobile App Screens > Settings".

Layout: account info, sign out, recording consent status.
CRM connection (OAuth button) is added in Task 8.4.

Tests:
  - renders all settings options
  - sign out triggers auth signOut
```

### Task 6.7 — Onboarding Flow
**Depends on:** 4.2 (auth)
**Creates:** `app/onboarding.tsx`

```
Build the 3-screen onboarding tutorial + consent. Lighter tests.
Read this document's section: "Mobile App Screens > Onboarding".

3 screens: what Kosha does, how voice works, how text works.
Consent screen with timestamp storage.
~30 seconds total.

Tests:
  - renders 3 tutorial screens
  - consent screen stores timestamp
  - navigates to home after completion
```

---

## Phase 7: Integration + Polish

### Task 7.1 — Voice Debrief Integration Test
**Depends on:** All of Phase 3 (3.1–3.9)
**Creates:** `__tests__/integration/voice-debrief.test.ts`

```
Full end-to-end voice debrief flow with all external services mocked.
Read this document's section: "Testing Strategy > Integration Tests > Voice Debrief Flow".

Test the complete loop:
  Start session → capture → VAD → Deepgram → transcript → Claude → TTS → playback →
  session end → submit to Vercel → session status update.

Assert: full transcript stored, session submitted, status updates correctly.
```

### Task 7.2 — Barge-In Integration Test
**Depends on:** 3.5, 3.9
**Creates:** `__tests__/integration/barge-in.test.ts`

```
Test barge-in flow end to end.
Agent speaking → VAD detects rep → TTS stops → new speech captured → Claude responds.
Assert: no audio overlap, interrupted text stored.
```

### Task 7.3 — Offline Fallback Integration Test
**Depends on:** 2.2, 2.6
**Creates:** `__tests__/integration/offline-fallback.test.ts`

```
Test offline fallback flow.
Session active → network drops → Deepgram fails → local recording → network returns → batch process.
Assert: no data lost.
```

### Task 7.4 — Crash Recovery Integration Test
**Depends on:** 2.4, 2.5
**Creates:** `__tests__/integration/crash-recovery.test.ts`

```
Test crash recovery flow.
Session active → auto-save fires → app crash simulated → app reopens → orphan detected → submitted.
Assert: transcript recovered.
```

### Task 7.5 — Offline Recording Fallback Module
**Depends on:** 1.1, 2.6
**Creates:** `lib/audio/offline-recorder.ts`, `__tests__/lib/audio/offline-recorder.test.ts`

```
Build the offline recording fallback. TDD.
Read this document's section: "Offline Behavior".

When network drops during conversation:
  - Keep recording audio locally
  - Save audio file to device storage
  - When back online: send to server for batch transcription + processing

Tests:
  - starts recording on network drop
  - saves audio file locally
  - detects network return
  - submits for batch processing
```

### Task 7.6 — Push Notifications
**Depends on:** 4.4 (status poller)
**Creates:** `lib/notifications.ts`

```
Set up push notifications for:
  - "Your notes have been processed" (sync complete)
  - "Sync failed — tap to retry" (sync failed)
Uses expo-notifications.
```

### Task 7.7 — Error Messaging
**Depends on:** All previous tasks
**Creates:** `components/ErrorBoundary.tsx`, `components/ErrorMessage.tsx`

```
Build error boundaries and user-facing error messages.
Read this document's section: "Error Handling Strategy > Error Boundaries".

App-level, conversation-level, and component-level error boundaries.
```

---

## Phase 8: CRM Integration

### Task 8.1 — CRM Connector: Schema Reader
**Depends on:** 0.2 (types)
**Creates:** `inngest/crm/schema-reader.ts`, `__tests__/inngest/crm/schema-reader.test.ts`

```
Build the CRM schema reader. TDD.
Read this document's section: "CRM Integration > How the Connector Works".

Interface:
  readCrmSchema(orgId: string): Promise<CrmSchema>

CrmSchema: { crm_type, objects: Array<{ name, fields: Array<{ name, type, required, picklist_values? }> }> }

Requirements:
  - HubSpot: GET /crm/v3/properties/{objectType} for Deal, Contact, Company
  - Salesforce: GET /services/data/v59.0/sobjects/{objectType}/describe/ for Opportunity, Contact, Account
  - Reads OAuth tokens from voice.organizations
  - Returns normalized schema structure (same shape regardless of CRM type)
  - Saves to voice.crm_schemas as cache
  - Handles token refresh if expired

Tests (mock HubSpot API + mock Salesforce API):
  - reads HubSpot schema correctly
  - reads Salesforce schema correctly
  - normalizes to same shape
  - handles token refresh
  - handles API error gracefully
```

### Task 8.2 — CRM Connector: Dynamic Extractor
**Depends on:** 8.1
**Creates:** `inngest/crm/dynamic-extractor.ts`, `__tests__/inngest/crm/dynamic-extractor.test.ts`

```
Build the dynamic CRM extraction agent. TDD.
Read this document's section: "CRM Integration > How the Connector Works".

Interface:
  extractForCrm(params: {
    transcript: ConversationMessage[],
    crmSchema: CrmSchema,
    accountMatch: AccountMatch
  }): Promise<CrmExtraction>

CrmExtraction: { objects: Array<{ objectType, recordId?, fields: Record<string, any> }> }

Requirements:
  - Takes transcript + CRM schema
  - Sends to Claude: "Given this conversation and this CRM structure, populate whatever
    fields you can confidently fill from what the rep said. Do not guess. Return only
    fields where the transcript provides clear evidence."
  - Claude returns CRM-shaped data — field names and values matching the actual CRM
  - Output is ready to push directly to CRM API
  - Handles custom fields, picklist values (validates against schema), required fields

Tests (mock Claude):
  - extracts standard fields (deal amount, stage, contacts)
  - extracts custom fields when transcript provides evidence
  - validates picklist values against schema
  - does not hallucinate fields without evidence
  - handles transcript that maps to multiple CRM objects
  - handles transcript with nothing to extract
```

### Task 8.3 — CRM Connector: Sync Engine
**Depends on:** 8.2
**Creates:** `inngest/crm/sync.ts`, `__tests__/inngest/crm/sync.test.ts`

```
Build the CRM sync engine that pushes extracted data. TDD.

Interface:
  syncToCrm(params: {
    crmExtraction: CrmExtraction,
    orgId: string,
    sessionId: string
  }): Promise<SyncResult>

SyncResult: { success: boolean, recordsWritten: number, errors: string[] }

Requirements:
  - HubSpot: uses v3 API to create/update records
  - Salesforce: uses REST API to create/update records
  - Creates new records when none exist for this account
  - Updates existing records when match found
  - Attaches full transcript as Note/Activity
  - Logs every write to voice.crm_sync_log
  - Idempotency key per session prevents duplicates
  - Handles OAuth token refresh
  - On API error: return failure for retry

Tests (mock HubSpot API + mock Salesforce API):
  - creates new records
  - updates existing records
  - attaches transcript as note
  - logs to sync audit
  - idempotency prevents duplicates
  - handles token refresh
  - handles API error gracefully
```

### Task 8.4 — CRM Pipeline Step + Settings OAuth
**Depends on:** 8.3, 5.7 (pre-CRM pipeline), 6.6 (settings screen)
**Modifies:** `inngest/process-debrief.ts`, `app/settings.tsx`

```
Add CRM steps to the existing pipeline and CRM OAuth to settings. TDD.

Pipeline changes (modify process-debrief.ts):
  - Add Step 5 after embeddings (if CRM connected):
    a. Read CRM schema
    b. Dynamic extraction against schema
    c. Sync to CRM
  - Update session status from 'processed' to 'synced' on CRM success
  - Skip CRM steps entirely if org has no CRM connected

Settings changes (modify settings.tsx):
  - Add CRM connection section: OAuth button for HubSpot/Salesforce
  - Show connected CRM type and status when connected
  - Disconnect option

Tests:
  - pipeline runs CRM steps when CRM connected
  - pipeline skips CRM steps when no CRM
  - settings renders OAuth button
  - settings shows connected state
```

---

## Phase 9: QA + Launch Prep

### Task 9.1 — Latency Benchmarks
**Creates:** `__tests__/benchmarks/latency.test.ts`

```
Performance tests that run on a real device.
Read this document's section: "Testing Strategy > Latency Benchmarks".

Measure and log:
  - VAD detection < 100ms
  - Deepgram transcript < 300ms
  - Claude first token < 400ms
  - ElevenLabs first chunk < 300ms
  - Total < 900ms
```

### Task 9.2 — Edge Case Testing
```
Run through all scenarios in 03-risk-analysis.md.
Fix anything that breaks.
```

### Task 9.3 — App Store Prep
```
App icons, splash screen, store listing metadata, build configuration for iOS + Android.
```

---

## Task Dependency Graph

```
0.1 ─── 0.2
 │       │
 ├── 1.1 ├── 1.2 ── 1.3
 │    │       │
 │    │   ┌───┘
 │    ▼   ▼
 │   2.1  2.2 ── 2.3 ── 2.4 ── 2.5
 │    │              │
 │    │              2.6
 │    │
 │   3.1  3.2  3.3  3.4  3.5  3.6  3.7  3.8
 │    │    │    │    │    │    │    │    │
 │    └────┴────┴────┴────┴────┴────┴────┘
 │                    │
 │                  3.9 (ORCHESTRATOR — depends on everything above)
 │
 │   4.1 ── 4.2 ── 4.3 ── 4.4
 │
 │   5.1  5.2  5.3 ── 5.4 ── 5.5 ── 5.6
 │                                    │
 │                                  5.7 (PRE-CRM PIPELINE WIRING)
 │
 │   6.1  6.2  6.3 ── 6.4  6.5  6.6  6.7
 │
 │   7.1  7.2  7.3  7.4  7.5  7.6  7.7
 │
 │   8.1 ── 8.2 ── 8.3 ── 8.4 (CRM INTEGRATION)
 │
 │   9.1  9.2  9.3
```

---

## How to Use This Plan

**For each task, paste this into Claude Code:**

```
Read CLAUDE.md and 05-voice-agent-design-spec.md.
Then complete Task [X.Y] from the Implementation Plan section.
Write the test file first (TDD), then implement.
Run `npm test` when done — all tests must pass.
Don't modify files from other tasks.
```

---

## Document References

- **03-risk-analysis.md** — 40+ failure scenarios with mitigations (still valid, build against it)
- **CLAUDE.md** — Project guidance for Claude Code when building