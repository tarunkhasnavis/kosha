# Customer Memory System - Design Engineering Scoping Document

## Overview

Build an intelligent customer memory system that automatically learns and remembers customer-specific facts from email interactions, eliminating the need to repeatedly ask customers for information already provided.

## Problem Statement

When a customer sends an order without required information (e.g., liquor license), the system asks for it. Once provided, this information should be remembered for future orders from the same customer. Currently, every order is processed independently with no memory of past interactions.

---

## Architecture

### Two Complementary Approaches

| Approach | Use Case | Example |
|----------|----------|---------|
| **Structured Memory** | Known facts with named fields | Liquor license, billing address, payment terms |
| **RAG (Retrieval)** | Searching unknown/varied content | "Same as last week", learning from corrections |

### Decision Framework

> **"Can you name the field ahead of time?"**
> - **Yes** → Structured Memory (fast, deterministic)
> - **No** → RAG (semantic search, discovery)

### How They Work Together

```
┌─────────────────────────────────────────────────────────────┐
│                     EMAIL PROCESSING                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  AI extracts order + identifies NEW LEARNABLE FACTS         │
│                                                             │
│  Order: { items: [...], total: $150 }                       │
│  NewFacts: [                                                │
│    { key: "liquor_license", value: "ABC-123", conf: 0.92 }, │
│    { key: "preferred_delivery", value: "morning", conf: 0.8}│
│  ]                                                          │
└─────────────────────────────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
┌──────────────────────┐    ┌──────────────────────────────┐
│   Create Order       │    │   Auto-save to Structured    │
│   (normal flow)      │    │   Memory (if confidence > X) │
└──────────────────────┘    └──────────────────────────────┘
                                          │
                                          ▼
                            ┌──────────────────────────────┐
                            │  Next order from customer:   │
                            │  Fetch known facts → inject  │
                            │  into AI prompt context      │
                            └──────────────────────────────┘
```

---

## Database Schema

### Table: `customer_memory`

```sql
CREATE TABLE customer_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  customer_identifier TEXT NOT NULL,  -- Email domain (e.g., "acme.com")
  field_key TEXT NOT NULL,            -- e.g., "liquor_license", "billing_address"
  field_value TEXT NOT NULL,          -- The actual value
  confidence FLOAT DEFAULT 1.0,       -- 0.0 - 1.0
  source_type TEXT NOT NULL,          -- "ai_extraction" | "user_correction"
  source_order_id UUID REFERENCES orders(id),
  source_email_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (organization_id, customer_identifier, field_key)
);

CREATE INDEX idx_customer_memory_lookup
  ON customer_memory(organization_id, customer_identifier);
```

### Column Definitions

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `organization_id` | UUID | Foreign key to organizations table |
| `customer_identifier` | TEXT | Email domain (e.g., "acme.com") - groups all emails from same company |
| `field_key` | TEXT | The type of fact (e.g., "liquor_license", "billing_address") |
| `field_value` | TEXT | The actual value of the fact |
| `confidence` | FLOAT | AI confidence score 0.0-1.0 (1.0 = user-verified) |
| `source_type` | TEXT | How the fact was learned: "ai_extraction" or "user_correction" |
| `source_order_id` | UUID | Which order triggered this learning (nullable) |
| `source_email_id` | UUID | Which email contained this fact (nullable) |
| `created_at` | TIMESTAMPTZ | When first learned |
| `updated_at` | TIMESTAMPTZ | When last updated |

### Example Data

| customer_identifier | field_key | field_value | confidence | source_type |
|---------------------|-----------|-------------|------------|-------------|
| acme.com | liquor_license | ABC-12345 | 0.92 | ai_extraction |
| acme.com | billing_address | 123 Main St, NYC | 0.88 | ai_extraction |
| acme.com | payment_terms | Net 30 | 1.0 | user_correction |
| bobs-diner.com | preferred_delivery_time | before 10am | 0.75 | ai_extraction |

---

## Implementation Phases

### Phase 1: Database & Basic CRUD
- Create `customer_memory` table migration
- Create `lib/actions/customerMemory.ts` with:
  - `getCustomerMemory(organizationId, customerIdentifier)`
  - `upsertCustomerFact(organizationId, customerIdentifier, fieldKey, fieldValue, sourceType, confidence)`
  - `getCustomerIdentifierFromEmail(email: string)` - extracts domain

**Estimated Complexity:** Low

### Phase 2: AI Extraction Integration
- Modify `processEmailWithAI` return type to include `newCustomerFacts[]`
- Update AI prompt to identify learnable facts with confidence scores
- Add TypeScript interfaces for new data structures

**Estimated Complexity:** Medium

### Phase 3: Auto-Learning Pipeline
- After order creation in `handleEmailOrder.ts`:
  - Save high-confidence facts (> 0.85) automatically
  - Queue medium-confidence facts (0.6 - 0.85) for optional user review
  - Discard low-confidence facts (< 0.6)

**Estimated Complexity:** Medium

### Phase 4: Context Injection
- Before processing new emails, fetch known facts for customer
- Inject into AI prompt as `=== KNOWN CUSTOMER INFORMATION ===`
- AI uses known facts instead of asking again
- Update `handleEmailOrder.ts` to call `getCustomerMemory` before AI processing

**Estimated Complexity:** Low

### Phase 5: User Corrections (Optional Enhancement)
- When user edits customer fields in UI, save as `source_type: 'user_correction'`
- User corrections always override AI extractions (confidence = 1.0)
- Add UI component for viewing/editing customer memory

**Estimated Complexity:** Medium

---

## AI Prompt Modifications

### For Extraction (add to existing prompt in `processEmail.ts`):

```
CUSTOMER LEARNING:
If you discover any of these facts about the customer, include them in "newCustomerFacts":
- liquor_license: Any liquor/alcohol license number
- billing_address: Customer's billing or delivery address
- phone: Customer's phone number
- payment_terms: Payment terms (Net 30, COD, Credit Card, etc.)
- preferred_delivery_time: When they prefer deliveries
- contact_name: Primary contact person's name
- delivery_instructions: Standing delivery instructions

Format in response JSON:
"newCustomerFacts": [
  { "key": "liquor_license", "value": "ABC-12345", "confidence": 0.92 }
]

Only include facts you're confident about (confidence > 0.6).
Do NOT include facts that are order-specific (like delivery date for THIS order).
Only include facts that would apply to FUTURE orders from this customer.
```

### For Context Injection (prepend to email context):

```
=== KNOWN CUSTOMER INFORMATION ===
Customer: acme.com
- Liquor License: ABC-12345 (verified)
- Billing Address: 123 Main St, NYC
- Payment Terms: Net 30
- Preferred Delivery: Before 10am
=== END KNOWN CUSTOMER INFO ===

Use this information to pre-fill order fields. Do NOT ask the customer for information already known above.
```

---

## Key Design Decisions

### 1. Customer Identifier Strategy
**Decision:** Use email domain (`acme.com`) not full email address

**Rationale:** Multiple people from the same company (chef@acme.com, orders@acme.com) should share the same customer memory. A restaurant's liquor license doesn't change based on who sends the email.

### 2. Flexible Field Keys
**Decision:** `field_key` is a TEXT field, not an ENUM

**Rationale:** AI can discover new types of facts we haven't thought of yet. More extensible than a fixed schema.

### 3. Source Type Precedence
**Decision:** `user_correction` always wins over `ai_extraction`

**Rationale:** If a user manually corrects a fact, that's the source of truth. AI confidence should never override explicit human input.

### 4. Confidence Thresholds
| Confidence | Action |
|------------|--------|
| `> 0.85` | Auto-save to memory |
| `0.6 - 0.85` | Optional: queue for user review |
| `< 0.6` | Discard (too uncertain) |

### 5. Upsert Pattern
**Decision:** One value per (organization_id, customer_identifier, field_key)

**Rationale:** If a customer's address changes, we want the latest value, not a history. Updates replace old values (with updated_at timestamp).

---

## Integration Points

| File | Change Required |
|------|-----------------|
| `lib/actions/processEmail.ts` | Add `newCustomerFacts` to `ParsedOrderData`, update AI prompt |
| `lib/actions/handleEmailOrder.ts` | Fetch known facts before AI, save new facts after order creation |
| `lib/actions/customerMemory.ts` | **New file** - CRUD operations for customer_memory table |
| `supabase/migrations/` | **New migration** - create customer_memory table |
| `types/customerMemory.ts` | **New file** - TypeScript interfaces |

---

## TypeScript Interfaces

```typescript
// types/customerMemory.ts

export interface CustomerFact {
  id: string
  organization_id: string
  customer_identifier: string
  field_key: string
  field_value: string
  confidence: number
  source_type: 'ai_extraction' | 'user_correction'
  source_order_id?: string
  source_email_id?: string
  created_at: string
  updated_at: string
}

export interface NewCustomerFact {
  key: string
  value: string
  confidence: number
}

export interface CustomerMemoryContext {
  customerIdentifier: string
  facts: Record<string, { value: string; confidence: number; source: string }>
}
```

---

## Success Metrics

| Metric | How to Measure |
|--------|----------------|
| Clarification email reduction | Compare clarification rate for new vs returning customers |
| First-submission completeness | % of orders complete on first email (no clarification needed) |
| Time per order | Track processing time for returning customers |
| Memory accuracy | % of auto-saved facts that users don't correct |

---

## Future Enhancements (Out of Scope for V1)

1. **RAG for Order History** - "Same as last week" requires searching past orders
2. **Customer Memory UI** - Dashboard to view/edit all known facts per customer
3. **Memory Decay** - Reduce confidence over time for stale facts
4. **Bulk Import** - Import existing customer data from spreadsheets
5. **Memory Sharing** - Share memory across organizations (for chains/franchises)

---

## Appendix: RAG vs Structured Memory

### When to Use Structured Memory
- You can name the field ahead of time
- The data has a consistent format
- Fast, deterministic lookups are needed
- Examples: liquor_license, billing_address, payment_terms

### When to Use RAG
- You don't know what data will be useful
- Semantic similarity matters ("chicken" should match "poultry")
- Discovery/search across unstructured content
- Examples: "same as last week", finding relevant past orders

### The Relationship
RAG and Structured Memory are not separate silos - they work together:

1. **RAG discovers** → AI searches past interactions
2. **AI extracts** → Identifies learnable facts with confidence scores
3. **Structured Memory stores** → High-confidence facts saved for fast retrieval
4. **Fast retrieval** → Next order uses structured data directly

This is called **Progressive Knowledge Extraction** - standard practice in production AI systems.

---

*Document created: December 2024*
*Last updated: December 2024*
