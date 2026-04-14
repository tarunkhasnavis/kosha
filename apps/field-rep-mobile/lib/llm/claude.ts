import EventSource from 'react-native-sse'

type ClaudeConfig = {
  apiKey: string
  model?: string
  maxTokens?: number
  temperature?: number
}

type Message = {
  role: 'user' | 'assistant'
  content: string
}

type StreamParams = {
  systemPrompt: string
  messages: Message[]
  onText: (text: string) => void
}

/**
 * Claude streaming client using react-native-sse.
 *
 * Streams response tokens via SSE so each token can be
 * forwarded to ElevenLabs TTS immediately for lowest latency.
 */
export function createClaudeClient(config: ClaudeConfig) {
  const {
    apiKey,
    model = 'claude-sonnet-4-20250514',
    maxTokens = 1024,
    temperature = 0.3,
  } = config

  const stream = (params: StreamParams): Promise<string> => {
    const { systemPrompt, messages, onText } = params

    return new Promise((resolve, reject) => {
      let fullText = ''

      const es = new EventSource('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature,
          stream: true,
          system: systemPrompt,
          messages,
        }),
      })

      es.addEventListener('content_block_delta', (event: { data?: string }) => {
        if (!event.data) return
        try {
          const parsed = JSON.parse(event.data)
          if (parsed.delta?.type === 'text_delta' && parsed.delta?.text) {
            const text = parsed.delta.text
            fullText += text
            onText(text)
          }
        } catch {
          // Skip malformed JSON
        }
      })

      es.addEventListener('message_stop', () => {
        es.close()
        resolve(fullText)
      })

      es.addEventListener('error', (event: { message?: string }) => {
        es.close()
        reject(new Error(`Claude SSE error: ${event.message || 'Unknown error'}`))
      })
    })
  }

  return { stream }
}

export type ClaudeClient = ReturnType<typeof createClaudeClient>
