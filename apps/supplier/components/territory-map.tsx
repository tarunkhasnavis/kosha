'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import {
  Button,
  Calendar as CalendarWidget,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@kosha/ui'
import {
  MapPin,
  Plus,
  Search,
  Navigation2,
  Phone,
  Star,
  X,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Palette,
  Sparkles,
  Building2,
  Calendar,
  MinusCircle,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { TerritoryAccountPanel } from './territory-account-panel'
import { createAccount } from '@/lib/accounts/actions'
import { claimDiscoveredAccount } from '@/lib/discovery/actions'
import { createVisit, deleteVisit } from '@/lib/visits/actions'
import { toast } from '@/hooks/use-toast'
import type { Account, DiscoveredAccount, DiscoveryCategory } from '@kosha/types'
import type { VisitWithAccount } from '@/lib/visits/queries'

interface PlaceResult {
  place_id: string
  name: string
  address: string
  latitude: number
  longitude: number
  rating: number | null
  review_count: number | null
  phone: string | null
  website: string | null
  hours: string[] | null
  types: string[]
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

const MAP_STYLES = [
  { key: 'streets', label: 'Streets', url: 'mapbox://styles/mapbox/streets-v12' },
  { key: 'light', label: 'Light', url: 'mapbox://styles/mapbox/light-v11' },
  { key: 'dark', label: 'Dark', url: 'mapbox://styles/mapbox/dark-v11' },
  { key: 'satellite', label: 'Satellite', url: 'mapbox://styles/mapbox/satellite-streets-v12' },
] as const

const CATEGORY_PILLS: { key: DiscoveryCategory | 'my_accounts'; label: string }[] = [
  { key: 'bar', label: 'Bar' },
  { key: 'restaurant', label: 'Restaurant' },
  { key: 'liquor_store', label: 'Liquor Store' },
  { key: 'brewery', label: 'Brewery' },
  { key: 'hotel', label: 'Hotel' },
  { key: 'convenience_store', label: 'Convenience Store' },
]

type MapMode = 'browse' | 'plan'

interface TerritoryMapProps {
  accounts: Account[]
  discoveredAccounts: DiscoveredAccount[]
  todayVisits: VisitWithAccount[]
  tomorrowVisits: VisitWithAccount[]
}

function formatDistance(meters: number): string {
  const miles = meters / 1609.34
  return `${miles.toFixed(1)}mi`
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.round((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function formatPlanDateLabel(dateStr: string): string {
  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  if (dateStr === today) return 'Today'
  if (dateStr === tomorrow) return 'Tomorrow'
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function TerritoryMap({
  accounts,
  discoveredAccounts,
  todayVisits,
  tomorrowVisits,
}: TerritoryMapProps) {
  const router = useRouter()
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const tempMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const discoveredMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const routeSourceAdded = useRef(false)

  const [mode, setMode] = useState<MapMode>('browse')
  const [activeCategory, setActiveCategory] = useState<DiscoveryCategory | 'my_accounts'>('my_accounts')
  const [filterOpen, setFilterOpen] = useState(false)
  const [mapStyle, setMapStyle] = useState<typeof MAP_STYLES[number]['key']>('streets')
  const [styleMenuOpen, setStyleMenuOpen] = useState(false)
  const [searchDrawerOpen, setSearchDrawerOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [drawerCategory, setDrawerCategory] = useState<DiscoveryCategory | 'all'>('all')
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [selectedDiscovered, setSelectedDiscovered] = useState<DiscoveredAccount | null>(null)
  const [claiming, setClaiming] = useState(false)

  // Google Places search state
  const [placesResults, setPlacesResults] = useState<PlaceResult[]>([])
  const [placesLoading, setPlacesLoading] = useState(false)
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null)
  const [claimingPlace, setClaimingPlace] = useState(false)
  const placeMarkerRef = useRef<mapboxgl.Marker | null>(null)

  // Plan mode state
  const [calendarOpen, setCalendarOpen] = useState(false)
  const todayStr = new Date().toISOString().split('T')[0]
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  const [planDate, setPlanDate] = useState(todayStr)
  const [routeInfo, setRouteInfo] = useState<{
    totalDistance: number
    totalDuration: number
    stops: { visitId: string; name: string; address: string; distance: number; duration: number }[]
  } | null>(null)
  const [planSheetOpen, setPlanSheetOpen] = useState(false)

  // Add Stop mode
  const [addStopMode, setAddStopMode] = useState(false)

  // Add Account dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [newAccountName, setNewAccountName] = useState('')
  const [newAccountAddress, setNewAccountAddress] = useState('')
  const [newAccountCoords, setNewAccountCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [creating, setCreating] = useState(false)

  const mappableAccounts = accounts.filter((a) => a.latitude != null && a.longitude != null)

  // Dynamic visit loading for any plan date
  const [dateVisits, setDateVisits] = useState<VisitWithAccount[]>([])
  const [loadingVisits, setLoadingVisits] = useState(false)

  useEffect(() => {
    if (planDate === todayStr) {
      setDateVisits(todayVisits)
    } else if (planDate === tomorrowStr) {
      setDateVisits(tomorrowVisits)
    } else {
      // Fetch visits for the selected date
      setLoadingVisits(true)
      fetch(`/api/visits?date=${planDate}`)
        .then((res) => res.json())
        .then((data) => setDateVisits(data.visits || []))
        .catch(() => setDateVisits([]))
        .finally(() => setLoadingVisits(false))
    }
  }, [planDate, todayStr, tomorrowStr, todayVisits, tomorrowVisits])

  const activeVisits = dateVisits
  const visitsWithCoords = activeVisits.filter(
    (v) => v.account?.latitude != null && v.account?.longitude != null
  )

  const filteredDiscovered = activeCategory === 'my_accounts'
    ? []
    : discoveredAccounts.filter((d) => d.category === activeCategory)

  // Filtered + ranked list for the search drawer
  const drawerResults = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()

    if (addStopMode) {
      // Only show managed accounts, exclude those already in route, rank by proximity
      const existingAccountIds = new Set(visitsWithCoords.map((v) => v.account.id))
      const routeCenter = visitsWithCoords.length > 0
        ? {
            lat: visitsWithCoords.reduce((sum, v) => sum + (v.account.latitude || 0), 0) / visitsWithCoords.length,
            lng: visitsWithCoords.reduce((sum, v) => sum + (v.account.longitude || 0), 0) / visitsWithCoords.length,
          }
        : null

      const filtered = accounts
        .filter((a) => !existingAccountIds.has(a.id))
        .filter((a) => !q || a.name.toLowerCase().includes(q) || (a.address?.toLowerCase().includes(q) ?? false))
        .map((a) => {
          const dist = routeCenter && a.latitude != null && a.longitude != null
            ? Math.sqrt(Math.pow(a.latitude - routeCenter.lat, 2) + Math.pow(a.longitude - routeCenter.lng, 2))
            : Infinity
          return { ...a, _dist: dist }
        })
        .sort((a, b) => a._dist - b._dist)

      return { discovered: [] as typeof discoveredAccounts, managed: filtered }
    }

    const filteredDiscoveredAccounts = discoveredAccounts
      .filter((d) => drawerCategory === 'all' || d.category === drawerCategory)
      .filter((d) => !q || d.name.toLowerCase().includes(q) || d.address.toLowerCase().includes(q))

    const filteredManagedAccounts = accounts
      .filter((a) => !q || a.name.toLowerCase().includes(q) || (a.address?.toLowerCase().includes(q) ?? false))

    return { discovered: filteredDiscoveredAccounts, managed: filteredManagedAccounts }
  }, [searchQuery, drawerCategory, discoveredAccounts, accounts, addStopMode, visitsWithCoords])

  function handleDrawerSelectDiscovered(d: DiscoveredAccount) {
    setSearchDrawerOpen(false)
    setSelectedDiscovered(d)
    setSelectedPlace(null)
    // Clean up place marker
    if (placeMarkerRef.current) {
      placeMarkerRef.current.remove()
      placeMarkerRef.current = null
    }

    // Remove previous discovered marker
    if (discoveredMarkerRef.current) {
      discoveredMarkerRef.current.remove()
      discoveredMarkerRef.current = null
    }

    if (map.current) {
      // Place a green highlight pin on the selected location
      const el = document.createElement('div')
      el.style.cssText = 'width:32px;height:32px;background:#16a34a;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(22,163,74,0.4);display:flex;align-items:center;justify-content:center;'
      el.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>'

      discoveredMarkerRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat([d.longitude, d.latitude])
        .addTo(map.current)

      // Offset center upward so pin appears in top third, above the preview card
      const offsetLat = d.latitude - 0.004
      map.current.flyTo({ center: [d.longitude, offsetLat], zoom: 15 })
    }
  }

  async function handleDrawerSelectAccount(account: Account) {
    if (addStopMode) {
      setSearchDrawerOpen(false)
      setAddStopMode(false)
      const visitDate = new Date(planDate + 'T12:00:00').toISOString()
      const result = await createVisit({
        account_id: account.id,
        account_name: account.name,
        visit_date: visitDate,
      })
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' })
      } else {
        toast({ title: 'Stop added', description: `${account.name} added to ${formatPlanDateLabel(planDate)}'s route.` })
        router.refresh()
      }
      return
    }
    if (account.latitude == null || account.longitude == null) return
    setSearchDrawerOpen(false)
    setSelectedAccount(account)
    setPanelOpen(true)
    if (map.current) {
      map.current.flyTo({ center: [account.longitude, account.latitude], zoom: 15 })
    }
  }

  // Debounced Google Places search
  useEffect(() => {
    const q = searchQuery.trim()
    if (q.length < 3) {
      setPlacesResults([])
      return
    }

    const timer = setTimeout(async () => {
      setPlacesLoading(true)
      try {
        const center = map.current?.getCenter()
        const lat = center?.lat ?? 27.9506
        const lng = center?.lng ?? -82.4572
        const res = await fetch(`/api/places/search?q=${encodeURIComponent(q)}&lat=${lat}&lng=${lng}`)
        if (res.ok) {
          const data = await res.json()
          setPlacesResults(data.results || [])
        }
      } catch {
        // Silently fail — local results still show
      } finally {
        setPlacesLoading(false)
      }
    }, 400)

    return () => clearTimeout(timer)
  }, [searchQuery])

  function handleSelectPlace(place: PlaceResult) {
    setSearchDrawerOpen(false)
    setSelectedPlace(place)
    setSelectedDiscovered(null)

    // Remove previous place marker
    if (placeMarkerRef.current) {
      placeMarkerRef.current.remove()
      placeMarkerRef.current = null
    }
    // Remove previous discovered marker
    if (discoveredMarkerRef.current) {
      discoveredMarkerRef.current.remove()
      discoveredMarkerRef.current = null
    }

    if (map.current) {
      const el = document.createElement('div')
      el.style.cssText = 'width:32px;height:32px;background:#16a34a;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(22,163,74,0.4);display:flex;align-items:center;justify-content:center;'
      el.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>'

      placeMarkerRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat([place.longitude, place.latitude])
        .addTo(map.current)

      const offsetLat = place.latitude - 0.004
      map.current.flyTo({ center: [place.longitude, offsetLat], zoom: 15 })
    }
  }

  async function handleClaimPlace() {
    if (!selectedPlace) return
    setClaimingPlace(true)
    const result = await createAccount({
      name: selectedPlace.name,
      address: selectedPlace.address,
      latitude: selectedPlace.latitude,
      longitude: selectedPlace.longitude,
      phone: selectedPlace.phone ?? undefined,
      website: selectedPlace.website ?? undefined,
      hours: selectedPlace.hours?.join('; ') ?? undefined,
    })
    setClaimingPlace(false)

    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' })
      return
    }

    toast({ title: 'Account added!', description: `${selectedPlace.name} is now in your accounts.` })
    setSelectedPlace(null)
    if (placeMarkerRef.current) {
      placeMarkerRef.current.remove()
      placeMarkerRef.current = null
    }
  }

  const handleMarkerClick = useCallback((account: Account) => {
    setSelectedAccount(account)
    setPanelOpen(true)
  }, [])

  // Clean up discovered marker when selection is cleared
  useEffect(() => {
    if (!selectedDiscovered && discoveredMarkerRef.current) {
      discoveredMarkerRef.current.remove()
      discoveredMarkerRef.current = null
    }
  }, [selectedDiscovered])

  // Clean up place marker when selection is cleared
  useEffect(() => {
    if (!selectedPlace && placeMarkerRef.current) {
      placeMarkerRef.current.remove()
      placeMarkerRef.current = null
    }
  }, [selectedPlace])

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !MAPBOX_TOKEN) return

    mapboxgl.accessToken = MAPBOX_TOKEN

    const mapInstance = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-82.4572, 27.9506], // Tampa FL
      zoom: 10,
    })

    map.current = mapInstance

    return () => {
      mapInstance.remove()
      map.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Update markers when accounts/mode/category change
  useEffect(() => {
    if (!map.current) return

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    if (mode === 'browse') {
      clearRoute()

      if (activeCategory === 'my_accounts') {
        mappableAccounts.forEach((account) => {
          const marker = createAccountMarker(account, '#d97706', map.current!, handleMarkerClick)
          markersRef.current.push(marker)
        })

        if (mappableAccounts.length > 0) {
          fitBoundsToPoints(
            mappableAccounts.map((a) => [a.longitude!, a.latitude!]),
            map.current!
          )
        }
      } else {
        // Show managed accounts that match category as green
        mappableAccounts.forEach((account) => {
          const marker = createAccountMarker(account, '#d97706', map.current!, handleMarkerClick)
          markersRef.current.push(marker)
        })

        // Show discovered accounts as gray
        filteredDiscovered.forEach((discovered) => {
          const marker = createDiscoveredMarker(discovered, map.current!, (d) => {
            setSelectedDiscovered(d)
          })
          markersRef.current.push(marker)
        })

        const allPoints = [
          ...mappableAccounts.map((a) => [a.longitude!, a.latitude!] as [number, number]),
          ...filteredDiscovered.map((d) => [d.longitude, d.latitude] as [number, number]),
        ]
        if (allPoints.length > 0) {
          fitBoundsToPoints(allPoints, map.current!)
        }
      }
    } else {
      // Plan mode
      clearRoute()

      visitsWithCoords.forEach((visit, index) => {
        const marker = createStopMarker(
          visit.account.name,
          index + 1,
          [visit.account.longitude!, visit.account.latitude!],
          map.current!
        )
        markersRef.current.push(marker)
      })

      if (visitsWithCoords.length >= 2) {
        buildRoute(visitsWithCoords)
      } else if (visitsWithCoords.length === 1) {
        map.current.flyTo({
          center: [visitsWithCoords[0].account.longitude!, visitsWithCoords[0].account.latitude!],
          zoom: 14,
        })
        setRouteInfo(null)
      } else {
        setRouteInfo(null)
      }
    }
  }, [mode, activeCategory, accounts, discoveredAccounts, planDate, todayVisits, tomorrowVisits]) // eslint-disable-line react-hooks/exhaustive-deps

  function clearRoute() {
    if (!map.current) return
    try {
      if (map.current.getLayer('route-line')) map.current.removeLayer('route-line')
      if (map.current.getSource('route')) map.current.removeSource('route')
    } catch {
      // Layer may not exist yet
    }
    routeSourceAdded.current = false
    setRouteInfo(null)
  }

  async function buildRoute(visits: VisitWithAccount[]) {
    if (!map.current || visits.length < 2) return

    const coordinates = visits
      .map((v) => `${v.account.longitude},${v.account.latitude}`)
      .join(';')

    try {
      // Try Optimization API first
      const optimizeUrl = `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coordinates}?access_token=${MAPBOX_TOKEN}&geometries=geojson&overview=full`
      let response = await fetch(optimizeUrl)
      let data = await response.json()

      let geometry: GeoJSON.LineString | null = null
      let legs: { distance: number; duration: number }[] = []
      let orderedVisits = visits

      if (data.code === 'Ok' && data.trips?.[0]) {
        const trip = data.trips[0]
        geometry = trip.geometry
        legs = trip.legs || []

        const waypointOrder = data.waypoints?.map((w: { waypoint_index: number }) => w.waypoint_index) || []
        if (waypointOrder.length === visits.length) {
          orderedVisits = waypointOrder.map((i: number) => visits[i])
        }
      } else {
        // Fallback to Directions API
        const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?access_token=${MAPBOX_TOKEN}&geometries=geojson&overview=full`
        response = await fetch(directionsUrl)
        data = await response.json()

        if (data.code === 'Ok' && data.routes?.[0]) {
          geometry = data.routes[0].geometry
          legs = data.routes[0].legs || []
        }
      }

      if (geometry && map.current) {
        if (routeSourceAdded.current) {
          const source = map.current.getSource('route') as mapboxgl.GeoJSONSource
          source?.setData({ type: 'Feature', properties: {}, geometry })
        } else {
          map.current.addSource('route', {
            type: 'geojson',
            data: { type: 'Feature', properties: {}, geometry },
          })
          map.current.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#d97706', 'line-width': 4, 'line-opacity': 0.8 },
          })
          routeSourceAdded.current = true
        }

        const totalDistance = legs.reduce((sum, leg) => sum + (leg.distance || 0), 0)
        const totalDuration = legs.reduce((sum, leg) => sum + (leg.duration || 0), 0)

        const stops = orderedVisits.map((v, i) => ({
          visitId: v.id,
          name: v.account.name,
          address: v.account.address || '',
          distance: legs[i]?.distance || 0,
          duration: legs[i]?.duration || 0,
        }))

        setRouteInfo({ totalDistance, totalDuration, stops })

        fitBoundsToPoints(
          orderedVisits.map((v) => [v.account.longitude!, v.account.latitude!] as [number, number]),
          map.current
        )
      }
    } catch (err) {
      console.error('Route optimization failed:', err)
    }
  }

  async function handleRemoveStop(visitId: string) {
    const result = await deleteVisit(visitId)
    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' })
    } else {
      toast({ title: 'Stop removed', description: 'Route will update.' })
      router.refresh()
    }
  }

  async function handleClaimAccount() {
    if (!selectedDiscovered) return
    setClaiming(true)
    const result = await claimDiscoveredAccount(selectedDiscovered.id)
    setClaiming(false)

    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' })
      return
    }

    toast({ title: 'Account added!', description: `${selectedDiscovered.name} is now in your accounts.` })
    setSelectedDiscovered(null)
  }

  async function handleCreateAccount() {
    if (!newAccountName.trim() || !newAccountCoords) return
    setCreating(true)
    const result = await createAccount({
      name: newAccountName.trim(),
      address: newAccountAddress,
      latitude: newAccountCoords.lat,
      longitude: newAccountCoords.lng,
    })
    setCreating(false)

    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' })
      return
    }

    toast({ title: 'Account created' })
    setAddDialogOpen(false)
    if (tempMarkerRef.current) {
      tempMarkerRef.current.remove()
      tempMarkerRef.current = null
    }
  }

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <MapPin className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <p className="text-muted-foreground">
          Set NEXT_PUBLIC_MAPBOX_TOKEN to enable the territory map.
        </p>
      </div>
    )
  }

  return (
    <div className="fixed inset-x-0 top-0 bottom-16 z-30">
      {/* Map */}
      <div ref={mapContainer} className="w-full h-full" />

      {/* Search Pill (centered between theme + filter) */}
      {mode === 'browse' && (
        <button
          onClick={() => { setAddStopMode(false); setSearchDrawerOpen(true); setFilterOpen(false); setStyleMenuOpen(false) }}
          className="absolute top-[56px] left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-8 py-2.5 rounded-full bg-stone-800 text-white shadow-[0_2px_12px_rgba(0,0,0,0.2)] border-none transition-all hover:bg-stone-700 min-w-[200px] justify-center"
        >
          <Search className="h-4 w-4" />
          <span className="text-sm font-medium">Search</span>
        </button>
      )}

      {/* Search Drawer */}
      <Sheet open={searchDrawerOpen} onOpenChange={(open) => { setSearchDrawerOpen(open); if (!open) setAddStopMode(false) }}>
        <SheetContent side="bottom" hideCloseButton className="rounded-t-2xl h-[82vh] p-0 flex flex-col bg-white">
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-stone-300" />
          </div>
          <SheetHeader className="px-5 pb-0">
            <SheetTitle className="text-lg font-bold text-stone-800">{addStopMode ? 'Add Stop to Route' : 'Explore Accounts'}</SheetTitle>
            <SheetDescription className="sr-only">{addStopMode ? 'Select an account to add to your route' : 'Search and browse ranked accounts'}</SheetDescription>
          </SheetHeader>

          <div className="px-5 pt-4 space-y-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search accounts..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-100 bg-stone-50 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-800/10 focus:border-stone-300 transition-all"
                autoFocus
              />
            </div>

            {/* Category Filter Pills */}
            {!addStopMode && <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setDrawerCategory('all')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  drawerCategory === 'all'
                    ? 'bg-stone-800 text-white border-stone-800'
                    : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'
                }`}
              >
                All
              </button>
              {CATEGORY_PILLS.map((pill) => (
                <button
                  key={pill.key}
                  onClick={() => setDrawerCategory(pill.key as DiscoveryCategory)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    drawerCategory === pill.key
                      ? 'bg-stone-800 text-white border-stone-800'
                      : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>}
          </div>

          {/* Results List */}
          <div className="flex-1 overflow-y-auto px-5 pt-4 pb-8">
            {/* Discovered Accounts (ranked by AI score) */}
            {drawerResults.discovered.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  Recommended
                </h3>
                <div className="space-y-3">
                  {drawerResults.discovered.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => handleDrawerSelectDiscovered(d)}
                      className="w-full text-left bg-white rounded-xl p-3.5 border border-stone-100 shadow-sm hover:shadow-md transition-all"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-stone-800 truncate">{d.name}</p>
                          <p className="text-xs text-stone-500 mt-0.5 flex items-center gap-1">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{d.address}</span>
                          </p>
                        </div>
                        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                          <span className="text-xs font-bold">{d.ai_score}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                        <span className="text-[11px] text-stone-500 capitalize px-2 py-0.5 rounded-md bg-stone-100">
                          {d.category.replace('_', ' ')}
                        </span>
                        {d.google_rating && (
                          <span className="text-[11px] text-stone-600 flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-stone-100">
                            <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                            {d.google_rating}
                            {d.google_review_count && (
                              <span className="text-stone-400">({d.google_review_count})</span>
                            )}
                          </span>
                        )}
                      </div>

                      {d.website && (
                        <p className="text-xs text-blue-600 mt-1.5 truncate">{d.website}</p>
                      )}

                      {d.hours && (
                        <p className="text-xs text-stone-500 mt-1 whitespace-pre-line line-clamp-2">{d.hours}</p>
                      )}

                      {d.ai_reasons.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {d.ai_reasons.map((reason, i) => (
                            <p key={i} className="text-xs text-stone-600 flex items-start gap-1.5">
                              <span className="text-amber-500 mt-px shrink-0">&#8226;</span>
                              {reason}
                            </p>
                          ))}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Managed Accounts */}
            {drawerResults.managed.length > 0 && (
              <div className={drawerResults.discovered.length > 0 ? 'mt-6' : ''}>
                <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-stone-500" />
                  My Accounts
                </h3>
                <div className="space-y-3">
                  {drawerResults.managed.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => handleDrawerSelectAccount(a)}
                      className="w-full text-left bg-white rounded-xl p-3.5 border border-stone-100 shadow-sm hover:shadow-md transition-all"
                    >
                      <p className="text-sm font-semibold text-stone-800">{a.name}</p>
                      {a.address && (
                        <p className="text-xs text-stone-500 mt-0.5 flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{a.address}</span>
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Google Places Results */}
            {searchQuery.trim().length >= 3 && (
              <div className={drawerResults.discovered.length > 0 || drawerResults.managed.length > 0 ? 'mt-6' : ''}>
                <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Search className="h-3.5 w-3.5 text-stone-500" />
                  Google Places
                  {placesLoading && <span className="text-xs text-stone-400 ml-1">searching...</span>}
                </h3>
                {placesResults.length > 0 ? (
                  <div className="space-y-3">
                    {placesResults.map((place) => (
                      <button
                        key={place.place_id}
                        onClick={() => handleSelectPlace(place)}
                        className="w-full text-left bg-white rounded-xl p-3.5 border border-stone-100 shadow-sm hover:shadow-md transition-all"
                      >
                        <p className="text-sm font-semibold text-stone-800 truncate">{place.name}</p>
                        <p className="text-xs text-stone-500 mt-0.5 flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{place.address}</span>
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          {place.rating && (
                            <span className="text-[11px] text-stone-600 flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-stone-100">
                              <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                              {place.rating}
                              {place.review_count && (
                                <span className="text-stone-400">({place.review_count})</span>
                              )}
                            </span>
                          )}
                          {place.phone && (
                            <span className="text-[11px] text-stone-500 px-2 py-0.5 rounded-md bg-stone-100">
                              <Phone className="h-3 w-3 inline mr-0.5" />
                              {place.phone}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  !placesLoading && (
                    <p className="text-xs text-stone-400 py-2">No results from Google Places</p>
                  )
                )}
              </div>
            )}

            {/* Empty state */}
            {drawerResults.discovered.length === 0 && drawerResults.managed.length === 0 && placesResults.length === 0 && !placesLoading && (
              <div className="flex flex-col items-center py-12">
                <Search className="h-8 w-8 text-stone-300 mb-3" />
                <p className="text-sm text-muted-foreground">No accounts found</p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Mode Toggle */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-white/95 backdrop-blur-sm rounded-full shadow-lg border border-stone-200 p-1 flex">
        <button
          onClick={() => setMode('browse')}
          className={`px-5 py-2 text-sm font-medium rounded-full transition-all ${
            mode === 'browse' ? 'bg-teal-600 text-white shadow-sm' : 'text-stone-600 hover:text-stone-800'
          }`}
        >
          <Search className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
          Browse
        </button>
        <button
          onClick={() => setMode('plan')}
          className={`px-5 py-2 text-sm font-medium rounded-full transition-all ${
            mode === 'plan' ? 'bg-teal-600 text-white shadow-sm' : 'text-stone-600 hover:text-stone-800'
          }`}
        >
          <Navigation2 className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
          Plan
        </button>
      </div>

      {/* Browse: Theme Button (left) */}
      {mode === 'browse' && (
        <div className="absolute top-[56px] left-6 z-10 flex flex-col items-start">
          <button
            onClick={() => { setStyleMenuOpen(!styleMenuOpen); setFilterOpen(false) }}
            className="flex items-center justify-center w-10 h-10 rounded-full shadow-[0_2px_12px_rgba(0,0,0,0.2)] border-none transition-all bg-stone-800 text-white"
          >
            <Palette className="h-4 w-4" />
          </button>

          {styleMenuOpen && (
            <div className="fixed inset-0 z-0" onClick={() => setStyleMenuOpen(false)} />
          )}

          <div className="relative z-10 flex flex-col gap-1.5 mt-2">
            {MAP_STYLES.map((style, index) => (
              <button
                key={style.key}
                onClick={() => {
                  setMapStyle(style.key)
                  setStyleMenuOpen(false)
                  if (map.current) {
                    map.current.setStyle(style.url)
                  }
                }}
                style={{
                  opacity: styleMenuOpen ? 1 : 0,
                  transform: styleMenuOpen ? 'translateY(0) scale(1)' : 'translateY(-8px) scale(0.9)',
                  transitionProperty: 'opacity, transform',
                  transitionDuration: '200ms',
                  transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
                  transitionDelay: styleMenuOpen ? `${index * 40}ms` : '0ms',
                  pointerEvents: styleMenuOpen ? 'auto' : 'none',
                }}
                className={`px-4 py-2 rounded-full text-sm font-medium shadow-[0_2px_12px_rgba(0,0,0,0.15)] transition-colors whitespace-nowrap w-fit ${
                  mapStyle === style.key
                    ? 'bg-stone-800 text-white'
                    : 'bg-white text-stone-700'
                }`}
              >
                {style.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Browse: Filter Button + Animated Pills */}
      {mode === 'browse' && (
        <div className="absolute top-[56px] right-6 z-10 flex flex-col items-end">
          <button
            onClick={() => { setFilterOpen(!filterOpen); setStyleMenuOpen(false) }}
            className="flex items-center justify-center w-10 h-10 rounded-full shadow-[0_2px_12px_rgba(0,0,0,0.2)] border-none transition-all bg-stone-800 text-white"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>

          {filterOpen && (
            <div className="fixed inset-0 z-0" onClick={() => setFilterOpen(false)} />
          )}

          <div className="relative z-10 flex flex-col items-end gap-1.5 mt-2">
            {[
              { key: 'my_accounts' as const, label: 'All Accounts' },
              ...CATEGORY_PILLS,
            ].map((pill, index) => (
              <button
                key={pill.key}
                onClick={() => {
                  setActiveCategory(pill.key)
                  setFilterOpen(false)
                }}
                style={{
                  opacity: filterOpen ? 1 : 0,
                  transform: filterOpen ? 'translateY(0) scale(1)' : 'translateY(-8px) scale(0.9)',
                  transitionProperty: 'opacity, transform',
                  transitionDuration: '200ms',
                  transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
                  transitionDelay: filterOpen ? `${index * 40}ms` : '0ms',
                  pointerEvents: filterOpen ? 'auto' : 'none',
                }}
                className={`px-4 py-2 rounded-full text-sm font-medium shadow-[0_2px_12px_rgba(0,0,0,0.15)] transition-colors whitespace-nowrap w-fit ${
                  activeCategory === pill.key
                    ? 'bg-stone-800 text-white'
                    : 'bg-white text-stone-700'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>
      )}


      {/* Plan: Date Selector Pill with Chevrons */}
      {mode === 'plan' && (
        <>
          <div className="absolute top-[56px] left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
            <button
              onClick={() => {
                const d = new Date(planDate + 'T12:00:00')
                d.setDate(d.getDate() - 1)
                setPlanDate(d.toISOString().split('T')[0])
              }}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-stone-800 text-white shadow-[0_2px_12px_rgba(0,0,0,0.2)] hover:bg-stone-700 transition-all"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <button
                  className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-stone-800 text-white shadow-[0_2px_12px_rgba(0,0,0,0.2)] hover:bg-stone-700 transition-all min-w-[160px] justify-center"
                >
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm font-medium">{formatPlanDateLabel(planDate)}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-2xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.15)]" align="center">
                <CalendarWidget
                  mode="single"
                  selected={new Date(planDate + 'T12:00:00')}
                  onSelect={(date) => {
                    if (date) {
                      setPlanDate(date.toISOString().split('T')[0])
                      setCalendarOpen(false)
                    }
                  }}
                  className="rounded-2xl"
                />
              </PopoverContent>
            </Popover>
            <button
              onClick={() => {
                const d = new Date(planDate + 'T12:00:00')
                d.setDate(d.getDate() + 1)
                setPlanDate(d.toISOString().split('T')[0])
              }}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-stone-800 text-white shadow-[0_2px_12px_rgba(0,0,0,0.2)] hover:bg-stone-700 transition-all"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Route Summary + Floating Card */}
          {visitsWithCoords.length > 0 && (
            <div className="absolute bottom-[108px] left-3 right-3 z-10 space-y-2">
              {routeInfo && (
                <div className="flex items-center gap-2">
                  <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-stone-200 px-4 py-2.5 inline-flex items-center">
                    <span className="text-sm font-semibold text-stone-800">
                      {visitsWithCoords.length} stops &middot; {formatDistance(routeInfo.totalDistance)} &middot; {formatDuration(routeInfo.totalDuration)}
                    </span>
                  </div>
                  <button
                    onClick={() => { setAddStopMode(true); setSearchDrawerOpen(true) }}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-teal-600 text-white text-xs font-semibold shadow-lg hover:bg-teal-700 transition-colors shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Stop
                  </button>
                </div>
              )}

              <div onClick={() => setPlanSheetOpen(true)} className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-stone-200 p-4 cursor-pointer active:scale-[0.98] transition-transform">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <p className="text-sm font-semibold text-stone-800 truncate">
                    {routeInfo?.stops[0]?.name || visitsWithCoords[0]?.account.name}
                  </p>
                  <button
                    onClick={() => setPlanSheetOpen(true)}
                    className="px-2.5 py-1 rounded-md bg-[#D97706] text-white text-[11px] font-semibold hover:bg-[#B45309] transition-colors shrink-0 flex items-center justify-center leading-none"
                  >
                    View Plan
                  </button>
                </div>
                <p className="text-xs text-stone-500 line-clamp-1">
                  {routeInfo?.stops[0]?.address || visitsWithCoords[0]?.account.address}
                </p>
                <p className="text-xs text-stone-400 mt-1.5">
                  {formatPlanDateLabel(planDate)} &middot; {visitsWithCoords.length} accounts
                </p>
              </div>
            </div>
          )}

          {visitsWithCoords.length === 0 && (
            <div className="absolute bottom-[108px] left-3 right-3 z-10">
              <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-stone-200 p-4 text-center">
                <Navigation2 className="h-6 w-6 text-stone-300 mx-auto mb-2" />
                <p className="text-sm text-stone-500">
                  No visits scheduled for {formatPlanDateLabel(planDate).toLowerCase()}.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Plan Route Sheet */}
      <Sheet open={planSheetOpen} onOpenChange={setPlanSheetOpen}>
        <SheetContent side="bottom" hideCloseButton className="rounded-t-2xl h-[82vh] p-0 flex flex-col bg-white">
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-stone-300" />
          </div>

          <SheetHeader className="px-6 pt-3 pb-5 shrink-0 text-center">
            <SheetTitle className="text-lg font-bold text-stone-800">
              {formatPlanDateLabel(planDate)}&apos;s Route
            </SheetTitle>
            <SheetDescription className="sr-only">Route plan details</SheetDescription>
            {routeInfo && (
              <p className="text-sm text-stone-500 mt-1">
                {visitsWithCoords.length} stops &middot; {formatDistance(routeInfo.totalDistance)} &middot; {formatDuration(routeInfo.totalDuration)}
              </p>
            )}
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6">
            <div className="space-y-1">
              {(routeInfo?.stops || visitsWithCoords.map((v) => ({
                visitId: v.id,
                name: v.account.name,
                address: v.account.address || '',
                distance: 0,
                duration: 0,
              }))).map((stop, index, arr) => (
                <div key={stop.visitId} className="flex items-start gap-4 py-4 border-b border-stone-100 last:border-b-0">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-600 text-white text-sm font-bold flex items-center justify-center">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-sm font-semibold text-stone-800">{stop.name}</p>
                    <p className="text-xs text-stone-500 mt-1">{stop.address}</p>
                    {stop.distance > 0 && index < arr.length - 1 && (
                      <p className="text-xs text-stone-400 mt-2">
                        {formatDistance(stop.distance)} &middot; {formatDuration(stop.duration)} to next
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveStop(stop.visitId)}
                    className="flex-shrink-0 mt-1 p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <MinusCircle className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Add Stop Button */}
          <div className="shrink-0 px-6 py-4 border-t border-stone-100">
            <button
              onClick={() => { setPlanSheetOpen(false); setAddStopMode(true); setSearchDrawerOpen(true) }}
              className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Stop
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Discovery Preview Card */}
      {selectedDiscovered && (
        <div className="absolute bottom-4 left-3 right-3 z-20">
          <div className="bg-white rounded-2xl shadow-xl border border-stone-200 p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-stone-800 truncate">{selectedDiscovered.name}</h3>
                  <span className="flex-shrink-0 bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">
                    {selectedDiscovered.ai_score}
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-0.5 flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {selectedDiscovered.address}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  {selectedDiscovered.google_rating && (
                    <span className="text-xs text-stone-600 flex items-center gap-0.5">
                      <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                      {selectedDiscovered.google_rating}
                      {selectedDiscovered.google_review_count && (
                        <span className="text-stone-400">({selectedDiscovered.google_review_count})</span>
                      )}
                    </span>
                  )}
                  <span className="text-xs text-stone-400 capitalize">
                    {selectedDiscovered.category.replace('_', ' ')}
                  </span>
                </div>
              </div>
              <button onClick={() => setSelectedDiscovered(null)} className="p-1 text-stone-400 hover:text-stone-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            {selectedDiscovered.phone && (
              <div className="flex items-center justify-between bg-stone-50 rounded-lg px-3 py-2">
                <span className="text-sm text-stone-700 flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-stone-400" />
                  {selectedDiscovered.phone}
                </span>
                <a href={`tel:${selectedDiscovered.phone}`} className="text-xs font-medium text-blue-600 hover:text-blue-700">
                  Call
                </a>
              </div>
            )}

            {selectedDiscovered.website && (
              <div className="flex items-center justify-between bg-stone-50 rounded-lg px-3 py-2">
                <span className="text-sm text-stone-700 truncate flex-1 mr-2">{selectedDiscovered.website}</span>
                <a href={selectedDiscovered.website} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-blue-600 hover:text-blue-700 shrink-0">
                  Visit
                </a>
              </div>
            )}

            {selectedDiscovered.hours && (
              <div className="bg-stone-50 rounded-lg px-3 py-2">
                <p className="text-xs font-medium text-stone-500 mb-1">Hours</p>
                <p className="text-xs text-stone-700 whitespace-pre-line">{selectedDiscovered.hours}</p>
              </div>
            )}

            {selectedDiscovered.ai_reasons.length > 0 && (
              <div>
                <p className="text-xs font-medium text-stone-500 mb-1.5">Why visit:</p>
                <ul className="space-y-1">
                  {selectedDiscovered.ai_reasons.map((reason, i) => (
                    <li key={i} className="text-xs text-stone-600 flex items-start gap-1.5">
                      <span className="text-stone-300 mt-0.5">&#8226;</span>
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" size="sm" disabled={claiming} onClick={handleClaimAccount}>
                {claiming ? 'Adding...' : 'Add to My Accounts'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedDiscovered(null)}>
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Google Places Preview Card */}
      {selectedPlace && (
        <div className="absolute bottom-4 left-3 right-3 z-20">
          <div className="bg-white rounded-2xl shadow-xl border border-stone-200 p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-stone-800 truncate">{selectedPlace.name}</h3>
                <p className="text-xs text-stone-500 mt-0.5 flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {selectedPlace.address}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  {selectedPlace.rating && (
                    <span className="text-xs text-stone-600 flex items-center gap-0.5">
                      <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                      {selectedPlace.rating}
                      {selectedPlace.review_count && (
                        <span className="text-stone-400">({selectedPlace.review_count})</span>
                      )}
                    </span>
                  )}
                  {selectedPlace.types.length > 0 && (
                    <span className="text-xs text-stone-400 capitalize">
                      {selectedPlace.types[0].replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => setSelectedPlace(null)} className="p-1 text-stone-400 hover:text-stone-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            {selectedPlace.phone && (
              <div className="flex items-center justify-between bg-stone-50 rounded-lg px-3 py-2">
                <span className="text-sm text-stone-700 flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-stone-400" />
                  {selectedPlace.phone}
                </span>
                <a href={`tel:${selectedPlace.phone}`} className="text-xs font-medium text-blue-600 hover:text-blue-700">
                  Call
                </a>
              </div>
            )}

            {selectedPlace.website && (
              <div className="flex items-center justify-between bg-stone-50 rounded-lg px-3 py-2">
                <span className="text-sm text-stone-700 truncate flex-1 mr-2">{selectedPlace.website}</span>
                <a href={selectedPlace.website} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-blue-600 hover:text-blue-700 shrink-0">
                  Visit
                </a>
              </div>
            )}

            {selectedPlace.hours && selectedPlace.hours.length > 0 && (
              <div className="bg-stone-50 rounded-lg px-3 py-2">
                <p className="text-xs font-medium text-stone-500 mb-1">Hours</p>
                <p className="text-xs text-stone-700 whitespace-pre-line">{selectedPlace.hours.join('\n')}</p>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" size="sm" disabled={claimingPlace} onClick={handleClaimPlace}>
                {claimingPlace ? 'Adding...' : 'Add to My Accounts'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedPlace(null)}>
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Account detail panel */}
      <TerritoryAccountPanel
        account={selectedAccount}
        open={panelOpen}
        onClose={() => { setPanelOpen(false); setSelectedAccount(null) }}
      />

      {/* Add Account dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Account
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleCreateAccount() }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-account-name">Account Name *</Label>
              <Input
                id="new-account-name"
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
                placeholder="Enter account name"
                autoFocus
                required
                className="focus-visible:ring-[#D97706] focus-visible:border-[#D97706]"
              />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <p className="text-sm text-muted-foreground rounded-md border px-3 py-2 bg-muted/50">
                {newAccountAddress}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={creating || !newAccountName.trim()} className="bg-[#D97706] hover:bg-[#B45309] text-white focus-visible:ring-[#D97706]">
                {creating ? 'Creating...' : 'Create Account'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Empty state */}
      {accounts.length === 0 && mode === 'browse' && activeCategory === 'my_accounts' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 pointer-events-none">
          <MapPin className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground mb-1">No accounts yet</p>
          <p className="text-xs text-muted-foreground">Create accounts with addresses to see them on the map.</p>
        </div>
      )}
    </div>
  )
}

// --- Marker Factories ---

function createAccountMarker(
  account: Account,
  color: string,
  mapInstance: mapboxgl.Map,
  onClick: (account: Account) => void
): mapboxgl.Marker {
  const el = document.createElement('div')
  el.style.cssText = `width:28px;height:28px;background:${color};border:2px solid white;border-radius:50%;cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;transition:transform 0.15s ease;`
  el.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`
  el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.2)' })
  el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)' })

  const marker = new mapboxgl.Marker({ element: el })
    .setLngLat([account.longitude!, account.latitude!])
    .addTo(mapInstance)

  const popup = new mapboxgl.Popup({ offset: 20, closeButton: false, closeOnClick: false })
    .setHTML(`<div style="font-size:13px;font-weight:500;padding:2px 4px;">${account.name}</div>`)

  el.addEventListener('mouseenter', () => { marker.setPopup(popup); marker.togglePopup() })
  el.addEventListener('mouseleave', () => { popup.remove() })
  el.addEventListener('click', () => { popup.remove(); onClick(account) })

  return marker
}

function createDiscoveredMarker(
  discovered: DiscoveredAccount,
  mapInstance: mapboxgl.Map,
  onClick: (d: DiscoveredAccount) => void
): mapboxgl.Marker {
  const el = document.createElement('div')
  el.style.cssText = `width:24px;height:24px;background:#94a3b8;border:2px solid white;border-radius:50%;cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,0.15);display:flex;align-items:center;justify-content:center;transition:transform 0.15s ease;`
  el.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`
  el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.2)' })
  el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)' })

  const marker = new mapboxgl.Marker({ element: el })
    .setLngLat([discovered.longitude, discovered.latitude])
    .addTo(mapInstance)

  el.addEventListener('click', () => onClick(discovered))

  return marker
}

function createStopMarker(
  name: string,
  stopNumber: number,
  coords: [number, number],
  mapInstance: mapboxgl.Map
): mapboxgl.Marker {
  const el = document.createElement('div')
  el.style.cssText = `width:32px;height:32px;background:#d97706;border:2px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;color:white;font-size:13px;font-weight:700;`
  el.textContent = String(stopNumber)

  const popup = new mapboxgl.Popup({ offset: 20, closeButton: false, closeOnClick: false })
    .setHTML(`<div style="font-size:13px;font-weight:500;padding:2px 4px;">Stop ${stopNumber} — ${name}</div>`)

  const marker = new mapboxgl.Marker({ element: el })
    .setLngLat(coords)
    .setPopup(popup)
    .addTo(mapInstance)

  el.addEventListener('mouseenter', () => marker.togglePopup())
  el.addEventListener('mouseleave', () => popup.remove())

  return marker
}

function fitBoundsToPoints(points: [number, number][], mapInstance: mapboxgl.Map) {
  if (points.length === 0) return
  const bounds = new mapboxgl.LngLatBounds()
  points.forEach((p) => bounds.extend(p))
  mapInstance.fitBounds(bounds, {
    padding: { top: 100, bottom: 120, left: 40, right: 40 },
    maxZoom: 14,
  })
}
