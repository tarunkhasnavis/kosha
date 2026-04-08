import { NextRequest, NextResponse } from 'next/server'
import { extractFromTranscript } from '@/lib/extract'

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

    // Fetch conversation details from ElevenLabs
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
        { status: 500 },
      )
    }

    const conversation = await res.json()

    console.log(`[transcript] ${conversationId}: status=${conversation.status}, transcript_length=${conversation.transcript?.length ?? 0}`)

    // Build transcript from conversation turns
    const transcript = (conversation.transcript ?? [])
      .map((turn: { role: string; message: string }) => `${turn.role}: ${turn.message}`)
      .join('\n')

    console.log(`[transcript] ${conversationId}: built transcript (${transcript.length} chars)`)

    if (!transcript) {
      console.log(`[transcript] ${conversationId}: no transcript available`)
      return NextResponse.json({
        conversation_id: conversationId,
        transcript: '',
        extraction: null,
        status: 'no_transcript',
      })
    }

    // Extract price data from transcript
    console.log(`[transcript] ${conversationId}: extracting prices...`)
    const extraction = await extractFromTranscript(transcript)
    console.log(`[transcript] ${conversationId}: extraction result:`, JSON.stringify(extraction))

    return NextResponse.json({
      conversation_id: conversationId,
      transcript,
      extraction,
      status: 'extracted',
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Unexpected error', details: String(err) },
      { status: 500 },
    )
  }
}
