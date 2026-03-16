import { getUser } from '@kosha/supabase'
import { redirect } from 'next/navigation'
import { WelcomeScreen } from './WelcomeScreen'

export default async function WelcomePage() {
  const user = await getUser()

  if (user) {
    redirect('/capture')
  }

  return <WelcomeScreen />
}
