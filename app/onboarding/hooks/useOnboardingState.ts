'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  OnboardingSession,
  ChatMessage,
} from '@/lib/onboarding/types'
import { getStageGreetingSequence } from '@/lib/onboarding/agent'

interface UseOnboardingStateOptions {
  userName?: string
}

/**
 * State hook for onboarding flow.
 * Fetches session from server on mount, provides update functions.
 * Handles orphan recovery by ensuring chat has greeting if needed.
 */
export function useOnboardingState(options: UseOnboardingStateOptions = {}) {
  const { userName } = options
  const [session, setSession] = useState<OnboardingSession | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isAiTyping, setIsAiTyping] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load session from server on mount
  useEffect(() => {
    async function loadSession() {
      try {
        const response = await fetch('/api/onboarding/session')
        const { session: serverSession, error: serverError } = await response.json()

        if (serverError) {
          throw new Error(serverError)
        }

        if (serverSession) {
          setSession(serverSession)

          // Restore messages from server
          let restoredMessages = serverSession.lastMessages || []

          // ORPHAN RECOVERY: If user is in a chat stage but has no messages,
          // OR if messages are in old format (single greeting instead of 3-message sequence),
          // generate a fresh greeting so they see the new multi-message format
          // Note: 'order_example' stage has been removed from the flow
          const isChatStage = serverSession.currentStage === 'products'

          // Check if messages are in old format (single greeting instead of 2-message sequence)
          const hasOnlyOldGreeting = restoredMessages.length > 0 &&
            restoredMessages.length < 2 &&
            restoredMessages.every((m: ChatMessage) => m.role === 'assistant') &&
            !restoredMessages.some((m: ChatMessage) => m.content.startsWith("Welcome,"))

          if (isChatStage && (restoredMessages.length === 0 || hasOnlyOldGreeting)) {
            // Pass org name for products stage greeting
            const orgName = serverSession.orgData?.name || undefined
            // Use full greeting sequence (without animation on reload)
            restoredMessages = getStageGreetingSequence(serverSession.currentStage, userName, orgName)

            // Persist the greeting so it survives future refreshes
            fetch('/api/onboarding/session', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sessionId: serverSession.id,
                lastMessages: restoredMessages,
              }),
            }).catch(err => {
              console.error('Failed to persist greeting:', err)
            })
          }

          setMessages(restoredMessages)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load session')
      } finally {
        setIsLoading(false)
      }
    }

    loadSession()
  }, [userName])

  // Add a message to the chat
  const addMessage = useCallback((message: ChatMessage) => {
    setMessages(prev => [...prev, message])
  }, [])

  // Update session after server confirms a change
  const updateSession = useCallback((updates: Partial<OnboardingSession>) => {
    setSession(prev => prev ? { ...prev, ...updates } : null)
  }, [])

  return {
    session,
    messages,
    isAiTyping,
    isLoading,
    error,
    // Actions
    setSession,
    setMessages,
    addMessage,
    setIsAiTyping,
    setIsLoading,
    setError,
    updateSession,
  }
}
