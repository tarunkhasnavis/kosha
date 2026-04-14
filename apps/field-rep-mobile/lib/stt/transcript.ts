export type Speaker = 'rep' | 'agent'

export type TranscriptEntry = {
  speaker: Speaker
  text: string
  timestamp: number
}

type LLMMessage = {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Transcript buffer — stores the conversation history in memory.
 *
 * Provides:
 * - Ordered entries with speaker labels and timestamps
 * - Full text output for post-processing
 * - LLM-formatted messages for Claude context
 * - JSON serialization for SQLite crash recovery
 */
export function createTranscriptBuffer() {
  let entries: TranscriptEntry[] = []
  const startedAt = Date.now()

  const addEntry = (speaker: Speaker, text: string) => {
    entries.push({
      speaker,
      text,
      timestamp: Date.now(),
    })
  }

  const getEntries = (): TranscriptEntry[] => [...entries]

  const getFullText = (): string => {
    return entries
      .map((e) => `${e.speaker === 'rep' ? 'Rep' : 'Agent'}: ${e.text}`)
      .join('\n')
  }

  const getMessagesForLLM = (): LLMMessage[] => {
    return entries.map((e) => ({
      role: e.speaker === 'rep' ? 'user' as const : 'assistant' as const,
      content: e.text,
    }))
  }

  const getTurnCount = (): number => entries.length

  const toJSON = (): string => JSON.stringify(entries)

  const fromJSON = (json: string) => {
    try {
      const parsed = JSON.parse(json)
      if (Array.isArray(parsed)) {
        entries = parsed
      }
    } catch {
      // Ignore malformed JSON
    }
  }

  const clear = () => {
    entries = []
  }

  const getStartedAt = (): number => startedAt

  const getDurationSeconds = (): number => {
    return Math.floor((Date.now() - startedAt) / 1000)
  }

  return {
    addEntry,
    getEntries,
    getFullText,
    getMessagesForLLM,
    getTurnCount,
    toJSON,
    fromJSON,
    clear,
    getStartedAt,
    getDurationSeconds,
  }
}

export type TranscriptBuffer = ReturnType<typeof createTranscriptBuffer>
