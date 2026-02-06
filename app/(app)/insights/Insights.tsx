'use client'

import { useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { User, Sparkles, Send, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useInsightsChat } from './hooks/useInsightsChat'
import type { AnalyticsChatMessage } from '@/lib/analytics-chat/types'

// =============================================================================
// Suggested Questions
// =============================================================================

const SUGGESTED_QUESTIONS = [
  'Who are my top 5 customers?',
  'How did we do this month?',
  'What are my best selling products?',
  'Compare this month to last month',
]

// =============================================================================
// Typing Indicator
// =============================================================================

function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex gap-3"
    >
      <div className="w-8 h-8 rounded-full bg-[hsl(145,44%,93%)] flex items-center justify-center flex-shrink-0">
        <Sparkles className="w-4 h-4 text-[hsl(142,64%,24%)]" />
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex gap-1.5 items-center">
          <motion.span
            className="w-2 h-2 bg-slate-400 rounded-full"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut', delay: 0 }}
          />
          <motion.span
            className="w-2 h-2 bg-slate-400 rounded-full"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut', delay: 0.2 }}
          />
          <motion.span
            className="w-2 h-2 bg-slate-400 rounded-full"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut', delay: 0.4 }}
          />
        </div>
      </div>
    </motion.div>
  )
}

// =============================================================================
// Chat Message Component
// =============================================================================

interface ChatMessageProps {
  message: AnalyticsChatMessage
}

function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'flex gap-3',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      {isUser ? (
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-[hsl(230,60%,85%)]">
          <User className="w-4 h-4 text-[hsl(230,51%,36%)]" />
        </div>
      ) : (
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-[hsl(145,44%,93%)]">
          <Sparkles className="w-4 h-4 text-[hsl(142,64%,24%)]" />
        </div>
      )}

      {/* Message content */}
      <div
        className={cn(
          'max-w-[80%] space-y-2',
          isUser ? 'items-end' : 'items-start'
        )}
      >
        {/* Text bubble */}
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5',
            isUser
              ? 'bg-[hsl(230,100%,95%)] text-[hsl(230,51%,36%)] rounded-tr-sm'
              : 'bg-white border border-slate-200 text-slate-900 rounded-tl-sm'
          )}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    </motion.div>
  )
}

// =============================================================================
// Chat Input Component
// =============================================================================

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
  placeholder?: string
}

function ChatInput({ onSend, disabled, placeholder = 'Ask about your orders...' }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = () => {
    const text = textareaRef.current?.value.trim()
    if (!text || disabled) return

    onSend(text)
    if (textareaRef.current) {
      textareaRef.current.value = ''
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const canSend = !disabled

  return (
    <div className="px-4 pt-4 pb-6">
      {/* Input container - rounded pill with button inside */}
      <div
        className={cn(
          'relative flex items-center rounded-full border bg-gray-50 transition-all',
          'border-gray-200',
          'focus-within:border-gray-300 focus-within:bg-white focus-within:shadow-sm'
        )}
      >
        {/* Text input */}
        <textarea
          ref={textareaRef}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className={cn(
            'flex-1 bg-transparent border-0 outline-none resize-none py-3 px-4 text-gray-900 placeholder:text-gray-400',
            'min-h-[24px] max-h-[120px]',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          style={{
            height: 'auto',
            overflow: 'hidden',
          }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement
            target.style.height = 'auto'
            target.style.height = `${Math.min(target.scrollHeight, 120)}px`
          }}
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={disabled}
          className={cn(
            'flex-shrink-0 m-1.5 p-2 rounded-full transition-all',
            canSend
              ? 'bg-[#16a34a] text-white hover:bg-[#15803d]'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          )}
        >
          <Send className="w-4 h-4" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}

// =============================================================================
// Welcome Screen
// =============================================================================

interface WelcomeScreenProps {
  onQuestionClick: (question: string) => void
  disabled?: boolean
}

function WelcomeScreen({ onQuestionClick, disabled }: WelcomeScreenProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex-1 flex flex-col items-center justify-center px-8"
    >
      <div className="w-16 h-16 rounded-full bg-[hsl(145,44%,93%)] flex items-center justify-center mb-6">
        <Sparkles className="w-8 h-8 text-[hsl(142,64%,24%)]" />
      </div>
      <h2 className="text-2xl font-semibold text-slate-900 mb-2">Insights</h2>
      <p className="text-slate-500 text-center max-w-md mb-8">
        Ask questions about your orders, customers, and products. I can help you understand trends, find top performers, and compare time periods.
      </p>

      <div className="grid grid-cols-2 gap-3 max-w-lg w-full">
        {SUGGESTED_QUESTIONS.map((question, i) => (
          <button
            key={i}
            onClick={() => onQuestionClick(question)}
            disabled={disabled}
            className={cn(
              'text-left px-4 py-3 rounded-xl border border-slate-200 bg-white',
              'hover:border-slate-300 hover:shadow-sm transition-all',
              'text-sm text-slate-700',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {question}
          </button>
        ))}
      </div>
    </motion.div>
  )
}

// =============================================================================
// Main Insights Component
// =============================================================================

export function Insights() {
  const { messages, isLoading, sendMessage, clearMessages } = useInsightsChat()
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const hasMessages = messages.length > 0

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[hsl(145,44%,93%)] flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-[hsl(142,64%,24%)]" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Insights</h1>
            <p className="text-sm text-slate-500">Ask questions about your data</p>
          </div>
        </div>
        {hasMessages && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearMessages}
            className="text-slate-400 hover:text-slate-600"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear chat
          </Button>
        )}
      </div>

      {/* Chat area */}
      {!hasMessages ? (
        <WelcomeScreen onQuestionClick={sendMessage} disabled={isLoading} />
      ) : (
        <div className="flex-1 overflow-y-auto px-4 pt-6 pb-4 space-y-4 min-h-0">
          <AnimatePresence mode="popLayout">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          <AnimatePresence>
            {isLoading && <TypingIndicator />}
          </AnimatePresence>

          <div ref={bottomRef} />
        </div>
      )}

      {/* Input */}
      <div className="border-t border-slate-200 bg-white">
        <ChatInput onSend={sendMessage} disabled={isLoading} />
      </div>
    </div>
  )
}
