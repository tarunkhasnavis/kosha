type NetworkListener = (isOnline: boolean) => void

/**
 * Network monitor — tracks connectivity state.
 *
 * Used to trigger offline fallback (local recording)
 * when internet drops mid-conversation.
 */
export function createNetworkMonitor() {
  let online = true
  const listeners: Set<NetworkListener> = new Set()

  const isOnline = () => online

  const setOnline = (value: boolean) => {
    if (value === online) return
    online = value
    for (const listener of listeners) {
      listener(value)
    }
  }

  const onChange = (listener: NetworkListener): (() => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  return {
    isOnline,
    setOnline,
    onChange,
  }
}

export type NetworkMonitor = ReturnType<typeof createNetworkMonitor>
