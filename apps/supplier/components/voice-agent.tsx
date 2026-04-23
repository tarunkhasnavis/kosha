'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
import { AccountDetail } from '@/components/account-detail'
import { fetchAccountDetails } from '@/lib/territory/actions'
import type { Account, AccountContact, Insight, Task, Visit, Capture } from '@kosha/types'

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
  notes?: string[]
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

// ─── Whisper hallucination filtering ───────────────────────
const WHISPER_HALLUCINATION_PATTERNS = [
  /^thank you( for watching| for listening)?\.?$/i,
  /^(please )?subscribe/i,
  /^(like and )?subscribe/i,
  /^thanks for watching/i,
  /^see you (in the )?next/i,
  /^MBC /,
  /^JTBC /,
]

function isWhisperHallucination(text: string): boolean {
  // Non-Latin script detection (Korean, Chinese, Arabic, Cyrillic, etc.)
  if (/[^\u0000-\u024F\u1E00-\u1EFF\u2000-\u206F\u2190-\u21FF\u2200-\u22FF\u0300-\u036F]/.test(text)) {
    return true
  }
  return WHISPER_HALLUCINATION_PATTERNS.some((p) => p.test(text.trim()))
}

// ─── Farewell detection ────────────────────────────────────
const FAREWELL_PHRASES = ['bye', 'see ya', 'thats it', 'goodbye', 'stop recording', 'thanks kosha', 'okay thank you bye', 'ok thank you bye']

function isFarewell(text: string): boolean {
  const normalized = text.trim().toLowerCase().replace(/[.,!?']/g, '')
  return FAREWELL_PHRASES.some((phrase) => normalized.includes(phrase))
}

// ─── Component ──────────────────────────────────────────────

export function VoiceAgent({ accounts, captures = [] }: VoiceAgentProps) {
  const router = useRouter()
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
  const isSpeakingRef = useRef(false)
  const [isMuted, setIsMuted] = useState(false)
  const [textInput, setTextInput] = useState('')
  const [textFocused, setTextFocused] = useState(false)
  const idleInputRef = useRef<HTMLInputElement>(null)
  const activeInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // User geolocation for live discovery
  const userLocationRef = useRef<{ lat: number; lng: number } | null>(null)
  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userLocationRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      },
      () => { /* permission denied — will fall back to default */ },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  // iOS PWA keyboard-aware layout:
  // Track visualViewport height AND offsetTop to position the container
  // exactly over the visible area, even when iOS scrolls behind the keyboard.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    function update() {
      if (!vv || !containerRef.current) return
      containerRef.current.style.height = `${vv.height}px`
      containerRef.current.style.top = `${vv.offsetTop}px`
    }

    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])
  const [conversationsOpen, setConversationsOpen] = useState(false)
  const [doneAccountSheetOpen, setDoneAccountSheetOpen] = useState(false)
  const [doneAccountDetails, setDoneAccountDetails] = useState<{
    insights: Insight[]
    tasks: Task[]
    visits: Visit[]
    captures: Capture[]
    contacts: AccountContact[]
  } | null>(null)
  const [doneAccountLoading, setDoneAccountLoading] = useState(false)
  const [captureMode, setCaptureMode] = useState<CaptureMode>('voice')
  const [textSending, setTextSending] = useState(false)
  const chatHistoryRef = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([])

  // Focus the active text input when entering text mode or after sending
  useEffect(() => {
    if (state === 'active' && captureMode === 'text' && !textSending && activeInputRef.current) {
      const timer = setTimeout(() => {
        activeInputRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [state, captureMode, textSending])

  // Pre-select account from URL param (e.g. /capture?accountId=xxx)
  useEffect(() => {
    const urlAccountId = searchParams.get('accountId')
    if (urlAccountId && accounts.some((a) => a.id === urlAccountId)) {
      setAccountId(urlAccountId)
    }
  }, [searchParams, accounts])

  // Pre-warm: fetch ephemeral token on mount so startCapture is faster
  const prewarmedRef = useRef<{ client_secret: string; timestamp: number } | null>(null)
  useEffect(() => {
    let cancelled = false
    const prewarm = async () => {
      try {
        const res = await fetch('/api/capture/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId: accountId || undefined }),
        })
        if (!res.ok || cancelled) return
        const { client_secret } = await res.json()
        if (client_secret && !cancelled) {
          prewarmedRef.current = { client_secret, timestamp: Date.now() }
        }
      } catch { /* ignore pre-warm failures */ }
    }
    prewarm()
    return () => { cancelled = true }
  }, [accountId])

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const currentAssistantTextRef = useRef('')
  const fullTranscriptRef = useRef('')
  const functionCallArgsRef = useRef('')
  const isMutedRef = useRef(false)
  const itemOrderRef = useRef<string[]>([])

  const selectedAccount = accounts.find((a) => a.id === accountId)

  // Auto-detect account from user message text
  const tryAutoDetectAccount = useCallback((message: string) => {
    if (accountId) return // Already selected

    const msgLower = message.toLowerCase()
    // Find the best match — longest name that appears in the message
    const match = accounts
      .filter((a) => msgLower.includes(a.name.toLowerCase()))
      .sort((a, b) => b.name.length - a.name.length)[0]

    if (match) {
      setAccountId(match.id)
      toast({ title: `Account linked`, description: match.name })
    }
  }, [accountId, accounts])

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
    if (wakeLockRef.current) { wakeLockRef.current.release().catch(() => {}); wakeLockRef.current = null }
  }, [])

  const reset = useCallback(() => {
    setState('idle')
    setTranscript([])
    setExtractedCapture(null)
    setAccountId('')
    setCaptureMode('voice')
        fullTranscriptRef.current = ''
    chatHistoryRef.current = []
  }, [])

  const transcriptRef = useRef<TranscriptEntry[]>([])
  transcriptRef.current = transcript

  const buildSortedTranscript = useCallback(() => {
    const order = itemOrderRef.current
    const sorted = [...transcriptRef.current].sort((a, b) => {
      const aIdx = a.itemId ? order.indexOf(a.itemId) : -1
      const bIdx = b.itemId ? order.indexOf(b.itemId) : -1
      if (aIdx === -1 || bIdx === -1) return 0
      return aIdx - bIdx
    })
    return sorted.map((e) => `${e.role === 'user' ? 'Rep' : 'Assistant'}: ${e.text}`).join('\n')
  }, [])

  const fallbackExtract = useCallback(async () => {
    cleanup()
    const transcriptText = buildSortedTranscript()
    const extractAccountId = accountId || null
    const extractAccountName = selectedAccount?.name || 'Field Notes'

    // Always save transcript for conversation history (if there's content)
    if (transcriptText) {
      try {
        await fetch('/api/capture/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            account_id: extractAccountId,
            account_name: extractAccountName,
            mode: 'debrief',
            transcript: transcriptText,
          }),
        })
      } catch (err) {
        console.error('Failed to save transcript:', err)
      }
    }

    // Attempt extraction if enough content
    const wordCount = transcriptText.split(/\s+/).length
    if (!transcriptText || wordCount < 15) {
      router.refresh()
      reset()
      if (transcriptText) {
        toast({ title: 'Conversation saved', description: 'Too short to extract insights.' })
      }
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
        reset()
        toast({ title: 'Conversation saved' })
      }
    } catch (error) {
      console.error('Fallback extraction failed:', error)
      reset()
      toast({
        title: 'Extraction failed',
        description: error instanceof Error ? error.message : 'Could not process the conversation.',
        variant: 'destructive',
      })
    }
  }, [cleanup, accountId, selectedAccount, router, reset, buildSortedTranscript])

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
          // Drop transcriptions that arrived while the agent was speaking — likely echo
          if (isSpeakingRef.current) {
            break
          }
          // Filter Whisper hallucinations (non-Latin text, known false patterns)
          if (isWhisperHallucination(userText)) {
            break
          }
          // Client-side noise filter: skip single-word transcriptions (likely ambient noise)
          // unless it's a farewell phrase which should always be processed
          const wordCount = userText.split(/\s+/).length
          if (wordCount <= 1 && !isFarewell(userText)) {
            break // Skip noise — don't add to transcript or context
          }
          setTranscript((prev) => sortByItemOrder([...prev, { role: 'user', text: userText, itemId }]))
          fullTranscriptRef.current += `Rep: ${userText}\n`
          // Explicit farewell phrase ends the voice conversation
          if (isFarewell(userText)) {
            stopCapture()
          }
        }
        break
      }
      case 'response.audio_transcript.delta': {
        const delta = event.delta as string || ''
        currentAssistantTextRef.current += delta
        const itemId = event.item_id as string
        if (itemId) trackItemOrder(itemId)
        isSpeakingRef.current = true
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
        isSpeakingRef.current = false
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
        const callId = event.call_id as string
        if (name === 'save_capture') {
          const argsString = (event.arguments as string) || functionCallArgsRef.current
          functionCallArgsRef.current = ''
          try {
            const args = JSON.parse(argsString) as Record<string, unknown>
            const mode = (args.mode as string) || 'debrief'

            if (mode === 'note') {
              // Note: collect all notes, show review screen for confirmation
              
              cleanup()
              const notesList = (args.notes as string[]) || []
              setExtractedCapture({
                summary: '',
                insights: [],
                tasks: [],
                notes: notesList,
              })
              setState('saving')
              return
            }

            if (mode === 'prep') {
              // Prep: save transcript for history, go straight to home
              
              cleanup()
              // Save transcript silently for conversation history
              const sortedTranscript = buildSortedTranscript()
              if (sortedTranscript && accountId) {
                fetch('/api/capture/save', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    account_id: accountId || null,
                    account_name: selectedAccount?.name || 'Unknown Account',
                    mode: 'prep',
                    transcript: sortedTranscript,
                  }),
                }).catch(console.error)
              }
              toast({ title: 'Good luck!' })
              router.refresh()
              // Go straight to home — no done screen
              reset()
              return
            }

            // Debrief mode: show review screen with insights/tasks
            
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
        } else if (name === 'set_active_account') {
          // Resolve account name to ID and update client state
          const argsString = (event.arguments as string) || functionCallArgsRef.current
          functionCallArgsRef.current = ''
          try {
            const args = JSON.parse(argsString)
            fetch('/api/capture/tools/set-active-account', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(args),
            })
              .then((res) => res.json())
              .then((data) => {
                const dc = dcRef.current
                if (!dc || dc.readyState !== 'open') return
                if (data.success) {
                  setAccountId(data.account_id)
                  // Update selectedAccount reference for display
                  const matched = accounts.find((a) => a.id === data.account_id)
                  if (matched) {
                    setAccountId(data.account_id)
                  }
                }
                dc.send(JSON.stringify({
                  type: 'conversation.item.create',
                  item: {
                    type: 'function_call_output',
                    call_id: callId,
                    output: JSON.stringify(data),
                  },
                }))
                dc.send(JSON.stringify({ type: 'response.create' }))
              })
              .catch(() => {
                const dc = dcRef.current
                if (!dc || dc.readyState !== 'open') return
                dc.send(JSON.stringify({
                  type: 'conversation.item.create',
                  item: {
                    type: 'function_call_output',
                    call_id: callId,
                    output: JSON.stringify({ error: 'Failed to resolve account' }),
                  },
                }))
                dc.send(JSON.stringify({ type: 'response.create' }))
              })
          } catch {
            functionCallArgsRef.current = ''
          }
        } else if (name === 'manage_visits' || name === 'schedule_visit') {
          // Unified visit management (schedule/delete/move) or legacy schedule_visit
          const argsString = (event.arguments as string) || functionCallArgsRef.current
          functionCallArgsRef.current = ''
          try {
            const args = JSON.parse(argsString)
            // Support legacy schedule_visit tool name
            const payload = name === 'schedule_visit'
              ? { ...args, action: 'schedule' }
              : args
            fetch('/api/capture/tools/manage-visits', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            })
              .then((res) => res.json())
              .then((data) => {
                const dc = dcRef.current
                if (!dc || dc.readyState !== 'open') return
                dc.send(JSON.stringify({
                  type: 'conversation.item.create',
                  item: {
                    type: 'function_call_output',
                    call_id: callId,
                    output: JSON.stringify(data),
                  },
                }))
                dc.send(JSON.stringify({ type: 'response.create' }))
                if (data.success) {
                  const actionLabel = data.action === 'deleted' ? 'Visit removed' : data.action === 'moved' ? 'Visit moved' : 'Visit scheduled'
                  toast({ title: actionLabel, description: data.message })
                  router.refresh()
                }
              })
              .catch(() => {
                const dc = dcRef.current
                if (!dc || dc.readyState !== 'open') return
                dc.send(JSON.stringify({
                  type: 'conversation.item.create',
                  item: { type: 'function_call_output', call_id: callId, output: JSON.stringify({ error: 'Failed to manage visit' }) },
                }))
                dc.send(JSON.stringify({ type: 'response.create' }))
              })
          } catch {
            functionCallArgsRef.current = ''
          }
        } else if (name === 'manage_account') {
          // Account create/delete/claim
          const argsString = (event.arguments as string) || functionCallArgsRef.current
          functionCallArgsRef.current = ''
          try {
            const args = JSON.parse(argsString)
            fetch('/api/capture/tools/manage-account', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(args),
            })
              .then((res) => res.json())
              .then((data) => {
                const dc = dcRef.current
                if (!dc || dc.readyState !== 'open') return
                dc.send(JSON.stringify({
                  type: 'conversation.item.create',
                  item: { type: 'function_call_output', call_id: callId, output: JSON.stringify(data) },
                }))
                dc.send(JSON.stringify({ type: 'response.create' }))
                if (data.success) {
                  const label = data.action === 'created' ? 'Account created' : data.action === 'claimed' ? 'Account added' : 'Account deleted'
                  toast({ title: label, description: data.message })
                  router.refresh()
                }
              })
              .catch(() => {
                const dc = dcRef.current
                if (!dc || dc.readyState !== 'open') return
                dc.send(JSON.stringify({
                  type: 'conversation.item.create',
                  item: { type: 'function_call_output', call_id: callId, output: JSON.stringify({ error: 'Failed to manage account' }) },
                }))
                dc.send(JSON.stringify({ type: 'response.create' }))
              })
          } catch {
            functionCallArgsRef.current = ''
          }
        } else if (name === 'manage_task') {
          // Task create/update/delete/complete
          const argsString = (event.arguments as string) || functionCallArgsRef.current
          functionCallArgsRef.current = ''
          try {
            const args = JSON.parse(argsString)
            fetch('/api/capture/tools/manage-task', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(args),
            })
              .then((res) => res.json())
              .then((data) => {
                const dc = dcRef.current
                if (!dc || dc.readyState !== 'open') return
                dc.send(JSON.stringify({
                  type: 'conversation.item.create',
                  item: { type: 'function_call_output', call_id: callId, output: JSON.stringify(data) },
                }))
                dc.send(JSON.stringify({ type: 'response.create' }))
                if (data.success) {
                  const label = data.action === 'created' ? 'Task created' : data.action === 'completed' ? 'Task completed' : data.action === 'deleted' ? 'Task deleted' : 'Task updated'
                  toast({ title: label, description: data.message })
                  router.refresh()
                }
              })
              .catch(() => {
                const dc = dcRef.current
                if (!dc || dc.readyState !== 'open') return
                dc.send(JSON.stringify({
                  type: 'conversation.item.create',
                  item: { type: 'function_call_output', call_id: callId, output: JSON.stringify({ error: 'Failed to manage task' }) },
                }))
                dc.send(JSON.stringify({ type: 'response.create' }))
              })
          } catch {
            functionCallArgsRef.current = ''
          }
        } else if (name === 'manage_notes') {
          // Note add/update/delete
          const argsString = (event.arguments as string) || functionCallArgsRef.current
          functionCallArgsRef.current = ''
          try {
            const args = JSON.parse(argsString)
            fetch('/api/capture/tools/manage-notes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(args),
            })
              .then((res) => res.json())
              .then((data) => {
                const dc = dcRef.current
                if (!dc || dc.readyState !== 'open') return
                dc.send(JSON.stringify({
                  type: 'conversation.item.create',
                  item: { type: 'function_call_output', call_id: callId, output: JSON.stringify(data) },
                }))
                dc.send(JSON.stringify({ type: 'response.create' }))
                if (data.success) {
                  toast({ title: 'Note ' + data.action, description: data.message })
                }
              })
              .catch(() => {
                const dc = dcRef.current
                if (!dc || dc.readyState !== 'open') return
                dc.send(JSON.stringify({
                  type: 'conversation.item.create',
                  item: { type: 'function_call_output', call_id: callId, output: JSON.stringify({ error: 'Failed to manage note' }) },
                }))
                dc.send(JSON.stringify({ type: 'response.create' }))
              })
          } catch {
            functionCallArgsRef.current = ''
          }
        } else if (name === 'manage_contacts') {
          // Contact add/update/delete
          const argsString = (event.arguments as string) || functionCallArgsRef.current
          functionCallArgsRef.current = ''
          try {
            const args = JSON.parse(argsString)
            fetch('/api/capture/tools/manage-contacts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(args),
            })
              .then((res) => res.json())
              .then((data) => {
                const dc = dcRef.current
                if (!dc || dc.readyState !== 'open') return
                dc.send(JSON.stringify({
                  type: 'conversation.item.create',
                  item: { type: 'function_call_output', call_id: callId, output: JSON.stringify(data) },
                }))
                dc.send(JSON.stringify({ type: 'response.create' }))
                if (data.success) {
                  toast({ title: 'Contact ' + data.action, description: data.message })
                }
              })
              .catch(() => {
                const dc = dcRef.current
                if (!dc || dc.readyState !== 'open') return
                dc.send(JSON.stringify({
                  type: 'conversation.item.create',
                  item: { type: 'function_call_output', call_id: callId, output: JSON.stringify({ error: 'Failed to manage contact' }) },
                }))
                dc.send(JSON.stringify({ type: 'response.create' }))
              })
          } catch {
            functionCallArgsRef.current = ''
          }
        } else if (name === 'search_discovery_accounts') {
          // Live discovery — search Google Places near user's location
          const argsString = (event.arguments as string) || functionCallArgsRef.current
          functionCallArgsRef.current = ''
          try {
            const args = JSON.parse(argsString)
            const loc = userLocationRef.current
            const params = new URLSearchParams()
            if (args.category) params.set('category', args.category)
            if (loc) {
              params.set('lat', String(loc.lat))
              params.set('lng', String(loc.lng))
            } else {
              // Fallback — use a default location
              params.set('lat', '34.2198')
              params.set('lng', '-84.1287')
            }
            fetch(`/api/discovery/live?${params}`)
              .then((res) => res.json())
              .then((data) => {
                const dc = dcRef.current
                if (!dc || dc.readyState !== 'open') return
                // Slim down for the LLM — only send what it needs to speak about
                const slimAccounts = (data.accounts || []).slice(0, args.limit || 10).map((a: { name: string; address: string; category: string; ai_score: number; ai_reasons: string[]; google_rating: number | null; phone: string | null; website: string | null }) => ({
                  name: a.name,
                  address: a.address,
                  category: a.category,
                  ai_score: a.ai_score,
                  ai_reasons: a.ai_reasons,
                  google_rating: a.google_rating,
                  phone: a.phone,
                  website: a.website,
                }))
                dc.send(JSON.stringify({
                  type: 'conversation.item.create',
                  item: { type: 'function_call_output', call_id: callId, output: JSON.stringify({ accounts: slimAccounts }) },
                }))
                dc.send(JSON.stringify({ type: 'response.create' }))
              })
              .catch(() => {
                const dc = dcRef.current
                if (!dc || dc.readyState !== 'open') return
                dc.send(JSON.stringify({
                  type: 'conversation.item.create',
                  item: { type: 'function_call_output', call_id: callId, output: JSON.stringify({ error: 'Failed to search for prospects' }) },
                }))
                dc.send(JSON.stringify({ type: 'response.create' }))
              })
          } catch {
            functionCallArgsRef.current = ''
          }
        } else if (name === 'get_account_details' || name === 'get_route_info') {
          // Read-only lookup tools — fetch data and send result back to the model
          const argsString = (event.arguments as string) || functionCallArgsRef.current
          functionCallArgsRef.current = ''
          const endpointMap: Record<string, string> = {
            get_account_details: '/api/capture/tools/account-details',
            get_route_info: '/api/capture/tools/route-info',
          }
          const endpoint = endpointMap[name]
          try {
            const args = JSON.parse(argsString)
            fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(args),
            })
              .then((res) => res.json())
              .then((data) => {
                const dc = dcRef.current
                if (!dc || dc.readyState !== 'open') return
                dc.send(JSON.stringify({
                  type: 'conversation.item.create',
                  item: { type: 'function_call_output', call_id: callId, output: JSON.stringify(data) },
                }))
                dc.send(JSON.stringify({ type: 'response.create' }))
              })
              .catch(() => {
                const dc = dcRef.current
                if (!dc || dc.readyState !== 'open') return
                dc.send(JSON.stringify({
                  type: 'conversation.item.create',
                  item: { type: 'function_call_output', call_id: callId, output: JSON.stringify({ error: 'Failed to fetch data' }) },
                }))
                dc.send(JSON.stringify({ type: 'response.create' }))
              })
          } catch {
            functionCallArgsRef.current = ''
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
    isSpeakingRef.current = false
    setIsSpeaking(false)
    currentAssistantTextRef.current = ''
    fullTranscriptRef.current = ''
    functionCallArgsRef.current = ''
    itemOrderRef.current = []

    try {
      // Use pre-warmed token if fresh (<45s old), otherwise fetch on demand
      let client_secret: string | undefined
      const prewarmed = prewarmedRef.current
      if (prewarmed && Date.now() - prewarmed.timestamp < 45_000) {
        client_secret = prewarmed.client_secret
        prewarmedRef.current = null
      } else {
        const sessionRes = await fetch('/api/capture/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId: accountId || undefined }),
        })
        if (!sessionRes.ok) {
          const err = await sessionRes.json()
          throw new Error(err.error || 'Failed to create session')
        }
        const data = await sessionRes.json()
        client_secret = data.client_secret
      }
      if (!client_secret) throw new Error('No client secret returned')

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      })
      pcRef.current = pc

      // Monitor connection health — log drops instead of silently dying
      pc.oniceconnectionstatechange = () => {
        const iceState = pc.iceConnectionState
        console.log('[voice] ICE connection state:', iceState)
        if (iceState === 'disconnected') {
          // Transient drop (common on mobile) — wait for recovery
          console.warn('[voice] ICE disconnected — waiting for recovery...')
        } else if (iceState === 'failed') {
          console.error('[voice] ICE connection failed — ending session')
          if (fullTranscriptRef.current.trim()) {
            fallbackExtract()
          } else {
            cleanup()
            setState('idle')
          }
        }
      }

      const audio = document.createElement('audio')
      audio.autoplay = true
      audioRef.current = audio

      pc.ontrack = (event) => { audio.srcObject = event.streams[0] }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone access requires HTTPS. Please use text chat instead, or open via localhost.')
      }
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
      dc.onopen = () => {
        // Agent stays silent — no greeting, no beep, no response.create
        // The agent only speaks after the rep speaks first
      }
      dc.onclose = () => {
        // Connection closed (AI ended session or network drop) — save transcript
        if (state === 'active' && fullTranscriptRef.current.trim()) {
          fallbackExtract()
        }
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

      // Keep screen awake during voice session
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request('screen')
        }
      } catch { /* wake lock not supported or denied — non-critical */ }

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
    // Save if there's any transcript content (check ref, not state — state may lag)
    if (transcript.length > 0 || fullTranscriptRef.current.trim()) {
      await fallbackExtract()
    } else {
      // Truly empty session — go back to idle
      cleanup()
      setTranscript([])
      fullTranscriptRef.current = ''
      chatHistoryRef.current = []
      setState('idle')
    }
  }, [cleanup, transcript.length, captureMode, extractedCapture, fallbackExtract])

  const saveCapture = useCallback(async () => {
    if (!extractedCapture) return

    setSaving(true)
    try {
      const res = await fetch('/api/capture/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: accountId || null,
          account_name: selectedAccount?.name || 'Field Notes',
          mode: 'debrief',
          summary: extractedCapture.summary,
          insights: extractedCapture.insights,
          tasks: extractedCapture.tasks,
          notes: extractedCapture.notes,
          transcript: buildSortedTranscript() || fullTranscriptRef.current || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to save capture')
      }
      cleanup()
      setState('done')
      toast({ title: 'Capture saved' })
      router.refresh() // Refresh to update recent conversations list
    } catch (error) {
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Failed to save capture',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }, [extractedCapture, selectedAccount, accountId, cleanup, router])

  const discardCapture = useCallback(() => {
    cleanup()
    setExtractedCapture(null)
    setCaptureMode('voice')
        chatHistoryRef.current = []
    setState('idle')
  }, [cleanup])


  const startTextChat = useCallback(async (initialMessage: string) => {
    tryAutoDetectAccount(initialMessage)
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
      const data = await res.json() as { message: string; isComplete: boolean; scheduledVisit?: { account_name: string; visit_date: string } }

      chatHistoryRef.current.push({ role: 'assistant', content: data.message })
      fullTranscriptRef.current += `Assistant: ${data.message}\n`
      setTranscript((prev) => [...prev, { role: 'assistant', text: data.message }])

      if (data.scheduledVisit) {
        toast({
          title: 'Visit scheduled',
          description: `${data.scheduledVisit.account_name} on ${new Date(data.scheduledVisit.visit_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`,
        })
        router.refresh()
      }

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
  }, [fallbackExtract, accountId, router, tryAutoDetectAccount])

  const sendTextMessage = useCallback(async (message: string) => {
    if (!message.trim() || textSending) return
    tryAutoDetectAccount(message)

    const userEntry: TranscriptEntry = { role: 'user', text: message }
    setTranscript((prev) => [...prev, userEntry])
    fullTranscriptRef.current += `Rep: ${message}\n`
    chatHistoryRef.current.push({ role: 'user', content: message })

    // Explicit farewell phrase ends the conversation
    if (isFarewell(message)) {
      await fallbackExtract()
      return
    }

    setTextSending(true)
    try {
      const res = await fetch('/api/capture/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: chatHistoryRef.current, accountId: accountId || undefined }),
      })
      if (!res.ok) throw new Error('Failed to get AI response')
      const data = await res.json() as { message: string; isComplete: boolean; scheduledVisit?: { account_name: string; visit_date: string } }

      chatHistoryRef.current.push({ role: 'assistant', content: data.message })
      fullTranscriptRef.current += `Assistant: ${data.message}\n`
      setTranscript((prev) => [...prev, { role: 'assistant', text: data.message }])

      if (data.scheduledVisit) {
        toast({
          title: 'Visit scheduled',
          description: `${data.scheduledVisit.account_name} on ${new Date(data.scheduledVisit.visit_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`,
        })
        router.refresh()
      }

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
  }, [textSending, fallbackExtract, accountId, router, tryAutoDetectAccount])

  const handleTextSend = useCallback(() => {
    if (!textInput.trim()) return
    const message = textInput.trim()
    setTextInput('')

    if (state === 'active' && captureMode === 'text') {
      // If no messages yet (just transitioned from idle), use startTextChat for first message
      if (chatHistoryRef.current.length === 0) {
        startTextChat(message)
      } else {
        sendTextMessage(message)
      }
    } else if (state === 'idle') {
      startTextChat(message)
    }
  }, [textInput, state, captureMode, startTextChat, sendTextMessage])

  // ─── Render ───────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className={`fixed top-0 left-0 right-0 overflow-hidden bg-stone-50 ${state === 'idle' ? 'z-30' : 'z-50'}`}
      style={{ height: '100dvh' }}
    >
      <AnimatePresence mode="popLayout">
        {/* ─── Idle State ─────────────────────────────────────── */}
        {state === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.05 }}
            className={`flex flex-col items-center h-full overflow-hidden ${textFocused ? 'pb-1' : 'pb-24'}`}
          >
            {/* Top Bar */}
            <div className="flex items-center justify-between w-full px-5 shrink-0 pt-14">
              {textFocused ? (
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-full shrink-0"
                    style={{
                      background: 'linear-gradient(135deg, #b8d8a8 0%, #e8c86a 12%, #f0b86e 28%, #eda06a 55%, #e8946a 72%, #d898c0 86%, #88b4d8 100%)',
                    }}
                  />
                  <div>
                    <p className="text-sm font-semibold text-stone-800">
                      {selectedAccount?.name || 'Conversation'}
                    </p>
                    {selectedAccount && (true) ? (
                      <div className="inline-flex items-center gap-1 mt-0.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                        <span className="text-[11px] font-medium text-teal-600">Saving to this account</span>
                      </div>
                    ) : (
                      <p className="text-xs text-stone-500">{selectedAccount?.name || 'Text chat'}</p>
                    )}
                  </div>
                </div>
              ) : (
                <>
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
                </>
              )}
            </div>

            {/* Gradient Orb + Subtitle — hidden when text focused */}
            {!textFocused && (
              <>
                <div className="flex-1 flex flex-col items-center justify-center min-h-0">
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
                      <img src="/icons/kosha-k.svg" alt="Kosha" className="h-16 w-16 drop-shadow-sm" style={{ filter: 'brightness(0) invert(1) opacity(0.9)' }} />
                    </div>
                  </button>

                  <p className="text-sm text-stone-600 mt-6 font-medium">
                    Tap to talk with Kosha
                  </p>
                </div>

                {/* Account selector — only when not focused */}
                <div className="shrink-0 w-full px-4 pb-1">
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
                          side="top"
                          sideOffset={4}
                          avoidCollisions={false}
                        >
                          <div className="p-2 border-b border-stone-100">
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
                          <div className="max-h-40 overflow-y-auto py-0.5">
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
                </div>
              </>
            )}

            {/* Empty chat area when focused */}
            {textFocused && <div className="flex-1" />}

            {/* Text input — always visible */}
            <div className="shrink-0 w-full px-4 pb-3">
              <div className="relative">
                <input
                  ref={idleInputRef}
                  type="text"
                  placeholder={textFocused ? 'Type a message...' : 'or type your thoughts...'}
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleTextSend()}
                  onFocus={() => setTextFocused(true)}
                  onBlur={() => { if (!textInput.trim()) setTextFocused(false) }}
                  className="w-full pl-4 pr-12 py-3 bg-white rounded-2xl border border-stone-200 text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-800/10 shadow-sm"
                />
                <button
                  onClick={handleTextSend}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-teal-600 hover:bg-teal-700 text-white rounded-full flex items-center justify-center transition-colors"
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
            className="flex flex-col items-center justify-center h-full pt-14"
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
            className="flex flex-col h-full"
          >
            {/* Header with small orb */}
            <div className="flex items-center justify-between px-5 pb-3" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}>
              <button
                onClick={stopCapture}
                className="flex items-center gap-3 -ml-1 px-1 py-1 rounded-xl hover:bg-stone-100 active:bg-stone-200 transition-colors"
              >
                <div
                  className="h-10 w-10 rounded-full shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, #b8d8a8 0%, #e8c86a 12%, #f0b86e 28%, #eda06a 55%, #e8946a 72%, #d898c0 86%, #88b4d8 100%)',
                    animation: isSpeaking
                      ? 'orb-speak 1.2s ease-in-out infinite'
                      : 'orb-pulse-small 2s ease-in-out infinite',
                  }}
                />
                <div className="text-left">
                  <p className="text-sm font-semibold text-stone-800">
                    {selectedAccount?.name || 'Conversation'}
                  </p>
                  <p className="text-xs text-stone-500">
                    {captureMode === 'text'
                      ? (textSending ? 'Kosha is typing...' : 'Text chat')
                      : (isMuted ? 'Muted' : isSpeaking ? 'Kosha is speaking...' : 'Listening...')}
                  </p>
                </div>
              </button>
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

            {/* Account association indicator — only for note/debrief */}
            {selectedAccount && (true) && (
              <div className="flex items-center gap-1.5 px-5 pb-2">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-100">
                  <div className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                  <span className="text-[11px] font-medium text-teal-700">
                    Saving to {selectedAccount.name}
                  </span>
                </div>
              </div>
            )}

            {/* Transcript */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-5 pb-24"
            >
              {transcript.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-16">
                  <div
                    className="h-16 w-16 rounded-full mb-4 flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, #b8d8a8 0%, #e8c86a 12%, #f0b86e 28%, #eda06a 55%, #e8946a 72%, #d898c0 86%, #88b4d8 100%)',
                    }}
                  >
                    <img src="/icons/kosha-k.svg" alt="Kosha" className="h-7 w-7 drop-shadow-sm" style={{ filter: 'brightness(0) invert(1) opacity(0.9)' }} />
                  </div>
                  <p className="text-sm font-medium text-stone-600">
                    {captureMode === 'text' ? 'What\'s on your mind?' : 'Start speaking about your meeting...'}
                  </p>
                  <p className="text-xs text-stone-400 mt-1">
                    {captureMode === 'text' ? 'Debrief, prep, or jot a quick note' : 'Kosha is listening'}
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
                  {/* Thinking orb */}
                  {textSending && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex justify-start"
                    >
                      <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl rounded-bl-md bg-white border border-stone-100 shadow-sm">
                        <div
                          className="h-6 w-6 rounded-full"
                          style={{
                            background: 'linear-gradient(135deg, #b8d8a8 0%, #e8c86a 12%, #f0b86e 28%, #eda06a 55%, #e8946a 72%, #d898c0 86%, #88b4d8 100%)',
                            animation: 'orb-thinking 1.4s ease-in-out infinite',
                          }}
                        />
                        <span className="text-xs text-stone-400">Thinking...</span>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Bar */}
            {captureMode === 'text' ? (
              <div className="shrink-0 px-4 py-2 border-t border-stone-100 bg-stone-50" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)' }}>
                <div className="flex items-center gap-2 max-w-lg mx-auto">
                  <button
                    onClick={stopCapture}
                    className="h-10 w-10 shrink-0 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center active:scale-95 transition-all shadow-sm"
                  >
                    <Square className="h-3.5 w-3.5 fill-current" />
                  </button>
                  <input
                    ref={activeInputRef}
                    type="text"
                    placeholder="Type a message..."
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleTextSend()}
                    disabled={textSending}
                    className="flex-1 min-w-0 pl-4 pr-4 py-3 bg-white rounded-full border border-stone-200 text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-800/10 shadow-sm disabled:opacity-50"
                  />
                  <button
                    onClick={handleTextSend}
                    disabled={textSending || !textInput.trim()}
                    className="h-10 w-10 shrink-0 bg-teal-600 hover:bg-teal-700 text-white rounded-full flex items-center justify-center transition-colors disabled:opacity-50 shadow-sm"
                    >
                      {textSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            ) : (
              <div className="fixed left-0 right-0 flex justify-center z-20" style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px) + 0.75rem)' }}>
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
            className="flex flex-col items-center justify-center h-full pt-14"
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
            className="flex flex-col h-full"
          >
            {/* Review Header */}
            <div className="flex items-center justify-between px-5 pb-3" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}>
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

            {/* Account selector (shown if no account linked) */}
            {!accountId && (
              <div className="px-5 pb-2">
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <span className="text-xs text-amber-700 flex-1">Select an account to save this capture</span>
                  <Popover open={accountPopoverOpen} onOpenChange={setAccountPopoverOpen}>
                    <PopoverTrigger asChild>
                      <button className="px-3 py-1.5 rounded-full text-xs font-medium text-white bg-[#D97706] hover:bg-[#B45309] transition-colors">
                        Choose Account
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[calc(100vw-2.5rem)] p-0 rounded-2xl border-stone-200 shadow-lg"
                      align="center"
                      side="bottom"
                      sideOffset={8}
                      avoidCollisions
                      collisionPadding={16}
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
                      <div className="max-h-48 overflow-y-auto py-1">
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
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-stone-600 active:bg-stone-50 transition-colors"
                            >
                              <span>{account.name}</span>
                            </button>
                          ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}

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

              {/* Notes (shown for note mode) */}
              {extractedCapture.notes && extractedCapture.notes.length > 0 && (
                <div>
                  <h3 className="text-xs text-stone-500 uppercase tracking-wider font-semibold mb-3">
                    Notes ({extractedCapture.notes.length})
                  </h3>
                  <div className="space-y-2">
                    {extractedCapture.notes.map((note, i) => (
                      <div key={i} className="bg-white rounded-xl p-3.5 border border-stone-100 flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <Input
                              value={note}
                              onChange={(e) => {
                                setExtractedCapture((prev) => {
                                  if (!prev || !prev.notes) return prev
                                  const notes = [...prev.notes]
                                  notes[i] = e.target.value
                                  return { ...prev, notes }
                                })
                              }}
                              className="text-sm h-8 border-stone-200"
                            />
                          ) : (
                            <p className="text-sm text-stone-700">{note}</p>
                          )}
                        </div>
                        {isEditing && (
                          <button
                            onClick={() => setExtractedCapture((prev) => {
                              if (!prev || !prev.notes) return prev
                              return { ...prev, notes: prev.notes.filter((_, idx) => idx !== i) }
                            })}
                            className="p-1 text-stone-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Insights */}
              {extractedCapture.insights.length > 0 && (
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
              )}

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
            <div className="fixed bottom-0 left-0 right-0 px-5 bg-gradient-to-t from-stone-50 via-stone-50 to-transparent pt-6 z-20" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}>
              <div className="flex gap-3 max-w-lg mx-auto">
                <button
                  onClick={saveCapture}
                  disabled={saving}
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
            className="flex flex-col items-center justify-center h-full pt-14 px-5"
          >
            <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-stone-800 mb-1">Capture Saved</h3>
            {selectedAccount ? (
              <p className="text-sm text-stone-500 mb-2 text-center">
                Saved to <span className="font-semibold text-stone-700">{selectedAccount.name}</span>
              </p>
            ) : (
              <p className="text-sm text-stone-500 mb-2 text-center">
                Saved to your organization.
              </p>
            )}
            {extractedCapture && (
              <div className="flex items-center gap-3 mb-6">
                {extractedCapture.insights && extractedCapture.insights.length > 0 && (
                  <span className="text-xs text-stone-400">
                    {extractedCapture.insights.length} insight{extractedCapture.insights.length !== 1 ? 's' : ''}
                  </span>
                )}
                {extractedCapture.tasks && extractedCapture.tasks.length > 0 && (
                  <>
                    <span className="text-xs text-stone-300">&middot;</span>
                    <span className="text-xs text-stone-400">
                      {extractedCapture.tasks.length} task{extractedCapture.tasks.length !== 1 ? 's' : ''}
                    </span>
                  </>
                )}
              </div>
            )}
            <div className="flex flex-col gap-3 items-center">
              {selectedAccount && (
                <button
                  onClick={async () => {
                    setDoneAccountSheetOpen(true)
                    setDoneAccountLoading(true)
                    try {
                      const details = await fetchAccountDetails(selectedAccount.id)
                      setDoneAccountDetails(details)
                    } finally {
                      setDoneAccountLoading(false)
                    }
                  }}
                  className="h-12 px-6 bg-[#D97706] hover:bg-[#B45309] text-white rounded-xl font-medium text-sm flex items-center gap-2 active:scale-[0.98] transition-all"
                >
                  View {selectedAccount.name}
                </button>
              )}
              <button
                onClick={reset}
                className="h-12 px-6 bg-stone-800 text-white rounded-xl font-medium text-sm flex items-center gap-2 active:scale-[0.98] transition-all"
              >
                <RotateCcw className="h-4 w-4" />
                Capture Another
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Conversations Sheet */}
      <Sheet open={conversationsOpen} onOpenChange={setConversationsOpen}>
        <SheetContent side="left" hideCloseButton className="w-[78vw] max-w-sm" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <SheetHeader>
            <SheetTitle>Recent Conversations</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <ConversationList captures={captures.slice(0, 12)} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Account Detail Sheet (after capture save) */}
      <Sheet open={doneAccountSheetOpen} onOpenChange={(open) => {
        setDoneAccountSheetOpen(open)
        if (!open) setDoneAccountDetails(null)
      }}>
        <SheetContent side="bottom" hideCloseButton className="flex flex-col p-0 bg-white h-[85vh]">
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-stone-300" />
          </div>
          <SheetHeader className="sr-only">
            <SheetTitle>{selectedAccount?.name || 'Account Details'}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-5 pt-2 pb-5">
            {selectedAccount && (
              <AccountDetail
                account={selectedAccount}
                visits={doneAccountDetails?.visits}
                insights={doneAccountDetails?.insights}
                tasks={doneAccountDetails?.tasks}
                captures={doneAccountDetails?.captures}
                contacts={doneAccountDetails?.contacts}
                loading={doneAccountLoading}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
