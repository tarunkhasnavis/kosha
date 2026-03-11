'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  ScrollArea,
  Separator,
} from '@kosha/ui'
import { Mic, MicOff, Loader2, CheckCircle2, X, RotateCcw } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import type { Account } from '@kosha/types'

type AgentState = 'idle' | 'connecting' | 'active' | 'extracting' | 'saving' | 'done'

interface TranscriptEntry {
  role: 'user' | 'assistant'
  text: string
  itemId?: string
}

interface ExtractedInsightItem {
  type: string
  description: string
  category: string
  suggestedAction: string
}

interface ExtractedTaskItem {
  task: string
  priority: string
}

interface ExtractedCapture {
  summary: string
  insights: ExtractedInsightItem[]
  tasks: ExtractedTaskItem[]
}

interface VoiceAgentProps {
  accounts: Account[]
}

const insightTypeConfig: Record<string, { label: string; className: string }> = {
  demand: { label: 'Demand', className: 'bg-purple-100 text-purple-700' },
  competitive: { label: 'Competitive', className: 'bg-red-100 text-red-700' },
  friction: { label: 'Friction', className: 'bg-amber-100 text-amber-700' },
  expansion: { label: 'Expansion', className: 'bg-emerald-100 text-emerald-700' },
  relationship: { label: 'Relationship', className: 'bg-blue-100 text-blue-700' },
}

const priorityConfig: Record<string, { label: string; className: string }> = {
  high: { label: 'High', className: 'bg-red-100 text-red-700' },
  medium: { label: 'Medium', className: 'bg-amber-100 text-amber-700' },
  low: { label: 'Low', className: 'bg-slate-100 text-slate-600' },
}

export function VoiceAgent({ accounts }: VoiceAgentProps) {
  const [state, setState] = useState<AgentState>('idle')
  const [accountId, setAccountId] = useState('')
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [extractedCapture, setExtractedCapture] = useState<ExtractedCapture | null>(null)
  const [saving, setSaving] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isMuted, setIsMuted] = useState(false)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const currentAssistantTextRef = useRef('')
  const fullTranscriptRef = useRef('')
  const functionCallArgsRef = useRef('')
  const isMutedRef = useRef(false)
  const itemOrderRef = useRef<string[]>([])

  const selectedAccount = accounts.find((a) => a.id === accountId)

  // Auto-scroll transcript — target the Radix ScrollArea viewport
  useEffect(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]')
      const target = viewport || scrollRef.current
      target.scrollTop = target.scrollHeight
    }
  }, [transcript])

  const cleanup = useCallback(() => {
    if (dcRef.current) {
      dcRef.current.close()
      dcRef.current = null
    }
    if (pcRef.current) {
      pcRef.current.close()
      pcRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (audioRef.current) {
      audioRef.current.srcObject = null
      audioRef.current = null
    }
  }, [])

  const fallbackExtract = useCallback(async () => {
    cleanup()

    const transcriptText = fullTranscriptRef.current.trim()
    if (!transcriptText) {
      setState('idle')
      return
    }

    setState('extracting')
    try {
      const res = await fetch('/api/capture/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: transcriptText }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Extraction failed')
      }

      const data = await res.json() as ExtractedCapture
      if (data.insights && data.insights.length > 0) {
        setExtractedCapture(data)
        setState('saving')
      } else {
        setState('idle')
        toast({ title: 'Capture ended', description: 'No insights could be extracted from the conversation.' })
      }
    } catch (error) {
      console.error('Fallback extraction failed:', error)
      setState('idle')
      toast({
        title: 'Extraction failed',
        description: error instanceof Error ? error.message : 'Could not process the conversation.',
        variant: 'destructive',
      })
    }
  }, [cleanup])

  const startCapture = useCallback(async () => {
    if (!accountId || !selectedAccount) return

    setState('connecting')
    setTranscript([])
    setExtractedCapture(null)
    setIsSpeaking(false)
    currentAssistantTextRef.current = ''
    fullTranscriptRef.current = ''
    functionCallArgsRef.current = ''
    itemOrderRef.current = []

    try {
      // 1. Get ephemeral token
      const sessionRes = await fetch('/api/capture/session', { method: 'POST' })
      if (!sessionRes.ok) {
        const err = await sessionRes.json()
        throw new Error(err.error || 'Failed to create session')
      }
      const { client_secret } = await sessionRes.json()
      if (!client_secret) throw new Error('No client secret returned')

      // 2. Create peer connection
      const pc = new RTCPeerConnection()
      pcRef.current = pc

      // 3. Set up remote audio playback
      const audio = document.createElement('audio')
      audio.autoplay = true
      audioRef.current = audio

      pc.ontrack = (event) => {
        audio.srcObject = event.streams[0]
      }

      // 4. Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      streamRef.current = stream
      pc.addTrack(stream.getAudioTracks()[0], stream)

      // 5. Create data channel for events
      const dc = pc.createDataChannel('oai-events')
      dcRef.current = dc

      dc.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data)
          handleRealtimeEvent(event)
        } catch {
          // ignore parse errors
        }
      }

      // 6. Create SDP offer
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      // 7. Send offer to OpenAI Realtime API
      const sdpRes = await fetch(
        'https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview',
        {
          method: 'POST',
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${client_secret}`,
            'Content-Type': 'application/sdp',
          },
        }
      )

      if (!sdpRes.ok) {
        throw new Error('Failed to connect to voice service')
      }

      const answerSdp = await sdpRes.text()
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })

      setState('active')
    } catch (error) {
      console.error('Failed to start capture:', error)
      cleanup()
      setState('idle')
      toast({
        title: 'Connection failed',
        description: error instanceof Error ? error.message : 'Failed to start voice capture',
        variant: 'destructive',
      })
    }
  }, [accountId, selectedAccount, cleanup])

  // Track item creation order from the Realtime API so we can sort transcript entries correctly.
  // Whisper transcription of user speech can arrive AFTER the assistant response, causing misordering.
  const trackItemOrder = useCallback((itemId: string) => {
    if (itemId && !itemOrderRef.current.includes(itemId)) {
      itemOrderRef.current.push(itemId)
    }
  }, [])

  const sortByItemOrder = useCallback((entries: TranscriptEntry[]): TranscriptEntry[] => {
    return [...entries].sort((a, b) => {
      const aIdx = a.itemId ? itemOrderRef.current.indexOf(a.itemId) : -1
      const bIdx = b.itemId ? itemOrderRef.current.indexOf(b.itemId) : -1
      if (aIdx === -1 || bIdx === -1) return 0
      return aIdx - bIdx
    })
  }, [])

  const handleRealtimeEvent = useCallback((event: Record<string, unknown>) => {
    const type = event.type as string

    switch (type) {
      // Track item creation order — fires in correct conversational order
      case 'conversation.item.created': {
        const item = event.item as Record<string, unknown> | undefined
        const itemId = item?.id as string
        if (itemId) trackItemOrder(itemId)
        break
      }

      // User speech transcription (may arrive late — after assistant response)
      case 'conversation.item.input_audio_transcription.completed': {
        const userText = (event.transcript as string || '').trim()
        const itemId = event.item_id as string
        if (itemId) trackItemOrder(itemId)
        if (userText) {
          setTranscript((prev) => sortByItemOrder([...prev, { role: 'user', text: userText, itemId }]))
          fullTranscriptRef.current += `Rep: ${userText}\n`
        }
        break
      }

      // Assistant audio transcript delta — AI is speaking
      case 'response.audio_transcript.delta': {
        const delta = event.delta as string || ''
        currentAssistantTextRef.current += delta
        const itemId = event.item_id as string
        if (itemId) trackItemOrder(itemId)
        // Auto-mute mic while AI speaks to prevent echo triggering VAD
        if (streamRef.current && !isMutedRef.current) {
          const track = streamRef.current.getAudioTracks()[0]
          if (track) track.enabled = false
        }
        setIsSpeaking(true)
        break
      }

      // Assistant audio transcript complete — AI stopped speaking
      case 'response.audio_transcript.done': {
        const assistantText = (event.transcript as string || currentAssistantTextRef.current).trim()
        const itemId = event.item_id as string
        if (itemId) trackItemOrder(itemId)
        if (assistantText) {
          setTranscript((prev) => sortByItemOrder([...prev, { role: 'assistant', text: assistantText, itemId }]))
          fullTranscriptRef.current += `Assistant: ${assistantText}\n`
        }
        currentAssistantTextRef.current = ''
        setIsSpeaking(false)
        // Re-enable mic after AI finishes (unless user manually muted)
        if (streamRef.current && !isMutedRef.current) {
          const track = streamRef.current.getAudioTracks()[0]
          if (track) track.enabled = true
        }
        break
      }

      // Function call arguments streaming in
      case 'response.function_call_arguments.delta': {
        const delta = event.delta as string || ''
        functionCallArgsRef.current += delta
        break
      }

      // Function call completed — agent wants to save
      case 'response.function_call_arguments.done': {
        const name = event.name as string
        if (name === 'save_capture') {
          // Use event.arguments first, fall back to accumulated deltas
          const argsString = (event.arguments as string) || functionCallArgsRef.current
          functionCallArgsRef.current = ''

          try {
            const args = JSON.parse(argsString) as ExtractedCapture
            // Validate that we actually have insights
            if (!args.insights || args.insights.length === 0) {
              console.warn('save_capture called with no insights, falling back to transcript extraction')
              fallbackExtract()
              return
            }
            setExtractedCapture(args)
            setState('saving')
          } catch (err) {
            console.warn('Failed to parse save_capture args, falling back to transcript extraction:', err)
            fallbackExtract()
          }
        } else {
          functionCallArgsRef.current = ''
        }
        break
      }

      default:
        break
    }
  }, [fallbackExtract, trackItemOrder, sortByItemOrder])

  const toggleMute = useCallback(() => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        isMutedRef.current = !audioTrack.enabled
        setIsMuted(!audioTrack.enabled)
      }
    }
  }, [])

  const stopCapture = useCallback(async () => {
    // If the AI already extracted capture, just clean up (saving state handles it)
    if (extractedCapture) {
      cleanup()
      return
    }

    // If there's transcript content, fallbackExtract handles cleanup + extraction
    if (transcript.length > 0) {
      await fallbackExtract()
    } else {
      cleanup()
      setState('idle')
    }
  }, [cleanup, transcript.length, extractedCapture, fallbackExtract])

  const saveCapture = useCallback(async () => {
    if (!extractedCapture || !selectedAccount) return

    setSaving(true)
    try {
      const res = await fetch('/api/capture/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: accountId,
          account_name: selectedAccount.name,
          summary: extractedCapture.summary,
          insights: extractedCapture.insights,
          tasks: extractedCapture.tasks,
          transcript: fullTranscriptRef.current || null,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to save capture')
      }

      cleanup()
      setState('done')
      toast({ title: 'Capture saved' })
    } catch (error) {
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Failed to save capture',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }, [extractedCapture, selectedAccount, accountId, cleanup])

  const discardCapture = useCallback(() => {
    cleanup()
    setExtractedCapture(null)
    setState('idle')
  }, [cleanup])

  const reset = useCallback(() => {
    setState('idle')
    setTranscript([])
    setExtractedCapture(null)
    setAccountId('')
    fullTranscriptRef.current = ''
  }, [])

  // ─── Idle State ───────────────────────────────────────────
  if (state === 'idle') {
    return (
      <div className="flex flex-col items-center text-center max-w-md mx-auto">
        {/* Account selector */}
        <div className="w-full">
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger>
              <SelectValue placeholder="Select an account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Hero mic icon with subtle glow */}
        <div className="relative flex items-center justify-center mt-16 mb-14">
          {/* Soft glow ring */}
          <div
            className="absolute h-36 w-36 rounded-full bg-amber-100/40"
            style={{ animation: 'pulse-glow 3s ease-in-out infinite' }}
          />
          {/* Static outer ring */}
          <div className="absolute h-28 w-28 rounded-full border border-slate-200/80" />
          {/* Mic circle */}
          <div className="h-20 w-20 rounded-full bg-white border border-slate-200 flex items-center justify-center z-10 shadow-sm">
            <Mic className="h-8 w-8 text-amber-600" />
          </div>
        </div>

        {/* Label + dynamic text */}
        <h3 className="text-lg font-semibold text-slate-900">Post-Meeting Capture</h3>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          {selectedAccount ? (
            <>
              Tap to start a quick voice conversation about your visit with{' '}
              <span className="font-medium text-slate-700">{selectedAccount.name}</span>.
            </>
          ) : (
            'Select an account above to begin capturing field intelligence.'
          )}
        </p>

        {/* CTA button */}
        <Button
          className="w-full mt-10"
          size="lg"
          disabled={!accountId}
          onClick={startCapture}
        >
          <Mic className="h-5 w-5 mr-2" />
          Start Summary
        </Button>
      </div>
    )
  }

  // ─── Connecting State ─────────────────────────────────────
  if (state === 'connecting') {
    return (
      <div className="flex flex-col items-center text-center py-16">
        <div className="relative flex items-center justify-center mb-6">
          <div className="h-20 w-20 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center">
            <Mic className="h-8 w-8 text-amber-600" />
          </div>
          <div className="absolute h-24 w-24 rounded-full border-2 border-amber-400/40 border-t-transparent animate-spin" />
        </div>
        <p className="text-sm text-muted-foreground">Connecting to AI assistant...</p>
      </div>
    )
  }

  // ─── Active State ─────────────────────────────────────────
  if (state === 'active') {
    return (
      <div className="flex flex-col items-center w-full max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between w-full mb-8">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-medium text-slate-700">
              {selectedAccount?.name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={isMuted ? 'default' : 'outline'}
              size="sm"
              onClick={toggleMute}
              className={isMuted ? 'bg-amber-500 hover:bg-amber-600 text-white' : ''}
            >
              {isMuted ? <MicOff className="h-4 w-4 mr-1.5" /> : <Mic className="h-4 w-4 mr-1.5" />}
              {isMuted ? 'Muted' : 'Mute'}
            </Button>
            <Button variant="outline" size="sm" onClick={stopCapture}>
              <MicOff className="h-4 w-4 mr-1.5" />
              End
            </Button>
          </div>
        </div>

        {/* AI Orb — ChatGPT-inspired */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="h-24 w-24 rounded-full bg-gradient-to-br from-amber-400 via-orange-300 to-amber-500 flex items-center justify-center transition-all duration-500"
            style={{
              animation: isSpeaking
                ? 'orb-speak 1.2s ease-in-out infinite'
                : 'orb-breathe 3s ease-in-out infinite',
            }}
          >
            <Mic className="h-8 w-8 text-white" />
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            {isMuted ? 'Muted' : isSpeaking ? 'AI is speaking...' : 'Listening...'}
          </p>
        </div>

        {/* Transcript */}
        <Card className="w-full">
          <CardContent className="p-0">
            <ScrollArea className="h-[50vh] min-h-[320px] p-4" ref={scrollRef}>
              {transcript.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">
                  Start speaking about your observation.
                </p>
              ) : (
                <div className="space-y-3 px-1">
                  {transcript.map((entry, i) => (
                    <div
                      key={i}
                      className={`flex ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                          entry.role === 'user'
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-900'
                        }`}
                      >
                        {entry.text}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ─── Extracting State ────────────────────────────────────
  if (state === 'extracting') {
    return (
      <div className="flex flex-col items-center text-center py-16">
        <div className="relative flex items-center justify-center mb-6">
          <div className="h-20 w-20 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-amber-600 animate-spin" />
          </div>
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-1">Processing Conversation</h3>
        <p className="text-sm text-muted-foreground">
          Extracting insights and tasks from your conversation...
        </p>
      </div>
    )
  }

  // ─── Saving State ─────────────────────────────────────────
  if (state === 'saving' && extractedCapture) {
    // Group insights by type
    const insightsByType = extractedCapture.insights.reduce<Record<string, ExtractedInsightItem[]>>(
      (acc, item) => {
        const key = item.type
        if (!acc[key]) acc[key] = []
        acc[key].push(item)
        return acc
      },
      {}
    )

    return (
      <Card className="w-full max-w-lg mx-auto">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Review Capture</CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="pt-4 space-y-5">
          {/* Summary */}
          {extractedCapture.summary && (
            <p className="text-sm leading-relaxed text-slate-700">
              {extractedCapture.summary}
            </p>
          )}

          {/* Insights grouped by category */}
          {Object.entries(insightsByType).map(([type, items]) => {
            const config = insightTypeConfig[type] || insightTypeConfig.demand
            return (
              <div key={type}>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={config.className}>{config.label}</Badge>
                </div>
                <ul className="space-y-1 pl-4">
                  {items.map((item, i) => (
                    <li key={i} className="text-sm text-slate-700 list-disc">
                      {item.description}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}

          {/* Tasks */}
          {extractedCapture.tasks.length > 0 && (
            <>
              <Separator />
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                  Follow-up Tasks
                </Label>
                <div className="mt-2 space-y-2">
                  {extractedCapture.tasks.map((task, i) => {
                    const pConfig = priorityConfig[task.priority] || priorityConfig.medium
                    return (
                      <div key={i} className="flex items-start gap-2">
                        <div className="h-4 w-4 rounded-sm border border-slate-300 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">{task.task}</p>
                          <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 mt-1 ${pConfig.className}`}>
                            {pConfig.label}
                          </Badge>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={saveCapture} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Save Capture
                </>
              )}
            </Button>
            <Button variant="outline" onClick={discardCapture} disabled={saving}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ─── Done State ───────────────────────────────────────────
  return (
    <div className="flex flex-col items-center text-center py-12">
      <CheckCircle2 className="h-14 w-14 text-emerald-500 mb-4" />
      <h3 className="text-lg font-semibold text-slate-900 mb-1">Capture Saved</h3>
      <p className="text-sm text-muted-foreground mb-6">
        Your field intelligence and follow-up tasks have been saved.
      </p>
      <Button onClick={reset}>
        <RotateCcw className="h-4 w-4 mr-2" />
        Capture Another
      </Button>
    </div>
  )
}
