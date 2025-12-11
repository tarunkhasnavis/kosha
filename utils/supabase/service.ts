import { createClient } from '@supabase/supabase-js'

/**
 * Supabase Service Role Client
 *
 * This client bypasses Row Level Security (RLS) and should ONLY be used
 * for server-side operations like cron jobs, background workers, etc.
 *
 * WARNING: Never expose this client to the frontend!
 */
export function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase service role credentials')
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
