/**
 * Authentication utilities
 *
 * This is the ONLY place where we call supabase.auth.getUser()
 * All other files should import from here.
 */

import { cache } from 'react'
import { createClient } from './server'
import { redirect } from 'next/navigation'

/**
 * Get the current authenticated user
 * Returns null if not authenticated
 * Cached per request — safe to call from multiple queries in parallel.
 */
export const getUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

/**
 * Require authentication - redirects to /login if not authenticated
 * Use this in server components that need a logged-in user
 */
export async function requireAuth() {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  return user
}

/**
 * Get the current session (includes provider tokens for OAuth)
 */
export async function getSession() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session
}
