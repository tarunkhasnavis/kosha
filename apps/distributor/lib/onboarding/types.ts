/**
 * Onboarding Types & Zod Schemas
 *
 * REQUIRED DATABASE MIGRATION (run in Supabase SQL Editor):
 * -----------------------------------------------------
 * CREATE TABLE onboarding_sessions (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 *   organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
 *   current_stage TEXT NOT NULL DEFAULT 'organization',
 *
 *   -- Collected data
 *   org_data JSONB DEFAULT '{}',
 *   products_imported INTEGER DEFAULT 0,
 *   order_example_saved BOOLEAN DEFAULT FALSE,
 *
 *   -- Chat context (for LLM)
 *   chat_summary TEXT,
 *   last_messages JSONB DEFAULT '[]',
 *
 *   -- Timestamps
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   updated_at TIMESTAMPTZ DEFAULT NOW(),
 *   completed_at TIMESTAMPTZ,
 *
 *   UNIQUE(user_id)
 * );
 *
 * -- Enable RLS
 * ALTER TABLE onboarding_sessions ENABLE ROW LEVEL SECURITY;
 *
 * -- Users can only access their own session
 * CREATE POLICY "Users can view own session"
 *   ON onboarding_sessions FOR SELECT
 *   USING (auth.uid() = user_id);
 *
 * CREATE POLICY "Users can insert own session"
 *   ON onboarding_sessions FOR INSERT
 *   WITH CHECK (auth.uid() = user_id);
 *
 * CREATE POLICY "Users can update own session"
 *   ON onboarding_sessions FOR UPDATE
 *   USING (auth.uid() = user_id);
 *
 * -- Index for fast lookups
 * CREATE INDEX idx_onboarding_sessions_user_id ON onboarding_sessions(user_id);
 * -----------------------------------------------------
 */

import { z } from 'zod'

// =============================================================================
// Stage Types
// =============================================================================

export type OnboardingStage = 'organization' | 'products' | 'order_example' | 'complete'

// Note: 'order_example' kept for backwards compatibility with existing sessions
// New flow: organization -> products -> complete (skips order_example)
export const ONBOARDING_STAGES: OnboardingStage[] = ['organization', 'products', 'complete']

export const STAGE_LABELS: Record<OnboardingStage, string> = {
  organization: 'Organization',
  products: 'Products',
  order_example: 'Order Example', // Legacy, not used in new flow
  complete: 'Complete',
}

// =============================================================================
// Action Types (Structured, not free-form strings)
// =============================================================================

export type OnboardingActionId =
  // Stage 2 - Products
  | 'confirm_products_import'
  | 'edit_products'
  | 'skip_products'
  | 'add_more_products'

export interface OnboardingAction {
  id: OnboardingActionId
  label: string
}

export const ACTION_LABELS: Record<OnboardingActionId, string> = {
  confirm_products_import: 'Import & Confirm',
  edit_products: 'Let me correct that',
  skip_products: 'Skip for now',
  add_more_products: 'Add more products',
}

// =============================================================================
// Zod Schemas (Treat LLM output as untrusted)
// =============================================================================

export const OnboardingActionSchema = z.object({
  id: z.enum([
    'confirm_products_import',
    'edit_products',
    'skip_products',
    'add_more_products',
  ]),
  label: z.string(),
})

export const ExtractedProductSchema = z.object({
  sku: z.string().optional(),
  name: z.string().min(1),
  unit_price: z.number().nonnegative(),
})

export const ExtractedOrderItemSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().positive(),
  quantity_unit: z.string().optional(),
  unit_price: z.number().nonnegative().optional(),
})

export const ExtractedOrderSchema = z.object({
  company_name: z.string().optional(),
  contact_name: z.string().optional(),
  contact_email: z.string().email().optional(),
  phone: z.string().optional(),
  items: z.array(ExtractedOrderItemSchema),
  notes: z.string().optional(),
  expected_date: z.string().optional(),
})

export const AIResponseExtractedDataSchema = z.object({
  products: z.array(ExtractedProductSchema).optional(),
  orderExtraction: ExtractedOrderSchema.optional(),
})

export const AIOnboardingResponseSchema = z.object({
  message: z.string().max(2000),
  extractedData: AIResponseExtractedDataSchema.optional(),
  stageComplete: z.boolean(),
  suggestedActions: z.array(OnboardingActionSchema).optional(),
})

// Infer types from schemas
export type ExtractedProduct = z.infer<typeof ExtractedProductSchema>
export type ExtractedOrderItem = z.infer<typeof ExtractedOrderItemSchema>
export type ExtractedOrder = z.infer<typeof ExtractedOrderSchema>
export type AIOnboardingResponse = z.infer<typeof AIOnboardingResponseSchema>

// =============================================================================
// Session & State Types
// =============================================================================

export interface OrgData {
  name: string | null
  phone: string | null
  address: string | null
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  richContent?: {
    type: 'product_preview' | 'order_extraction'
    data: ExtractedProduct[] | ExtractedOrder | null
  }
  attachment?: {
    name: string
    type: string
    size: number
  }
  actions?: OnboardingAction[]
  isGreeting?: boolean // Used for typing animation on initial messages
  hideAvatar?: boolean // Hide avatar for continuation messages in a sequence
}

export interface OnboardingSession {
  id: string
  userId: string
  organizationId: string | null
  currentStage: OnboardingStage
  orgData: OrgData
  productsImported: number
  orderExampleSaved: boolean
  chatSummary: string | null
  lastMessages: ChatMessage[]
  createdAt: Date
  updatedAt: Date
  completedAt: Date | null
}

// Database row type (snake_case)
export interface OnboardingSessionRow {
  id: string
  user_id: string
  organization_id: string | null
  current_stage: string
  org_data: OrgData
  products_imported: number
  order_example_saved: boolean
  chat_summary: string | null
  last_messages: ChatMessage[]
  created_at: string
  updated_at: string
  completed_at: string | null
}

// =============================================================================
// Client State (for useOnboardingState hook)
// =============================================================================

export interface OnboardingState {
  sessionId: string | null
  currentStage: OnboardingStage
  organizationId: string | null
  orgData: OrgData
  productsImported: number
  orderExampleSaved: boolean
  messages: ChatMessage[]
  isAiTyping: boolean
  isLoading: boolean
  error: string | null
}

export type OnboardingStateAction =
  | { type: 'SET_SESSION'; session: OnboardingSession }
  | { type: 'SET_STAGE'; stage: OnboardingStage }
  | { type: 'SET_ORG_ID'; organizationId: string }
  | { type: 'SET_ORG_DATA'; orgData: Partial<OrgData> }
  | { type: 'SET_PRODUCTS_IMPORTED'; count: number }
  | { type: 'SET_ORDER_EXAMPLE_SAVED'; saved: boolean }
  | { type: 'ADD_USER_MESSAGE'; message: ChatMessage }
  | { type: 'ADD_AI_MESSAGE'; message: ChatMessage }
  | { type: 'SET_AI_TYPING'; isTyping: boolean }
  | { type: 'SET_LOADING'; isLoading: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'RESET' }

// =============================================================================
// API Request/Response Types
// =============================================================================

export interface OnboardingChatRequest {
  request_id: string
  session_id: string
  message: string
  stage: OnboardingStage
  attachments?: {
    name: string
    type: string
    content: string // base64 for files, raw text for text
  }[]
  action?: OnboardingActionId // If user clicked an action button
}

export interface OnboardingChatResponse {
  request_id: string
  message: ChatMessage
  session: {
    currentStage: OnboardingStage
    productsImported: number
    orderExampleSaved: boolean
  }
  error?: string
}

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Server-side validation for stage completion
 * Never trust stageComplete from the model alone
 */
export function validateStageComplete(
  stage: OnboardingStage,
  action: OnboardingActionId | undefined,
  productsImported: number
): boolean {
  switch (stage) {
    case 'products':
      return action === 'confirm_products_import' || action === 'skip_products'
    default:
      return false
  }
}

/**
 * Get the next stage after current stage
 */
export function getNextStage(current: OnboardingStage): OnboardingStage {
  const index = ONBOARDING_STAGES.indexOf(current)
  if (index === -1 || index >= ONBOARDING_STAGES.length - 1) {
    return 'complete'
  }
  return ONBOARDING_STAGES[index + 1]
}
