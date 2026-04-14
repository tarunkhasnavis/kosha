import { Audio } from 'expo-av'

export type PlaybackState = 'idle' | 'playing' | 'paused'

/**
 * Audio playback module — plays TTS audio chunks from ElevenLabs.
 *
 * Usage:
 *   const player = createAudioPlayback()
 *   await player.playUri(uri)  // play a local audio file
 *   player.stop()              // stop immediately (barge-in)
 */
export function createAudioPlayback() {
  let sound: Audio.Sound | null = null
  let state: PlaybackState = 'idle'
  let onFinishCallback: (() => void) | null = null

  const playUri = async (uri: string) => {
    // Stop any currently playing audio
    await stop()

    const { sound: newSound } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: true },
      (status) => {
        if (status.isLoaded && status.didJustFinish) {
          state = 'idle'
          onFinishCallback?.()
        }
      }
    )

    sound = newSound
    state = 'playing'
  }

  const stop = async () => {
    if (!sound) return
    try {
      await sound.stopAsync()
      await sound.unloadAsync()
    } catch {
      // Already unloaded
    }
    sound = null
    state = 'idle'
  }

  const pause = async () => {
    if (!sound || state !== 'playing') return
    await sound.pauseAsync()
    state = 'paused'
  }

  const resume = async () => {
    if (!sound || state !== 'paused') return
    await sound.playAsync()
    state = 'playing'
  }

  const onFinish = (callback: () => void) => {
    onFinishCallback = callback
  }

  const getState = (): PlaybackState => state

  return {
    playUri,
    stop,
    pause,
    resume,
    onFinish,
    getState,
  }
}

export type AudioPlayback = ReturnType<typeof createAudioPlayback>
