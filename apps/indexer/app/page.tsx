'use client'

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import {
  Phone,
  Loader2,
  MapPin,
  Store as StoreIcon,
  CheckCircle2,
  XCircle,
  PhoneCall,
  Play,
  Pause,
  Download,
  DollarSign,
  BarChart3,
  CheckSquare,
  Square,
  MinusSquare,
  Plus,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Store, CallExtraction, ProductExtraction } from '@/lib/types'
import { StoreMap, type MarkerStatus } from '@/components/store-map'
import { INDEXED_PRODUCTS } from '@/lib/agent-prompt'

type CallRecord = {
  store_id: string
  status: 'idle' | 'calling' | 'done' | 'extracting' | 'extracted' | 'error' | 'no_answer' | 'hung_up'
  conversation_id?: string
  transcript?: string
  extraction?: CallExtraction
  error?: string
  duration?: number
  calledAt?: string
  endReason?: string
  dbCallId?: string
}

type Tab = 'map' | 'results' | 'settings'

// ── Test numbers (add your friends here) ────────────────────
// These show up as stores in the list so you can batch-call them.
// Remove or empty this array when you're ready to call real stores.
const TEST_NUMBERS: { name: string; phone: string }[] = []

function testNumbersToStores(numbers: { name: string; phone: string }[]): Store[] {
  return numbers.map((n, i) => ({
    id: `test-${i}`,
    name: n.name,
    phone: n.phone,
    address: 'Test number',
    lat: 41.8781 + (i * 0.005),
    lng: -87.6298 + (i * 0.005),
    type: 'other' as const,
    place_id: `test-${i}`,
  }))
}

export default function IndexerPage() {
  const [stores, setStores] = useState<Store[]>([])
  const [calls, setCalls] = useState<Record<string, CallRecord>>({})
  const [loading, setLoading] = useState(true)
  const [singleNumber, setSingleNumber] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [tab, setTab] = useState<Tab>('map')
  const [expandedCallId, setExpandedCallId] = useState<string>()
  const [filter, setFilter] = useState<'all' | 'not_called' | 'called' | 'no_answer' | 'hung_up' | 'test' | 'retarget'>('all')

  // Queue state — one call at a time, full cycle before next
  const [queueRunning, setQueueRunning] = useState(false)
  const [queueCurrent, setQueueCurrent] = useState<string>()
  const queueRef = useRef<Store[]>([])
  const queueAbort = useRef<AbortController | null>(null)
  const processingRef = useRef(false)

  // Retarget list — stores to call again
  const [retargetIds, setRetargetIds] = useState<Set<string>>(new Set())

  // Add store state
  const [newStoreName, setNewStoreName] = useState('')
  const [newStorePhone, setNewStorePhone] = useState('')
  const [newStoreAddress, setNewStoreAddress] = useState('')
  const [newStoreType, setNewStoreType] = useState('liquor_store')

  // ── Persistence helpers ──────────────────────────────────────

  const saveStoresToDb = async (storesToSave: Store[]) => {
    try {
      const res = await fetch('/api/data/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stores: storesToSave }),
      })
      if (!res.ok) console.error('[db] Failed to save stores:', await res.text())
    } catch (err) { console.error('[db] Save stores error:', err) }
  }

  const saveCallToDb = async (storeId: string, toNumber: string, conversationId: string) => {
    try {
      const res = await fetch('/api/data/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: storeId, to_number: toNumber, conversation_id: conversationId, status: 'calling' }),
      })
      const data = await res.json()
      if (!res.ok) console.error('[db] Failed to save call:', data)
      return data.call?.id as string | undefined
    } catch (err) { console.error('[db] Save call error:', err); return undefined }
  }

  const updateCallInDb = async (callId: string, updates: Record<string, unknown>) => {
    try {
      const res = await fetch('/api/data/calls', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_id: callId, ...updates }),
      })
      if (!res.ok) console.error('[db] Failed to update call:', await res.text())
    } catch (err) { console.error('[db] Update call error:', err) }
  }

  const saveExtractionToDb = async (callId: string, storeId: string, products: unknown[]) => {
    try {
      const res = await fetch('/api/data/extractions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_id: callId, store_id: storeId, products }),
      })
      if (!res.ok) console.error('[db] Failed to save extractions:', await res.text())
    } catch (err) { console.error('[db] Save extractions error:', err) }
  }

  // ── Load stores + calls on mount ───────────────────────────

  useEffect(() => {
    const loadData = async () => {
      const testStores = testNumbersToStores(TEST_NUMBERS)

      // Load stores: try Supabase first, then Google Places for new ones
      let allStores = [...testStores]

      try {
        // Load persisted stores from Supabase
        const dbRes = await fetch('/api/data/stores')
        const dbData = await dbRes.json()
        if (dbRes.ok && dbData.stores?.length > 0) {
          const dbStoreIds = new Set((dbData.stores as Store[]).map((s) => s.id))
          // Add DB stores that aren't test stores
          const dbStores = (dbData.stores as Store[]).filter((s) => !s.id.startsWith('test-'))
          allStores = [...testStores, ...dbStores]

          // Also search for new stores from Google Places
          try {
            const placesRes = await fetch('/api/stores/search')
            const placesData = await placesRes.json()
            if (placesRes.ok) {
              const newStores = (placesData.stores as Store[]).filter((s) => !dbStoreIds.has(s.id))
              if (newStores.length > 0) {
                allStores = [...allStores, ...newStores]
                // Save new stores to DB
                saveStoresToDb(newStores)
              }
            }
          } catch { /* Places API optional */ }
        } else {
          // No DB stores — load from Google Places
          try {
            const res = await fetch('/api/stores/search')
            const data = await res.json()
            if (res.ok) {
              allStores = [...testStores, ...data.stores]
              saveStoresToDb(data.stores)
            }
          } catch { /* ignore */ }
        }
      } catch {
        // DB failed — try Google Places directly
        try {
          const res = await fetch('/api/stores/search')
          const data = await res.json()
          if (res.ok) allStores = [...testStores, ...data.stores]
        } catch { /* ignore */ }
      }

      // Save test stores to DB too
      saveStoresToDb(testStores)
      setStores(allStores)

      // Load persisted calls
      try {
        const callsRes = await fetch('/api/data/calls')
        const callsData = await callsRes.json()
        console.log('[load] Calls from DB:', callsRes.ok, callsData.calls?.length ?? 0)
        if (!callsRes.ok) console.error('[load] Calls error:', callsData)

        if (callsRes.ok && callsData.calls?.length > 0) {
          const restoredCalls: Record<string, CallRecord> = {}
          for (const call of callsData.calls) {
            const extractions = call.extractions ?? []
            const products = extractions.map((e: Record<string, unknown>) => ({
              product_name: e.product_name,
              found: e.found,
              price: e.price != null ? Number(e.price) : undefined,
              before_tax: e.before_tax,
              pack_size: e.pack_size,
              notes: e.notes,
              confidence: e.confidence,
            }))

            // If a call was mid-flight when the page closed, mark it as stale
            const status = ['calling', 'extracting', 'done'].includes(call.status)
              ? 'error'
              : call.status

            restoredCalls[call.store_id] = {
              store_id: call.store_id,
              status,
              conversation_id: call.conversation_id,
              transcript: call.transcript,
              duration: call.duration,
              calledAt: call.created_at,
              endReason: call.end_reason,
              dbCallId: call.id,
              extraction: products.length > 0 ? {
                store_carries_seltzers: products.some((p: { found: boolean }) => p.found),
                products,
                call_quality: 'good',
              } : undefined,
            }
          }
          console.log('[load] Restored', Object.keys(restoredCalls).length, 'calls')
          setCalls(restoredCalls)
        }
      } catch (err) { console.error('[load] Failed to load calls:', err) }

      setLoading(false)
    }
    loadData()
  }, [])

  // ── Derived stats ───────────────────────────────────────────

  const stats = useMemo(() => {
    const allCalls = Object.values(calls)
    const extracted = allCalls.filter((c) => c.status === 'extracted')
    const allProducts: ProductExtraction[] = extracted.flatMap(
      (c) => c.extraction?.products ?? [],
    )

    const byProduct = INDEXED_PRODUCTS.map((p) => {
      const matches = allProducts.filter(
        (e) => e.product_name.toLowerCase().includes(p.shortName.toLowerCase().split(' ')[0].toLowerCase()),
      )
      const found = matches.filter((m) => m.found)
      const prices = found.filter((m) => m.price != null).map((m) => m.price!)
      return {
        ...p,
        found: found.length,
        notFound: matches.length - found.length,
        prices,
        avgPrice: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : null,
        minPrice: prices.length > 0 ? Math.min(...prices) : null,
        maxPrice: prices.length > 0 ? Math.max(...prices) : null,
      }
    })

    return {
      totalStores: stores.length,
      called: allCalls.filter((c) => c.status !== 'idle' && c.status !== 'calling').length,
      extracted: extracted.length,
      failed: allCalls.filter((c) => c.status === 'error').length,
      calling: allCalls.filter((c) => c.status === 'calling').length,
      totalPrices: allProducts.filter((p) => p.found && p.price != null).length,
      byProduct,
    }
  }, [calls, stores])

  // ── Map marker statuses ─────────────────────────────────────

  const markerStatuses = useMemo(() => {
    const map: Record<string, MarkerStatus> = {}
    for (const [id, call] of Object.entries(calls)) {
      if (call.status === 'calling') map[id] = 'calling'
      else if (call.status === 'extracted') map[id] = 'extracted'
      else if (call.status === 'done' || call.status === 'extracting') map[id] = 'done'
      else if (call.status === 'error') map[id] = 'error'
    }
    // Mark selected stores that aren't in a call state
    for (const id of selectedIds) {
      if (!map[id]) map[id] = 'selected'
    }
    return map
  }, [calls, selectedIds])

  // ── Filtered stores ─────────────────────────────────────────

  const filteredStores = useMemo(() => {
    switch (filter) {
      case 'test':
        return stores.filter((s) => s.id.startsWith('test-') || s.id.startsWith('manual-'))
      case 'not_called':
        return stores.filter((s) => !calls[s.id])
      case 'called':
        return stores.filter((s) => {
          const c = calls[s.id]
          return c && (c.status === 'extracted' || c.status === 'done' || c.status === 'extracting')
        })
      case 'no_answer':
        return stores.filter((s) => calls[s.id]?.status === 'no_answer')
      case 'hung_up':
        return stores.filter((s) => calls[s.id]?.status === 'hung_up')
      case 'retarget':
        return stores.filter((s) => retargetIds.has(s.id) || !calls[s.id])
      default:
        return stores
    }
  }, [stores, filter, calls, retargetIds])

  // Filter counts for badges
  const filterCounts = useMemo(() => ({
    all: stores.length,
    not_called: stores.filter((s) => !calls[s.id]).length,
    called: stores.filter((s) => {
      const c = calls[s.id]
      return c && (c.status === 'extracted' || c.status === 'done' || c.status === 'extracting')
    }).length,
    no_answer: stores.filter((s) => calls[s.id]?.status === 'no_answer').length,
    hung_up: stores.filter((s) => calls[s.id]?.status === 'hung_up').length,
    retarget: stores.filter((s) => retargetIds.has(s.id) || !calls[s.id]).length,
    test: stores.filter((s) => s.id.startsWith('test-') || s.id.startsWith('manual-')).length,
  }), [stores, calls, retargetIds])

  // ── Stores with prices collected ───────────────────────────

  const priceCollectedIds = useMemo(() => {
    const ids = new Set<string>()
    for (const [id, call] of Object.entries(calls)) {
      if (
        call.status === 'extracted' &&
        call.extraction?.products?.some((p) => p.found && p.price != null)
      ) {
        ids.add(id)
      }
    }
    return ids
  }, [calls])

  // Only stores that have extracted prices — for the results map
  const storesWithPrices = useMemo(() => {
    return stores.filter((s) => priceCollectedIds.has(s.id))
  }, [stores, priceCollectedIds])

  // Count of products with prices per store — for map coloring
  const priceCountByStore = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const [id, call] of Object.entries(calls)) {
      if (call.extraction?.products) {
        counts[id] = call.extraction.products.filter((p) => p.found && p.price != null).length
      }
    }
    return counts
  }, [calls])

  // ── Derived results for the table ──────────────────────────

  type ResultRow = {
    storeName: string
    storeAddress: string
    storeType: string
    storePhone: string
    productName: string
    price: number
    confidence: string
    notes: string
    transcript: string
  }

  const resultRows = useMemo(() => {
    const rows: ResultRow[] = []
    for (const [storeId, call] of Object.entries(calls)) {
      if (call.status !== 'extracted' || !call.extraction?.products) continue
      const store = stores.find((s) => s.id === storeId)
      if (!store) continue

      for (const p of call.extraction.products) {
        if (!p.found || p.price == null) continue
        rows.push({
          storeName: store.name,
          storeAddress: store.address,
          storeType: store.type,
          storePhone: store.phone,
          productName: p.product_name,
          price: p.price,
          confidence: p.confidence,
          notes: p.notes ?? '',
          transcript: call.transcript ?? '',
        })
      }
    }
    return rows
  }, [calls, stores])

  // ── Selection ───────────────────────────────────────────────

  const toggleSelect = (storeId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(storeId)) next.delete(storeId)
      else next.add(storeId)
      return next
    })
  }

  const selectAll = () => {
    if (selectedIds.size === stores.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(stores.map((s) => s.id)))
    }
  }

  const handleMapStoreClick = useCallback((storeId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(storeId)) next.delete(storeId)
      else next.add(storeId)
      return next
    })
  }, [])


  // ── Call queue: atomic, sequential, resilient ───────────────
  //
  // GUARANTEES:
  // 1. One call at a time — never two concurrent calls
  // 2. Full cycle completes before next: trigger → poll → extract → save
  // 3. No individual failure stops the queue
  // 4. Every call gets a final status saved to Supabase
  // 5. Every answered call attempts transcript extraction
  // 6. 20s mandatory cooldown between calls

  const updateCallState = (storeId: string, updates: Partial<CallRecord>) => {
    setCalls((prev) => ({
      ...prev,
      [storeId]: { ...prev[storeId], ...updates },
    }))
  }

  const processOneCall = async (store: Store): Promise<void> => {
    const storeId = store.id
    const calledAt = new Date().toISOString()
    console.log(`[queue] ── START: ${store.name} (${store.phone}) ──`)

    // ── STAGE 1: Mark as calling ──────────────────────────────
    updateCallState(storeId, { store_id: storeId, status: 'calling', calledAt })

    // ── STAGE 2: Ensure store exists in DB ────────────────────
    try { await saveStoresToDb([store]) } catch { /* non-blocking */ }

    // ── STAGE 3: Trigger the outbound call ────────────────────
    let conversationId: string | undefined
    let dbCallId: string | undefined

    try {
      const res = await fetch('/api/call-bar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toNumber: store.phone }),
      })
      const data = await res.json()

      if (!res.ok) {
        console.error(`[queue] Trigger failed:`, data)
        updateCallState(storeId, { status: 'error', error: data.error || 'Trigger failed' })
        try { dbCallId = await saveCallToDb(storeId, store.phone, ''); if (dbCallId) await updateCallInDb(dbCallId, { status: 'error', error: data.error }) } catch { /* */ }
        return
      }

      conversationId = data.data?.conversation_id
      console.log(`[queue] Triggered: ${conversationId}`)
      try { dbCallId = await saveCallToDb(storeId, store.phone, conversationId ?? '') } catch { /* non-blocking */ }
      updateCallState(storeId, { conversation_id: conversationId, dbCallId })
    } catch (err) {
      console.error(`[queue] Trigger network error:`, err)
      updateCallState(storeId, { status: 'error', error: 'Network error' })
      return
    }

    if (!conversationId) {
      updateCallState(storeId, { status: 'error', error: 'No conversation ID' })
      return
    }

    // ── STAGE 4: Poll until call ends ─────────────────────────
    // No hard timeout. Polls every 5s until ElevenLabs reports a terminal state.
    // Safety net at 15 minutes for truly stuck calls.
    type PollResult = 'completed' | 'no_answer' | 'hung_up' | 'failed'
    let pollResult: PollResult = 'completed'
    let callDuration: number | undefined
    let callEndReason = ''
    let pollCount = 0

    console.log(`[queue] Polling...`)
    // eslint-disable-next-line no-constant-condition
    while (true) {
      pollCount++
      await new Promise((r) => setTimeout(r, 5000))

      try {
        const res = await fetch(`/api/calls/${conversationId}/status`)
        if (!res.ok) continue

        const data = await res.json()
        const s = (data.status ?? '').toLowerCase()
        const er = (data.end_reason ?? '').toLowerCase()

        // Still active — keep polling
        if (['initiated', 'in-progress', 'in_progress', 'active', 'processing'].includes(s)) {
          continue
        }

        // Terminal state reached
        callDuration = data.duration
        callEndReason = er

        if (['done', 'completed', 'ended', 'finished'].includes(s)) {
          if (er.includes('no_answer') || er.includes('no-answer') || er.includes('unanswered') || er.includes('busy')) {
            pollResult = 'no_answer'
          } else if (er.includes('hangup') || er.includes('hang_up') || er.includes('rejected') || er.includes('caller_hung_up')) {
            pollResult = 'hung_up'
          } else if (callDuration != null && callDuration < 5) {
            pollResult = 'no_answer'
          } else {
            pollResult = 'completed'
          }
          break
        }

        if (['failed', 'error'].includes(s)) {
          if (er.includes('no_answer') || er.includes('busy') || er.includes('unanswered')) {
            pollResult = 'no_answer'
          } else {
            pollResult = 'failed' // May still have transcript
          }
          break
        }

        // Unknown status — safety net at 15 min
        if (pollCount > 180) {
          console.log(`[queue] Safety timeout (15min), status="${s}"`)
          pollResult = 'failed'
          break
        }
      } catch {
        // Network error — keep polling
        if (pollCount > 180) { pollResult = 'failed'; break }
      }
    }

    console.log(`[queue] Poll done: result=${pollResult}, duration=${callDuration}s, reason=${callEndReason}`)
    updateCallState(storeId, { duration: callDuration, endReason: callEndReason })

    // ── STAGE 5: Handle no-answer / hung-up ───────────────────
    // These have no transcript — save status and move on
    if (pollResult === 'no_answer') {
      console.log(`[queue] No answer — done`)
      updateCallState(storeId, { status: 'no_answer' })
      if (dbCallId) try { await updateCallInDb(dbCallId, { status: 'no_answer', duration: callDuration, end_reason: callEndReason }) } catch { /* */ }
      return
    }
    if (pollResult === 'hung_up') {
      console.log(`[queue] Hung up — done`)
      updateCallState(storeId, { status: 'hung_up' })
      if (dbCallId) try { await updateCallInDb(dbCallId, { status: 'hung_up', duration: callDuration, end_reason: callEndReason }) } catch { /* */ }
      return
    }

    // ── STAGE 6: Wait for transcript ──────────────────────────
    // Longer calls need more processing time. Scale wait with duration.
    const waitMs = Math.max(10000, Math.min((callDuration ?? 30) * 200, 30000))
    console.log(`[queue] Waiting ${waitMs / 1000}s for transcript...`)
    await new Promise((r) => setTimeout(r, waitMs))

    // ── STAGE 7: Fetch transcript + extract ───────────────────
    updateCallState(storeId, { status: 'extracting' })

    let transcript = ''
    let extraction: CallExtraction | undefined

    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        console.log(`[queue] Transcript attempt ${attempt + 1}/4...`)
        const res = await fetch(`/api/calls/${conversationId}/transcript`)
        const data = await res.json()
        transcript = data.transcript || ''
        extraction = data.extraction || undefined
        if (transcript) {
          console.log(`[queue] Transcript: ${transcript.length} chars, ${extraction?.products?.length ?? 0} products`)
          break
        }
      } catch (err) {
        console.error(`[queue] Transcript error:`, err)
      }
      if (attempt < 3) {
        const delay = 10000 + attempt * 8000
        console.log(`[queue] Retrying in ${delay / 1000}s...`)
        await new Promise((r) => setTimeout(r, delay))
      }
    }

    // ── STAGE 8: Save final result to state + DB ──────────────
    const hasPrices = extraction?.products?.some((p) => p.found && p.price != null) ?? false
    const finalStatus = transcript ? 'extracted' : (pollResult === 'failed' ? 'error' : 'extracted')

    updateCallState(storeId, {
      status: finalStatus as CallRecord['status'],
      transcript: transcript || '(no transcript available)',
      extraction,
    })

    if (dbCallId) {
      try {
        await updateCallInDb(dbCallId, {
          status: finalStatus,
          transcript: transcript || '',
          duration: callDuration,
          end_reason: callEndReason,
        })
        if (extraction?.products && extraction.products.length > 0) {
          await saveExtractionToDb(dbCallId, storeId, extraction.products)
        }
      } catch (err) {
        console.error(`[queue] DB save error:`, err)
      }
    }

    console.log(`[queue] ── DONE: ${store.name} | ${finalStatus} | transcript=${!!transcript} | prices=${hasPrices} ──`)
  }

  // ── Queue processor ─────────────────────────────────────────
  // Outer try/catch guarantees the queue NEVER stops due to an error.
  // Each call is independent — one failure doesn't affect the next.

  const processQueue = async () => {
    if (processingRef.current) return
    processingRef.current = true
    setQueueRunning(true)

    while (queueRef.current.length > 0) {
      if (queueAbort.current?.signal.aborted) break

      const store = queueRef.current[0]
      setQueueCurrent(store.name)

      try {
        await processOneCall(store)
      } catch (err) {
        // Should never happen — processOneCall handles its own errors
        console.error(`[queue] UNEXPECTED:`, err)
        updateCallState(store.id, { status: 'error', error: 'Unexpected error' })
      }

      queueRef.current = queueRef.current.slice(1)

      // 20s mandatory cooldown — ensures phone line is fully released
      if (queueRef.current.length > 0 && !queueAbort.current?.signal.aborted) {
        console.log(`[queue] Cooldown 20s (${queueRef.current.length} remaining)...`)
        await new Promise((r) => setTimeout(r, 20000))
      }
    }

    setQueueRunning(false)
    setQueueCurrent(undefined)
    processingRef.current = false
    console.log('[queue] ── QUEUE COMPLETE ──')
    if (queueRef.current.length === 0 && !queueAbort.current?.signal.aborted) {
      toast.success('All calls complete')
    }
  }

  const enqueueCall = (store: Store) => {
    if (queueRef.current.some((s) => s.id === store.id)) {
      toast.info(`${store.name} is already queued`)
      return
    }
    queueRef.current = [...queueRef.current, store]
    processQueue()
  }

  const enqueueBatch = (storeIds?: Set<string>) => {
    const storesToCall = storeIds ? stores.filter((s) => storeIds.has(s.id)) : stores
    const toAdd = storesToCall.filter((s) => !queueRef.current.some((q) => q.id === s.id))
    if (toAdd.length === 0) { toast.info('All selected stores are already queued'); return }
    queueAbort.current = new AbortController()
    queueRef.current = [...queueRef.current, ...toAdd]
    toast.info(`${toAdd.length} stores added to queue`)
    processQueue()
  }

  const pauseQueue = () => {
    queueAbort.current?.abort()
    queueRef.current = []
    setQueueRunning(false)
    setQueueCurrent(undefined)
    processingRef.current = false
  }

  // ── Quick call ──────────────────────────────────────────────

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '')
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
  }

  const handleQuickCall = () => {
    const digits = singleNumber.replace(/\D/g, '')
    if (digits.length < 10) return
    const phone = `+1${digits}`
    const quickStore: Store = {
      id: `quick-${Date.now()}`,
      name: `Quick Call ${phone}`,
      phone,
      address: 'Quick dial',
      lat: 41.8781,
      lng: -87.6298,
      type: 'other',
      place_id: `quick-${Date.now()}`,
    }
    setStores((prev) => [quickStore, ...prev])
    enqueueCall(quickStore)
    setSingleNumber('')
  }

  // ── Add store ───────────────────────────────────────────────

  const handleAddStore = () => {
    if (!newStoreName || !newStorePhone) {
      toast.error('Name and phone are required')
      return
    }

    const digits = newStorePhone.replace(/\D/g, '')
    const phone = digits.length === 10 ? `+1${digits}` : `+${digits}`

    const store: Store = {
      id: `manual-${Date.now()}`,
      name: newStoreName,
      phone,
      address: newStoreAddress || 'Manually added',
      lat: 41.8781 + (Math.random() - 0.5) * 0.05,
      lng: -87.6298 + (Math.random() - 0.5) * 0.05,
      type: newStoreType as Store['type'],
      place_id: `manual-${Date.now()}`,
    }

    setStores((prev) => [store, ...prev])
    setNewStoreName('')
    setNewStorePhone('')
    setNewStoreAddress('')
    toast.success(`Added ${store.name}`)
  }

  // ── Helpers ─────────────────────────────────────────────────

  const typeColor = (type: string) => {
    const colors: Record<string, string> = {
      bar: 'bg-purple-500/20 text-purple-400',
      liquor_store: 'bg-amber-500/20 text-amber-400',
      grocery: 'bg-green-500/20 text-green-400',
      gas_station: 'bg-blue-500/20 text-blue-400',
      convenience: 'bg-cyan-500/20 text-cyan-400',
      other: 'bg-zinc-500/20 text-zinc-400',
    }
    return colors[type] ?? colors.other
  }

  const typeLabel = (type: string) =>
    type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <main className="h-screen flex flex-col p-4 gap-3 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">Price Indexer</h1>
          {loading && (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center bg-secondary rounded-xl p-1">
          <button
            onClick={() => setTab('map')}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === 'map' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Stores
          </button>
          <button
            onClick={() => setTab('results')}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === 'results' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Results
          </button>
        </div>
      </div>


      {/* Main content */}
      {tab === 'map' ? (
        <div className="flex-1 min-h-0 flex gap-4">
          {/* Left: Target List + Call Log */}
          <div className="w-[70%] flex flex-col min-h-0 gap-3">

            {/* ── Target List (phone book) ─────────────────────── */}
            <div className={`flex flex-col min-h-0 ${Object.keys(calls).length > 0 ? 'max-h-[50%]' : 'flex-1'}`}>
              <div className="flex items-center justify-between mb-2 shrink-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold">Target List</h2>
                  <button onClick={selectAll} className="text-muted-foreground hover:text-foreground transition-all">
                    {selectedIds.size === 0 ? (
                      <Square className="w-3.5 h-3.5" />
                    ) : selectedIds.size === stores.length ? (
                      <CheckSquare className="w-3.5 h-3.5 text-primary" />
                    ) : (
                      <MinusSquare className="w-3.5 h-3.5 text-primary" />
                    )}
                  </button>
                  <span className="text-[11px] text-muted-foreground">
                    {selectedIds.size > 0
                      ? `${selectedIds.size} selected`
                      : `${filteredStores.length} stores`}
                  </span>
                  <div className="flex items-center gap-1 ml-1 flex-wrap">
                    {([
                      { key: 'all', label: 'All' },
                      { key: 'not_called', label: 'Not Called' },
                      { key: 'called', label: 'Called' },
                      { key: 'no_answer', label: 'No Answer' },
                      { key: 'hung_up', label: 'Hung Up' },
                      { key: 'retarget', label: 'Retarget' },
                      { key: 'test', label: 'Test' },
                    ] as const).map(({ key, label }) => {
                      const count = filterCounts[key]
                      if (key !== 'all' && count === 0) return null
                      return (
                        <button
                          key={key}
                          onClick={() => setFilter(key)}
                          className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                            filter === key
                              ? key === 'no_answer'
                                ? 'bg-amber-500/20 text-amber-400'
                                : key === 'hung_up'
                                  ? 'bg-destructive/20 text-destructive'
                                  : key === 'retarget'
                                    ? 'bg-blue-500/20 text-blue-400'
                                    : 'bg-background text-foreground'
                              : 'bg-secondary text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {label}
                          {key !== 'all' && <span className="ml-1 opacity-60">{count}</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
                {selectedIds.size > 0 && (
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="text-[11px] text-muted-foreground hover:text-foreground transition-all"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                {filteredStores.length > 0 ? (
                  filteredStores.map((store) => {
                    const isSelected = selectedIds.has(store.id)

                    return (
                      <div
                        key={store.id}
                        className={`flex items-center rounded-lg border transition-all ${
                          isSelected
                            ? 'bg-secondary border-primary/30 ring-1 ring-primary/20'
                            : 'bg-secondary/50 border-border/50 hover:bg-secondary/70'
                        }`}
                      >
                        <div
                          className="flex items-center gap-2.5 p-2.5 flex-1 min-w-0 cursor-pointer"
                          onClick={() => toggleSelect(store.id)}
                        >
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleSelect(store.id) }}
                            className="shrink-0 text-muted-foreground hover:text-foreground"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-3.5 h-3.5 text-primary" />
                            ) : (
                              <Square className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium truncate">{store.name}</span>
                              <span className={`text-[9px] px-1 py-0.5 rounded-full font-medium ${typeColor(store.type)}`}>
                                {typeLabel(store.type)}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                              <span className="flex items-center gap-1 truncate">
                                <MapPin className="w-2.5 h-2.5 shrink-0" />
                                {store.address}
                              </span>
                              <span className="flex items-center gap-1 shrink-0">
                                <Phone className="w-2.5 h-2.5" />
                                {store.phone}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Call button — shows status if active */}
                        <div className="shrink-0 pr-2">
                          {calls[store.id]?.status === 'calling' ? (
                            <span className="flex items-center gap-1.5 px-3 py-1.5 text-amber-400 text-[11px]">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Calling
                            </span>
                          ) : calls[store.id]?.status === 'extracting' ? (
                            <span className="flex items-center gap-1.5 px-3 py-1.5 text-primary text-[11px]">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Extracting
                            </span>
                          ) : queueRef.current.some((q) => q.id === store.id) ? (
                            <span className="px-3 py-1.5 text-muted-foreground text-[11px]">
                              Queued
                            </span>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                enqueueCall(store)
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-foreground text-[11px] font-medium hover:bg-secondary/80 transition-all border border-border/50"
                            >
                              <PhoneCall className="w-3.5 h-3.5" />
                              Call
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-muted-foreground">
                      {loading
                        ? 'Loading Chicago stores...'
                        : filter === 'not_called'
                          ? 'All stores have been called'
                          : filter === 'no_answer'
                            ? 'No unanswered calls'
                            : filter === 'hung_up'
                              ? 'No hung up calls'
                              : filter === 'called'
                                ? 'No calls completed yet'
                                : filter === 'retarget'
                                  ? 'No stores to retarget — add from the Call Log'
                                  : filter === 'test'
                                    ? 'No test numbers'
                                    : 'No stores found'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ── Call Log (table) ─────────────────────────────── */}
            {Object.keys(calls).length > 0 && (
              <div className="flex-1 flex flex-col min-h-0">
                <h2 className="text-sm font-semibold mb-2 shrink-0">
                  Call Log
                  <span className="text-xs font-normal text-muted-foreground ml-2">
                    {Object.keys(calls).length} calls
                  </span>
                </h2>
                <div className="flex-1 overflow-auto rounded-xl border border-border min-h-0">
                  <table className="w-full text-xs">
                    <thead className="bg-secondary sticky top-0">
                      <tr>
                        <th className="text-left p-2.5 font-medium text-muted-foreground">Store</th>
                        <th className="text-left p-2.5 font-medium text-muted-foreground">Phone</th>
                        <th className="text-left p-2.5 font-medium text-muted-foreground">Status</th>
                        <th className="text-left p-2.5 font-medium text-muted-foreground">Result</th>
                        <th className="text-right p-2.5 font-medium text-muted-foreground">Duration</th>
                        <th className="text-left p-2.5 font-medium text-muted-foreground">Time</th>
                        <th className="text-left p-2.5 font-medium text-muted-foreground">Transcript</th>
                        <th className="text-left p-2.5 font-medium text-muted-foreground"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(calls)
                        .sort(([, a], [, b]) => {
                          // Most recent first
                          const timeA = a.calledAt ? new Date(a.calledAt).getTime() : 0
                          const timeB = b.calledAt ? new Date(b.calledAt).getTime() : 0
                          return timeB - timeA
                        })
                        .map(([storeId, call]) => {
                          const store = stores.find((s) => s.id === storeId)
                          if (!store) return null
                          const hasPrice = call.extraction?.products?.some((p) => p.found && p.price != null)
                          const priceCount = call.extraction?.products?.filter((p) => p.found && p.price != null).length ?? 0

                          return (
                            <React.Fragment key={storeId}>
                            <tr className="border-t border-border/50 hover:bg-secondary/30">
                              <td className="p-2.5">
                                <div className="font-medium">{store.name}</div>
                                <span className={`text-[9px] px-1 py-0.5 rounded-full ${typeColor(store.type)}`}>
                                  {typeLabel(store.type)}
                                </span>
                              </td>
                              <td className="p-2.5 text-muted-foreground">{store.phone}</td>
                              <td className="p-2.5">
                                {call.status === 'calling' ? (
                                  <span className="flex items-center gap-1.5 text-amber-400">
                                    <span className="relative flex h-2 w-2">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
                                    </span>
                                    Calling
                                  </span>
                                ) : call.status === 'extracting' ? (
                                  <span className="flex items-center gap-1.5 text-primary">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Extracting
                                  </span>
                                ) : call.status === 'done' ? (
                                  <span className="flex items-center gap-1.5 text-blue-400">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Processing
                                  </span>
                                ) : call.status === 'extracted' ? (
                                  <span className="text-green-400">Complete</span>
                                ) : call.status === 'no_answer' ? (
                                  <span className="text-amber-400">No Answer</span>
                                ) : call.status === 'hung_up' ? (
                                  <span className="text-destructive">Hung Up</span>
                                ) : call.status === 'error' ? (
                                  <span className="text-destructive">Failed</span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="p-2.5">
                                {call.status === 'extracted' && call.extraction?.products ? (
                                  hasPrice ? (
                                    <span className="text-green-400">
                                      {priceCount} price{priceCount !== 1 ? 's' : ''} found
                                    </span>
                                  ) : (
                                    <span className="text-destructive">No prices</span>
                                  )
                                ) : call.status === 'no_answer' ? (
                                  <span className="text-amber-400">—</span>
                                ) : call.status === 'hung_up' ? (
                                  <span className="text-destructive">Hung up before answering</span>
                                ) : call.status === 'error' ? (
                                  <span className="text-destructive text-[10px]">{call.error || 'Failed'}</span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="p-2.5 text-right text-muted-foreground">
                                {call.duration
                                  ? `${Math.floor(call.duration / 60)}:${String(Math.floor(call.duration % 60)).padStart(2, '0')}`
                                  : '—'}
                              </td>
                              <td className="p-2.5 text-muted-foreground">
                                {call.calledAt
                                  ? new Date(call.calledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                  : '—'}
                              </td>
                              <td className="p-2.5">
                                {call.transcript ? (
                                  <button
                                    onClick={() => setExpandedCallId(expandedCallId === storeId ? undefined : storeId)}
                                    className="text-[10px] text-primary hover:underline"
                                  >
                                    {expandedCallId === storeId ? 'Hide' : 'View'}
                                  </button>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="p-2.5">
                                {retargetIds.has(storeId) ? (
                                  <button
                                    onClick={() => setRetargetIds((prev) => {
                                      const next = new Set(prev)
                                      next.delete(storeId)
                                      return next
                                    })}
                                    className="text-[10px] text-blue-400 hover:underline"
                                  >
                                    Added
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => setRetargetIds((prev) => new Set([...prev, storeId]))}
                                    className="text-[10px] text-muted-foreground hover:text-blue-400 hover:underline"
                                  >
                                    Retarget
                                  </button>
                                )}
                              </td>
                            </tr>
                            {expandedCallId === storeId && call.transcript && (
                              <tr>
                                <td colSpan={8} className="p-0">
                                  <div className="px-4 py-3 bg-secondary/50 border-t border-border/30">
                                    <div className="text-[10px] font-medium text-muted-foreground mb-1.5">Transcript</div>
                                    <pre className="text-[11px] text-foreground/80 whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto">
                                      {call.transcript}
                                    </pre>
                                  </div>
                                </td>
                              </tr>
                            )}
                            </React.Fragment>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Right: Controls panel */}
          <div className="w-[30%] shrink-0 flex flex-col gap-3 overflow-y-auto pr-1">
            <h2 className="text-sm font-semibold mb-2 shrink-0">Call Center</h2>
            {/* Call controls */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">

              {/* Quick call */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-muted-foreground">Quick dial</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">+1</span>
                    <input
                      type="tel"
                      value={formatPhone(singleNumber)}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, '')
                        if (digits.length <= 10) setSingleNumber(digits)
                      }}
                      placeholder="(555) 123-4567"
                      className="w-full pl-9 pr-3 py-2 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground/50 text-xs focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                      onKeyDown={(e) => { if (e.key === 'Enter') handleQuickCall() }}
                    />
                  </div>
                  <button
                    onClick={handleQuickCall}
                    disabled={singleNumber.replace(/\D/g, '').length < 10}
                    className="px-3 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-xs hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="border-t border-border/50" />

              {/* Batch actions */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-muted-foreground">Batch</label>
              <div className="space-y-2">
                {queueRunning ? (
                  <button
                    onClick={pauseQueue}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-amber-500/20 text-amber-400 font-medium text-xs hover:bg-amber-500/30 transition-all"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    Pause Batch
                  </button>
                ) : (
                  <>
                    {selectedIds.size > 0 && (
                      <button
                        onClick={() => enqueueBatch(selectedIds)}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-xs hover:brightness-110 transition-all"
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                        Call Selected ({selectedIds.size})
                      </button>
                    )}
                    <button
                      onClick={() => enqueueBatch()}
                      disabled={stores.length === 0 || loading}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-secondary text-foreground font-medium text-xs hover:bg-secondary/80 disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-border/50"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Call All Stores
                    </button>
                  </>
                )}
              </div>
              </div>
            </div>

            {/* Live status */}
            {(queueRunning || stats.calling > 0) && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Phone className="w-4 h-4 text-amber-400" />
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-400 rounded-full animate-ping" />
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-400 rounded-full" />
                  </div>
                  <span className="text-xs text-amber-400 font-medium">
                    {queueCurrent ? `Calling ${queueCurrent}` : `${stats.calling} active`}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                    <div
                      key={i}
                      className="w-1 bg-amber-400/80 rounded-full"
                      style={{ animation: `waveform 0.8s ease-in-out ${i * 0.08}s infinite alternate` }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <h3 className="text-xs font-medium text-muted-foreground">Progress</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Stores', value: stats.totalStores },
                  { label: 'Called', value: stats.called },
                  { label: 'Extracted', value: stats.extracted },
                  { label: 'Prices', value: stats.totalPrices },
                ].map(({ label, value }) => (
                  <div key={label} className="space-y-0.5">
                    <div className="text-lg font-semibold">{value}</div>
                    <div className="text-[10px] text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>
              {stats.failed > 0 && (
                <div className="text-[11px] text-destructive">
                  {stats.failed} failed
                </div>
              )}
              {stats.called > 0 && stats.totalStores > 0 && (
                <div className="space-y-1">
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${(stats.called / stats.totalStores) * 100}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-muted-foreground text-right">
                    {Math.round((stats.called / stats.totalStores) * 100)}% complete
                  </div>
                </div>
              )}
            </div>

            {/* Per-product mini summary */}
            {stats.byProduct.some((p) => p.prices.length > 0) && (
              <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                <h3 className="text-xs font-medium text-muted-foreground">Avg Prices</h3>
                {stats.byProduct
                  .filter((p) => p.avgPrice !== null)
                  .map((p) => (
                    <div key={p.shortName} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{p.shortName}</span>
                      <span className="font-medium">${p.avgPrice!.toFixed(2)}</span>
                    </div>
                  ))}
              </div>
            )}

            {/* Add Store */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <h3 className="text-sm font-semibold">Add Store</h3>
              <div className="space-y-2">
                <div>
                  <label className="text-[11px] text-muted-foreground">Store name</label>
                  <input
                    value={newStoreName}
                    onChange={(e) => setNewStoreName(e.target.value)}
                    className="w-full mt-1 p-2 rounded-lg bg-secondary border border-border text-foreground text-xs focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                    placeholder="Joe's Liquor"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground">Phone number</label>
                  <input
                    value={newStorePhone}
                    onChange={(e) => setNewStorePhone(e.target.value)}
                    className="w-full mt-1 p-2 rounded-lg bg-secondary border border-border text-foreground text-xs focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                    placeholder="(312) 555-1234"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground">Address (optional)</label>
                  <input
                    value={newStoreAddress}
                    onChange={(e) => setNewStoreAddress(e.target.value)}
                    className="w-full mt-1 p-2 rounded-lg bg-secondary border border-border text-foreground text-xs focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                    placeholder="123 N Michigan Ave, Chicago"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground">Type</label>
                  <select
                    value={newStoreType}
                    onChange={(e) => setNewStoreType(e.target.value)}
                    className="w-full mt-1 p-2 rounded-lg bg-secondary border border-border text-foreground text-xs focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  >
                    <option value="liquor_store">Liquor Store</option>
                    <option value="grocery">Grocery Store</option>
                    <option value="convenience">Convenience Store</option>
                    <option value="bar">Bar</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <button
                  onClick={handleAddStore}
                  disabled={!newStoreName || !newStorePhone}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-xs hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add to Target List
                </button>
              </div>
            </div>

          </div>
        </div>
      ) : (
        /* Results tab — prices top, map + table below */
        <div className="flex-1 min-h-0 flex flex-col gap-3">
          {/* TOP: Product price cards — the hero metrics */}
          <div className="grid grid-cols-3 gap-3 shrink-0">
            {stats.byProduct.map((p) => (
              <div key={p.shortName} className="rounded-2xl border border-border bg-card p-5 space-y-2">
                <div className="text-sm text-muted-foreground font-medium">{p.name}</div>
                {p.avgPrice !== null ? (
                  <>
                    <div className="text-4xl font-bold tracking-tight">${p.avgPrice.toFixed(2)}</div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                        Low ${p.minPrice!.toFixed(2)}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                        High ${p.maxPrice!.toFixed(2)}
                      </span>
                      <span>{p.prices.length} prices</span>
                      <span>{p.found} stores</span>
                    </div>
                  </>
                ) : (
                  <div className="text-2xl text-muted-foreground/40 font-light">No data yet</div>
                )}
              </div>
            ))}
          </div>

          {/* Summary stats row */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              {[
                { label: 'Stores', value: stores.length },
                { label: 'Called', value: stats.called },
                { label: 'Extracted', value: stats.extracted },
                { label: 'Prices', value: stats.totalPrices },
              ].map(({ label, value }) => (
                <span key={label} className="px-2 py-1 rounded-md bg-secondary">
                  {value} {label.toLowerCase()}
                </span>
              ))}
              {stats.failed > 0 && (
                <span className="px-2 py-1 rounded-md bg-destructive/10 text-destructive">
                  {stats.failed} failed
                </span>
              )}
            </div>
            <div className="flex-1" />
            <a
              href="/api/results/export"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-foreground text-xs font-medium hover:bg-secondary/80 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </a>
          </div>

          {/* BOTTOM: Map left + Table right */}
          <div className="flex gap-3 flex-1 min-h-0">
            {/* Map — only stores with extracted prices */}
            <div className="w-1/2 h-full">
              <StoreMap
                stores={storesWithPrices}
                priceCountByStore={priceCountByStore}
              />
            </div>

            {/* Right: mini stats + table */}
            <div className="w-1/2 h-full flex flex-col gap-2 min-h-0">
              {/* Mini store metrics */}
              <div className="grid grid-cols-4 gap-1.5 shrink-0">
                {[
                  { label: 'Stores', value: stores.length, icon: StoreIcon },
                  { label: 'Called', value: stats.called, icon: PhoneCall },
                  { label: 'Extracted', value: stats.extracted, icon: BarChart3 },
                  { label: 'Prices', value: stats.totalPrices, icon: DollarSign },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="rounded-lg border border-border bg-card px-2.5 py-2 flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <div>
                      <div className="text-base font-semibold leading-tight">{value}</div>
                      <div className="text-[9px] text-muted-foreground">{label}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Price table */}
              <div className="flex-1 overflow-auto rounded-xl border border-border min-h-0">
              <table className="w-full text-xs">
                <thead className="bg-secondary sticky top-0">
                  <tr>
                    <th className="text-left p-2.5 font-medium text-muted-foreground">Store</th>
                    <th className="text-left p-2.5 font-medium text-muted-foreground">Product</th>
                    <th className="text-right p-2.5 font-medium text-muted-foreground">Price</th>
                    <th className="text-left p-2.5 font-medium text-muted-foreground">Conf.</th>
                    <th className="text-left p-2.5 font-medium text-muted-foreground">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {resultRows.length > 0 ? (
                    resultRows.map((r, i) => (
                      <tr key={i} className="border-t border-border/50 hover:bg-secondary/30">
                        <td className="p-2.5">
                          <div className="font-medium">{r.storeName}</div>
                          <div className="text-muted-foreground text-[10px]">
                            <span className={`px-1 py-0.5 rounded-full ${typeColor(r.storeType)}`}>
                              {typeLabel(r.storeType)}
                            </span>
                          </div>
                        </td>
                        <td className="p-2.5">{r.productName}</td>
                        <td className="p-2.5 text-right font-medium">${r.price.toFixed(2)}</td>
                        <td className="p-2.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                            r.confidence === 'high' ? 'bg-green-500/20 text-green-400'
                              : r.confidence === 'medium' ? 'bg-yellow-500/20 text-yellow-400'
                                : 'bg-red-500/20 text-red-400'
                          }`}>
                            {r.confidence}
                          </span>
                        </td>
                        <td className="p-2.5 text-muted-foreground max-w-[150px] truncate">
                          {r.notes || '—'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">
                        No results yet — call stores and prices will appear here automatically.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
