'use client'

import { useEffect, useState, useRef } from 'react'

interface GridMarker {
  x: number
  y: number
  opacity: number
  isActive: boolean
}

// Core action colors (ordered for smooth color wheel rotation: warm → cool)
const COLORS = [
  { r: 245, g: 158, b: 11 },   // Amber (attention) - ~40° hue
  { r: 16, g: 185, b: 129 },   // Emerald (approve) - ~160° hue
  { r: 59, g: 130, b: 246 },   // Blue (save/continue) - ~220° hue
]

const GRID_SIZE = 60
const HOVER_RADIUS = 120 // Pixels - how far the mouse influence extends
const COLOR_CYCLE_DURATION = 2000 // ms per color (8 seconds each)

// Interpolate between two colors
function lerpColor(
  from: { r: number; g: number; b: number },
  to: { r: number; g: number; b: number },
  t: number
) {
  return {
    r: Math.round(from.r + (to.r - from.r) * t),
    g: Math.round(from.g + (to.g - from.g) * t),
    b: Math.round(from.b + (to.b - from.b) * t),
  }
}

export function LoginBackground() {
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 })
  const [markers, setMarkers] = useState<GridMarker[]>([])
  const [globalColorPhase, setGlobalColorPhase] = useState(0)
  const startTimeRef = useRef(Date.now())

  // Initialize grid markers on mount
  useEffect(() => {
    const initMarkers = () => {
      const cols = Math.ceil(window.innerWidth / GRID_SIZE) + 1
      const rows = Math.ceil(window.innerHeight / GRID_SIZE) + 1
      const newMarkers: GridMarker[] = []

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          // There are 4 crosses per grid cell at specific offsets
          const positions = [
            { x: col * GRID_SIZE + 6, y: row * GRID_SIZE + 6 },
            { x: col * GRID_SIZE + 36, y: row * GRID_SIZE + 6 },
            { x: col * GRID_SIZE + 6, y: row * GRID_SIZE + 36 },
            { x: col * GRID_SIZE + 36, y: row * GRID_SIZE + 36 },
          ]

          positions.forEach(pos => {
            newMarkers.push({
              x: pos.x,
              y: pos.y,
              opacity: 0,
              isActive: false,
            })
          })
        }
      }

      setMarkers(newMarkers)
    }

    initMarkers()
    window.addEventListener('resize', initMarkers)
    return () => window.removeEventListener('resize', initMarkers)
  }, [])

  // Track mouse position
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY })
    }

    const handleMouseLeave = () => {
      setMousePos({ x: -1000, y: -1000 })
    }

    window.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseleave', handleMouseLeave)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [])

  // Global color cycling - all markers share the same color phase
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current
      const totalCycleDuration = COLOR_CYCLE_DURATION * COLORS.length
      const phase = (elapsed % totalCycleDuration) / totalCycleDuration
      setGlobalColorPhase(phase)
    }, 30)

    return () => clearInterval(interval)
  }, [])

  // Update markers based on mouse proximity
  useEffect(() => {
    const interval = setInterval(() => {
      setMarkers(prev => prev.map(marker => {
        const dx = marker.x - mousePos.x
        const dy = marker.y - mousePos.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        const isInRadius = distance < HOVER_RADIUS

        if (isInRadius) {
          // Calculate opacity based on distance (closer = more opaque)
          const proximityFactor = 1 - (distance / HOVER_RADIUS)
          const targetOpacity = 0.6 + proximityFactor * 0.4 // Range: 0.6 to 1.0

          return {
            ...marker,
            isActive: true,
            opacity: marker.opacity + (targetOpacity - marker.opacity) * 0.15,
          }
        } else {
          // Fade out when not in radius
          const newOpacity = marker.opacity * 0.92

          if (newOpacity < 0.01) {
            return { ...marker, isActive: false, opacity: 0 }
          }

          return { ...marker, isActive: false, opacity: newOpacity }
        }
      }))
    }, 30)

    return () => clearInterval(interval)
  }, [mousePos])

  // Calculate current color based on global phase
  const getCurrentColor = () => {
    const totalColors = COLORS.length
    const scaledPhase = globalColorPhase * totalColors
    const colorIndex = Math.floor(scaledPhase)
    const t = scaledPhase - colorIndex // 0 to 1 within current color transition

    const fromColor = COLORS[colorIndex % totalColors]
    const toColor = COLORS[(colorIndex + 1) % totalColors]

    // Use eased transition for smoother feel
    const easedT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2

    return lerpColor(fromColor, toColor, easedT)
  }

  const currentColor = getCurrentColor()
  const colorString = `rgb(${currentColor.r}, ${currentColor.g}, ${currentColor.b})`

  return (
    <>
      {/* Base background */}
      <div className="absolute inset-0 bg-[#F7F8FA]" />

      {/* Static grid pattern - dots */}
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%230F172A'%3E%3Ccircle cx='6' cy='6' r='2'/%3E%3Ccircle cx='36' cy='6' r='2'/%3E%3Ccircle cx='6' cy='36' r='2'/%3E%3Ccircle cx='36' cy='36' r='2'/%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      {/* Interactive colored markers - all share the same smoothly transitioning color */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {markers.map((marker, i) => (
          marker.opacity > 0.01 && (
            <circle
              key={i}
              cx={marker.x}
              cy={marker.y}
              r={3}
              fill={colorString}
              opacity={marker.opacity}
            />
          )
        ))}
      </svg>
    </>
  )
}
