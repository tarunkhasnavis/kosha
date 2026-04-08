import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@kosha/supabase'

// GET — load all stores from Supabase
export async function GET() {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('indexer_stores')
      .select('*')
      .order('name')

    if (error) throw error
    return NextResponse.json({ stores: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// POST — save/upsert stores to Supabase
export async function POST(req: NextRequest) {
  try {
    const { stores } = await req.json()
    if (!Array.isArray(stores)) {
      return NextResponse.json({ error: 'stores must be an array' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const rows = stores.map((s: Record<string, unknown>) => ({
      id: s.id,
      name: s.name,
      phone: s.phone,
      address: s.address,
      lat: s.lat,
      lng: s.lng,
      type: s.type,
      place_id: s.place_id,
    }))

    const { error } = await supabase
      .from('indexer_stores')
      .upsert(rows, { onConflict: 'id' })

    if (error) throw error
    return NextResponse.json({ ok: true, count: rows.length })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
