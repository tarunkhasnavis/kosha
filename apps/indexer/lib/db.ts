import { createServiceClient } from '@kosha/supabase'
import type { Store, CallExtraction } from './types'

// ── Stores ───────────────────────────────────────────────────

export async function upsertStores(stores: Store[]) {
  const supabase = createServiceClient()

  const rows = stores.map((s) => ({
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

  if (error) throw new Error(`Failed to upsert stores: ${error.message}`)
  return rows.length
}

export async function getAllStores() {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('indexer_stores')
    .select('*')
    .order('name')

  if (error) throw new Error(`Failed to fetch stores: ${error.message}`)
  return data as Store[]
}

// ── Calls ────────────────────────────────────────────────────

export async function createCall(storeId: string, toNumber: string, conversationId?: string) {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('indexer_calls')
    .insert({
      store_id: storeId,
      to_number: toNumber,
      status: conversationId ? 'in_progress' : 'queued',
      conversation_id: conversationId,
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create call: ${error.message}`)
  return data
}

export async function updateCallStatus(
  callId: string,
  status: string,
  extra?: { conversation_id?: string; transcript?: string; error?: string },
) {
  const supabase = createServiceClient()

  const update: Record<string, unknown> = { status }
  if (extra?.conversation_id) update.conversation_id = extra.conversation_id
  if (extra?.transcript) update.transcript = extra.transcript
  if (extra?.error) update.error = extra.error
  if (status === 'completed' || status === 'failed') update.completed_at = new Date().toISOString()

  const { error } = await supabase
    .from('indexer_calls')
    .update(update)
    .eq('id', callId)

  if (error) throw new Error(`Failed to update call: ${error.message}`)
}

export async function getCallsForStore(storeId: string) {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('indexer_calls')
    .select('*')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch calls: ${error.message}`)
  return data
}

export async function getAllCalls() {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('indexer_calls')
    .select('*, indexer_stores(name, address, type)')
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch calls: ${error.message}`)
  return data
}

// ── Extractions ──────────────────────────────────────────────

export async function saveExtraction(
  callId: string,
  storeId: string,
  extraction: CallExtraction,
) {
  const supabase = createServiceClient()

  // Save per-product extractions
  const productRows = extraction.products.map((p) => ({
    call_id: callId,
    store_id: storeId,
    product_name: p.product_name,
    found: p.found,
    price: p.price ?? null,
    before_tax: p.before_tax,
    pack_size: p.pack_size ?? null,
    notes: p.notes ?? null,
    confidence: p.confidence,
  }))

  if (productRows.length > 0) {
    const { error: extError } = await supabase
      .from('indexer_extractions')
      .insert(productRows)

    if (extError) throw new Error(`Failed to save extractions: ${extError.message}`)
  }

  // Save call-level metadata
  const { error: metaError } = await supabase
    .from('indexer_call_metadata')
    .upsert({
      call_id: callId,
      store_carries_seltzers: extraction.store_carries_seltzers,
      call_quality: extraction.call_quality,
      notes: extraction.notes ?? null,
    })

  if (metaError) throw new Error(`Failed to save call metadata: ${metaError.message}`)
}

// ── Results / Dashboard queries ──────────────────────────────

export async function getPriceResults() {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('indexer_extractions')
    .select('*, indexer_stores(name, address, type, phone)')
    .eq('found', true)
    .not('price', 'is', null)
    .order('product_name')
    .order('price')

  if (error) throw new Error(`Failed to fetch results: ${error.message}`)
  return data
}

export async function getResultsSummary() {
  const supabase = createServiceClient()

  const [storesRes, callsRes, extractionsRes] = await Promise.all([
    supabase.from('indexer_stores').select('id', { count: 'exact', head: true }),
    supabase.from('indexer_calls').select('id, status', { count: 'exact' }),
    supabase.from('indexer_extractions').select('id, found, price', { count: 'exact' }),
  ])

  const calls = callsRes.data ?? []
  const extractions = extractionsRes.data ?? []

  return {
    total_stores: storesRes.count ?? 0,
    total_calls: callsRes.count ?? 0,
    completed_calls: calls.filter((c) => c.status === 'completed').length,
    failed_calls: calls.filter((c) => c.status === 'failed').length,
    total_extractions: extractionsRes.count ?? 0,
    products_found: extractions.filter((e) => e.found).length,
    prices_collected: extractions.filter((e) => e.price != null).length,
  }
}
