import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'

type AppState = {
  session: Session | null
  isOnline: boolean
  setSession: (session: Session | null) => void
  setOnline: (online: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  session: null,
  isOnline: true,
  setSession: (session) => set({ session }),
  setOnline: (isOnline) => set({ isOnline }),
}))
