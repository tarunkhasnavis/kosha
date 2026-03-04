/**
 * Next.js Instrumentation Hook
 *
 * This file is executed when the Next.js server starts.
 * We use it to validate environment variables BEFORE the server accepts requests.
 *
 * If any required env vars are missing, the server will fail to start.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Import and validate environment variables
    // This will throw an error if any required variables are missing
    await import('./lib/env')
  }
}
