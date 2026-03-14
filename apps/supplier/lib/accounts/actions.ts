'use server'

/**
 * Account Server Actions
 *
 * CRUD operations for account management.
 * Mutations only — read operations are in queries.ts
 */

import { createClient } from '@kosha/supabase/server'
import { getUser } from '@kosha/supabase'
import { getOrganizationId } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { geocodeAddress } from '@/lib/geocoding'
import type { Account, CreateAccountInput, UpdateAccountInput } from '@kosha/types'

/**
 * Create a new account
 */
export async function createAccount(
  input: CreateAccountInput
): Promise<{ account: Account | null; error?: string }> {
  const user = await getUser()
  if (!user) {
    return { account: null, error: 'Not authenticated' }
  }

  const orgId = await getOrganizationId()
  if (!orgId) {
    return { account: null, error: 'No organization found' }
  }

  const supabase = await createClient()

  // Auto-geocode if address provided but no coordinates
  let latitude = input.latitude || null
  let longitude = input.longitude || null
  if (input.address?.trim() && !latitude && !longitude) {
    const coords = await geocodeAddress(input.address.trim())
    if (coords) {
      latitude = coords.latitude
      longitude = coords.longitude
    }
  }

  const { data, error } = await supabase
    .from('accounts')
    .insert({
      user_id: user.id,
      organization_id: orgId,
      name: input.name.trim(),
      industry: input.industry?.trim() || null,
      address: input.address?.trim() || null,
      premise_type: input.premise_type || null,
      latitude,
      longitude,
      phone: input.phone?.trim() || null,
      website: input.website?.trim() || null,
      hours: input.hours?.trim() || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create account:', error)
    return { account: null, error: 'Failed to create account' }
  }

  revalidatePath('/accounts')

  revalidatePath('/territory')
  return { account: data as Account }
}

/**
 * Update an existing account
 */
export async function updateAccount(
  accountId: string,
  input: UpdateAccountInput
): Promise<{ account: Account | null; error?: string }> {
  const user = await getUser()
  if (!user) {
    return { account: null, error: 'Not authenticated' }
  }

  const supabase = await createClient()

  const updateData: Record<string, unknown> = {}
  if (input.name !== undefined) updateData.name = input.name.trim()
  if (input.industry !== undefined) updateData.industry = input.industry?.trim() || null
  if (input.address !== undefined) updateData.address = input.address?.trim() || null
  if (input.premise_type !== undefined) updateData.premise_type = input.premise_type
  if (input.last_contact !== undefined) updateData.last_contact = input.last_contact
  if (input.latitude !== undefined) updateData.latitude = input.latitude
  if (input.longitude !== undefined) updateData.longitude = input.longitude
  if (input.phone !== undefined) updateData.phone = input.phone?.trim() || null
  if (input.website !== undefined) updateData.website = input.website?.trim() || null
  if (input.hours !== undefined) updateData.hours = input.hours?.trim() || null

  // Re-geocode if address changed and no explicit coordinates provided
  if (input.address !== undefined && input.latitude === undefined && input.longitude === undefined) {
    const trimmed = input.address?.trim()
    if (trimmed) {
      const coords = await geocodeAddress(trimmed)
      if (coords) {
        updateData.latitude = coords.latitude
        updateData.longitude = coords.longitude
      }
    } else {
      updateData.latitude = null
      updateData.longitude = null
    }
  }

  const { data, error } = await supabase
    .from('accounts')
    .update(updateData)
    .eq('id', accountId)
    .select()
    .single()

  if (error) {
    console.error('Failed to update account:', error)
    return { account: null, error: 'Failed to update account' }
  }

  revalidatePath('/accounts')
  revalidatePath(`/accounts/${accountId}`)

  revalidatePath('/territory')
  return { account: data as Account }
}

/**
 * Delete an account
 */
export async function deleteAccount(
  accountId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('accounts')
    .delete()
    .eq('id', accountId)

  if (error) {
    console.error('Failed to delete account:', error)
    return { success: false, error: 'Failed to delete account' }
  }

  revalidatePath('/accounts')

  revalidatePath('/territory')
  return { success: true }
}

/**
 * Create a note for an account.
 */
export async function createAccountNote(
  accountId: string,
  content: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const orgId = await getOrganizationId()
  if (!orgId) return { success: false, error: 'No organization found' }

  const supabase = await createClient()

  const { error } = await supabase
    .from('account_notes')
    .insert({
      organization_id: orgId,
      account_id: accountId,
      user_id: user.id,
      content: content.trim(),
    })

  if (error) {
    console.error('Failed to create note:', error)
    return { success: false, error: 'Failed to create note' }
  }

  revalidatePath(`/accounts/${accountId}`)
  return { success: true }
}
