import { getUser } from '@kosha/supabase'
import { redirect } from 'next/navigation'
import { GoogleSignIn } from './GoogleSignIn'
import { LoginBackground } from './LoginBackground'

export default async function LoginPage() {
  const user = await getUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <LoginBackground />

      <div className="absolute top-8 left-8 md:top-12 md:left-16 z-10">
        <span className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900/80">
          kosha
        </span>
      </div>

      <div className="relative z-10 flex flex-col items-center px-4">
        <h1 className="mb-8 text-3xl md:text-4xl font-medium tracking-tight text-slate-900 text-center">
          Welcome to Kosha
        </h1>

        <GoogleSignIn />
      </div>
    </div>
  )
}
