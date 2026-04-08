import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@kosha/supabase'

// POST — save extraction results for a call
export async function POST(req: NextRequest) {
  try {
    const { call_id, store_id, products } = await req.json()

    if (!call_id || !store_id || !Array.isArray(products)) {
      return NextResponse.json({ error: 'call_id, store_id, and products required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const rows = products.map((p: Record<string, unknown>) => ({
      call_id,
      store_id,
      product_name: p.product_name,
      found: p.found,
      price: p.price ?? null,
      before_tax: p.before_tax ?? true,
      pack_size: p.pack_size ?? null,
      notes: p.notes ?? null,
      confidence: p.confidence ?? 'low',
    }))

    const { error } = await supabase
      .from('indexer_extractions')
      .insert(rows)

    if (error) throw error
    return NextResponse.json({ ok: true, count: rows.length })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// GET — get all extractions with store info (for results tab)
export async function GET() {
  try {
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('indexer_extractions')
      .select('*, indexer_stores(name, address, type, phone)')
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ extractions: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
