import { requireAuth } from '@/lib/auth'
import { getUserOrganization, getAllOrganizations } from '@/lib/organizations/queries'
import { MainNav } from '@/components/main-nav'
import { redirect } from 'next/navigation'
import { getOnboardingSession } from '@/lib/onboarding/actions'
import { AppLayoutWrapper } from '@/components/app-layout-wrapper'

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Protect all pages in this layout - runs once for the entire section
  const user = await requireAuth()

  // Check onboarding status first - this is the source of truth
  const { session: onboardingSession } = await getOnboardingSession()

  // If user has an active onboarding session that isn't complete, redirect to onboarding
  if (onboardingSession && onboardingSession.currentStage !== 'complete') {
    redirect('/onboarding')
  }

  // Get user's organization for display
  const org = await getUserOrganization()

  // If user has no organization and no onboarding session, start onboarding
  if (!org) {
    redirect('/onboarding')
  }

  // Get all orgs for super admin switcher
  const allOrgs = org?.isSuperAdmin ? await getAllOrganizations() : []

  return (
    <AppLayoutWrapper>
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
    </AppLayoutWrapper>
  )
}
