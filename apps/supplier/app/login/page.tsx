import { getUser } from '@kosha/supabase'
import { redirect } from 'next/navigation'
import { GoogleSignIn } from './GoogleSignIn'
import { LoginBackground } from './LoginBackground'

export default async function LoginPage() {
  const user = await getUser()

  if (user) {
    redirect('/capture')
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-6 text-center overflow-hidden">
      <LoginBackground />

      <div className="relative z-10 mb-10">
        <img src="/icons/kosha-k.svg" alt="Kosha" className="h-24 w-24 mx-auto drop-shadow-sm" style={{ filter: 'brightness(0) opacity(0.85)' }} />
      </div>

      <div className="relative z-10 w-full max-w-xs space-y-4">
        <GoogleSignIn />
        <p className="text-stone-400 text-sm">Sign in to continue</p>
      </div>

      <p className="absolute bottom-6 z-10 text-[10px] text-stone-400">
        &copy; {new Date().getFullYear()} Kosha
      </p>
    </div>
  )
}
