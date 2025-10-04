import { getUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { GoogleSignIn } from './GoogleSignIn'

export default async function LoginPage() {
  const user = await getUser()

  // If already logged in, redirect to orders
  if (user) {
    redirect('/orders')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Welcome to Zoodl</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to manage your orders
          </p>
        </div>

        <GoogleSignIn />
      </div>
    </div>
  )
}
