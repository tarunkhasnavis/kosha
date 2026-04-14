import { createDeepgramClient, type DeepgramClient } from '../stt/deepgram'
import { createTranscriptBuffer, type TranscriptBuffer } from '../stt/transcript'
import { createClaudeClient, type ClaudeClient } from '../llm/claude'
import { buildSystemPrompt } from '../llm/prompt'
import { createElevenLabsClient, type ElevenLabsClient } from '../tts/elevenlabs'
import { createMeteringVAD, type MeteringVAD } from '../vad/metering-vad'
import { createThinkingBeep, type ThinkingBeep } from '../tts/thinking-beep'
import { createConversationMachine, type SessionState } from './machine'
import { isFarewell, hasWrapUpMarker, removeWrapUpMarker } from './farewell'

type OrchestratorConfig = {
  deepgramKey: string
  anthropicKey: string
  elevenLabsKey: string
  sessionMode: 'voice' | 'chat'
  repName?: string
  accountContext?: string
  onStateChange?: (state: SessionState) => void
  onTranscriptUpdate?: (entries: { speaker: 'rep' | 'agent'; text: string }[]) => void
  onAgentText?: (text: string) => void
  onPlayAudio?: (audioData: ArrayBuffer) => Promise<void>
  onPlayBeep?: () => void
  onSessionEnd?: (transcript: string) => void
}

/**
 * Orchestrator — the brain of the voice pipeline.
 *
 * Wires together: VAD → Deepgram → Claude → ElevenLabs → Playback
 *
 * Flow:
 * 1. Audio metering feeds VAD
 * 2. VAD detects speech end → Deepgram has final transcript
 * 3. Check for farewell → if yes, end session
 * 4. Send transcript to Claude (streaming)
 * 5. Accumulate Claude response into sentences
 * 6. Send each sentence to ElevenLabs TTS (if voice mode)
 * 7. Play audio back
 * 8. Loop
 */
export function createOrchestrator(config: OrchestratorConfig) {
  const {
    deepgramKey,
    anthropicKey,
    elevenLabsKey,
    sessionMode,
    repName,
    accountContext,
    onStateChange,
    onTranscriptUpdate,
    onAgentText,
    onPlayAudio,
    onPlayBeep,
    onSessionEnd,
  } = config

  const machine = createConversationMachine()
  const transcript = createTranscriptBuffer()
  const vad = createMeteringVAD({ threshold: -40, silenceDurationMs: 1500 })
  const thinkingBeep = createThinkingBeep()
  const deepgram = createDeepgramClient({ apiKey: deepgramKey })
  const claude = createClaudeClient({ apiKey: anthropicKey })
  const tts = createElevenLabsClient({
    apiKey: elevenLabsKey,
    voiceId: process.env.EXPO_PUBLIC_ELEVENLABS_VOICE_ID || undefined,
  })

  let isProcessingTurn = false
  let silenceTimer: ReturnType<typeof setTimeout> | null = null
  const MUTUAL_SILENCE_MS = 30000

  // Build system prompt
  const systemPrompt = buildSystemPrompt({ repName, accountContext })

  // Wire up state machine transitions
  machine.onTransition((from, to) => {
    onStateChange?.(to)

    if (to === 'ENDING') {
      handleSessionEnding()
    }

    if (to === 'COMPLETE') {
      cleanup()
      onSessionEnd?.(transcript.toJSON())
    }
  })

  // Wire up VAD
  vad.onSpeechStart(() => {
    // Barge-in: if agent is speaking, stop TTS
    if (tts.getState() === 'synthesizing') {
      tts.cancel()
    }
    thinkingBeep.stop()

    // Reset mutual silence timer
    resetSilenceTimer()
  })

  vad.onSpeechEnd(() => {
    // Speech ended — Deepgram will send the final transcript
    // We process it when we receive the Deepgram callback
    resetSilenceTimer()
  })

  // Wire up Deepgram transcripts
  deepgram.onTranscript((result) => {
    if (!result.isFinal) return
    if (machine.getState() !== 'ACTIVE') return

    // Add to transcript
    transcript.addEntry('rep', result.text)
    onTranscriptUpdate?.(transcript.getEntries())

    // Check for farewell
    if (isFarewell(result.text)) {
      machine.send({ type: 'FAREWELL_DETECTED' })
      return
    }

    // Process this turn (get agent response)
    processTurn()
  })

  // Wire up thinking beep
  thinkingBeep.onBeep(() => {
    onPlayBeep?.()
  })

  const processTurn = async () => {
    if (isProcessingTurn) return
    isProcessingTurn = true

    // Start thinking beep timer
    thinkingBeep.startWaiting()

    try {
      let fullResponse = ''

      await claude.stream({
        systemPrompt,
        messages: transcript.getMessagesForLLM(),
        onText: (text) => {
          // Stop thinking beep on first token
          thinkingBeep.stop()
          fullResponse += text
          onAgentText?.(text)
        },
      })

      // Check for wrap up marker
      const isWrapUp = hasWrapUpMarker(fullResponse)
      const cleanResponse = removeWrapUpMarker(fullResponse)

      // Add agent response to transcript
      if (cleanResponse) {
        transcript.addEntry('agent', cleanResponse)
        onTranscriptUpdate?.(transcript.getEntries())
      }

      // TTS — only in voice mode
      if (sessionMode === 'voice' && cleanResponse && onPlayAudio) {
        try {
          const audioData = await tts.synthesize(cleanResponse)
          if (audioData.byteLength > 0) {
            await onPlayAudio(audioData)
          }
        } catch (error) {
          console.error('TTS error:', error)
          // Continue without TTS — agent text is still in transcript
        }
      }

      // If Claude signaled wrap up, end session
      if (isWrapUp) {
        machine.send({ type: 'FAREWELL_DETECTED' })
      }
    } catch (error) {
      console.error('Claude error:', error)
      thinkingBeep.stop()
    } finally {
      isProcessingTurn = false
    }
  }

  const handleSessionEnding = async () => {
    // Agent says brief sign-off (already handled by Claude's WRAP_UP response)
    // Transition to complete
    machine.send({ type: 'SIGNOFF_COMPLETE' })
  }

  const resetSilenceTimer = () => {
    if (silenceTimer) clearTimeout(silenceTimer)
    silenceTimer = setTimeout(() => {
      if (machine.getState() === 'ACTIVE') {
        machine.send({ type: 'MUTUAL_SILENCE_TIMEOUT' })
      }
    }, MUTUAL_SILENCE_MS)
  }

  // Public API

  const start = async () => {
    machine.send({ type: 'START' })
    resetSilenceTimer()

    // Connect Deepgram in background — don't block session start
    deepgram.connect().catch((error) => {
      console.log('Deepgram connection pending — text input available')
    })
  }

  const stop = () => {
    machine.send({ type: 'REP_TAP_END' })
  }

  const processAudioLevel = (dB: number) => {
    vad.processLevel(dB)
  }

  const sendAudioChunk = (chunk: ArrayBuffer) => {
    deepgram.sendAudio(chunk)
  }

  const sendTextMessage = (text: string) => {
    if (machine.getState() !== 'ACTIVE') return

    transcript.addEntry('rep', text)
    onTranscriptUpdate?.(transcript.getEntries())

    if (isFarewell(text)) {
      machine.send({ type: 'FAREWELL_DETECTED' })
      return
    }

    processTurn()
  }

  const getState = () => machine.getState()
  const getTranscript = () => transcript

  const cleanup = () => {
    deepgram.disconnect()
    tts.cancel()
    thinkingBeep.stop()
    vad.reset()
    if (silenceTimer) clearTimeout(silenceTimer)
  }

  return {
    start,
    stop,
    processAudioLevel,
    sendAudioChunk,
    sendTextMessage,
    getState,
    getTranscript,
    cleanup,
  }
}

export type Orchestrator = ReturnType<typeof createOrchestrator>
