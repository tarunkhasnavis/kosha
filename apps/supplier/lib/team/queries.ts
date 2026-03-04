/**
 * Team Queries
 *
 * Read-only operations for team members and invites.
 */

import { createClient } from '@kosha/supabase/server'
import { getOrganizationId } from '@/lib/auth'

export interface TeamMember {
  id: string
  email: string | null
  full_name: string | null
  role: string
  created_at: string | null
}

export interface ActiveInvite {
  id: string
  token: string
  expires_at: string
  created_at: string
}

/**
 * Get all team members in the current user's org.
 * RLS ensures only admins can see all profiles in the org.
 */
export async function getTeamMembers(): Promise<{ members: TeamMember[]; error?: string }> {
  const orgId = await getOrganizationId()
  if (!orgId) return { members: [], error: 'No organization found' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('supplier_profiles')
    .select('id, email, full_name, role, created_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Failed to fetch team members:', error)
    return { members: [], error: 'Failed to fetch team members' }
  }

  return { members: (data as TeamMember[]) || [] }
}

/**
 * Get the latest non-expired invite for the current org.
 */
export async function getActiveInvite(): Promise<{ invite: ActiveInvite | null; error?: string }> {
  const orgId = await getOrganizationId()
  if (!orgId) return { invite: null, error: 'No organization found' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('org_invites')
    .select('id, token, expires_at, created_at')
    .eq('organization_id', orgId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Failed to fetch active invite:', error)
    return { invite: null, error: 'Failed to fetch invite' }
  }

  return { invite: data as ActiveInvite | null }
}
