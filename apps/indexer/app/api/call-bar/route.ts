import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { toNumber } = await req.json()

    if (!toNumber || typeof toNumber !== 'string') {
      return NextResponse.json({ error: 'Missing toNumber' }, { status: 400 })
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
          to_number: toNumber,
        }),
      },
    )

    const data = await response.json()

    console.log('[call-bar] ElevenLabs response:', response.status, JSON.stringify(data))

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to start call', details: data },
        { status: 500 },
      )
    }

    return NextResponse.json({ ok: true, data })
  } catch (err) {
    return NextResponse.json(
      { error: 'Unexpected error', details: String(err) },
      { status: 500 },
    )
  }
}
