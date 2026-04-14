type VADConfig = {
  threshold?: number        // dB level above which is considered speech (default: -40)
  silenceDurationMs?: number // ms of silence before speech end fires (default: 1500)
}

type Callback = () => void

/**
 * Metering-based Voice Activity Detection.
 *
 * Uses audio level (dB) from expo-av's metering to detect
 * speech start and end. Simple threshold approach — will be
 * swapped for expo-audio-studio's real VAD in Phase 7.
 *
 * Interface matches the spec's VAD contract so it's a drop-in swap.
 */
export function createMeteringVAD(config: VADConfig = {}) {
  const { threshold = -40, silenceDurationMs = 1500 } = config

  let speaking = false
  let silenceTimer: ReturnType<typeof setTimeout> | null = null
  let speechStartCallback: Callback | null = null
  let speechEndCallback: Callback | null = null

  const processLevel = (dB: number) => {
    const isAboveThreshold = dB > threshold

    if (isAboveThreshold) {
      // Cancel any pending silence timer
      if (silenceTimer) {
        clearTimeout(silenceTimer)
        silenceTimer = null
      }

      if (!speaking) {
        speaking = true
        speechStartCallback?.()
      }
    } else if (speaking) {
      // Below threshold while speaking — start silence timer
      if (!silenceTimer) {
        silenceTimer = setTimeout(() => {
          speaking = false
          silenceTimer = null
          speechEndCallback?.()
        }, silenceDurationMs)
      }
    }
  }

  const onSpeechStart = (callback: Callback) => {
    speechStartCallback = callback
  }

  const onSpeechEnd = (callback: Callback) => {
    speechEndCallback = callback
  }

  const isSpeaking = () => speaking

  const reset = () => {
    speaking = false
    if (silenceTimer) {
      clearTimeout(silenceTimer)
      silenceTimer = null
    }
  }

  return {
    processLevel,
    onSpeechStart,
    onSpeechEnd,
    isSpeaking,
    reset,
  }
}

export type MeteringVAD = ReturnType<typeof createMeteringVAD>
