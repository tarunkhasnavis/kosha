import { requireAuth } from '@/lib/auth'
import { getUserOrganization, getAllOrganizations } from '@/lib/organizations/queries'
import { MainNav } from '@/components/main-nav'

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Protect all pages in this layout - runs once for the entire section
  const user = await requireAuth()

  // Get user's organization for display
  const org = await getUserOrganization()

  // Get all orgs for super admin switcher
  const allOrgs = org?.isSuperAdmin ? await getAllOrganizations() : []

  return (
    <>
      <MainNav
        organizationName={org?.name}
        isSuperAdmin={org?.isSuperAdmin}
        isOverride={org?.isOverride}
        currentOrgId={org?.id}
        allOrganizations={allOrgs}
        userId={user?.id}
        userEmail={user?.email}
      />
      {children}
    </>
  )
}
