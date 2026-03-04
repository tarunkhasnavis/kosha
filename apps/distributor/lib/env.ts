import { z } from 'zod'

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .length(64)
    .regex(/^[0-9a-f]{64}$/i),
  DATABASE_URL: z.string().url().optional(),
  RESEND_API_KEY: z.string().min(1),
  // QuickBooks Online (optional - only needed when QBO integration is used)
  QUICKBOOKS_CLIENT_ID: z.string().min(1).optional(),
  QUICKBOOKS_CLIENT_SECRET: z.string().min(1).optional(),
  QUICKBOOKS_ENVIRONMENT: z.enum(['sandbox', 'production']).optional(),
  QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN: z.string().min(1).optional(),
  // QuickBooks Desktop via Conductor (optional - only needed when QBD integration is used)
  CONDUCTOR_SECRET_KEY: z.string().min(1).optional(),
  CONDUCTOR_PUBLISHABLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
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
