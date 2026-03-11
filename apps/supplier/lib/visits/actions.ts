'use server'

/**
 * Visit Server Actions
 *
 * CRUD operations for visit management.
 */

import { createClient } from '@kosha/supabase/server'
import { getUser } from '@kosha/supabase'
import { getOrganizationId } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { Visit, CreateVisitInput } from '@kosha/types'

/**
 * Create a new visit and update the account's last_contact date.
 */
export async function createVisit(
  input: CreateVisitInput
): Promise<{ visit: Visit | null; error?: string }> {
  const user = await getUser()
  if (!user) return { visit: null, error: 'Not authenticated' }

  const orgId = await getOrganizationId()
  if (!orgId) return { visit: null, error: 'No organization found' }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('visits')
    .insert({
      user_id: user.id,
      organization_id: orgId,
      account_id: input.account_id,
      account_name: input.account_name,
      visit_date: input.visit_date,
      notes: input.notes?.trim() || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create visit:', error)
    return { visit: null, error: 'Failed to create visit' }
  }

  // Only update last_contact if the visit is today or in the past
  const visitDate = new Date(input.visit_date)
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  if (visitDate <= today) {
    await supabase
      .from('accounts')
      .update({ last_contact: input.visit_date })
      .eq('id', input.account_id)
  }

  revalidatePath('/visits')
  revalidatePath('/accounts')
  revalidatePath(`/accounts/${input.account_id}`)
  return { visit: data as Visit }
}

/**
 * Delete a visit.
 */
export async function deleteVisit(
  visitId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const supabase = await createClient()

  const { error } = await supabase
    .from('visits')
    .delete()
    .eq('id', visitId)

  if (error) {
    console.error('Failed to delete visit:', error)
    return { success: false, error: 'Failed to delete visit' }
  }

  revalidatePath('/visits')
  revalidatePath('/accounts')
  return { success: true }
}
