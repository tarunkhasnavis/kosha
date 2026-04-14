import { createClaudeClient } from '../../../lib/llm/claude'

// Mock fetch
const mockFetch = jest.fn()
global.fetch = mockFetch

beforeEach(() => {
  jest.clearAllMocks()
})

function createSSEStream(chunks: string[]) {
  let index = 0
  const encoder = new TextEncoder()

  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]))
        index++
      } else {
        controller.close()
      }
    },
  })
}

describe('Claude streaming client', () => {
  it('sends correct request to Anthropic API', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: createSSEStream([
        'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}\n\n',
        'event: message_stop\ndata: {"type":"message_stop"}\n\n',
      ]),
    })

    const client = createClaudeClient({ apiKey: 'test-key' })
    const chunks: string[] = []

    await client.stream({
      systemPrompt: 'You are Kosha',
      messages: [{ role: 'user', content: 'Hi' }],
      onText: (text) => chunks.push(text),
    })

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-api-key': 'test-key',
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        }),
      })
    )

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.model).toContain('claude')
    expect(body.stream).toBe(true)
    expect(body.system).toBe('You are Kosha')
    expect(body.messages).toEqual([{ role: 'user', content: 'Hi' }])
  })

  it('streams text chunks via onText callback', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: createSSEStream([
        'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hey "}}\n\n',
        'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"there!"}}\n\n',
        'event: message_stop\ndata: {"type":"message_stop"}\n\n',
      ]),
    })

    const client = createClaudeClient({ apiKey: 'test-key' })
    const chunks: string[] = []

    await client.stream({
      systemPrompt: 'You are Kosha',
      messages: [{ role: 'user', content: 'Hi' }],
      onText: (text) => chunks.push(text),
    })

    expect(chunks).toEqual(['Hey ', 'there!'])
  })

  it('returns full response text', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: createSSEStream([
        'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Full "}}\n\n',
        'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"response"}}\n\n',
        'event: message_stop\ndata: {"type":"message_stop"}\n\n',
      ]),
    })

    const client = createClaudeClient({ apiKey: 'test-key' })
    const result = await client.stream({
      systemPrompt: 'You are Kosha',
      messages: [{ role: 'user', content: 'Hi' }],
      onText: () => {},
    })

    expect(result).toBe('Full response')
  })

  it('throws on API error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Rate limited',
    })

    const client = createClaudeClient({ apiKey: 'test-key' })

    await expect(
      client.stream({
        systemPrompt: 'You are Kosha',
        messages: [{ role: 'user', content: 'Hi' }],
        onText: () => {},
      })
    ).rejects.toThrow()
  })

  it('uses low temperature for consistency', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: createSSEStream([
        'event: message_stop\ndata: {"type":"message_stop"}\n\n',
      ]),
    })

    const client = createClaudeClient({ apiKey: 'test-key' })
    await client.stream({
      systemPrompt: 'test',
      messages: [{ role: 'user', content: 'Hi' }],
      onText: () => {},
    })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.temperature).toBeLessThanOrEqual(0.3)
  })
})
