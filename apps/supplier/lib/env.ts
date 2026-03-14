import { z } from 'zod'

const envSchema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  // OpenAI
  OPENAI_API_KEY: z.string().min(1),
  // Mapbox (optional — geocoding and territory map degrade gracefully without it)
  NEXT_PUBLIC_MAPBOX_TOKEN: z.string().min(1).optional(),
  // Google Places (optional — enables search in Explore Accounts)
  GOOGLE_PLACES_API_KEY: z.string().min(1).optional(),
})

export type Env = z.infer<typeof envSchema>

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    console.error('Environment validation failed:')
    console.error(result.error.format())
    console.error('\nRestart the dev server after fixing .env.local')
    throw new Error('Invalid environment variables')
  }

  return result.data
}

export const env = validateEnv()
