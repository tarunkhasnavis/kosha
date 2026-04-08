import { NextRequest, NextResponse } from 'next/server'

// GET — fetch current agent config from ElevenLabs
export async function GET() {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY
    const agentId = process.env.ELEVENLABS_AGENT_ID

    if (!apiKey || !agentId) {
      return NextResponse.json({ error: 'Missing ElevenLabs config' }, { status: 500 })
    }

    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/agents/${agentId}`,
      { headers: { 'xi-api-key': apiKey } },
    )

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: 'Failed to fetch agent', details: err }, { status: 500 })
    }

    const agent = await res.json()

    return NextResponse.json({
      agent_id: agentId,
      name: agent.name,
      prompt: agent.conversation_config?.agent?.prompt?.prompt ?? '',
      first_message: agent.conversation_config?.agent?.first_message ?? '',
      language: agent.conversation_config?.agent?.language ?? 'en',
    })
  } catch (err) {
    return NextResponse.json({ error: 'Unexpected error', details: String(err) }, { status: 500 })
  }
}

// PATCH — update agent prompt on ElevenLabs
export async function PATCH(req: NextRequest) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY
    const agentId = process.env.ELEVENLABS_AGENT_ID

    if (!apiKey || !agentId) {
      return NextResponse.json({ error: 'Missing ElevenLabs config' }, { status: 500 })
    }

    const { prompt, first_message } = await req.json()

    const body: Record<string, unknown> = {
      conversation_config: {
        agent: {
          prompt: { prompt },
          ...(first_message != null ? { first_message } : {}),
        },
      },
    }

    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/agents/${agentId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify(body),
      },
    )

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: 'Failed to update agent', details: err }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: 'Unexpected error', details: String(err) }, { status: 500 })
  }
}
