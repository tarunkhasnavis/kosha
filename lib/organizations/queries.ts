/**
 * Organization Queries
 *
 * Read-only database operations for organizations.
 * No mutations - those are in actions.ts
 */

import { createClient } from '@/utils/supabase/server'
import { getUser } from '@/lib/auth'
import { cookies } from 'next/headers'

const SUPER_ADMIN_ORG_COOKIE = 'super_admin_org_id'

/**
 * Check if the current user is a super admin
 */
export async function isSuperAdmin(): Promise<boolean> {
  const user = await getUser()
  if (!user) return false

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  return profile?.is_super_admin === true
}

/**
 * Get the super admin's currently selected org ID from cookie
 */
export async function getSuperAdminSelectedOrg(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(SUPER_ADMIN_ORG_COOKIE)?.value || null
}

/**
 * Get the current user's organization with details
 * For super admins, respects the org switcher cookie
 */
export async function getUserOrganization() {
  const user = await getUser()

  if (!user) {
    return null
  }

  const supabase = await createClient()

  // Get user's profile
  const { data: profile } = await supabase
    .from('profiles')
    .select(`
      organization_id,
      role,
      is_super_admin,
      organizations (
        id,
        name,
        created_at
      )
    `)
    .eq('id', user.id)
    .single()

  if (!profile) {
    return null
  }

  // Super admin org override
  if (profile.is_super_admin) {
    const overrideOrgId = await getSuperAdminSelectedOrg()
    if (overrideOrgId) {
      // Fetch the override org details
      const { data: overrideOrg } = await supabase
        .from('organizations')
        .select('id, name, created_at')
        .eq('id', overrideOrgId)
        .single()

      if (overrideOrg) {
        return {
          id: overrideOrg.id,
          name: overrideOrg.name,
          role: 'super_admin' as const,
          createdAt: overrideOrg.created_at,
          isSuperAdmin: true,
          isOverride: true,
        }
      }
    }
  }

  if (!profile.organization_id) {
    // Super admin without own org can still use the switcher
    if (profile.is_super_admin) {
      return {
        id: null,
        name: null,
        role: 'super_admin' as const,
        createdAt: null,
        isSuperAdmin: true,
        isOverride: false,
      }
    }
    return null
  }

  return {
    id: profile.organization_id,
    name: (profile.organizations as any)?.name,
    role: profile.role,
    createdAt: (profile.organizations as any)?.created_at,
    isSuperAdmin: profile.is_super_admin === true,
    isOverride: false,
  }
}

/**
 * Get all organizations (super admin only)
 */
export async function getAllOrganizations() {
  const superAdmin = await isSuperAdmin()
  if (!superAdmin) return []

  const supabase = await createClient()
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id, name, gmail_email, created_at')
    .order('name')

  return orgs || []
}

/**
 * Get just the organization ID for the current user
 * Convenience function - returns null if no organization
 */
export async function getOrganizationId() {
  const org = await getUserOrganization()
  return org?.id || null
}

/**
 * Organization info for PDF generation
 */
export interface OrgInfoForPdf {
  name: string
  addressLine1: string
  addressLine2?: string
  city?: string
  state?: string
  zip?: string
  phone?: string
  email?: string
  website?: string
  billingAddressPayment?: string
  bankInformation?: string
  paymentLink?: string
}

/**
 * Get organization info formatted for PDF generation
 * Falls back to reasonable defaults for missing fields
 */
export async function getOrganizationForPdf(organizationId: string): Promise<OrgInfoForPdf | null> {
  const supabase = await createClient()

  const { data: org, error } = await supabase
    .from('organizations')
    .select('id, name, gmail_email, address, phone, billing_address_payment, bank_information, payment_link')
    .eq('id', organizationId)
    .single()

  if (error || !org) {
    console.error('Failed to fetch organization for PDF:', error)
    return null
  }

  // Return organization data with available fields
  return {
    name: org.name || 'Your Company',
    addressLine1: org.address || '',
    email: org.gmail_email || undefined,
    phone: org.phone || undefined,
    billingAddressPayment: org.billing_address_payment || undefined,
    bankInformation: org.bank_information || undefined,
    paymentLink: org.payment_link || undefined,
  }
}
