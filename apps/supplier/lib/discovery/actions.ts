'use server'

/**
 * Discovery Actions
 *
 * Mutations for account discovery — claiming discovered accounts.
 */

import { createClient } from '@kosha/supabase/server'
import { getUser } from '@kosha/supabase'
import { getOrganizationId } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { Account } from '@kosha/types'

/**
 * Claim a discovered account — creates a managed account from discovery data.
 */
export async function claimDiscoveredAccount(
  discoveredAccountId: string
): Promise<{ account: Account | null; error?: string }> {
  const user = await getUser()
  if (!user) return { account: null, error: 'Not authenticated' }

  const orgId = await getOrganizationId()
  if (!orgId) return { account: null, error: 'No organization found' }

  const supabase = await createClient()

  // Fetch the discovered account
  const { data: discovered, error: fetchError } = await supabase
    .from('discovered_accounts')
    .select('*')
    .eq('id', discoveredAccountId)
    .single()

  if (fetchError || !discovered) {
    return { account: null, error: 'Discovered account not found' }
  }

  // Create a managed account from the discovery data
  const { data: account, error: createError } = await supabase
    .from('accounts')
    .insert({
      user_id: user.id,
      organization_id: orgId,
      name: discovered.name,
      address: discovered.address,
      latitude: discovered.latitude,
      longitude: discovered.longitude,
      phone: discovered.phone,
      website: discovered.website,
      hours: discovered.hours,
    })
    .select()
    .single()

  if (createError) {
    console.error('Failed to create account from discovery:', createError)
    return { account: null, error: 'Failed to claim account' }
  }

  // Mark the discovered account as claimed
  await supabase
    .from('discovered_accounts')
    .update({ is_claimed: true })
    .eq('id', discoveredAccountId)

  revalidatePath('/territory')
  revalidatePath('/territory')

  return { account: account as Account }
}
