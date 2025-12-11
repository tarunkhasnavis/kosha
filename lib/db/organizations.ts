/**
 * Organization database queries
 *
 * These functions READ data from the database (SELECT operations only)
 * For mutations (INSERT/UPDATE/DELETE), see lib/actions/organizations.ts
 */

import { createClient } from '@/utils/supabase/server'
import { getUser } from '@/lib/auth'

/**
 * Get the current user's organization with details
 */
export async function getUserOrganization() {
  const user = await getUser()

  if (!user) {
    return null
  }

  const supabase = await createClient()

  // Get user's profile and organization (one-to-many: user belongs to one org)
  const { data: profile } = await supabase
    .from('profiles')
    .select(`
      organization_id,
      role,
      organizations (
        id,
        name,
        created_at
      )
    `)
    .eq('id', user.id)
    .single()

  if (!profile || !profile.organization_id) {
    return null
  }

  return {
    id: profile.organization_id,
    name: (profile.organizations as any)?.name,
    role: profile.role,
    createdAt: (profile.organizations as any)?.created_at
  }
}

/**
 * Get just the organization ID for the current user
 * Convenience function - returns null if no organization
 */
export async function getOrganizationId() {
  const org = await getUserOrganization()
  return org?.id || null
}
