'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Badge,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  Textarea,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@kosha/ui'
import { cn } from '@/lib/utils'
import {
  Mic,
  MicOff,
  Loader2,
  CheckCircle2,
  X,
  RotateCcw,
  Trash2,
  Pencil,
  Menu,
  User,
  Send,
  Square,
  Search,
  Check,
  ChevronDown,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from '@/hooks/use-toast'
import { ConversationList } from '@/components/conversation-list'
import type { Account } from '@kosha/types'
import type { Capture } from '@kosha/types'

// ─── Types ──────────────────────────────────────────────────

type AgentState = 'idle' | 'connecting' | 'active' | 'extracting' | 'saving' | 'done'
type CaptureMode = 'voice' | 'text'

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
  captures?: Capture[]
}

// ─── Config ─────────────────────────────────────────────────

const insightTypeConfig: Record<string, { label: string; className: string }> = {
  demand: { label: 'Demand', className: 'bg-purple-100 text-purple-700' },
  competitive: { label: 'Competitive', className: 'bg-red-100 text-red-700' },
  friction: { label: 'Friction', className: 'bg-amber-100 text-amber-700' },
  expansion: { label: 'Expansion', className: 'bg-emerald-100 text-emerald-700' },
  relationship: { label: 'Relationship', className: 'bg-blue-100 text-blue-700' },
  promotion: { label: 'Promotion', className: 'bg-pink-100 text-pink-700' },
}

const priorityConfig: Record<string, { label: string; className: string }> = {
  high: { label: 'High', className: 'bg-red-100 text-red-700' },
  medium: { label: 'Medium', className: 'bg-amber-100 text-amber-700' },
  low: { label: 'Low', className: 'bg-slate-100 text-stone-600' },
}

// ─── Component ──────────────────────────────────────────────

export function VoiceAgent({ accounts, captures = [] }: VoiceAgentProps) {
  const searchParams = useSearchParams()
  const [state, setState] = useState<AgentState>('idle')
  const [accountId, setAccountId] = useState('')
  const [accountSearch, setAccountSearch] = useState('')
  const [accountPopoverOpen, setAccountPopoverOpen] = useState(false)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [extractedCapture, setExtractedCapture] = useState<ExtractedCapture | null>(null)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [textInput, setTextInput] = useState('')
  const [conversationsOpen, setConversationsOpen] = useState(false)
  const [captureMode, setCaptureMode] = useState<CaptureMode>('voice')
  const [textSending, setTextSending] = useState(false)
  const chatHistoryRef = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([])

  // Pre-select account from URL param (e.g. /capture?accountId=xxx)
  useEffect(() => {
    const urlAccountId = searchParams.get('accountId')
    if (urlAccountId && accounts.some((a) => a.id === urlAccountId)) {
      setAccountId(urlAccountId)
    }
  }, [searchParams, accounts])

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

  // Auto-scroll transcript
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: 'smooth',
        })
      }
    })
    return () => cancelAnimationFrame(raf)
  }, [transcript, isSpeaking, textSending])

  // ─── Core Logic (unchanged) ───────────────────────────────

  const cleanup = useCallback(() => {
    if (dcRef.current) { dcRef.current.close(); dcRef.current = null }
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null }
    if (audioRef.current) { audioRef.current.srcObject = null; audioRef.current = null }
  }, [])

  const fallbackExtract = useCallback(async () => {
    cleanup()
    const transcriptText = fullTranscriptRef.current.trim()
    if (!transcriptText) { setState('idle'); return }

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
        toast({ title: 'Capture ended', description: 'No insights could be extracted.' })
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
      case 'conversation.item.created': {
        const item = event.item as Record<string, unknown> | undefined
        const itemId = item?.id as string
        if (itemId) trackItemOrder(itemId)
        break
      }
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
      case 'response.audio_transcript.delta': {
        const delta = event.delta as string || ''
        currentAssistantTextRef.current += delta
        const itemId = event.item_id as string
        if (itemId) trackItemOrder(itemId)
        setIsSpeaking(true)
        break
      }
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
        break
      }
      case 'response.function_call_arguments.delta': {
        const delta = event.delta as string || ''
        functionCallArgsRef.current += delta
        break
      }
      case 'response.function_call_arguments.done': {
        const name = event.name as string
        if (name === 'save_capture') {
          const argsString = (event.arguments as string) || functionCallArgsRef.current
          functionCallArgsRef.current = ''
          try {
            const args = JSON.parse(argsString) as Record<string, unknown>
            const mode = (args.mode as string) || 'debrief'

            if (mode === 'note') {
              // Save notes directly via the save endpoint
              cleanup()
              const notesList = (args.notes as string[]) || []
              if (notesList.length > 0 && accountId) {
                fetch('/api/capture/save', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    account_id: accountId,
                    account_name: selectedAccount?.name || 'Unknown Account',
                    mode: 'note',
                    notes: notesList,
                    transcript: fullTranscriptRef.current || null,
                  }),
                }).catch(console.error)
              }
              setState('done')
              toast({ title: 'Note saved' })
              return
            }

            if (mode === 'prep') {
              cleanup()
              setState('done')
              toast({ title: 'Good luck!' })
              return
            }

            // Default: debrief mode
            const capture = args as unknown as ExtractedCapture
            if (!capture.insights || capture.insights.length === 0) {
              fallbackExtract()
              return
            }
            setExtractedCapture(capture)
            setState('saving')
          } catch {
            fallbackExtract()
          }
        } else {
          functionCallArgsRef.current = ''
        }
        break
      }
    }
  }, [fallbackExtract, trackItemOrder, sortByItemOrder])

  const startCapture = useCallback(async () => {
    setState('connecting')
    setTranscript([])
    setExtractedCapture(null)
    setIsSpeaking(false)
    currentAssistantTextRef.current = ''
    fullTranscriptRef.current = ''
    functionCallArgsRef.current = ''
    itemOrderRef.current = []

    try {
      const sessionRes = await fetch('/api/capture/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: accountId || undefined }),
      })
      if (!sessionRes.ok) {
        const err = await sessionRes.json()
        throw new Error(err.error || 'Failed to create session')
      }
      const { client_secret } = await sessionRes.json()
      if (!client_secret) throw new Error('No client secret returned')

      const pc = new RTCPeerConnection()
      pcRef.current = pc

      const audio = document.createElement('audio')
      audio.autoplay = true
      audioRef.current = audio

      pc.ontrack = (event) => { audio.srcObject = event.streams[0] }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      streamRef.current = stream
      pc.addTrack(stream.getAudioTracks()[0], stream)

      const dc = pc.createDataChannel('oai-events')
      dcRef.current = dc
      dc.onmessage = (e) => {
        try { handleRealtimeEvent(JSON.parse(e.data)) } catch { /* ignore */ }
      }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      const sdpRes = await fetch(
        'https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview',
        {
          method: 'POST',
          body: offer.sdp,
          headers: { Authorization: `Bearer ${client_secret}`, 'Content-Type': 'application/sdp' },
        }
      )
      if (!sdpRes.ok) throw new Error('Failed to connect to voice service')

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
  }, [cleanup, handleRealtimeEvent])

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
    if (extractedCapture) { cleanup(); return }
    if (transcript.length > 0) {
      await fallbackExtract()
    } else {
      cleanup()
      setState('idle')
    }
  }, [cleanup, transcript.length, extractedCapture, fallbackExtract])

  const saveCapture = useCallback(async () => {
    if (!extractedCapture) return

    setSaving(true)
    try {
      const res = await fetch('/api/capture/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: accountId || null,
          account_name: selectedAccount?.name || 'Unknown Account',
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
    setCaptureMode('voice')
    chatHistoryRef.current = []
    setState('idle')
  }, [cleanup])

  const reset = useCallback(() => {
    setState('idle')
    setTranscript([])
    setExtractedCapture(null)
    setAccountId('')
    setCaptureMode('voice')
    fullTranscriptRef.current = ''
    chatHistoryRef.current = []
  }, [])

  const startTextChat = useCallback(async (initialMessage: string) => {
    setCaptureMode('text')
    setState('active')
    setTranscript([])
    setExtractedCapture(null)
    fullTranscriptRef.current = ''
    chatHistoryRef.current = []

    // Add user message
    const userEntry: TranscriptEntry = { role: 'user', text: initialMessage }
    setTranscript([userEntry])
    fullTranscriptRef.current += `Rep: ${initialMessage}\n`
    chatHistoryRef.current.push({ role: 'user', content: initialMessage })

    // Get AI response
    setTextSending(true)
    try {
      const res = await fetch('/api/capture/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: chatHistoryRef.current, accountId: accountId || undefined }),
      })
      if (!res.ok) throw new Error('Failed to get AI response')
      const data = await res.json() as { message: string; isComplete: boolean }

      chatHistoryRef.current.push({ role: 'assistant', content: data.message })
      fullTranscriptRef.current += `Assistant: ${data.message}\n`
      setTranscript((prev) => [...prev, { role: 'assistant', text: data.message }])

      if (data.isComplete) {
        await fallbackExtract()
      }
    } catch (error) {
      console.error('Text chat error:', error)
      toast({
        title: 'Chat error',
        description: 'Failed to get a response. Try again.',
        variant: 'destructive',
      })
    } finally {
      setTextSending(false)
    }
  }, [fallbackExtract])

  const sendTextMessage = useCallback(async (message: string) => {
    if (!message.trim() || textSending) return

    const userEntry: TranscriptEntry = { role: 'user', text: message }
    setTranscript((prev) => [...prev, userEntry])
    fullTranscriptRef.current += `Rep: ${message}\n`
    chatHistoryRef.current.push({ role: 'user', content: message })

    setTextSending(true)
    try {
      const res = await fetch('/api/capture/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: chatHistoryRef.current, accountId: accountId || undefined }),
      })
      if (!res.ok) throw new Error('Failed to get AI response')
      const data = await res.json() as { message: string; isComplete: boolean }

      chatHistoryRef.current.push({ role: 'assistant', content: data.message })
      fullTranscriptRef.current += `Assistant: ${data.message}\n`
      setTranscript((prev) => [...prev, { role: 'assistant', text: data.message }])

      if (data.isComplete) {
        await fallbackExtract()
      }
    } catch (error) {
      console.error('Text chat error:', error)
      toast({
        title: 'Chat error',
        description: 'Failed to get a response. Try again.',
        variant: 'destructive',
      })
    } finally {
      setTextSending(false)
    }
  }, [textSending, fallbackExtract])

  const handleTextSend = useCallback(() => {
    if (!textInput.trim()) return
    const message = textInput.trim()
    setTextInput('')

    if (state === 'idle') {
      startTextChat(message)
    } else if (state === 'active' && captureMode === 'text') {
      sendTextMessage(message)
    }
  }, [textInput, state, captureMode, startTextChat, sendTextMessage])

  // ─── Render ───────────────────────────────────────────────

  return (
    <div className="relative h-[calc(100dvh-3.5rem)] overflow-hidden">
      <AnimatePresence mode="wait">
        {/* ─── Idle State ─────────────────────────────────────── */}
        {state === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center h-full overflow-hidden"
          >
            {/* Top Bar */}
            <div className="flex items-center justify-between w-full px-5 pt-3 shrink-0">
              <button
                className="p-2 -ml-2 rounded-xl hover:bg-stone-100 transition-colors"
                onClick={() => setConversationsOpen(true)}
              >
                <Menu className="h-6 w-6 text-stone-700" />
              </button>

              <Link
                href="/settings"
                className="p-2 -mr-2 rounded-xl hover:bg-stone-100 transition-colors ml-auto"
              >
                <User className="h-6 w-6 text-stone-700" />
              </Link>
            </div>

            {/* Gradient Orb */}
            <div className="flex-1 flex flex-col items-center justify-center -mt-10 min-h-0">
              <button
                onClick={startCapture}
                className="relative group focus:outline-none"
                aria-label="Tap to talk with Kosha"
              >
                <div
                  className="h-40 w-40 rounded-full shadow-lg shadow-orange-200/40 transition-transform duration-200 group-active:scale-95 flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, #b8d8a8 0%, #e8c86a 12%, #f0b86e 28%, #eda06a 55%, #e8946a 72%, #d898c0 86%, #88b4d8 100%)',
                    animation: 'orb-breathe 4s ease-in-out infinite',
                  }}
                />
                <div
                  className="absolute inset-0 h-40 w-40 rounded-full flex items-center justify-center"
                >
                  <img src="/icons/kosha-k.svg" alt="Kosha" className="h-12 w-12 drop-shadow-sm" style={{ filter: 'brightness(0) invert(1) opacity(0.9)' }} />
                </div>
              </button>

              <p className="text-sm text-stone-600 mt-4 font-medium">
                Tap to talk with Kosha
              </p>
            </div>

            {/* Text Input */}
            <div className="w-full px-5 pb-3 shrink-0">
              {accounts.length > 0 && (
                <div className="mb-2 flex justify-center">
                  <Popover open={accountPopoverOpen} onOpenChange={setAccountPopoverOpen}>
                    <PopoverTrigger asChild>
                      <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-stone-600 border border-stone-200 bg-white transition-colors hover:text-stone-700 hover:border-stone-300 active:bg-stone-50 shadow-sm">
                        <span>
                          {selectedAccount?.name || 'Select account'}
                        </span>
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[calc(100vw-2.5rem)] p-0 rounded-2xl border-stone-200 shadow-lg"
                      align="center"
                      sideOffset={8}
                    >
                      <div className="p-3 border-b border-stone-100">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                          <input
                            type="text"
                            placeholder="Search accounts..."
                            value={accountSearch}
                            onChange={(e) => setAccountSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm bg-stone-50 rounded-lg border-0 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-800/10"
                            autoFocus
                          />
                        </div>
                      </div>
                      <div className="max-h-60 overflow-y-auto py-1">
                        <button
                          onClick={() => {
                            setAccountId('')
                            setAccountSearch('')
                            setAccountPopoverOpen(false)
                          }}
                          className={cn(
                            'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                            !accountId ? 'bg-teal-50 text-teal-800' : 'text-stone-600 active:bg-stone-50'
                          )}
                        >
                          <div className="h-4 w-4 flex items-center justify-center">
                            {!accountId && <Check className="h-4 w-4 text-teal-600" />}
                          </div>
                          <span className="font-medium">Auto-detect from conversation</span>
                        </button>
                        {accounts
                          .filter((a) => a.name.toLowerCase().includes(accountSearch.toLowerCase()))
                          .map((account) => (
                            <button
                              key={account.id}
                              onClick={() => {
                                setAccountId(account.id)
                                setAccountSearch('')
                                setAccountPopoverOpen(false)
                              }}
                              className={cn(
                                'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                                accountId === account.id ? 'bg-teal-50 text-teal-800' : 'text-stone-600 active:bg-stone-50'
                              )}
                            >
                              <div className="h-4 w-4 flex items-center justify-center">
                                {accountId === account.id && <Check className="h-4 w-4 text-teal-600" />}
                              </div>
                              <span>{account.name}</span>
                            </button>
                          ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              <div className="relative">
                <input
                  type="text"
                  placeholder="or type your thoughts..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleTextSend()}
                  className="w-full pl-4 pr-12 py-3.5 bg-white rounded-full border border-stone-200 text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-800/10 shadow-sm"
                />
                <button
                  onClick={handleTextSend}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 bg-teal-600 hover:bg-teal-700 text-white rounded-full flex items-center justify-center transition-colors"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── Connecting State ────────────────────────────────── */}
        {state === 'connecting' && (
          <motion.div
            key="connecting"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center min-h-[calc(100dvh-4rem)]"
          >
            <div
              className="h-48 w-48 rounded-full shadow-lg shadow-orange-200/40"
              style={{
                background: 'linear-gradient(135deg, #b8d8a8 0%, #e8c86a 12%, #f0b86e 28%, #eda06a 55%, #e8946a 72%, #d898c0 86%, #88b4d8 100%)',
                animation: 'connecting-glow 1.5s ease-in-out infinite',
              }}
            />
            <p className="text-sm text-stone-500 mt-8 animate-pulse">
              Connecting to Kosha...
            </p>
          </motion.div>
        )}

        {/* ─── Active State ───────────────────────────────────── */}
        {state === 'active' && (
          <motion.div
            key="active"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col min-h-[calc(100dvh-4rem)]"
          >
            {/* Header with small orb */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-full"
                  style={{
                    background: 'linear-gradient(135deg, #b8d8a8 0%, #e8c86a 12%, #f0b86e 28%, #eda06a 55%, #e8946a 72%, #d898c0 86%, #88b4d8 100%)',
                    animation: isSpeaking
                      ? 'orb-speak 1.2s ease-in-out infinite'
                      : 'orb-pulse-small 2s ease-in-out infinite',
                  }}
                />
                <div>
                  <p className="text-sm font-semibold text-stone-800">
                    {selectedAccount?.name || 'Conversation'}
                  </p>
                  <p className="text-xs text-stone-500">
                    {captureMode === 'text'
                      ? (textSending ? 'Kosha is typing...' : 'Text chat')
                      : (isMuted ? 'Muted' : isSpeaking ? 'Kosha is speaking...' : 'Listening...')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {captureMode === 'voice' && (
                  <button
                    onClick={toggleMute}
                    className={`h-9 w-9 rounded-full flex items-center justify-center transition-colors ${
                      isMuted ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-stone-600'
                    }`}
                  >
                    {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </button>
                )}
              </div>
            </div>

            {/* Live indicator */}
            <div className="flex items-center gap-2 px-5 pb-3">
              <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-medium text-red-500 uppercase tracking-wider">Live</span>
            </div>

            {/* Transcript */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-5 pb-24"
            >
              {transcript.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-16">
                  <div className="h-12 w-12 rounded-full bg-stone-100 flex items-center justify-center mb-3">
                    {captureMode === 'text' ? <Send className="h-5 w-5 text-stone-400" /> : <Mic className="h-5 w-5 text-stone-400" />}
                  </div>
                  <p className="text-sm text-stone-400">
                    {captureMode === 'text' ? 'Type about your meeting...' : 'Start speaking about your meeting...'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {transcript.map((entry, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className={`flex ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          entry.role === 'user'
                            ? 'bg-stone-800 text-white rounded-br-md'
                            : 'bg-white text-stone-800 border border-stone-100 rounded-bl-md shadow-sm'
                        }`}
                      >
                        {entry.text}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Bar */}
            {captureMode === 'text' ? (
              <div className="fixed bottom-16 left-0 right-0 px-4 z-20">
                <div className="flex items-center gap-2 max-w-lg mx-auto">
                  <button
                    onClick={stopCapture}
                    className="h-11 w-11 shrink-0 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-red-500/25 active:scale-95 transition-all"
                  >
                    <Square className="h-4 w-4 fill-current" />
                  </button>
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Type a message..."
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleTextSend()}
                      disabled={textSending}
                      className="w-full pl-4 pr-12 py-3 bg-white rounded-full border border-stone-200 text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-800/10 shadow-sm disabled:opacity-50"
                    />
                    <button
                      onClick={handleTextSend}
                      disabled={textSending || !textInput.trim()}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 bg-teal-600 hover:bg-teal-700 text-white rounded-full flex items-center justify-center transition-colors disabled:opacity-50"
                    >
                      {textSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="fixed bottom-16 left-0 right-0 flex justify-center z-20">
                <button
                  onClick={stopCapture}
                  className="h-14 w-14 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-red-500/25 active:scale-95 transition-all"
                >
                  <Square className="h-5 w-5 fill-current" />
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* ─── Extracting State ───────────────────────────────── */}
        {state === 'extracting' && (
          <motion.div
            key="extracting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center min-h-[calc(100dvh-4rem)]"
          >
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-violet-400 via-fuchsia-300 to-orange-300 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-white animate-spin" />
            </div>
            <h3 className="text-lg font-semibold text-stone-800 mt-6 mb-1">Processing</h3>
            <p className="text-sm text-stone-500">
              Extracting insights from your conversation...
            </p>
          </motion.div>
        )}

        {/* ─── Saving / Review State ──────────────────────────── */}
        {state === 'saving' && extractedCapture && (
          <motion.div
            key="saving"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="flex flex-col min-h-[calc(100dvh-4rem)]"
          >
            {/* Review Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h2 className="text-lg font-bold text-stone-800">Review Capture</h2>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className={`p-2 rounded-lg transition-colors ${
                  isEditing ? 'bg-violet-100 text-violet-700' : 'bg-stone-100 text-stone-500'
                }`}
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 pb-32 space-y-5">
              {/* Summary */}
              {isEditing ? (
                <div>
                  <Label className="text-xs text-stone-500 uppercase tracking-wider">Summary</Label>
                  <Textarea
                    value={extractedCapture.summary}
                    onChange={(e) => setExtractedCapture((prev) => prev ? { ...prev, summary: e.target.value } : prev)}
                    className="mt-1.5 text-sm resize-none rounded-xl"
                    rows={3}
                  />
                </div>
              ) : (
                extractedCapture.summary && (
                  <p className="text-sm leading-relaxed text-stone-700 bg-white rounded-xl p-4 border border-stone-100">
                    {extractedCapture.summary}
                  </p>
                )
              )}

              {/* Insights */}
              <div>
                <h3 className="text-xs text-stone-500 uppercase tracking-wider font-semibold mb-3">
                  Insights ({extractedCapture.insights.length})
                </h3>
                <div className="space-y-2">
                  {extractedCapture.insights.map((item, i) => {
                    const config = insightTypeConfig[item.type] || insightTypeConfig.demand
                    return (
                      <div key={i} className="bg-white rounded-xl p-3.5 border border-stone-100">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          {isEditing ? (
                            <Select value={item.type} onValueChange={(v: string) => {
                              setExtractedCapture((prev) => {
                                if (!prev) return prev
                                const insights = [...prev.insights]
                                insights[i] = { ...insights[i], type: v }
                                return { ...prev, insights }
                              })
                            }}>
                              <SelectTrigger className="h-7 w-auto border-0 p-0">
                                <Badge className={config.className}>{config.label}</Badge>
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(insightTypeConfig).map(([key, cfg]) => (
                                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge className={config.className}>{config.label}</Badge>
                          )}
                          {isEditing && (
                            <button
                              onClick={() => setExtractedCapture((prev) => {
                                if (!prev) return prev
                                return { ...prev, insights: prev.insights.filter((_, idx) => idx !== i) }
                              })}
                              className="p-1 text-stone-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        {isEditing ? (
                          <Input
                            value={item.description}
                            onChange={(e) => {
                              setExtractedCapture((prev) => {
                                if (!prev) return prev
                                const insights = [...prev.insights]
                                insights[i] = { ...insights[i], description: e.target.value }
                                return { ...prev, insights }
                              })
                            }}
                            className="text-sm h-8 border-stone-200"
                          />
                        ) : (
                          <p className="text-sm text-stone-700">{item.description}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Tasks */}
              {extractedCapture.tasks.length > 0 && (
                <div>
                  <h3 className="text-xs text-stone-500 uppercase tracking-wider font-semibold mb-3">
                    Follow-ups ({extractedCapture.tasks.length})
                  </h3>
                  <div className="space-y-2">
                    {extractedCapture.tasks.map((task, i) => {
                      const pConfig = priorityConfig[task.priority] || priorityConfig.medium
                      return (
                        <div key={i} className="bg-white rounded-xl p-3.5 border border-stone-100 flex items-start gap-3">
                          <div className="h-5 w-5 rounded border-2 border-stone-300 mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            {isEditing ? (
                              <Input
                                value={task.task}
                                onChange={(e) => {
                                  setExtractedCapture((prev) => {
                                    if (!prev) return prev
                                    const tasks = [...prev.tasks]
                                    tasks[i] = { ...tasks[i], task: e.target.value }
                                    return { ...prev, tasks }
                                  })
                                }}
                                className="text-sm h-8 border-stone-200"
                              />
                            ) : (
                              <p className="text-sm text-stone-700">{task.task}</p>
                            )}
                            <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 mt-1.5 ${pConfig.className}`}>
                              {pConfig.label}
                            </Badge>
                          </div>
                          {isEditing && (
                            <button
                              onClick={() => setExtractedCapture((prev) => {
                                if (!prev) return prev
                                return { ...prev, tasks: prev.tasks.filter((_, idx) => idx !== i) }
                              })}
                              className="p-1 text-stone-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Fixed Bottom Actions */}
            <div className="fixed bottom-16 left-0 right-0 px-5 pb-4 bg-gradient-to-t from-stone-50 via-stone-50 to-transparent pt-6 z-20">
              <div className="flex gap-3 max-w-lg mx-auto">
                <button
                  onClick={saveCapture}
                  disabled={saving || extractedCapture.insights.length === 0}
                  className="flex-1 h-12 bg-[#D97706] hover:bg-[#B45309] text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-all"
                >
                  {saving ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
                  ) : (
                    <><CheckCircle2 className="h-4 w-4" /> Save Capture</>
                  )}
                </button>
                <button
                  onClick={discardCapture}
                  disabled={saving}
                  className="h-12 w-12 bg-white border border-stone-200 rounded-xl flex items-center justify-center text-stone-500 hover:text-red-500 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── Done State ─────────────────────────────────────── */}
        {state === 'done' && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center min-h-[calc(100dvh-4rem)] px-5"
          >
            <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-stone-800 mb-1">Capture Saved</h3>
            <p className="text-sm text-stone-500 mb-8 text-center">
              Your field intelligence and follow-up tasks have been saved.
            </p>
            <button
              onClick={reset}
              className="h-12 px-6 bg-stone-800 text-white rounded-xl font-medium text-sm flex items-center gap-2 active:scale-[0.98] transition-all"
            >
              <RotateCcw className="h-4 w-4" />
              Capture Another
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Conversations Sheet */}
      <Sheet open={conversationsOpen} onOpenChange={setConversationsOpen}>
        <SheetContent side="left" className="w-[78vw] max-w-sm" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <SheetHeader>
            <SheetTitle>Conversations</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <ConversationList captures={captures} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
