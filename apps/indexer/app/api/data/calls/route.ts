import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@kosha/supabase'

// GET — load all calls with their extractions
export async function GET() {
  try {
    const supabase = createServiceClient()

    const { data: callsData, error: callsErr } = await supabase
      .from('indexer_calls')
      .select('*')
      .order('created_at', { ascending: false })

    if (callsErr) throw callsErr

    const { data: extractionsData, error: extErr } = await supabase
      .from('indexer_extractions')
      .select('*')
      .order('created_at')

    if (extErr) throw extErr

    // Group extractions by call_id
    const extractionsByCall: Record<string, typeof extractionsData> = {}
    for (const ext of extractionsData ?? []) {
      const callId = ext.call_id as string
      if (!extractionsByCall[callId]) extractionsByCall[callId] = []
      extractionsByCall[callId].push(ext)
    }

    // Attach extractions to calls
    const calls = (callsData ?? []).map((call) => ({
      ...call,
      extractions: extractionsByCall[call.id] ?? [],
    }))

    return NextResponse.json({ calls })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// POST — create a new call record
export async function POST(req: NextRequest) {
  try {
    const { store_id, to_number, conversation_id, status } = await req.json()

    const supabase = createServiceClient()

    // Ensure the store exists (upsert a minimal record if not)
    const { error: storeErr } = await supabase
      .from('indexer_stores')
      .upsert({
        id: store_id,
        name: store_id,
        phone: to_number,
        address: '',
        lat: 0,
        lng: 0,
        type: 'other',
        place_id: store_id,
      }, { onConflict: 'id', ignoreDuplicates: true })

    if (storeErr) {
      console.error('[POST calls] Store upsert error:', storeErr.message)
      // Continue anyway — the store may already exist
    }

    const { data, error } = await supabase
      .from('indexer_calls')
      .insert({
        store_id,
        to_number,
        conversation_id,
        status: status || 'calling',
      })
      .select()
      .single()

    if (error) {
      console.error('[POST calls] Supabase error:', error.message, 'store_id:', store_id)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    console.log('[POST calls] Created call:', data.id, 'for store:', store_id)
    return NextResponse.json({ call: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// PATCH — update a call (status, transcript, duration, etc)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const call_id = body.call_id
    if (!call_id) {
      return NextResponse.json({ error: 'call_id required' }, { status: 400 })
    }

    // Whitelist allowed fields
    const allowed = ['status', 'transcript', 'error', 'duration', 'end_reason', 'conversation_id']
    const updates: Record<string, unknown> = {}
    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key]
    }

    // Add completed_at for terminal statuses
    if (['extracted', 'error', 'no_answer', 'hung_up'].includes(updates.status as string)) {
      updates.completed_at = new Date().toISOString()
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: true }) // Nothing to update
    }

    const supabase = createServiceClient()

    const { error } = await supabase
      .from('indexer_calls')
      .update(updates)
      .eq('id', call_id)

    if (error) {
      console.error('[PATCH calls] Supabase error:', error.message, 'call_id:', call_id, 'updates:', JSON.stringify(updates))
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
