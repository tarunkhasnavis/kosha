'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@kosha/ui'
import { MapPin, Plus } from 'lucide-react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder'
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css'
import { TerritoryAccountPanel } from './territory-account-panel'
import { createAccount } from '@/lib/accounts/actions'
import { toast } from '@/hooks/use-toast'
import type { Account } from '@kosha/types'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''
const MARKER_COLOR = '#1e293b' // slate-800 — uniform for all accounts
const PROXIMITY_THRESHOLD = 0.001 // ~100m in degrees

interface TerritoryMapProps {
  accounts: Account[]
}

function findNearbyAccount(
  accounts: Account[],
  lng: number,
  lat: number
): Account | null {
  for (const account of accounts) {
    if (account.latitude == null || account.longitude == null) continue
    const dLat = Math.abs(account.latitude - lat)
    const dLng = Math.abs(account.longitude - lng)
    if (dLat < PROXIMITY_THRESHOLD && dLng < PROXIMITY_THRESHOLD) {
      return account
    }
  }
  return null
}

export function TerritoryMap({ accounts }: TerritoryMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const tempMarkerRef = useRef<mapboxgl.Marker | null>(null)

  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)

  // "Add as Account" dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [newAccountName, setNewAccountName] = useState('')
  const [newAccountAddress, setNewAccountAddress] = useState('')
  const [newAccountCoords, setNewAccountCoords] = useState<{
    lat: number
    lng: number
  } | null>(null)
  const [creating, setCreating] = useState(false)

  const mappableAccounts = accounts.filter(
    (a) => a.latitude != null && a.longitude != null
  )

  const handleMarkerClick = useCallback((account: Account) => {
    setSelectedAccount(account)
    setPanelOpen(true)
  }, [])

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !MAPBOX_TOKEN) return

    mapboxgl.accessToken = MAPBOX_TOKEN

    const mapInstance = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/standard',
      center: [-98.5795, 39.8283], // center of US
      zoom: 4,
    })

    mapInstance.addControl(new mapboxgl.NavigationControl(), 'bottom-right')

    // Geocoder search bar
    const geocoder = new MapboxGeocoder({
      accessToken: MAPBOX_TOKEN,
      mapboxgl: mapboxgl as unknown as typeof MapboxGeocoder.prototype.options.mapboxgl,
      marker: false,
      placeholder: 'Search for a location...',
    })

    mapInstance.addControl(geocoder, 'top-left')

    geocoder.on('result', (e: { result: { center: [number, number]; place_name?: string } }) => {
      const [lng, lat] = e.result.center
      const placeName = e.result.place_name || ''

      // Remove any previous temp marker
      if (tempMarkerRef.current) {
        tempMarkerRef.current.remove()
        tempMarkerRef.current = null
      }

      // Check if near an existing account
      const nearbyAccount = findNearbyAccount(accounts, lng, lat)
      if (nearbyAccount) {
        setSelectedAccount(nearbyAccount)
        setPanelOpen(true)
        mapInstance.flyTo({ center: [lng, lat], zoom: 15 })
        return
      }

      // Show temp marker with "Add as Account" option
      const popupEl = document.createElement('div')
      popupEl.style.padding = '4px 0'

      const label = document.createElement('p')
      label.style.cssText = 'font-size: 13px; font-weight: 500; margin: 0 0 8px;'
      label.textContent = placeName
      popupEl.appendChild(label)

      const btn = document.createElement('button')
      btn.textContent = '+ Add as Account'
      btn.style.cssText = `
        background: #1e293b;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 12px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 4px;
        width: 100%;
        justify-content: center;
      `
      btn.addEventListener('click', () => {
        setNewAccountAddress(placeName)
        setNewAccountCoords({ lat, lng })
        // Pre-fill name from the location (first part before comma)
        const defaultName = placeName.split(',')[0]?.trim() || ''
        setNewAccountName(defaultName)
        setAddDialogOpen(true)
      })
      popupEl.appendChild(btn)

      const popup = new mapboxgl.Popup({ offset: 25, closeOnClick: false })
        .setDOMContent(popupEl)

      const tempMarker = new mapboxgl.Marker({ color: '#6366f1' })
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(mapInstance)

      tempMarker.togglePopup()
      tempMarkerRef.current = tempMarker

      mapInstance.flyTo({ center: [lng, lat], zoom: 14 })
    })

    map.current = mapInstance

    return () => {
      mapInstance.remove()
      map.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Add/update markers when accounts change
  useEffect(() => {
    if (!map.current) return

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    mappableAccounts.forEach((account) => {
      const el = document.createElement('div')
      el.style.cssText = `
        width: 28px;
        height: 28px;
        background: ${MARKER_COLOR};
        border: 2px solid white;
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.15s ease;
      `
      el.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`

      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.2)'
      })
      el.addEventListener('mouseleave', () => {
        el.style.transform = 'scale(1)'
      })

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([account.longitude!, account.latitude!])
        .addTo(map.current!)

      // Show name on hover via tooltip
      const popup = new mapboxgl.Popup({
        offset: 20,
        closeButton: false,
        closeOnClick: false,
      }).setHTML(
        `<div style="font-size: 13px; font-weight: 500; padding: 2px 4px;">${account.name}</div>`
      )

      el.addEventListener('mouseenter', () => {
        marker.setPopup(popup)
        marker.togglePopup()
      })
      el.addEventListener('mouseleave', () => {
        popup.remove()
      })
      el.addEventListener('click', () => {
        popup.remove()
        handleMarkerClick(account)
      })

      markersRef.current.push(marker)
    })

    // Auto-fit bounds
    if (mappableAccounts.length > 0) {
      const bounds = new mapboxgl.LngLatBounds()
      mappableAccounts.forEach((a) => {
        bounds.extend([a.longitude!, a.latitude!])
      })

      map.current.fitBounds(bounds, {
        padding: { top: 80, bottom: 40, left: 40, right: 40 },
        maxZoom: 14,
      })
    }
  }, [accounts, handleMarkerClick]) // eslint-disable-line react-hooks/exhaustive-deps

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

    // Clean up temp marker
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
    <div className="
      fixed inset-x-0 top-0 bottom-16 z-30
      md:static md:h-dvh md:z-auto
    ">
      {/* Header bar */}
      <div className="absolute top-3 right-3 z-10 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-sm border text-xs text-muted-foreground">
        {mappableAccounts.length} of {accounts.length} accounts mapped
      </div>

      {/* Map container */}
      <div ref={mapContainer} className="w-full h-full overflow-hidden" />

      {/* Empty state overlay */}
      {accounts.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 rounded-lg">
          <MapPin className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground mb-1">No accounts yet</p>
          <p className="text-xs text-muted-foreground">
            Create accounts with addresses to see them on the map.
          </p>
        </div>
      )}

      {/* Account detail panel */}
      <TerritoryAccountPanel
        account={selectedAccount}
        open={panelOpen}
        onClose={() => {
          setPanelOpen(false)
          setSelectedAccount(null)
        }}
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
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleCreateAccount()
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="new-account-name">Account Name *</Label>
              <Input
                id="new-account-name"
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
                placeholder="Enter account name"
                autoFocus
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <p className="text-sm text-muted-foreground rounded-md border px-3 py-2 bg-muted/50">
                {newAccountAddress}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={creating || !newAccountName.trim()}
              >
                {creating ? 'Creating...' : 'Create Account'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
