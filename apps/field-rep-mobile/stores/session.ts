import { create } from 'zustand'

export type SessionState = 'IDLE' | 'ACTIVE' | 'ENDING' | 'COMPLETE'

type TranscriptEntry = {
  speaker: 'rep' | 'agent'
  text: string
  timestamp: number
}

type VoiceSessionState = {
  state: SessionState
  sessionType: 'voice' | 'text' | null
  transcript: TranscriptEntry[]
  activeAccountId: string | null

  // Actions
  startSession: (type: 'voice' | 'text') => void
  endSession: () => void
  completeSession: () => void
  resetSession: () => void
  addTranscriptEntry: (entry: TranscriptEntry) => void
  setActiveAccount: (accountId: string | null) => void
  setState: (state: SessionState) => void
}

export const useSessionStore = create<VoiceSessionState>((set) => ({
  state: 'IDLE',
  sessionType: null,
  transcript: [],
  activeAccountId: null,

  startSession: (type) => set({
    state: 'ACTIVE',
    sessionType: type,
    transcript: [],
    activeAccountId: null,
  }),

  endSession: () => set({ state: 'ENDING' }),

  completeSession: () => set({ state: 'COMPLETE' }),

  resetSession: () => set({
    state: 'IDLE',
    sessionType: null,
    transcript: [],
    activeAccountId: null,
  }),

  addTranscriptEntry: (entry) => set((s) => ({
    transcript: [...s.transcript, entry],
  })),

  setActiveAccount: (accountId) => set({ activeAccountId: accountId }),

  setState: (state) => set({ state }),
}))
