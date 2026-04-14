import { NextResponse } from 'next/server'

/**
 * Returns the Deepgram API key for the mobile app to use.
 *
 * In production, this should create short-lived scoped keys.
 * For now, it returns the main key — the mobile app needs it
 * because React Native WebSocket doesn't support custom headers.
 *
 * TODO: Add Supabase auth check before returning the key.
 */
export async function GET() {
  const apiKey = process.env.DEEPGRAM_API_KEY

  if (!apiKey) {
    return NextResponse.json({ error: 'Deepgram API key not configured' }, { status: 500 })
  }

  return NextResponse.json({ key: apiKey })
}
