'use client'

import { useState, useCallback, useEffect, type ReactNode } from 'react'
import { SidebarContext } from '@/hooks/use-sidebar'

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsOpen(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const toggle = useCallback(() => setIsOpen(prev => !prev), [])
  const close = useCallback(() => setIsOpen(false), [])
  const open = useCallback(() => setIsOpen(true), [])

  return (
    <SidebarContext.Provider value={{ isOpen, toggle, close, open }}>
      {children}
    </SidebarContext.Provider>
  )
}
