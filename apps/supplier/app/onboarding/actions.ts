'use server'

import { createClient } from '@kosha/supabase/server'
import { getUser } from '@kosha/supabase'

export async function completeOnboarding(
  orgName: string
): Promise<{ error?: string }> {
  const user = await getUser()
  if (!user) return { error: 'Not authenticated' }

  const supabase = await createClient()

  // Get the user's supplier profile to find their org
  const { data: profile } = await supabase
    .from('supplier_profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) {
    return { error: 'No organization found' }
  }

  // Update the org name
  const { error } = await supabase
    .from('organizations')
    .update({ name: orgName })
    .eq('id', profile.organization_id)

  if (error) {
    console.error('Failed to update organization name:', error)
    return { error: 'Failed to save organization name' }
  }

  return {}
}
