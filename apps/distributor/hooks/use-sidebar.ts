'use client'

import { createContext, useContext } from 'react'

type SidebarContextType = {
  isOpen: boolean
  toggle: () => void
  close: () => void
  open: () => void
}

export const SidebarContext = createContext<SidebarContextType | undefined>(undefined)

export function useSidebar() {
  const context = useContext(SidebarContext)
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider')
  }
  return context
}
