export type DeepgramState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

export type TranscriptResult = {
  text: string
  isFinal: boolean
  confidence: number
  timestamp: number
}

type DeepgramConfig = {
  apiKey: string
  model?: string
  sampleRate?: number
  channels?: number
  endpointing?: number
}

type TranscriptCallback = (result: TranscriptResult) => void

/**
 * Deepgram streaming STT client.
 *
 * Opens a WebSocket to Deepgram Nova-2, streams audio chunks,
 * and returns transcript results via callback.
 *
 * In development builds, WebSocket supports custom headers
 * for authentication. Buffers audio during disconnects.
 */
export function createDeepgramClient(config: DeepgramConfig) {
  const {
    apiKey,
    model = 'nova-2',
    sampleRate = 16000,
    channels = 1,
    endpointing = 1500,
  } = config

  let ws: WebSocket | null = null
  let state: DeepgramState = 'disconnected'
  let transcriptCallback: TranscriptCallback | null = null
  let audioBuffer: ArrayBuffer[] = []

  const buildUrl = () => {
    const params = new URLSearchParams({
      model,
      encoding: 'linear16',
      sample_rate: String(sampleRate),
      channels: String(channels),
      smart_format: 'true',
      punctuate: 'true',
      utterances: 'true',
      endpointing: String(endpointing),
      interim_results: 'true',
    })
    return `wss://api.deepgram.com/v1/listen?${params.toString()}`
  }

  const handleMessage = (event: { data: string }) => {
    try {
      const data = JSON.parse(event.data)

      if (data.type === 'Results') {
        const alternative = data.channel?.alternatives?.[0]
        if (!alternative) return

        const text = (alternative.transcript || '').trim()
        if (!text) return

        transcriptCallback?.({
          text,
          isFinal: data.is_final === true,
          confidence: alternative.confidence || 0,
          timestamp: Date.now(),
        })
      }
    } catch {
      // Ignore malformed messages
    }
  }

  const connect = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (state === 'connected' && ws) {
        resolve()
        return
      }

      state = 'connecting'
      const url = buildUrl()

      // Development build supports headers via 3rd argument
      // @ts-ignore — React Native WebSocket accepts options object
      ws = new WebSocket(url, null, {
        headers: {
          Authorization: `Token ${apiKey}`,
        },
      })

      const timeout = setTimeout(() => {
        if (state === 'connecting') {
          ws?.close()
          state = 'disconnected'
          reject(new Error('Deepgram WebSocket connection timeout'))
        }
      }, 5000)

      ws.onopen = () => {
        clearTimeout(timeout)
        state = 'connected'

        // Replay any buffered audio
        if (audioBuffer.length > 0) {
          for (const chunk of audioBuffer) {
            ws?.send(chunk as unknown as string)
          }
          audioBuffer = []
        }

        resolve()
      }

      ws.onmessage = handleMessage

      ws.onclose = () => {
        state = 'disconnected'
      }

      ws.onerror = (error) => {
        clearTimeout(timeout)
        console.warn('Deepgram WebSocket error, readyState:', ws?.readyState)
        state = 'disconnected'
        reject(error)
      }
    })
  }

  const sendAudio = (chunk: ArrayBuffer) => {
    if (state === 'connected' && ws && ws.readyState === 1) {
      ws.send(chunk as unknown as string)
    } else {
      audioBuffer.push(chunk)
    }
  }

  const onTranscript = (callback: TranscriptCallback) => {
    transcriptCallback = callback
  }

  const disconnect = () => {
    if (ws) {
      ws.close()
      ws = null
    }
    state = 'disconnected'
    audioBuffer = []
  }

  const getState = (): DeepgramState => state

  return {
    connect,
    sendAudio,
    onTranscript,
    disconnect,
    getState,
  }
}

export type DeepgramClient = ReturnType<typeof createDeepgramClient>
