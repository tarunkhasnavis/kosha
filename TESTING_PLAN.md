# Testing Plan

## Current Status
- **Coverage**: 7.06% statements, 156 tests passing
- **Target**: 80%+ on `lib/` directory

## Phase 1: Foundation ✅
- [x] Set up Vitest + React Testing Library
- [x] Add test scripts to package.json
- [x] Create first tests for utility files

## Phase 2: Quick Wins - Pure Functions ✅
Pure functions with zero dependencies:

| File | Status | Tests | Coverage |
|------|--------|-------|----------|
| `lib/orders/completeness.ts` | ✅ | 34 | 96.55% |
| `lib/orders/field-config.ts` | ✅ | 47 | 100% |
| `lib/email/attachments.ts` | ✅ | 40 | partial |
| `types/orders.ts` | ✅ | 17 | 100% |

## Phase 3: Database Layer (Medium) 🔄
Requires Supabase mocking:

| File | Status | Tests |
|------|--------|-------|
| `lib/orders/services.ts` | ⬜ | ~20 |
| `lib/orders/queries.ts` | ⬜ | ~25 |
| `lib/organizations/queries.ts` | ⬜ | ~12 |

## Phase 4: AI/External APIs (Hard)
Critical paths requiring OpenAI mocking:

| File | Priority | Status | Tests |
|------|----------|--------|-------|
| `lib/email/parser.ts` | **P0** | ⬜ | ~40 |
| `lib/email/handler.ts` | **P0** | ⬜ | ~25 |
| `lib/ai/embeddings.ts` | P1 | ⬜ | ~15 |

## Phase 5: Server Actions (Hard)
Main UI entry points:

| File | Priority | Status | Tests |
|------|----------|--------|-------|
| `lib/orders/actions.ts` | **P0** | ⬜ | ~50 |
| `lib/organizations/actions.ts` | P2 | ⬜ | ~15 |

## Test Infrastructure
```
__tests__/
├── factories/          # createOrder(), createEmail(), etc.
├── mocks/              # supabase.mock.ts, openai.mock.ts
├── fixtures/           # Sample emails, AI responses
└── lib/                # Unit tests mirroring src
```

## Definition of Done
- [ ] All P0 functions have 90%+ coverage
- [ ] All P1 functions have 80%+ coverage
- [ ] Overall `lib/` coverage at 80%+
- [ ] Enable TypeScript strict checks in build
- [ ] Remove build error suppression

## Resources
- [Testing Library Principles](https://testing-library.com/docs/guiding-principles)
- [Vitest Documentation](https://vitest.dev/)
- [Kent C. Dodds Testing JavaScript](https://testingjavascript.com/)
