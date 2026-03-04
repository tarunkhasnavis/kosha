'use server'

import { createClient } from '@kosha/supabase/server'
import { getUser } from '@kosha/supabase'
import { revalidatePath } from 'next/cache'
import { importProducts as importProductsBase } from '@/lib/products/actions'
import { saveOrderExample } from '@/lib/ai/embeddings'
import {
  OnboardingSession,
  OnboardingSessionRow,
  OnboardingStage,
  ChatMessage,
  OrgData,
  ExtractedProduct,
  ExtractedOrder,
} from './types'

// Convert database row to typed session
function rowToSession(row: OnboardingSessionRow): OnboardingSession {
  return {
    id: row.id,
    userId: row.user_id,
    organizationId: row.organization_id,
    currentStage: row.current_stage as OnboardingStage,
    orgData: row.org_data,
    productsImported: row.products_imported,
    orderExampleSaved: row.order_example_saved,
    chatSummary: row.chat_summary,
    lastMessages: row.last_messages || [],
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
  }
}

/**
 * Get or create onboarding session for the current user.
 *
 * IMPORTANT: This function handles orphan recovery scenarios where the session
 * state may be inconsistent with reality (e.g., user has org but session says 'organization').
 * It heals the session state to match the actual database state.
 */
export async function getOrCreateOnboardingSession(): Promise<{
  session: OnboardingSession | null
  error?: string
}> {
  const user = await getUser()
  if (!user) {
    return { session: null, error: 'Not authenticated' }
  }

  const supabase = await createClient()

  // Get user's profile to check actual org state
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  // Get organization details if user has one
  let orgData: OrgData = { name: null, phone: null, address: null }
  if (profile?.organization_id) {
    const { data: org } = await supabase
      .from('organizations')
      .select('name, phone, address')
      .eq('id', profile.organization_id)
      .single()

    if (org) {
      orgData = { name: org.name, phone: org.phone, address: org.address }
    }
  }

  // Get product count if user has an org
  let productCount = 0
  if (profile?.organization_id) {
    const { count } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', profile.organization_id)

    productCount = count || 0
  }

  // Try to get existing session
  const { data: existing, error: fetchError } = await supabase
    .from('onboarding_sessions')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (existing && !fetchError) {
    const session = rowToSession(existing)

    // ORPHAN RECOVERY: Heal session state if inconsistent with reality
    const needsHealing = await healSessionIfNeeded(
      supabase,
      session,
      profile?.organization_id || null,
      orgData,
      productCount
    )

    if (needsHealing) {
      // Re-fetch the healed session
      const { data: healed } = await supabase
        .from('onboarding_sessions')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (healed) {
        return { session: rowToSession(healed) }
      }
    }

    return { session }
  }

  // No existing session - create one starting at 'organization' stage
  // Note: 'order_example' stage has been removed from the flow
  // New users ALWAYS start at 'organization' stage to set their org name.
  // Session state is the single source of truth - we don't skip stages based on DB state.
  const initialStage: OnboardingStage = 'organization'

  const { data: created, error: createError } = await supabase
    .from('onboarding_sessions')
    .insert({
      user_id: user.id,
      organization_id: profile?.organization_id || null,
      current_stage: initialStage,
      org_data: orgData,
      products_imported: productCount,
      order_example_saved: false,
      last_messages: [],
    })
    .select()
    .single()

  if (createError || !created) {
    console.error('Failed to create onboarding session:', createError)
    return { session: null, error: 'Failed to create session' }
  }

  return { session: rowToSession(created) }
}

/**
 * Heal session state if it's inconsistent with database reality.
 * Returns true if healing was performed.
 *
 * IMPORTANT: We do NOT skip Stage 1 based on org name. The session's currentStage
 * is the single source of truth. If session says 'organization', user must complete
 * Stage 1 regardless of what the org name looks like.
 *
 * Scenarios handled:
 * 1. Session is missing organization_id but user has one → sync it (don't change stage)
 * 2. Sync product count if session is behind
 *
 * Note: 'order_example' stage has been removed from the flow
 */
async function healSessionIfNeeded(
  supabase: Awaited<ReturnType<typeof createClient>>,
  session: OnboardingSession,
  actualOrgId: string | null,
  actualOrgData: OrgData,
  actualProductCount: number
): Promise<boolean> {
  const updates: Record<string, unknown> = {}
  let needsUpdate = false

  // We intentionally do NOT advance stage based on org existence.
  // Session state is the single source of truth for onboarding progress.

  // Case 2: Session missing organization_id but user has one
  if (!session.organizationId && actualOrgId) {
    console.log('[Onboarding] Healing orphan: Session missing organization_id')
    updates.organization_id = actualOrgId
    updates.org_data = actualOrgData
    needsUpdate = true
  }

  // Case 3: Session says 'products' but already has products imported
  // Only advance if user explicitly skipped or confirmed - don't auto-advance
  // (We track this via productsImported in session, not just product count)

  // Case 4: Sync product count if session is behind
  if (session.productsImported < actualProductCount) {
    updates.products_imported = actualProductCount
    needsUpdate = true
  }

  if (needsUpdate) {
    updates.updated_at = new Date().toISOString()

    const { error } = await supabase
      .from('onboarding_sessions')
      .update(updates)
      .eq('id', session.id)

    if (error) {
      console.error('[Onboarding] Failed to heal session:', error)
      return false
    }

    console.log('[Onboarding] Session healed successfully:', updates)
    return true
  }

  return false
}

/**
 * Get onboarding session for the current user
 */
export async function getOnboardingSession(): Promise<{
  session: OnboardingSession | null
  error?: string
}> {
  const user = await getUser()
  if (!user) {
    return { session: null, error: 'Not authenticated' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('onboarding_sessions')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error || !data) {
    return { session: null }
  }

  return { session: rowToSession(data) }
}

/**
 * Update onboarding session
 */
export async function updateOnboardingSession(
  sessionId: string,
  updates: Partial<{
    currentStage: OnboardingStage
    organizationId: string
    orgData: OrgData
    productsImported: number
    orderExampleSaved: boolean
    chatSummary: string
    lastMessages: ChatMessage[]
    completedAt: Date
  }>
): Promise<{ success: boolean; error?: string }> {
  const user = await getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const supabase = await createClient()

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (updates.currentStage !== undefined) updateData.current_stage = updates.currentStage
  if (updates.organizationId !== undefined) updateData.organization_id = updates.organizationId
  if (updates.orgData !== undefined) updateData.org_data = updates.orgData
  if (updates.productsImported !== undefined) updateData.products_imported = updates.productsImported
  if (updates.orderExampleSaved !== undefined) updateData.order_example_saved = updates.orderExampleSaved
  if (updates.chatSummary !== undefined) updateData.chat_summary = updates.chatSummary
  if (updates.lastMessages !== undefined) updateData.last_messages = updates.lastMessages
  if (updates.completedAt !== undefined) updateData.completed_at = updates.completedAt.toISOString()

  const { error } = await supabase
    .from('onboarding_sessions')
    .update(updateData)
    .eq('id', sessionId)
    .eq('user_id', user.id)

  if (error) {
    console.error('Failed to update onboarding session:', error)
    return { success: false, error: 'Failed to update session' }
  }

  return { success: true }
}

/**
 * Update organization from onboarding (Stage 1)
 *
 * ARCHITECTURE: Organization is created during OAuth callback with a placeholder name.
 * This function updates the organization with the user-provided name and details.
 * This ensures OAuth tokens are never lost (they go directly to org during callback).
 */
export async function createOnboardingOrganization(
  sessionId: string,
  name: string,
  phone?: string,
  address?: string
): Promise<{
  success: boolean
  organizationId?: string
  error?: string
}> {
  const user = await getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const supabase = await createClient()

  try {
    // Get user's existing organization (created during OAuth callback)
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (!profile?.organization_id) {
      // This shouldn't happen with the new flow, but handle it gracefully
      console.error('No organization found for user - this indicates a callback flow issue')
      return {
        success: false,
        error: 'No organization found. Please sign out and sign in again.',
      }
    }

    const organizationId = profile.organization_id

    // Update organization with user-provided name and details
    const { error: updateError } = await supabase
      .from('organizations')
      .update({
        name: name.trim(),
        phone: phone || null,
        address: address || null,
      })
      .eq('id', organizationId)

    if (updateError) {
      console.error('Failed to update organization:', updateError)
      return {
        success: false,
        error: 'Failed to update organization: ' + updateError.message,
      }
    }

    console.log('✅ Organization updated:', organizationId, 'Name:', name)

    // Update onboarding session
    await updateOnboardingSession(sessionId, {
      organizationId,
      orgData: { name, phone: phone || null, address: address || null },
      currentStage: 'products',
    })

    return { success: true, organizationId }
  } catch (error) {
    console.error('Failed to update organization:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update organization',
    }
  }
}

/**
 * Import products from onboarding (Stage 2)
 * Note: importProducts() uses upsert, so duplicates just update existing records
 */
export async function importOnboardingProducts(
  sessionId: string,
  products: ExtractedProduct[]
): Promise<{
  success: boolean
  imported: number
  error?: string
}> {
  const user = await getUser()
  if (!user) {
    return { success: false, imported: 0, error: 'Not authenticated' }
  }

  if (products.length === 0) {
    return { success: true, imported: 0 }
  }

  try {
    const rows = products.map((p, i) => ({
      sku: p.sku || `PROD-${Date.now()}-${i}`,
      name: p.name,
      unit_price: p.unit_price,
    }))

    const result = await importProductsBase(rows)

    if (result.error) {
      return { success: false, imported: 0, error: result.error }
    }

    const totalImported = result.created + result.updated

    const { session } = await getOnboardingSession()
    if (session) {
      await updateOnboardingSession(sessionId, {
        productsImported: (session.productsImported || 0) + totalImported,
      })
    }

    revalidatePath('/products')

    return { success: true, imported: totalImported }
  } catch (error) {
    console.error('Failed to import products:', error)
    return {
      success: false,
      imported: 0,
      error: error instanceof Error ? error.message : 'Failed to import products',
    }
  }
}

/**
 * Save order example from onboarding (Stage 3)
 */
export async function saveOnboardingOrderExample(
  sessionId: string,
  rawInput: string,
  extractedOrder: ExtractedOrder
): Promise<{
  success: boolean
  error?: string
}> {
  const user = await getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { session } = await getOnboardingSession()
  if (!session?.organizationId) {
    return { success: false, error: 'No organization found' }
  }

  try {
    const orderData: Record<string, unknown> = {
      companyName: extractedOrder.company_name,
      contactName: extractedOrder.contact_name,
      contactEmail: extractedOrder.contact_email,
      phone: extractedOrder.phone,
      items: extractedOrder.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        quantityUnit: item.quantity_unit || 'units',
        unitPrice: item.unit_price,
      })),
      notes: extractedOrder.notes,
      expectedDate: extractedOrder.expected_date,
    }

    const result = await saveOrderExample(
      rawInput,
      orderData,
      session.organizationId,
      'onboarding-example',
      true,
      { docType: 'onboarding' }
    )

    if (!result.success) {
      return { success: false, error: result.error }
    }

    await updateOnboardingSession(sessionId, {
      orderExampleSaved: true,
    })

    return { success: true }
  } catch (error) {
    console.error('Failed to save order example:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save order example',
    }
  }
}

/**
 * Advance to the next onboarding stage
 */
export async function advanceOnboardingStage(
  sessionId: string,
  currentStage: OnboardingStage
): Promise<{ success: boolean; nextStage?: OnboardingStage; error?: string }> {
  // Use ONBOARDING_STAGES which defines the actual flow (skips order_example)
  const stageOrder: OnboardingStage[] = ['organization', 'products', 'complete']
  const currentIndex = stageOrder.indexOf(currentStage)

  if (currentIndex === -1 || currentIndex >= stageOrder.length - 1) {
    return { success: false, error: 'Invalid stage' }
  }

  const nextStage = stageOrder[currentIndex + 1]

  const result = await updateOnboardingSession(sessionId, {
    currentStage: nextStage,
    completedAt: nextStage === 'complete' ? new Date() : undefined,
  })

  if (!result.success) {
    return { success: false, error: result.error }
  }

  return { success: true, nextStage }
}

/**
 * Complete onboarding
 */
export async function completeOnboarding(sessionId: string): Promise<{
  success: boolean
  error?: string
}> {
  const result = await updateOnboardingSession(sessionId, {
    currentStage: 'complete',
    completedAt: new Date(),
  })

  if (!result.success) {
    return { success: false, error: result.error }
  }

  revalidatePath('/orders')

  return { success: true }
}
