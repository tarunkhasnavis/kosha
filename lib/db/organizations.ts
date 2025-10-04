import { createClient } from '@/utils/supabase/server'

export async function getUserOrganization() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

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

export async function getOrganizationId() {
  const org = await getUserOrganization()
  return org?.id || null
}
