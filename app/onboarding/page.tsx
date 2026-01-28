import { getUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Onboarding } from './Onboarding'
import { getOnboardingSession } from '@/lib/onboarding/actions'

export default async function OnboardingPage() {
  // Get user info for personalization
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  // Check onboarding session status - this is the source of truth
  const { session } = await getOnboardingSession()

  // Only redirect if onboarding is explicitly marked complete
  // The session table is the source of truth for onboarding state
  if (session?.currentStage === 'complete') {
    redirect('/orders')
  }

  // If no session exists, one will be created by getOrCreateOnboardingSession
  // in the useOnboardingState hook - let the user proceed to onboarding

  const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || undefined

  return <Onboarding userName={userName} />
}
