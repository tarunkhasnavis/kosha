import { getUser } from '@kosha/supabase'
import { redirect } from 'next/navigation'
import { WelcomeScreen } from './welcome/WelcomeScreen'

export default async function Home() {
  const user = await getUser()

  if (user) {
    redirect('/capture')
  }

  return <WelcomeScreen />
}
