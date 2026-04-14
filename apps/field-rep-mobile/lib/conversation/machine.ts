export type SessionState = 'IDLE' | 'ACTIVE' | 'ENDING' | 'COMPLETE'

export type SessionEvent =
  | { type: 'START' }
  | { type: 'REP_TAP_END' }
  | { type: 'FAREWELL_DETECTED' }
  | { type: 'MUTUAL_SILENCE_TIMEOUT' }
  | { type: 'SIGNOFF_COMPLETE' }
  | { type: 'BARGE_IN' }

type TransitionCallback = (from: SessionState, to: SessionState) => void

/**
 * Conversation state machine.
 *
 * IDLE → ACTIVE → ENDING → COMPLETE
 *
 * Transitions:
 * - START: IDLE → ACTIVE
 * - REP_TAP_END: ACTIVE → ENDING
 * - FAREWELL_DETECTED: ACTIVE → ENDING
 * - MUTUAL_SILENCE_TIMEOUT: ACTIVE → ENDING
 * - SIGNOFF_COMPLETE: ENDING → COMPLETE
 * - BARGE_IN: no state change, handled by orchestrator
 */
export function createConversationMachine() {
  let state: SessionState = 'IDLE'
  let transitionCallback: TransitionCallback | null = null

  const transition = (to: SessionState) => {
    const from = state
    if (from === to) return
    state = to
    transitionCallback?.(from, to)
  }

  const send = (event: SessionEvent) => {
    switch (event.type) {
      case 'START':
        if (state === 'IDLE') transition('ACTIVE')
        break

      case 'REP_TAP_END':
      case 'FAREWELL_DETECTED':
      case 'MUTUAL_SILENCE_TIMEOUT':
        if (state === 'ACTIVE') transition('ENDING')
        break

      case 'SIGNOFF_COMPLETE':
        if (state === 'ENDING') transition('COMPLETE')
        break

      case 'BARGE_IN':
        // No state change — barge-in is handled by the orchestrator
        // (stops TTS, switches to listening)
        break
    }
  }

  const getState = (): SessionState => state

  const onTransition = (callback: TransitionCallback) => {
    transitionCallback = callback
  }

  const reset = () => {
    state = 'IDLE'
  }

  return {
    send,
    getState,
    onTransition,
    reset,
  }
}

export type ConversationMachine = ReturnType<typeof createConversationMachine>
