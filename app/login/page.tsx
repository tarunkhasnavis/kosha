import { getUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { GoogleSignIn } from './GoogleSignIn'
import { Mail, Brain, Zap, CheckCircle2 } from 'lucide-react'

export default async function LoginPage() {
  const user = await getUser()

  // If already logged in, redirect to orders
  if (user) {
    redirect('/orders')
  }

  return (
    <div className="relative flex min-h-screen overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-green-700 to-teal-800">
        {/* Animated orbs */}
        <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-emerald-400/30 blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-teal-400/30 blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-green-400/20 blur-3xl animate-pulse delay-500" />
      </div>

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      {/* Left side - Branding & Features */}
      <div className="relative hidden w-1/2 flex-col justify-between p-12 lg:flex">
        {/* Logo */}
        <div>
          <h1 className="text-4xl font-bold text-white tracking-tight">
            Kosha
          </h1>
        </div>

        {/* Features */}
        <div className="space-y-8">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-white/10 p-3 backdrop-blur-sm">
              <Mail className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-lg">Email-to-Order</h3>
              <p className="mt-1 text-emerald-200/80 max-w-xs">
                Automatically extract orders from emails, PDFs, and spreadsheets using AI
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-white/10 p-3 backdrop-blur-sm">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-lg">Instant Processing</h3>
              <p className="mt-1 text-emerald-200/80 max-w-xs">
                Orders are processed in seconds, not hours. Focus on fulfillment, not data entry
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-white/10 p-3 backdrop-blur-sm">
              <Brain className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-lg">AI Business Insights</h3>
              <p className="mt-1 text-emerald-200/80 max-w-xs">
                Get intelligent analytics and recommendations to optimize your operations
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Sign in card */}
      <div className="relative flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Card with glassmorphism */}
          <div className="rounded-3xl bg-white/95 backdrop-blur-xl p-10 shadow-2xl shadow-black/20">
            {/* Mobile logo (hidden on desktop) */}
            <div className="mb-8 text-center lg:hidden">
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                Kosha
              </h1>
              <p className="mt-1 text-gray-500">Order Management Platform</p>
            </div>

            {/* Welcome text */}
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900">
                Welcome back
              </h2>
              <p className="mt-2 text-gray-500">
                Sign in to manage your orders
              </p>
            </div>

            {/* Sign in button */}
            <GoogleSignIn />

            {/* Features for mobile */}
            <div className="mt-8 space-y-3 lg:hidden">
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                <span>AI-powered order extraction</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                <span>Email, PDF & Excel support</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                <span>AI-powered business insights</span>
              </div>
            </div>

            {/* Divider */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-center text-xs text-gray-400">
                By signing in, you agree to our Terms of Service and Privacy Policy
              </p>
            </div>
          </div>

          {/* Bottom text */}
          <p className="mt-6 text-center text-sm text-white/60">
            Need help?{' '}
            <a href="mailto:support@kosha.app" className="text-white hover:text-white/80 underline underline-offset-2">
              Contact support
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
