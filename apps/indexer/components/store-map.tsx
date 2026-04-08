'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { Store } from '@/lib/types'

const CHICAGO_CENTER: [number, number] = [-87.6298, 41.8781]

// green = all 3 products, yellow = partial
const ALL_PRODUCTS_COLOR = '#22c55e'
const PARTIAL_COLOR = '#eab308'

export type MarkerStatus = 'idle' | 'selected' | 'calling' | 'done' | 'extracted' | 'error'

type StoreMapProps = {
  stores: Store[]
  // Map of store ID → number of products with prices extracted
  priceCountByStore?: Record<string, number>
  // For the stores tab — call statuses and selection
  selectedStoreIds?: Set<string>
  callStatuses?: Record<string, MarkerStatus>
  onStoreClick?: (storeId: string) => void
}

export function StoreMap({
  stores,
  priceCountByStore = {},
  selectedStoreIds = new Set(),
  callStatuses = {},
  onStoreClick,
}: StoreMapProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<Map<string, { marker: mapboxgl.Marker; el: HTMLDivElement }>>(new Map())
  const [mapHeight, setMapHeight] = useState(0)

  // Measure parent height
  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setMapHeight(entry.contentRect.height)
    })
    observer.observe(wrapper)
    setMapHeight(wrapper.clientHeight)
    return () => observer.disconnect()
  }, [])

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current || mapHeight === 0) return
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: CHICAGO_CENTER,
      zoom: 12,
    })
    map.addControl(new mapboxgl.NavigationControl(), 'top-right')
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [mapHeight])

  useEffect(() => {
    if (mapRef.current && mapHeight > 0) mapRef.current.resize()
  }, [mapHeight])

  // Create/update markers
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const existingIds = new Set(markersRef.current.keys())
    const newIds = new Set(stores.map((s) => s.id))

    for (const id of existingIds) {
      if (!newIds.has(id)) {
        markersRef.current.get(id)?.marker.remove()
        markersRef.current.delete(id)
      }
    }

    stores.forEach((store) => {
      if (!store.lat || !store.lng) return

      const priceCount = priceCountByStore[store.id] ?? 0
      const status = callStatuses[store.id] ?? 'idle'
      const isSelected = selectedStoreIds.has(store.id)
      const isResultsMode = Object.keys(priceCountByStore).length > 0

      let existing = markersRef.current.get(store.id)

      if (!existing) {
        const el = document.createElement('div')
        el.style.cursor = 'pointer'
        el.style.position = 'relative'
        el.style.display = 'flex'
        el.style.alignItems = 'center'
        el.style.justifyContent = 'center'

        el.addEventListener('click', (e) => {
          e.stopPropagation()
          onStoreClick?.(store.id)
        })

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([store.lng, store.lat])
          .addTo(map)

        existing = { marker, el }
        markersRef.current.set(store.id, existing)
      }

      const el = existing.el
      el.innerHTML = ''

      // Determine color
      let color: string
      let size: number

      if (isResultsMode) {
        // Results map: green = all 3, yellow = partial
        color = priceCount >= 3 ? ALL_PRODUCTS_COLOR : PARTIAL_COLOR
        size = 14
      } else if (status === 'calling') {
        color = '#f59e0b'
        size = 16
      } else if (status === 'done' || status === 'extracted') {
        color = priceCount >= 3 ? ALL_PRODUCTS_COLOR : priceCount > 0 ? PARTIAL_COLOR : '#3b82f6'
        size = 14
      } else if (status === 'error') {
        color = '#ef4444'
        size = 12
      } else {
        color = '#71717a'
        size = isSelected ? 14 : 12
      }

      el.style.width = `${size}px`
      el.style.height = `${size}px`

      const dot = document.createElement('div')
      dot.style.width = `${size}px`
      dot.style.height = `${size}px`
      dot.style.borderRadius = '50%'
      dot.style.backgroundColor = color
      dot.style.border = isSelected ? '2px solid white' : '2px solid rgba(255,255,255,0.5)'
      dot.style.boxShadow = `0 0 8px ${color}80`
      dot.style.transition = 'all 0.2s ease'

      if (status === 'calling') {
        dot.style.animation = 'pulse-marker 1s ease-in-out infinite'
      }

      el.appendChild(dot)

      // Update popup with price info
      const priceLabel = isResultsMode
        ? `<div style="font-size: 11px; color: ${priceCount >= 3 ? '#22c55e' : '#eab308'}; margin-top: 3px;">${priceCount}/3 prices</div>`
        : ''

      const popup = new mapboxgl.Popup({ offset: 14, closeButton: false })
        .setHTML(`
          <div style="font-family: system-ui; padding: 4px 0;">
            <div style="font-weight: 600; font-size: 13px; color: #fafafa;">${store.name}</div>
            <div style="font-size: 11px; color: #a1a1aa; margin-top: 2px;">${store.phone}</div>
            ${priceLabel}
          </div>
        `)

      existing.marker.setPopup(popup)
    })

    // Fit bounds
    if (stores.length > 1) {
      const bounds = new mapboxgl.LngLatBounds()
      stores.forEach((s) => { if (s.lat && s.lng) bounds.extend([s.lng, s.lat]) })
      map.fitBounds(bounds, { padding: 60, maxZoom: 14 })
    } else if (stores.length === 1 && stores[0].lat && stores[0].lng) {
      map.flyTo({ center: [stores[0].lng, stores[0].lat], zoom: 14 })
    }
  }, [stores, priceCountByStore, selectedStoreIds, callStatuses, onStoreClick])

  return (
    <div ref={wrapperRef} className="w-full h-full relative rounded-2xl overflow-hidden border border-border">
      <div
        ref={mapContainer}
        style={{ width: '100%', height: mapHeight > 0 ? `${mapHeight}px` : '100%' }}
      />

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-10 bg-card/90 backdrop-blur-sm border border-border rounded-xl px-3 py-2 space-y-1">
        {[
          { label: 'All 3 prices', color: ALL_PRODUCTS_COLOR },
          { label: 'Partial prices', color: PARTIAL_COLOR },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
            {label}
          </div>
        ))}
      </div>

      {stores.length === 0 && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 pointer-events-none">
          <p className="text-sm text-muted-foreground">No stores with prices yet</p>
        </div>
      )}
    </div>
  )
}
