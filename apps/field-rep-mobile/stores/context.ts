import { create } from 'zustand'

type AccountSummary = {
  id: string
  name: string
  summary: string
}

type ContextState = {
  accounts: AccountSummary[]
  loaded: boolean
  setAccounts: (accounts: AccountSummary[]) => void
  getAccountByName: (name: string) => AccountSummary | undefined
}

export const useContextStore = create<ContextState>((set, get) => ({
  accounts: [],
  loaded: false,

  setAccounts: (accounts) => set({ accounts, loaded: true }),

  getAccountByName: (name) => {
    const lower = name.toLowerCase()
    return get().accounts.find((a) =>
      a.name.toLowerCase().includes(lower) ||
      lower.includes(a.name.toLowerCase())
    )
  },
}))
