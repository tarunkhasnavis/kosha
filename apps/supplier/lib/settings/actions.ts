'use server'

import { createClient } from '@kosha/supabase/server'
import { getUser } from '@kosha/supabase'
import { getOrganizationId } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function updateOrganizationName(
  orgId: string,
  name: string
): Promise<{ error?: string }> {
  const user = await getUser()
  if (!user) return { error: 'Not authenticated' }

  const userOrgId = await getOrganizationId()
  if (userOrgId !== orgId) return { error: 'Unauthorized' }

  const supabase = await createClient()

  const { error } = await supabase
    .from('organizations')
    .update({ name })
    .eq('id', orgId)

  if (error) {
    console.error('Failed to update organization name:', error)
    return { error: 'Failed to update organization name' }
  }

  revalidatePath('/settings')
  return {}
}

export async function updateProfileName(
  userId: string,
  fullName: string
): Promise<{ error?: string }> {
  const user = await getUser()
  if (!user || user.id !== userId) return { error: 'Unauthorized' }

  const supabase = await createClient()

  const { error } = await supabase
    .from('supplier_profiles')
    .update({ full_name: fullName })
    .eq('id', userId)

  if (error) {
    console.error('Failed to update supplier profile:', error)
    return { error: 'Failed to update profile' }
  }

  revalidatePath('/settings')
  return {}
}
