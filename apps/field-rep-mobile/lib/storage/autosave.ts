/**
 * Auto-save timer — calls a save function on a regular interval.
 *
 * Used during active conversations to persist the transcript
 * to SQLite every 10 seconds for crash recovery.
 */
export function createAutoSave(saveFn: () => void, intervalMs = 10000) {
  let timer: ReturnType<typeof setInterval> | null = null

  const start = () => {
    if (timer) return
    timer = setInterval(saveFn, intervalMs)
  }

  const stop = () => {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  const saveNow = () => {
    saveFn()
  }

  return {
    start,
    stop,
    saveNow,
  }
}

export type AutoSave = ReturnType<typeof createAutoSave>
