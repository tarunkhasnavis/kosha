'use client'

import { useEffect, useRef } from 'react'
import { ChatMessage as ChatMessageType, OnboardingAction } from '@/lib/onboarding/types'
import { ChatMessage } from './ChatMessage'
import { motion, AnimatePresence } from 'framer-motion'

interface ChatContainerProps {
  messages: ChatMessageType[]
  isAiTyping?: boolean
  onActionClick?: (action: OnboardingAction) => void
}

/**
 * Blinking dots typing indicator
 */
function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex gap-3"
    >
      <div className="w-8 h-8 rounded-full bg-[hsl(145,44%,93%)] flex items-center justify-center flex-shrink-0">
        <span className="text-sm font-semibold text-[hsl(142,64%,24%)] tracking-tight">K</span>
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

export function ChatContainer({
  messages,
  isAiTyping,
  onActionClick,
}: ChatContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isAiTyping])

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-4 pt-8 pb-6 space-y-4 min-h-0"
    >
      <AnimatePresence mode="popLayout">
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message}
            onActionClick={onActionClick}
          />
        ))}
      </AnimatePresence>

      {/* Typing indicator */}
      <AnimatePresence>
        {isAiTyping && <TypingIndicator />}
      </AnimatePresence>

      <div ref={bottomRef} />
    </div>
  )
}
