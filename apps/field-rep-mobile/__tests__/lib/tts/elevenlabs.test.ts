import { createElevenLabsClient } from '../../../lib/tts/elevenlabs'

const mockFetch = jest.fn()
global.fetch = mockFetch

beforeEach(() => {
  jest.clearAllMocks()
})

describe('ElevenLabs TTS client', () => {
  it('initializes in idle state', () => {
    const client = createElevenLabsClient({ apiKey: 'test-key' })
    expect(client.getState()).toBe('idle')
  })

  it('sends correct request to ElevenLabs API', async () => {
    const audioData = new ArrayBuffer(1024)
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => audioData,
    })

    const client = createElevenLabsClient({ apiKey: 'test-key', voiceId: 'test-voice' })
    const result = await client.synthesize('Hello there')

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('https://api.elevenlabs.io/v1/text-to-speech/test-voice'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'xi-api-key': 'test-key',
          'Content-Type': 'application/json',
        }),
      })
    )

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.text).toBe('Hello there')
    expect(body.model_id).toContain('turbo')
  })

  it('returns audio data', async () => {
    const audioData = new ArrayBuffer(2048)
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => audioData,
    })

    const client = createElevenLabsClient({ apiKey: 'test-key' })
    const result = await client.synthesize('Test')

    expect(result).toBe(audioData)
  })

  it('throws on API error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    })

    const client = createElevenLabsClient({ apiKey: 'test-key' })
    await expect(client.synthesize('Test')).rejects.toThrow()
  })

  it('tracks state during synthesis', async () => {
    let resolvePromise: (value: unknown) => void
    const pending = new Promise((resolve) => { resolvePromise = resolve })

    mockFetch.mockReturnValue(pending)

    const client = createElevenLabsClient({ apiKey: 'test-key' })
    const promise = client.synthesize('Test')

    expect(client.getState()).toBe('synthesizing')

    resolvePromise!({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(0),
    })

    await promise
    expect(client.getState()).toBe('idle')
  })

  it('can cancel synthesis', () => {
    const client = createElevenLabsClient({ apiKey: 'test-key' })
    client.cancel()
    expect(client.getState()).toBe('idle')
  })
})
