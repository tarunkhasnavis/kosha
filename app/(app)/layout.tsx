import { requireAuth } from '@/lib/auth'
import { getUserOrganization } from '@/lib/db/organizations'
import { MainNav } from '@/components/main-nav'

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Protect all pages in this layout - runs once for the entire section
  await requireAuth()

  // Get user's organization for display
  const org = await getUserOrganization()

  return (
    <>
      <MainNav organizationName={org?.name} />
      {children}
    </>
  )
}
