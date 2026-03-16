'use client'

import { useEffect } from 'react'

/**
 * Sets a CSS custom property --vh on <html> that tracks the visual viewport height.
 * This accounts for the virtual keyboard on iOS/Android PWAs.
 *
 * Usage in CSS/Tailwind: h-[calc(var(--vh,1dvh)*100)]
 * or just use the `dvh` unit as fallback — this hook improves it for keyboard scenarios.
 */
export function useViewportHeight() {
  useEffect(() => {
    function update() {
      const vh = window.visualViewport?.height ?? window.innerHeight
      document.documentElement.style.setProperty('--vh', `${vh * 0.01}px`)
    }

    update()

    window.visualViewport?.addEventListener('resize', update)
    window.addEventListener('resize', update)

    return () => {
      window.visualViewport?.removeEventListener('resize', update)
      window.removeEventListener('resize', update)
    }
  }, [])
}
