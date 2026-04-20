# Kosha

AI-powered platform for field sales teams in the CPG/beverage industry. Reps capture meeting notes by talking to an AI agent, which extracts structured data and syncs it to their CRM — no typing required.

## Architecture

Turborepo monorepo managed with pnpm workspaces.

```
kosha/
├── apps/
│   ├── supplier/          # Sales rep web app (Next.js)
│   ├── distributor/       # Distributor dashboard (Next.js)
│   ├── field-rep-mobile/  # Voice-first mobile app (React Native + Expo)
│   └── indexer/           # Internal data indexing tool (Next.js)
├── packages/
│   ├── ui/                # Shared component library (Radix + shadcn)
│   ├── types/             # Centralized TypeScript type definitions
│   ├── supabase/          # Supabase client (server, client, service)
│   ├── tailwind-config/   # Shared Tailwind configuration
│   ├── typescript-config/ # Shared tsconfig presets
│   └── eslint-config/     # Shared ESLint rules
```

## Apps

### Supplier

Web app for field sales reps. Account management, territory mapping, visit scheduling, and AI-powered meeting capture via voice or text. Reps tap a button, talk to Kosha, and the conversation is processed into structured notes, tasks, and CRM updates.

- **Stack:** Next.js 15, React 19, Mapbox GL, OpenAI Realtime API (WebRTC)
- **Voice pipeline:** OpenAI GPT-4o Realtime with semantic VAD, Whisper transcription, streaming audio
- **Port:** 3100

### Distributor

Dashboard for distribution companies. Order management with PDF export, customer/account matching, product catalog with CSV import, analytics, and payment processing.

- **Stack:** Next.js 15, React 19, Recharts, pdf-lib, Conductor (payments), Resend (email)
- **Port:** 3000

### Field Rep Mobile

Voice-first mobile capture tool. Reps open the app, tap one button, and talk to an AI agent that guides them through capturing meeting notes. After the conversation, a background pipeline extracts structured data and syncs to CRM.

- **Stack:** React Native 0.81, Expo 54, Zustand, expo-av, expo-sqlite
- **Voice pipeline:** Deepgram Nova-2 (streaming STT) → Claude Sonnet (LLM) → ElevenLabs Turbo v2.5 (streaming TTS)
- **Target latency:** < 900ms from rep finishing speech to agent starting response

### Indexer

Internal tool for scraping and indexing store data. Lightweight admin interface with map visualization.

- **Stack:** Next.js 15, Mapbox GL
- **Port:** 3200

## Packages

| Package | Purpose |
|---------|---------|
| `@kosha/ui` | 30+ shared React components built on Radix UI primitives with Tailwind styling |
| `@kosha/types` | Domain types for orders, customers, products, accounts, visits, insights, tasks, captures |
| `@kosha/supabase` | Unified Supabase client with server/client/service exports and auth helpers |
| `@kosha/tailwind-config` | Shared Tailwind config with custom color system and animations |
| `@kosha/typescript-config` | Base, Next.js, and library tsconfig presets |
| `@kosha/eslint-config` | Shared lint rules (Prettier + Next.js) |

## Infrastructure

| Layer | Technology |
|-------|------------|
| Auth | Supabase (Google + Microsoft OAuth) |
| Database | Supabase PostgreSQL |
| Vector store | Supabase pgvector |
| Background jobs | Inngest (event-driven, on Vercel) |
| Hosting | Vercel (web apps) |
| Maps | Mapbox GL |
| Payments | Conductor |
| Email | Resend |

## Voice Pipeline

The core product loop — how a rep's spoken words become structured CRM data:

```
Rep speaks
  → Mic capture (16kHz mono PCM)
  → Voice Activity Detection (semantic VAD, on-device)
  → Streaming STT (Deepgram / Whisper)
  → LLM reasoning (Claude / GPT-4o) with account context
  → Streaming TTS (ElevenLabs)
  → Audio playback with barge-in support
  → [conversation ends]
  → Background pipeline: classify → extract → match accounts → sync to CRM
```

## Development

```bash
pnpm install              # Install all dependencies
pnpm dev                  # Start all apps in dev mode
pnpm build                # Build all apps
pnpm lint                 # Lint all apps
pnpm test                 # Run all tests
```

Individual apps:

```bash
pnpm --filter supplier dev        # Supplier on :3100
pnpm --filter distributor dev     # Distributor on :3000
pnpm --filter indexer dev         # Indexer on :3200
cd apps/field-rep-mobile && npx expo start   # Mobile dev server
```
