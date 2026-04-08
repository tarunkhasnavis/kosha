// ── Store / Location ─────────────────────────────────────────

export type StoreType = 'bar' | 'liquor_store' | 'grocery' | 'gas_station' | 'convenience' | 'other'

export type Store = {
  id: string
  name: string
  phone: string
  address: string
  lat: number
  lng: number
  type: StoreType
  place_id: string
}

// ── Call ─────────────────────────────────────────────────────

export type CallStatus = 'queued' | 'in_progress' | 'completed' | 'failed' | 'no_answer'

export type PriceCall = {
  id: string
  store_id: string
  store_name: string
  to_number: string
  status: CallStatus
  conversation_id?: string
  transcript?: string
  extractions?: ProductExtraction[]
  created_at: string
  completed_at?: string
  error?: string
}

// ── Extraction (parsed from transcript) ─────────────────────

export type ProductExtraction = {
  product_name: string
  found: boolean
  price?: number
  before_tax: boolean
  pack_size?: string
  notes?: string
  confidence: 'low' | 'medium' | 'high'
}

export type CallExtraction = {
  store_carries_seltzers: boolean
  products: ProductExtraction[]
  call_quality: 'good' | 'partial' | 'poor'
  notes?: string
}

// ── Batch ────────────────────────────────────────────────────

export type BatchStatus = 'idle' | 'running' | 'paused' | 'done'

export type BatchProgress = {
  status: BatchStatus
  total: number
  completed: number
  failed: number
  current_store?: string
}
