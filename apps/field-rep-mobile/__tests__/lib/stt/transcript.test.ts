import { createTranscriptBuffer } from '../../../lib/stt/transcript'

describe('transcript buffer', () => {
  it('initializes empty', () => {
    const buffer = createTranscriptBuffer()
    expect(buffer.getEntries()).toEqual([])
    expect(buffer.getFullText()).toBe('')
  })

  it('adds rep entries', () => {
    const buffer = createTranscriptBuffer()
    buffer.addEntry('rep', 'Just left Roosters')

    const entries = buffer.getEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0].speaker).toBe('rep')
    expect(entries[0].text).toBe('Just left Roosters')
    expect(entries[0].timestamp).toBeDefined()
  })

  it('adds agent entries', () => {
    const buffer = createTranscriptBuffer()
    buffer.addEntry('agent', 'How did it go?')

    const entries = buffer.getEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0].speaker).toBe('agent')
  })

  it('maintains order of entries', () => {
    const buffer = createTranscriptBuffer()
    buffer.addEntry('rep', 'First message')
    buffer.addEntry('agent', 'Second message')
    buffer.addEntry('rep', 'Third message')

    const entries = buffer.getEntries()
    expect(entries).toHaveLength(3)
    expect(entries[0].text).toBe('First message')
    expect(entries[1].text).toBe('Second message')
    expect(entries[2].text).toBe('Third message')
  })

  it('generates full text with speaker labels', () => {
    const buffer = createTranscriptBuffer()
    buffer.addEntry('rep', 'Just left Roosters')
    buffer.addEntry('agent', 'How did it go?')
    buffer.addEntry('rep', 'Danny wants the new seltzer line')

    const text = buffer.getFullText()
    expect(text).toContain('Rep: Just left Roosters')
    expect(text).toContain('Agent: How did it go?')
    expect(text).toContain('Rep: Danny wants the new seltzer line')
  })

  it('returns conversation messages for Claude context', () => {
    const buffer = createTranscriptBuffer()
    buffer.addEntry('rep', 'Hello')
    buffer.addEntry('agent', 'Hey, how can I help?')

    const messages = buffer.getMessagesForLLM()
    expect(messages).toHaveLength(2)
    expect(messages[0]).toEqual({ role: 'user', content: 'Hello' })
    expect(messages[1]).toEqual({ role: 'assistant', content: 'Hey, how can I help?' })
  })

  it('returns turn count', () => {
    const buffer = createTranscriptBuffer()
    expect(buffer.getTurnCount()).toBe(0)

    buffer.addEntry('rep', 'First')
    buffer.addEntry('agent', 'Response')
    buffer.addEntry('rep', 'Second')

    expect(buffer.getTurnCount()).toBe(3)
  })

  it('serializes to JSON for storage', () => {
    const buffer = createTranscriptBuffer()
    buffer.addEntry('rep', 'Test message')
    buffer.addEntry('agent', 'Response')

    const json = buffer.toJSON()
    const parsed = JSON.parse(json)

    expect(parsed).toHaveLength(2)
    expect(parsed[0].speaker).toBe('rep')
    expect(parsed[0].text).toBe('Test message')
    expect(parsed[1].speaker).toBe('agent')
  })

  it('restores from JSON', () => {
    const buffer1 = createTranscriptBuffer()
    buffer1.addEntry('rep', 'Saved message')
    buffer1.addEntry('agent', 'Saved response')
    const json = buffer1.toJSON()

    const buffer2 = createTranscriptBuffer()
    buffer2.fromJSON(json)

    expect(buffer2.getEntries()).toHaveLength(2)
    expect(buffer2.getEntries()[0].text).toBe('Saved message')
    expect(buffer2.getFullText()).toContain('Rep: Saved message')
  })

  it('clears all entries', () => {
    const buffer = createTranscriptBuffer()
    buffer.addEntry('rep', 'Message')
    buffer.addEntry('agent', 'Response')
    buffer.clear()

    expect(buffer.getEntries()).toEqual([])
    expect(buffer.getTurnCount()).toBe(0)
  })

  it('tracks session start time', () => {
    const before = Date.now()
    const buffer = createTranscriptBuffer()
    const after = Date.now()

    expect(buffer.getStartedAt()).toBeGreaterThanOrEqual(before)
    expect(buffer.getStartedAt()).toBeLessThanOrEqual(after)
  })

  it('calculates duration in seconds', () => {
    const buffer = createTranscriptBuffer()
    // Duration is time since creation
    const duration = buffer.getDurationSeconds()
    expect(duration).toBeGreaterThanOrEqual(0)
    expect(duration).toBeLessThan(1)
  })
})
