import { Audio } from 'expo-av'

export type AudioCaptureState = 'idle' | 'capturing' | 'paused'

type ChunkCallback = (pcm: ArrayBuffer) => void

/**
 * Audio capture module — records mic input as 16kHz mono PCM.
 *
 * Usage:
 *   const capture = createAudioCapture()
 *   capture.onChunk((pcm) => deepgram.sendAudio(pcm))
 *   await capture.start()
 *   // ... later
 *   await capture.stop()
 */
export function createAudioCapture() {
  let recording: Audio.Recording | null = null
  let state: AudioCaptureState = 'idle'
  let chunkCallback: ChunkCallback | null = null

  const start = async () => {
    if (state === 'capturing') return

    // Request permissions
    const { granted } = await Audio.requestPermissionsAsync()
    if (!granted) throw new Error('Microphone permission denied')

    // Configure audio session for recording + playback (agent TTS)
    // Must be called before creating recording, and may need a retry on iOS
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      })
    } catch {
      // Retry once after a brief delay — iOS sometimes needs a moment
      await new Promise((r) => setTimeout(r, 200))
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      })
    }

    // Create and start recording
    // Using LOW_QUALITY preset as base, then overriding for 16kHz mono PCM
    const { recording: rec } = await Audio.Recording.createAsync({
      isMeteringEnabled: true,
      android: {
        extension: '.wav',
        outputFormat: Audio.AndroidOutputFormat.DEFAULT,
        audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
        sampleRate: 16000,
        numberOfChannels: 1,
        bitRate: 256000,
      },
      ios: {
        extension: '.wav',
        outputFormat: Audio.IOSOutputFormat.LINEARPCM,
        audioQuality: Audio.IOSAudioQuality.HIGH,
        sampleRate: 16000,
        numberOfChannels: 1,
        bitRate: 256000,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      },
      web: {
        mimeType: 'audio/webm',
        bitsPerSecond: 256000,
      },
    })

    recording = rec
    state = 'capturing'

    // expo-av doesn't support streaming chunks natively.
    // For Phase 2 (Deepgram integration), we'll use a polling approach:
    // periodically read the recording file and send new data.
    // For now, the full recording is available on stop().
  }

  const stop = async (): Promise<string | null> => {
    if (!recording || state === 'idle') return null

    state = 'idle'
    await recording.stopAndUnloadAsync()

    // Reset audio mode
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    })

    const uri = recording.getURI()
    recording = null
    return uri
  }

  const pause = async () => {
    if (!recording || state !== 'capturing') return
    await recording.pauseAsync()
    state = 'paused'
  }

  const resume = async () => {
    if (!recording || state !== 'paused') return
    await recording.startAsync()
    state = 'capturing'
  }

  const onChunk = (callback: ChunkCallback) => {
    chunkCallback = callback
  }

  const getState = (): AudioCaptureState => state

  const getMetering = async (): Promise<number> => {
    if (!recording || state !== 'capturing') return -160
    const status = await recording.getStatusAsync()
    return status.isRecording ? (status.metering ?? -160) : -160
  }

  return {
    start,
    stop,
    pause,
    resume,
    onChunk,
    getState,
    getMetering,
  }
}

export type AudioCapture = ReturnType<typeof createAudioCapture>
