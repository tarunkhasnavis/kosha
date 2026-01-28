'use server'

/**
 * Organization Server Actions
 *
 * UI-facing server actions for organization management.
 *
 * NOTE: Organization creation now happens during OAuth callback (app/auth/callback/route.ts)
 * This ensures OAuth tokens are never lost. The onboarding flow updates the organization
 * name rather than creating a new one.
 */

import { createClient } from '@/utils/supabase/server'
import { getUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import type { OrgRequiredField } from '@/lib/orders/field-config'

const SUPER_ADMIN_ORG_COOKIE = 'super_admin_org_id'

/**
 * DEPRECATED: This function is kept for backwards compatibility but should not be used.
 * Organizations are now created during OAuth callback to ensure tokens are never lost.
 *
 * @deprecated Use the OAuth callback flow instead
 */
export async function createOrganization(organizationName: string): Promise<{ organizationId: string }> {
  const user = await getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const supabase = await createClient()

  // Check if user already has an organization (should always be true with new flow)
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (existingProfile?.organization_id) {
    // User already has an organization - just update its name
    await supabase
      .from('organizations')
      .update({ name: organizationName.trim() })
      .eq('id', existingProfile.organization_id)

    return { organizationId: existingProfile.organization_id }
  }

  // Fallback: Create org if somehow user doesn't have one (shouldn't happen with new flow)
  console.warn('createOrganization called but user has no org - this indicates a flow issue')

  const { data: newOrg, error: orgError } = await supabase
    .from('organizations')
    .insert({
      name: organizationName.trim(),
      gmail_email: user.email
    })
    .select()
    .single()

  if (orgError) {
    throw new Error('Failed to create organization: ' + orgError.message)
  }

  await supabase
    .from('profiles')
    .update({ organization_id: newOrg.id, role: 'owner' })
    .eq('id', user.id)

  revalidatePath('/', 'layout')
  revalidatePath('/orders')

  // Return organization ID - client will handle navigation
  // This ensures the database transaction is fully committed before redirect
  return { organizationId: newOrg.id }
}

/**
 * Save custom order fields for an organization
 */
export async function saveCustomFields(
  organizationId: string,
  fields: OrgRequiredField[]
): Promise<{ success: boolean; error?: string }> {
  const user = await getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const supabase = await createClient()

  // Verify user has access to this organization
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, role, is_super_admin')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return { success: false, error: 'Access denied' }
  }

  // Super admins can access any organization
  const isSuperAdmin = profile.is_super_admin === true

  if (!isSuperAdmin && profile.organization_id !== organizationId) {
    return { success: false, error: 'Access denied' }
  }

  // Only owners, admins, and super admins can modify settings
  if (!isSuperAdmin && profile.role !== 'owner' && profile.role !== 'admin') {
    return { success: false, error: 'Insufficient permissions' }
  }

  // Update the organization's required_order_fields
  const { error } = await supabase
    .from('organizations')
    .update({ required_order_fields: fields })
    .eq('id', organizationId)

  if (error) {
    console.error('Failed to save custom fields:', error)
    return { success: false, error: 'Failed to save custom fields' }
  }

  revalidatePath('/settings')
  revalidatePath('/orders')

  return { success: true }
}

/**
 * Switch to a different organization (super admin only)
 */
export async function switchOrganization(
  orgId: string | null
): Promise<{ success: boolean; error?: string }> {
  const user = await getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const supabase = await createClient()

  // Verify user is super admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_super_admin) {
    return { success: false, error: 'Access denied' }
  }

  const cookieStore = await cookies()

  if (orgId) {
    // Verify org exists
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('id', orgId)
      .single()

    if (!org) {
      return { success: false, error: 'Organization not found' }
    }

    // Set the cookie (8 hour expiry for security)
    cookieStore.set(SUPER_ADMIN_ORG_COOKIE, orgId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8,
      path: '/',
    })
  } else {
    // Clear the cookie to go back to own org
    cookieStore.delete(SUPER_ADMIN_ORG_COOKIE)
  }

  revalidatePath('/', 'layout')

  return { success: true }
}

/**
 * Check how many pending orders would be affected by new required fields
 * Returns count of orders in 'waiting_review' that are missing any of the new required fields
 */
export async function checkPendingOrdersForNewFields(
  organizationId: string,
  newRequiredFields: OrgRequiredField[],
  previousFields: OrgRequiredField[]
): Promise<{ affectedCount: number; error?: string }> {
  const user = await getUser()

  if (!user) {
    return { affectedCount: 0, error: 'Not authenticated' }
  }

  const supabase = await createClient()

  // Find truly new required fields (not in previous config)
  const previousFieldNames = new Set(previousFields.filter(f => f.required).map(f => f.field))
  const newlyAddedRequiredFields = newRequiredFields.filter(
    f => f.required && !previousFieldNames.has(f.field)
  )

  if (newlyAddedRequiredFields.length === 0) {
    return { affectedCount: 0 }
  }

  // Get all pending review orders for this org
  const { data: pendingOrders, error } = await supabase
    .from('orders')
    .select('id, custom_fields')
    .eq('organization_id', organizationId)
    .eq('status', 'waiting_review')

  if (error) {
    console.error('Failed to check pending orders:', error)
    return { affectedCount: 0, error: 'Failed to check pending orders' }
  }

  // Count orders missing any of the new required fields
  let affectedCount = 0
  for (const order of pendingOrders || []) {
    const customFields = (order.custom_fields || {}) as Record<string, unknown>
    const isMissingAny = newlyAddedRequiredFields.some(field => {
      const value = customFields[field.field]
      return value === null || value === undefined || value === ''
    })
    if (isMissingAny) {
      affectedCount++
    }
  }

  return { affectedCount }
}

/**
 * Revalidate pending orders after new required fields are added
 * Moves orders missing new required fields from 'waiting_review' to 'awaiting_clarification'
 */
export async function revalidatePendingOrdersForNewFields(
  organizationId: string,
  newRequiredFields: OrgRequiredField[],
  previousFields: OrgRequiredField[]
): Promise<{ movedCount: number; error?: string }> {
  const user = await getUser()

  if (!user) {
    return { movedCount: 0, error: 'Not authenticated' }
  }

  const supabase = await createClient()

  // Find truly new required fields (not in previous config)
  const previousFieldNames = new Set(previousFields.filter(f => f.required).map(f => f.field))
  const newlyAddedRequiredFields = newRequiredFields.filter(
    f => f.required && !previousFieldNames.has(f.field)
  )

  if (newlyAddedRequiredFields.length === 0) {
    return { movedCount: 0 }
  }

  // Get all pending review orders for this org
  const { data: pendingOrders, error } = await supabase
    .from('orders')
    .select('id, custom_fields')
    .eq('organization_id', organizationId)
    .eq('status', 'waiting_review')

  if (error) {
    console.error('Failed to get pending orders:', error)
    return { movedCount: 0, error: 'Failed to get pending orders' }
  }

  // Find orders missing any of the new required fields
  const ordersToMove: string[] = []
  for (const order of pendingOrders || []) {
    const customFields = (order.custom_fields || {}) as Record<string, unknown>
    const isMissingAny = newlyAddedRequiredFields.some(field => {
      const value = customFields[field.field]
      return value === null || value === undefined || value === ''
    })
    if (isMissingAny) {
      ordersToMove.push(order.id)
    }
  }

  if (ordersToMove.length === 0) {
    return { movedCount: 0 }
  }

  // Update these orders to awaiting_clarification
  const { error: updateError } = await supabase
    .from('orders')
    .update({ status: 'awaiting_clarification' })
    .in('id', ordersToMove)

  if (updateError) {
    console.error('Failed to update orders:', updateError)
    return { movedCount: 0, error: 'Failed to update orders' }
  }

  revalidatePath('/orders')

  return { movedCount: ordersToMove.length }
}

/**
 * Save system prompt for an organization
 */
export async function saveSystemPrompt(
  organizationId: string,
  systemPrompt: string | null
): Promise<{ success: boolean; error?: string }> {
  const user = await getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const supabase = await createClient()

  // Verify user has access to this organization
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, role, is_super_admin')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return { success: false, error: 'Access denied' }
  }

  // Super admins can access any organization
  const isSuperAdmin = profile.is_super_admin === true

  if (!isSuperAdmin && profile.organization_id !== organizationId) {
    return { success: false, error: 'Access denied' }
  }

  // Only owners, admins, and super admins can modify settings
  if (!isSuperAdmin && profile.role !== 'owner' && profile.role !== 'admin') {
    return { success: false, error: 'Insufficient permissions' }
  }

  // Update the organization's system_prompt
  const { error } = await supabase
    .from('organizations')
    .update({ system_prompt: systemPrompt || null })
    .eq('id', organizationId)

  if (error) {
    console.error('Failed to save system prompt:', error)
    return { success: false, error: 'Failed to save system prompt' }
  }

  revalidatePath('/settings')

  return { success: true }
}

/**
 * Update organization information (address, phone)
 */
export async function updateOrganizationInfo(
  organizationId: string,
  data: {
    address?: string | null
    phone?: string | null
  }
): Promise<{ success: boolean; error?: string }> {
  const user = await getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const supabase = await createClient()

  // Verify user has access to this organization
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, role, is_super_admin')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return { success: false, error: 'Access denied' }
  }

  // Super admins can access any organization
  const isSuperAdmin = profile.is_super_admin === true

  if (!isSuperAdmin && profile.organization_id !== organizationId) {
    return { success: false, error: 'Access denied' }
  }

  // Only owners, admins, and super admins can modify settings
  if (!isSuperAdmin && profile.role !== 'owner' && profile.role !== 'admin') {
    return { success: false, error: 'Insufficient permissions' }
  }

  // Update the organization
  const { error } = await supabase
    .from('organizations')
    .update({
      address: data.address,
      phone: data.phone,
    })
    .eq('id', organizationId)

  if (error) {
    console.error('Failed to update organization info:', error)
    return { success: false, error: 'Failed to update organization information' }
  }

  revalidatePath('/settings')

  return { success: true }
}
