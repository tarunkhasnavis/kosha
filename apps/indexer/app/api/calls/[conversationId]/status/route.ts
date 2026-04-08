import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  try {
    const { conversationId } = await params
    const apiKey = process.env.ELEVENLABS_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: 'Missing ElevenLabs API key' }, { status: 500 })
    }

    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
      {
        headers: { 'xi-api-key': apiKey },
      },
    )

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json(
        { error: 'Failed to fetch conversation', details: err },
        { status: res.status },
      )
    }

    const conversation = await res.json()

    console.log(`[status] ${conversationId}: status=${conversation.status}, analysis=${conversation.analysis?.call_successful}`)

    return NextResponse.json({
      conversation_id: conversationId,
      status: conversation.status ?? 'unknown',
      duration: conversation.metadata?.call_duration_secs,
      end_reason: conversation.metadata?.end_reason,
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Unexpected error', details: String(err) },
      { status: 500 },
    )
  }
}
