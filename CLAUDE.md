# CLAUDE.md

This file provides guidance for Claude Code when working with this codebase.

## Core Philosophy

We are incrementally adopting Test-Driven Development (TDD) with a strong emphasis on behavior-driven testing and functional programming principles. All new work should be done in small, incremental changes that maintain a working state throughout development.

### Guiding Principles

- **Test behavior, not implementation** - Tests should document expected business behavior
- **No `any` types** - Use `unknown` if type is truly unknown
- **Prefer immutability** - Avoid data mutation where possible
- **Small, pure functions** - Functions should do one thing well
- **Self-documenting code** - Favor clear naming over comments

### Development Workflow (Target State)

- **RED**: Write failing test first
- **GREEN**: Write minimum code to pass test
- **REFACTOR**: Improve code while tests pass
- Each increment leaves codebase in working state

> **Note**: Testing infrastructure is being adopted incrementally. New features and bug fixes should include tests. Legacy code will be covered over time.

---

## Project Overview

Kosha is a multi-tenant order management system with AI-powered email processing. It enables businesses to receive orders via email (with attachments), process them using AI extraction, and manage the full order lifecycle.

## Tech Stack

- **Framework**: Next.js 15 (App Router) with React 19
- **Language**: TypeScript (strict mode)
- **Database**: Supabase PostgreSQL with Row Level Security (RLS)
- **Auth**: Supabase Auth with Google OAuth
- **Styling**: Tailwind CSS + shadcn/ui (Radix primitives)
- **AI**: OpenAI API (GPT for extraction, text-embedding-3-small for RAG)
- **Email**: Gmail API with Pub/Sub webhooks
- **Testing**: Vitest + React Testing Library (adopting)

## Project Structure

```
app/
├── (app)/          # Protected routes (dashboard, orders, products, etc.)
├── api/            # API routes (webhooks, cron, admin endpoints)
├── auth/           # OAuth callback handler
├── login/          # Public login page
└── onboarding/     # Multi-step onboarding flow

lib/
├── ai/             # OpenAI integration (embeddings, extraction)
├── email/          # Gmail integration, email parsing, attachments
├── orders/         # Order management (actions, services, queries, utils)
├── organizations/  # Organization management and OAuth
├── products/       # Product catalog management
└── integrations/   # Third-party integrations (WooCommerce)

components/
├── ui/             # shadcn/ui components
└── ...             # App-specific components

utils/
└── supabase/       # Supabase client setup (server, client, service)

__tests__/          # Test files (mirror src structure)
```

## Key Architecture Patterns

### Server Actions vs Queries
- **Actions** (`*.actions.ts`): Server-side mutations using `'use server'`
- **Queries** (`*.queries.ts`): Read-only database access
- **Services** (`*.services.ts`): Business logic helpers (most testable)

### Supabase Client Levels
- **Server client** (`createClient()`): For server components/actions, respects RLS
- **Client-side client**: For browser operations
- **Service client** (`createServiceClient()`): Admin operations, bypasses RLS

### Email Processing Pipeline
1. Gmail Pub/Sub webhook triggers `/api/webhooks/gmail`
2. Fetch emails via Gmail API
3. Parse with AI (`lib/email/parser.ts`)
4. Process attachments (images, PDFs, Excel)
5. Create/update orders in database

### Order Status Flow
`waiting_review` → `approved` | `rejected` | `awaiting_clarification` → `processing` → `archived`

## Common Commands

```bash
# Development
pnpm dev          # Start dev server
pnpm build        # Production build
pnpm lint         # Run ESLint
pnpm format       # Format with Prettier

# Testing (once set up)
pnpm test         # Run tests
pnpm test:watch   # Run tests in watch mode
pnpm test:coverage # Run tests with coverage
```

## Database Tables

Key tables (all have RLS enabled):
- `organizations` - Org settings, encrypted Gmail tokens
- `orders` - Order headers with status and metadata
- `order_items` - Line items linked to orders
- `products` - Master product catalog
- `profiles` - User profiles linked to organizations
- `order_examples` - RAG embeddings for AI learning

## Environment Variables

Required (see `lib/env.ts` for Zod validation):
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `TOKEN_ENCRYPTION_KEY` (64-char hex for Gmail token encryption)

## Code Style

### Formatting
- **No semicolons**, single quotes, 2-space indentation
- **Trailing commas**: ES5 style
- **Path alias**: `@/*` maps to project root

### TypeScript Guidelines
- No `any` types - use `unknown` if type is truly unknown
- No type assertions without justification
- Prefer `type` over `interface` for data structures
- Use Zod schemas at trust boundaries, derive types with `z.infer<>`

### Functional Patterns
- Prefer immutable data - avoid mutation
- Use pure functions where possible
- Use early returns over nested if/else
- Prefer `map`, `filter`, `reduce` over loops
- Prefer options objects over many positional parameters

### Component Patterns
- Use shadcn/ui components from `components/ui/`
- Follow existing patterns for new features

## Testing Guidelines

### Philosophy
- Test behavior, not implementation details
- Tests should document expected business behavior
- Use factory functions for test data
- Test through public API exclusively

### What to Test First (Priority Order)
1. **Services** (`lib/*/services.ts`) - Pure business logic, easiest to test
2. **Utilities** (`lib/*/utils/`) - Helper functions
3. **API routes** - Integration tests for endpoints
4. **Components** - User interaction behavior

### Test File Location
- Place tests in `__tests__/` directory mirroring source structure
- Example: `lib/orders/services.ts` → `__tests__/lib/orders/services.test.ts`

## Key Files

- `lib/email/parser.ts` - AI-powered email parsing logic
- `lib/orders/actions.ts` - Order CRUD operations
- `lib/orders/services.ts` - Order business logic (good test candidate)
- `lib/ai/embeddings.ts` - RAG for order extraction
- `app/(app)/layout.tsx` - Protected route wrapper with `requireAuth()`
- `utils/supabase/*.ts` - Database client configuration

## Important Notes

- All database operations should use the appropriate Supabase client level
- OAuth tokens are encrypted before storage (`lib/tokenEncryption.ts`)
- Multi-tenant: Always filter by `organization_id`
- Build currently ignores ESLint/TS errors (goal: fix and enable)


## Resources

- [Testing Library Principles](https://testing-library.com/docs/guiding-principles)
- [Vitest Documentation](https://vitest.dev/)
