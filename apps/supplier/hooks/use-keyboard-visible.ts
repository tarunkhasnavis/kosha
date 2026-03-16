'use client'

import { useEffect, useState } from 'react'

/**
 * Detects whether the virtual keyboard is visible on mobile devices.
 * Uses visualViewport API to compare viewport height changes.
 */
export function useKeyboardVisible() {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false)

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return

    const initialHeight = viewport.height

    function onResize() {
      if (!viewport) return
      // If viewport shrinks by more than 100px, keyboard is likely open
      setIsKeyboardVisible(initialHeight - viewport.height > 100)
    }

    viewport.addEventListener('resize', onResize)
    return () => viewport.removeEventListener('resize', onResize)
  }, [])

  return isKeyboardVisible
}
