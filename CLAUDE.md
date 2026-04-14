# CLAUDE.md — field-rep-mobile
This file provides guidance for Claude Code when working with this codebase.
Core Philosophy
TDD for the voice pipeline and post-processing. Lighter tests for UI. Small, pure, atomic functions. Every piece of the pipeline must be independently testable and provably correct before integration.
Guiding Principles

Test behavior, not implementation — tests document expected business behavior
TDD for pipeline — RED → GREEN → REFACTOR for all audio, STT, LLM, TTS, post-processing, and CRM sync code
Lighter tests for UI — smoke tests and snapshot tests for screens and components
No any types — use unknown if type is truly unknown
Prefer immutability — avoid data mutation where possible
Small, pure functions — each function does one thing, takes input, returns output, no side effects
Self-documenting code — favor clear naming over comments
Stream everything — never wait for a full response when partial results are available

Development Workflow

RED: Write failing test first
GREEN: Write minimum code to pass test
REFACTOR: Improve code while tests pass
Each increment leaves codebase in working state
No function is "done" until its tests pass


Project Overview
field-rep-mobile is a voice-first mobile capture tool for sales reps, part of the Kosha product suite. Reps open the app, tap one button, and talk to an AI agent named Kosha that helps them capture meeting notes and deal information. After the conversation, a background pipeline extracts structured data and syncs it to the rep's CRM.
Three-Layer Architecture

Context Layer (before conversation) — pre-load all account summaries into memory on app open
Conversation Layer (during) — real-time voice loop with zero mid-conversation API calls beyond the core pipeline (Deepgram, Claude, ElevenLabs). No data decisions, no tool calls, no CRM lookups during the conversation
Processing Layer (after conversation) — server-side pipeline classifies, extracts, organizes, and syncs to CRM. Runs as Inngest background job triggered by Vercel API route


Tech Stack
LayerTechnologyFrameworkReact Native + ExpoNavigationExpo Router (file-based)AuthSupabase Auth (Google + Microsoft OAuth)Session StorageSecureStoreDatabaseSupabase PostgreSQL (existing Kosha instance)Vector StoreSupabase pgvectorLocal StorageSQLite (expo-sqlite)STTDeepgram Nova-2 (WebSocket streaming)LLMClaude Sonnet (streaming API)TTSElevenLabs Turbo v2.5 (streaming)VAD@ricky0123/vad (Silero, client-side)Audioexpo-avAPI RoutesVercel (existing Kosha deployment)Background JobsInngestCRMHubSpot v3 API + Salesforce REST API

Project Structure
app/
├── (tabs)/              # Tab-based navigation (home, settings)
├── conversation/        # Voice and text conversation screens
├── history/             # Session history and detail views
├── onboarding/          # First-launch tutorial + consent
├── auth/                # OAuth callback handler
└── _layout.tsx          # Root layout

lib/
├── audio/               # Mic capture, playback, session manager, audio routing
├── vad/                 # Silero VAD integration, speech boundary detection
├── stt/                 # Deepgram WebSocket client, reconnection, buffering
├── llm/                 # Claude reasoning engine, prompt construction, streaming
├── tts/                 # ElevenLabs client, streaming playback, filler audio
├── conversation/        # State machine, turn-taking logic, barge-in handling
├── context/             # Account summary pre-loading, name matching
├── transcript/          # Transcript buffer, SQLite persistence, crash recovery
├── processing/          # Post-processing types and client (triggers Inngest)
├── crm/                 # CRM sync types, field mapping definitions
├── extraction/          # Extraction schema definitions (JSON configs)
└── supabase/            # Supabase client setup (auth, queries)

api/
├── capture/
│   ├── process.ts       # Receives transcript, saves to Supabase, triggers Inngest
│   └── status.ts        # Returns session processing status
└── inngest/
    └── process-debrief.ts  # Background job: classify, extract, match, sync

components/
├── ui/                  # Shared UI components
├── WaveformIndicator/   # Audio visualization
├── MicButton/           # Primary action button
└── SessionCard/         # Recent session display

__tests__/               # Mirror lib/ structure
├── audio/
├── vad/
├── stt/
├── llm/
├── conversation/
├── context/
├── transcript/
├── processing/
├── crm/
└── integration/         # End-to-end flow tests

Key Architecture Rules
During Conversation (Real-Time Voice Loop)

NO mid-conversation API calls beyond the core pipeline (Deepgram, Claude, ElevenLabs)
NO tool calls from Claude during conversation (no saves, no task creation, no CRM lookups)
NO data decisions — agent doesn't classify, validate, or reconcile during the conversation
Account context is pre-loaded in memory before conversation starts — injected into Claude's system prompt via string concatenation, not an API call
Target latency: < 900ms from rep finishing speech to agent starting response

After Conversation (Post-Processing)

All data decisions happen here: classification, extraction, account matching, CRM sync
Runs on server (Vercel API route triggers Inngest background job)
Rep's phone is not involved — they can close the app
Retry logic with exponential backoff for all external API calls

State Management

Conversation state machine: IDLE → ACTIVE → ENDING → COMPLETE
Only one active session at a time (enforce in app logic)
Auto-save transcript to SQLite every 10 seconds
On crash: recover from SQLite, send to post-processing silently


Voice Pipeline Flow
Rep speaks
    ↓
expo-av captures mic audio (16kHz mono PCM)
    ↓
@ricky0123/vad detects speech start/end (Silero, on-device, ~100ms)
    ↓
Audio streams to Deepgram Nova-2 via WebSocket
    → endpointing: 1500ms
    → smart_format: true, punctuate: true
    → Final transcript on speech end (~200ms)
    ↓
Final transcript appended to conversation history
    ↓
Claude Sonnet via streaming API (~300ms to first token)
    → System prompt: agent identity + extraction schema + account context + conversation history
    → Returns: { response_text, internal_notes, fields_captured, suggested_next_question }
    → Only response_text goes to TTS
    ↓
ElevenLabs Turbo v2.5 streaming TTS (~200ms to first chunk)
    → Audio chunks stream back and play immediately via expo-av
    ↓
If VAD detects rep speaking during playback:
    → Stop TTS immediately (barge-in)
    → Remember interrupted question internally
    ↓
Loop back to top

Testing Strategy
Tools

Jest — test runner
React Native Testing Library — UI component tests
MSW (Mock Service Worker) — mock Deepgram, Claude, ElevenLabs API responses
jest-websocket-mock — mock WebSocket connections (Deepgram streaming)
Supertest — API route integration tests

TDD Scope (Full RED → GREEN → REFACTOR)
All code in these directories gets full TDD:

lib/audio/
lib/vad/
lib/stt/
lib/llm/
lib/tts/
lib/conversation/
lib/context/
lib/transcript/
api/inngest/ (post-processing pipeline)
lib/crm/

Lighter Test Scope
Smoke tests and snapshot tests only:

app/ (screens)
components/

Test File Location
Mirror source structure in __tests__/:

lib/stt/deepgram.ts → __tests__/stt/deepgram.test.ts
lib/conversation/stateMachine.ts → __tests__/conversation/stateMachine.test.ts

Integration Tests
Located in __tests__/integration/:

voiceDebrief.test.ts — full voice loop with mocked services
bargeIn.test.ts — barge-in handling end-to-end
offlineFallback.test.ts — network drop and recovery
crashRecovery.test.ts — SQLite persistence and recovery
postProcessing.test.ts — full Inngest job pipeline


Code Style
Formatting

No semicolons, single quotes, 2-space indentation
Trailing commas: ES5 style
Path alias: @/* maps to project root

TypeScript Guidelines

No any types — use unknown if type is truly unknown
No type assertions without justification
Prefer type over interface for data structures
Use Zod schemas at trust boundaries, derive types with z.infer<>

Functional Patterns

Prefer immutable data — avoid mutation
Use pure functions where possible
Use early returns over nested if/else
Prefer map, filter, reduce over loops
Prefer options objects over many positional parameters
Every function in lib/ should be a small, pure function that does one thing

Component Patterns

Minimal UI — this is a voice-first app
Home screen: walkie-talkie pattern (big mic button, "type instead" secondary)
Voice screen: waveform + status text + end button. Nothing else
No live transcript on voice screen
No review/summary screen after conversation


Key Behavioral Rules
Agent (Kosha) Behavior During Conversation

Stays silent while rep is talking (no backchanneling)
Responds after 2-3 seconds of silence
Super short responses in "pull" mode (drawing out info)
Slightly longer in "push" mode (answering questions)
Barge-in: stops immediately when rep starts talking
If both sides silent for 30 seconds: auto-end session
First 5 seconds: silent. If rep doesn't speak, one greeting. Then silent again
Can give gentle context-aware nudges based on pre-loaded account data
Never makes data decisions, never calls tools, never saves anything during conversation

Post-Processing Behavior

Classify transcript segments: debrief / retrieval / mixed / chitchat
Extract structured data only from debrief segments
On conflict with CRM data: update with new value, log change with audit trail
Multi-account conversations: split extraction per account
Unknown account: flag as new, create placeholder


Common Commands
bash# Development
npx expo start              # Start Expo dev server
npx expo run:ios            # Run on iOS simulator
npx expo run:android        # Run on Android emulator

# Testing
npm test                    # Run all tests
npm test -- --watch         # Watch mode
npm test -- --coverage      # Coverage report
npm test -- __tests__/stt   # Run specific test directory

# Building
npx expo build:ios          # iOS production build
npx expo build:android      # Android production build

# Linting
npm run lint                # ESLint
npm run format              # Prettier

Environment Variables
# Supabase
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=

# Deepgram
EXPO_PUBLIC_DEEPGRAM_API_KEY=

# Claude (Anthropic)
EXPO_PUBLIC_ANTHROPIC_API_KEY=

# ElevenLabs
EXPO_PUBLIC_ELEVENLABS_API_KEY=

# Vercel API (existing Kosha backend)
EXPO_PUBLIC_API_BASE_URL=

Supabase Schema (voice schema)
sql-- Sessions table
voice.sessions (
  id uuid primary key,
  user_id uuid references auth.users,
  org_id uuid references public.organizations,
  type text (voice | text),
  status text (active | processing | synced | failed),
  transcript jsonb,
  extracted_data jsonb,
  account_ids uuid[],
  classification jsonb,
  created_at timestamptz,
  ended_at timestamptz,
  sync_attempts int default 0,
  last_sync_error text,
  idempotency_key uuid unique
)

-- Account summaries table (pre-loaded context)
voice.account_summaries (
  id uuid primary key,
  account_id uuid references kosha.accounts,
  org_id uuid references public.organizations,
  summary_text text,
  summary_tokens int,
  last_updated_at timestamptz,
  last_session_id uuid references voice.sessions
)

-- Audit log for CRM sync changes
voice.sync_audit_log (
  id uuid primary key,
  session_id uuid references voice.sessions,
  account_id uuid references kosha.accounts,
  field_name text,
  old_value text,
  new_value text,
  change_type text (new | updated | confirmed),
  synced_at timestamptz
)