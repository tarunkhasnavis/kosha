import { NextRequest, NextResponse } from 'next/server'

// Rate limit: wait between calls (ms)
const DELAY_BETWEEN_CALLS = 30_000 // 30 seconds

type CallResult = {
  store_id: string
  store_name: string
  to_number: string
  status: 'success' | 'failed'
  conversation_id?: string
  error?: string
}

export async function POST(req: NextRequest) {
  try {
    const { stores } = await req.json()

    if (!Array.isArray(stores) || stores.length === 0) {
      return NextResponse.json({ error: 'No stores provided' }, { status: 400 })
    }

    const apiKey = process.env.ELEVENLABS_API_KEY
    const agentId = process.env.ELEVENLABS_AGENT_ID
    const agentPhoneNumberId = process.env.ELEVENLABS_AGENT_PHONE_NUMBER_ID

    if (!apiKey || !agentId || !agentPhoneNumberId) {
      return NextResponse.json(
        { error: 'Missing ElevenLabs configuration' },
        { status: 500 },
      )
    }

    const results: CallResult[] = []

    for (let i = 0; i < stores.length; i++) {
      const store = stores[i]

      try {
        const response = await fetch(
          'https://api.elevenlabs.io/v1/convai/twilio/outbound-call',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'xi-api-key': apiKey,
            },
            body: JSON.stringify({
              agent_id: agentId,
              agent_phone_number_id: agentPhoneNumberId,
              to_number: store.phone,
            }),
          },
        )

        const data = await response.json()

        if (response.ok) {
          results.push({
            store_id: store.id,
            store_name: store.name,
            to_number: store.phone,
            status: 'success',
            conversation_id: data.conversation_id,
          })
        } else {
          results.push({
            store_id: store.id,
            store_name: store.name,
            to_number: store.phone,
            status: 'failed',
            error: data.detail || JSON.stringify(data),
          })
        }
      } catch (err) {
        results.push({
          store_id: store.id,
          store_name: store.name,
          to_number: store.phone,
          status: 'failed',
          error: String(err),
        })
      }

      // Rate limit — wait before next call (skip wait after last one)
      if (i < stores.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_CALLS))
      }
    }

    return NextResponse.json({
      ok: true,
      total: stores.length,
      succeeded: results.filter((r) => r.status === 'success').length,
      failed: results.filter((r) => r.status === 'failed').length,
      results,
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Batch call failed', details: String(err) },
      { status: 500 },
    )
  }
}
