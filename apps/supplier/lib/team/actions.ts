'use server'

/**
 * Team Actions
 *
 * Admin-only operations for managing team members and invites.
 */

import { createClient } from '@kosha/supabase/server'
import { getUser } from '@kosha/supabase'
import { getUserWithRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

/**
 * Create an invite link for the current org.
 * Admin only.
 */
export async function createInviteLink(): Promise<{ token: string | null; error?: string }> {
  const user = await getUser()
  if (!user) return { token: null, error: 'Not authenticated' }

  const userInfo = await getUserWithRole()
  if (!userInfo?.orgId) return { token: null, error: 'No organization found' }
  if (userInfo.role !== 'admin') return { token: null, error: 'Only admins can create invites' }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('org_invites')
    .insert({
      organization_id: userInfo.orgId,
      created_by: user.id,
    })
    .select('token')
    .single()

  if (error) {
    console.error('Failed to create invite:', error)
    return { token: null, error: 'Failed to create invite link' }
  }

  revalidatePath('/settings')
  return { token: data.token }
}

/**
 * Remove a team member from the org.
 * Admin only. Cannot remove yourself.
 */
export async function removeTeamMember(
  memberId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  if (user.id === memberId) {
    return { success: false, error: 'Cannot remove yourself' }
  }

  const userInfo = await getUserWithRole()
  if (!userInfo?.orgId) return { success: false, error: 'No organization found' }
  if (userInfo.role !== 'admin') return { success: false, error: 'Only admins can remove members' }

  const supabase = await createClient()

  // Verify the member belongs to the same org
  const { data: member } = await supabase
    .from('supplier_profiles')
    .select('organization_id')
    .eq('id', memberId)
    .single()

  if (!member || member.organization_id !== userInfo.orgId) {
    return { success: false, error: 'Member not found in your organization' }
  }

  const { error } = await supabase
    .from('supplier_profiles')
    .delete()
    .eq('id', memberId)

  if (error) {
    console.error('Failed to remove team member:', error)
    return { success: false, error: 'Failed to remove team member' }
  }

  revalidatePath('/settings')
  return { success: true }
}

/**
 * Revoke an invite link.
 * Admin only.
 */
export async function revokeInvite(
  inviteId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const userInfo = await getUserWithRole()
  if (!userInfo?.orgId) return { success: false, error: 'No organization found' }
  if (userInfo.role !== 'admin') return { success: false, error: 'Only admins can revoke invites' }

  const supabase = await createClient()

  const { error } = await supabase
    .from('org_invites')
    .delete()
    .eq('id', inviteId)

  if (error) {
    console.error('Failed to revoke invite:', error)
    return { success: false, error: 'Failed to revoke invite' }
  }

  revalidatePath('/settings')
  return { success: true }
}
