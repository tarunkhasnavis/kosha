/**
 * Thinking beep manager.
 *
 * Plays a subtle repeating beep when Claude takes > 1.5s to respond.
 * Signals to the rep "I'm thinking, don't repeat yourself."
 * Stops immediately when TTS audio arrives.
 */
export function createThinkingBeep() {
  let timer: ReturnType<typeof setTimeout> | null = null
  let beepInterval: ReturnType<typeof setInterval> | null = null
  let active = false
  let beepCallback: (() => void) | null = null

  const startWaiting = () => {
    if (active) return
    // Wait 1.5s before starting beeps
    timer = setTimeout(() => {
      active = true
      beepCallback?.()
      beepInterval = setInterval(() => {
        beepCallback?.()
      }, 1000)
    }, 1500)
  }

  const stop = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (beepInterval) {
      clearInterval(beepInterval)
      beepInterval = null
    }
    active = false
  }

  const onBeep = (callback: () => void) => {
    beepCallback = callback
  }

  const isActive = () => active

  return {
    startWaiting,
    stop,
    onBeep,
    isActive,
  }
}

export type ThinkingBeep = ReturnType<typeof createThinkingBeep>
