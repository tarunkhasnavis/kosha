import { cache } from 'react'
import { createClient } from '@kosha/supabase/server'
import { getUser } from '@kosha/supabase'
import type { SupplierRole } from '@kosha/types'

/**
 * Get the current user's role and organization from supplier_profiles.
 * Uses supplier_profiles (not profiles) to keep supplier and distributor separate.
 * Returns null if not authenticated or no supplier profile found.
 * Cached per request — safe to call from multiple queries in parallel.
 */
export const getUserWithRole = cache(async (): Promise<{
  userId: string
  orgId: string | null
  role: SupplierRole
} | null> => {
  const user = await getUser()
  if (!user) return null

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('supplier_profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!profile) return null

  return {
    userId: user.id,
    orgId: profile.organization_id,
    role: (profile.role as SupplierRole) || 'rep',
  }
})

/**
 * Get just the organization ID for the current user.
 * Returns null if no organization.
 */
export async function getOrganizationId(): Promise<string | null> {
  const result = await getUserWithRole()
  return result?.orgId ?? null
}

/**
 * Check if the current user is an admin.
 */
export async function isAdmin(): Promise<boolean> {
  const result = await getUserWithRole()
  return result?.role === 'admin'
}
