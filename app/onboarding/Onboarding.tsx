'use client'

import { useCallback, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { useOnboardingState } from './hooks/useOnboardingState'
import { ProgressBar } from './components/ProgressBar'
import { OrganizationForm } from './components/OrganizationForm'
import { ChatContainer } from './components/ChatContainer'
import { ChatInput } from './components/ChatInput'
import {
  createOnboardingOrganization,
} from '@/lib/onboarding/actions'
import {
  ChatMessage,
  OnboardingAction,
  OnboardingStage,
} from '@/lib/onboarding/types'
import { getStageGreetingSequence } from '@/lib/onboarding/agent'

interface OnboardingProps {
  userName?: string
}

// Animation variants for page-level fade-in
const pageVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
}

// Animation variants for stage transitions (swipe left effect)
const stageVariants = {
  initial: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  animate: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -300 : 300,
    opacity: 0,
  }),
}

// Transition configs
const pageTransition = { duration: 0.5, ease: 'easeOut' as const }
const stageTransition = { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const }

export function Onboarding({ userName }: OnboardingProps) {
  const router = useRouter()
  const {
    session,
    messages,
    isAiTyping,
    isLoading,
    error,
    setSession,
    addMessage,
    setMessages,
    setIsAiTyping,
    updateSession,
    setError,
  } = useOnboardingState({ userName })

  // Track direction for slide animations (1 = forward, -1 = backward)
  const [slideDirection, setSlideDirection] = useState(1)

  // Track when greeting sequence is complete to show skip button
  const [greetingComplete, setGreetingComplete] = useState(false)
  const [isPlayingGreeting, setIsPlayingGreeting] = useState(false)

  // Set greetingComplete to true if messages are restored from server (page reload)
  // or when greeting sequence finishes (3 messages shown)
  useEffect(() => {
    // If we have messages and we're not currently playing the greeting animation
    if (messages.length > 0 && !isPlayingGreeting && !greetingComplete) {
      setGreetingComplete(true)
    }
  }, [messages.length, isPlayingGreeting, greetingComplete])

  // Helper to play greeting sequence with delays
  const playGreetingSequence = useCallback(async (
    greetingMessages: ChatMessage[],
    sessionId: string
  ) => {
    setGreetingComplete(false)
    setIsPlayingGreeting(true)
    const allMessages: ChatMessage[] = []

    for (let i = 0; i < greetingMessages.length; i++) {
      const msg = greetingMessages[i]

      // Show typing indicator before each message (except the first one which shows immediately)
      if (i > 0) {
        setIsAiTyping(true)
        await new Promise(resolve => setTimeout(resolve, 1000)) // 1 second loading between messages
      }

      setIsAiTyping(false)
      allMessages.push(msg)
      setMessages([...allMessages])

      // Small delay before showing typing for next message
      if (i < greetingMessages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300))
      }
    }

    // Persist all messages to server so they survive refresh
    await fetch('/api/onboarding/session', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        lastMessages: allMessages,
      }),
    })

    // Mark greeting as complete so skip button can show
    setIsPlayingGreeting(false)
    setGreetingComplete(true)
  }, [setMessages, setIsAiTyping])

  // Handle Stage 1: Organization form submission
  const handleOrgSubmit = useCallback(async (data: { name: string; phone?: string; address?: string }) => {
    if (!session) return

    try {
      const result = await createOnboardingOrganization(
        session.id,
        data.name,
        data.phone,
        data.address
      )

      if (!result.success) {
        throw new Error(result.error || 'Failed to create organization')
      }

      // Set slide direction for forward transition
      setSlideDirection(1)

      // Update local state and advance to Stage 2
      updateSession({
        organizationId: result.organizationId,
        currentStage: 'products',
        orgData: { name: data.name, phone: data.phone || null, address: data.address || null },
      })

      // Get greeting sequence and play it with delays
      const greetingSequence = getStageGreetingSequence('products', userName, data.name)

      // Start with empty messages, then play the sequence
      setMessages([])
      await playGreetingSequence(greetingSequence, session.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }, [session, userName, updateSession, setMessages, setError, playGreetingSequence])

  // Handle chat message sending (Stage 2 & 3)
  const handleSendMessage = useCallback(async (text: string, file?: File) => {
    if (!session) return

    // Create user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
      attachment: file ? {
        name: file.name,
        type: file.type,
        size: file.size,
      } : undefined,
    }

    addMessage(userMessage)
    setIsAiTyping(true)

    try {
      // Prepare file content if attached
      let attachments: { name: string; type: string; content: string }[] | undefined
      if (file) {
        const base64 = await fileToBase64(file)
        attachments = [{
          name: file.name,
          type: file.type,
          content: base64,
        }]
      }

      // Call chat API
      const response = await fetch('/api/onboarding/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: crypto.randomUUID(),
          session_id: session.id,
          message: text,
          stage: session.currentStage,
          attachments,
        }),
      })

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      // Add AI response
      addMessage(data.message)

      // Update session state from server response
      if (data.session) {
        updateSession({
          currentStage: data.session.currentStage as OnboardingStage,
          productsImported: data.session.productsImported,
          orderExampleSaved: data.session.orderExampleSaved,
        })

        // Redirect if complete
        if (data.session.currentStage === 'complete') {
          setTimeout(() => router.push('/orders'), 2000)
        }
      }
    } catch (err) {
      // Add error as AI message
      addMessage({
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Sorry, I encountered an error: ${err instanceof Error ? err.message : 'Please try again.'}`,
        timestamp: new Date(),
      })
    } finally {
      setIsAiTyping(false)
    }
  }, [session, addMessage, setIsAiTyping, updateSession, router])

  // Handle action button clicks
  const handleActionClick = useCallback(async (action: OnboardingAction) => {
    if (!session) return

    const previousStage = session.currentStage
    setIsAiTyping(true)

    try {
      const response = await fetch('/api/onboarding/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: crypto.randomUUID(),
          session_id: session.id,
          message: action.label,
          stage: session.currentStage,
          action: action.id,
        }),
      })

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      // Check if stage changed (e.g., products -> order_example)
      const newStage = data.session?.currentStage as OnboardingStage | undefined
      const stageChanged = newStage && newStage !== previousStage && newStage !== 'complete'

      if (stageChanged) {
        // Stage advanced - play full greeting sequence for new stage
        setIsAiTyping(false)

        // Update session first
        updateSession({
          currentStage: newStage,
          productsImported: data.session.productsImported,
          orderExampleSaved: data.session.orderExampleSaved,
        })

        // Play the greeting sequence for the new stage
        const greetingSequence = getStageGreetingSequence(newStage, userName)
        await playGreetingSequence(greetingSequence, session.id)
      } else {
        // No stage change - just add the response message
        addMessage(data.message)

        // Update session
        if (data.session) {
          updateSession({
            currentStage: data.session.currentStage as OnboardingStage,
            productsImported: data.session.productsImported,
            orderExampleSaved: data.session.orderExampleSaved,
          })

          // Redirect if complete
          if (data.session.currentStage === 'complete') {
            setTimeout(() => router.push('/orders'), 2000)
          }
        }
      }
    } catch (err) {
      addMessage({
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Sorry, I encountered an error: ${err instanceof Error ? err.message : 'Please try again.'}`,
        timestamp: new Date(),
      })
    } finally {
      setIsAiTyping(false)
    }
  }, [session, userName, addMessage, setIsAiTyping, updateSession, router, playGreetingSequence])

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
      </div>
    )
  }

  // Error state
  if (error || !session) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-center">
          <p className="text-red-600 text-sm mb-3">{error || 'Failed to load'}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  const currentStage = session.currentStage

  return (
    <motion.div
      className="h-screen bg-white flex flex-col overflow-hidden"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      transition={pageTransition}
    >
      {/* Logo - fixed top left */}
      <motion.div
        className="absolute top-8 left-10 z-10"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        <span className="text-2xl font-semibold tracking-tight text-slate-900/80">
          kosha
        </span>
      </motion.div>

      {/* Progress bar - centered, fixed at top */}
      <motion.div
        className="flex-shrink-0 pt-16 pb-8"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        <ProgressBar currentStage={currentStage} />
      </motion.div>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <AnimatePresence mode="wait" custom={slideDirection}>
          {/* Stage 1: Organization Form */}
          {currentStage === 'organization' && (
            <motion.div
              key="organization"
              custom={slideDirection}
              variants={stageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={stageTransition}
              className="flex-1 flex items-start justify-center px-6 pt-[12vh] overflow-auto"
            >
              <div className="w-full max-w-sm">
                <h1 className="text-2xl font-semibold text-neutral-900 mb-2">
                  Create your organization
                </h1>
                <p className="text-neutral-500 mb-10">
                  Set up your workspace for managing orders
                </p>
                <OrganizationForm onSubmit={handleOrgSubmit} />
              </div>
            </motion.div>
          )}

          {/* Stage 2: Product Catalog Chatbot */}
          {currentStage === 'products' && (
            <motion.div
              key="chat"
              custom={slideDirection}
              variants={stageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={stageTransition}
              className="flex-1 flex flex-col max-w-2xl mx-auto w-full min-h-0"
            >
              <ChatContainer
                messages={messages}
                isAiTyping={isAiTyping}
                onActionClick={handleActionClick}
              />
              <div className="flex-shrink-0">
                <ChatInput
                  onSend={handleSendMessage}
                  disabled={isAiTyping}
                  placeholder="Paste products or drop file here..."
                  skipLabel="Skip for now"
                  onSkip={() => handleActionClick({
                    id: 'skip_products',
                    label: 'Skip for now'
                  })}
                  showSkip={greetingComplete}
                />
              </div>
            </motion.div>
          )}

          {/* Complete state */}
          {currentStage === 'complete' && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="flex-1 flex items-center justify-center"
            >
              <div className="text-center">
                <motion.div
                  className="w-12 h-12 bg-[#16a34a] rounded-full flex items-center justify-center mx-auto mb-5"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
                >
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </motion.div>
                <h2 className="text-xl font-semibold text-neutral-900 mb-2">
                  You&apos;re all set
                </h2>
                <p className="text-neutral-500 text-sm">
                  Taking you to your dashboard...
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </motion.div>
  )
}

// Helper to convert file to base64
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Remove data URL prefix (e.g., "data:image/png;base64,")
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
