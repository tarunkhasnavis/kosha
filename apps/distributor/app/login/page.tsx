import { getUser } from '@kosha/supabase'
import { redirect } from 'next/navigation'
import { GoogleSignIn } from './GoogleSignIn'
import { LoginBackground } from './LoginBackground'

export default async function LoginPage() {
  const user = await getUser()

  // If already logged in, redirect to orders
  if (user) {
    redirect('/orders')
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Interactive animated background */}
      <LoginBackground />

      {/* Logo watermark - top left */}
      <div className="absolute top-12 left-16 z-10">
        <span className="text-3xl font-semibold tracking-tight text-slate-900/80">
          kosha
        </span>
      </div>

      {/* Centered content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Welcome text */}
        <h1 className="mb-8 text-4xl font-medium tracking-tight text-slate-900">
          Welcome to Kosha
        </h1>

        {/* Google Sign In Button */}
        <GoogleSignIn />
      </div>
    </div>
  )
}
