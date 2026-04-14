import { createDeepgramClient } from '../../../lib/stt/deepgram'

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = []
  readyState = 0 // CONNECTING
  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  sent: ArrayBuffer[] = []

  constructor(public url: string) {
    MockWebSocket.instances.push(this)
    setTimeout(() => {
      this.readyState = 1 // OPEN
      this.onopen?.()
    }, 0)
  }

  send(data: ArrayBuffer) {
    this.sent.push(data)
  }

  close() {
    this.readyState = 3 // CLOSED
    this.onclose?.()
  }

  simulateMessage(data: Record<string, unknown>) {
    this.onmessage?.({ data: JSON.stringify(data) })
  }
}

// @ts-ignore
global.WebSocket = MockWebSocket

beforeEach(() => {
  MockWebSocket.instances = []
})

describe('Deepgram client', () => {
  it('initializes in disconnected state', () => {
    const client = createDeepgramClient({ apiKey: 'test-key' })
    expect(client.getState()).toBe('disconnected')
  })

  it('connects to Deepgram WebSocket with correct params', async () => {
    const client = createDeepgramClient({ apiKey: 'test-key' })
    await client.connect()

    expect(client.getState()).toBe('connected')
    expect(MockWebSocket.instances).toHaveLength(1)

    const url = MockWebSocket.instances[0].url
    expect(url).toContain('wss://api.deepgram.com')
    expect(url).toContain('model=nova-2')
    expect(url).toContain('encoding=linear16')
    expect(url).toContain('sample_rate=16000')
    expect(url).toContain('channels=1')
    expect(url).toContain('smart_format=true')
    expect(url).toContain('punctuate=true')
    expect(url).toContain('endpointing=1500')
    expect(url).toContain('interim_results=true')
  })

  it('sends audio chunks to WebSocket', async () => {
    const client = createDeepgramClient({ apiKey: 'test-key' })
    await client.connect()

    const chunk = new ArrayBuffer(1024)
    client.sendAudio(chunk)

    expect(MockWebSocket.instances[0].sent).toHaveLength(1)
    expect(MockWebSocket.instances[0].sent[0]).toBe(chunk)
  })

  it('calls onTranscript with final results', async () => {
    const client = createDeepgramClient({ apiKey: 'test-key' })
    const results: { text: string; isFinal: boolean }[] = []

    client.onTranscript((result) => {
      results.push(result)
    })

    await client.connect()

    const ws = MockWebSocket.instances[0]
    ws.simulateMessage({
      type: 'Results',
      is_final: true,
      channel: {
        alternatives: [
          { transcript: 'Just left Roosters', confidence: 0.97 },
        ],
      },
    })

    expect(results).toHaveLength(1)
    expect(results[0].text).toBe('Just left Roosters')
    expect(results[0].isFinal).toBe(true)
  })

  it('calls onTranscript with interim results', async () => {
    const client = createDeepgramClient({ apiKey: 'test-key' })
    const results: { text: string; isFinal: boolean }[] = []

    client.onTranscript((result) => {
      results.push(result)
    })

    await client.connect()

    const ws = MockWebSocket.instances[0]
    ws.simulateMessage({
      type: 'Results',
      is_final: false,
      channel: {
        alternatives: [
          { transcript: 'Just left', confidence: 0.85 },
        ],
      },
    })

    expect(results).toHaveLength(1)
    expect(results[0].text).toBe('Just left')
    expect(results[0].isFinal).toBe(false)
  })

  it('ignores empty transcripts', async () => {
    const client = createDeepgramClient({ apiKey: 'test-key' })
    const results: { text: string; isFinal: boolean }[] = []

    client.onTranscript((result) => {
      results.push(result)
    })

    await client.connect()

    const ws = MockWebSocket.instances[0]
    ws.simulateMessage({
      type: 'Results',
      is_final: true,
      channel: {
        alternatives: [
          { transcript: '', confidence: 0 },
        ],
      },
    })

    expect(results).toHaveLength(0)
  })

  it('buffers audio when disconnected and replays on reconnect', async () => {
    const client = createDeepgramClient({ apiKey: 'test-key' })
    await client.connect()

    // Simulate disconnect
    const ws1 = MockWebSocket.instances[0]
    ws1.close()

    // Send audio while disconnected
    const chunk1 = new ArrayBuffer(512)
    const chunk2 = new ArrayBuffer(512)
    client.sendAudio(chunk1)
    client.sendAudio(chunk2)

    // Reconnect
    await client.connect()
    const ws2 = MockWebSocket.instances[1]

    // Buffered chunks should have been replayed
    expect(ws2.sent).toHaveLength(2)
  })

  it('disconnects cleanly', async () => {
    const client = createDeepgramClient({ apiKey: 'test-key' })
    await client.connect()
    client.disconnect()

    expect(client.getState()).toBe('disconnected')
  })
})
