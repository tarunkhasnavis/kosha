'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createOrganization(organizationName: string) {
  const supabase = await createClient()

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error('Not authenticated')
  }

  // Check if user already has an organization
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (existingProfile?.organization_id) {
    // User already has an organization, redirect to orders
    redirect('/orders')
  }

  // Create new organization
  const { data: newOrg, error: orgError } = await supabase
    .from('organizations')
    .insert({
      name: organizationName.trim()
    })
    .select()
    .single()

  if (orgError) {
    throw new Error('Failed to create organization: ' + orgError.message)
  }

  // Update user's profile with organization_id as owner
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      organization_id: newOrg.id,
      role: 'owner'
    })
    .eq('id', user.id)

  if (profileError) {
    throw new Error('Failed to update user profile: ' + profileError.message)
  }

  revalidatePath('/orders')
  redirect('/orders')
}
