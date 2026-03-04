import { getUser } from '@kosha/supabase'
import { getUserOrganization } from '@/lib/organizations/queries'
import { getOnboardingSession } from '@/lib/onboarding/actions'
import { redirect } from 'next/navigation'

export default async function HomePage() {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  // Check onboarding status first - this is the source of truth
  const { session: onboardingSession } = await getOnboardingSession()

  // If user has incomplete onboarding, send them there
  if (onboardingSession && onboardingSession.currentStage !== 'complete') {
    redirect('/onboarding')
  }

  // Check if user has an organization
  const org = await getUserOrganization()

  if (!org) {
    redirect('/onboarding')
  }

  redirect('/orders')
}
