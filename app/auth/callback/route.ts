import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)

    // Check if user has an organization
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      // Get or create user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      // If no profile exists, create one
      if (!profile) {
        await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || user.user_metadata?.name
          })

        // New user without organization - redirect to onboarding
        return NextResponse.redirect(new URL('/onboarding/create-organization', request.url))
      }

      // If profile exists but no organization - redirect to onboarding
      if (!profile.organization_id) {
        return NextResponse.redirect(new URL('/onboarding/create-organization', request.url))
      }
    }
  }

  // User has organization - redirect to orders
  return NextResponse.redirect(new URL('/orders', request.url))
}
