export type TTSState = 'idle' | 'synthesizing' | 'cancelled'

type ElevenLabsConfig = {
  apiKey: string
  voiceId?: string
  modelId?: string
}

/**
 * ElevenLabs TTS client.
 *
 * Sends text to ElevenLabs Turbo v2.5 and returns audio data.
 * For streaming, we synthesize sentence-by-sentence as Claude
 * streams tokens — each sentence becomes a separate TTS request.
 */
export function createElevenLabsClient(config: ElevenLabsConfig) {
  const {
    apiKey,
    voiceId = 'EST9Ui6982FZPSi7gCHi', // Elise
    modelId = 'eleven_turbo_v2_5',
  } = config

  let state: TTSState = 'idle'
  let cancelled = false

  const synthesize = async (text: string): Promise<ArrayBuffer> => {
    state = 'synthesizing'
    cancelled = false

    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg',
          },
          body: JSON.stringify({
            text,
            model_id: modelId,
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.0,
              use_speaker_boost: true,
            },
          }),
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`ElevenLabs API error ${response.status}: ${errorText}`)
      }

      if (cancelled) {
        state = 'idle'
        return new ArrayBuffer(0)
      }

      const audioData = await response.arrayBuffer()
      state = 'idle'
      return audioData
    } catch (error) {
      state = 'idle'
      throw error
    }
  }

  const cancel = () => {
    cancelled = true
    state = 'idle'
  }

  const getState = (): TTSState => state

  return {
    synthesize,
    cancel,
    getState,
  }
}

export type ElevenLabsClient = ReturnType<typeof createElevenLabsClient>
