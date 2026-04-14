import { useSessionStore } from '../../stores/session'

describe('session store', () => {
  beforeEach(() => {
    useSessionStore.getState().resetSession()
  })

  it('initializes in IDLE state', () => {
    const state = useSessionStore.getState()
    expect(state.state).toBe('IDLE')
    expect(state.sessionType).toBeNull()
    expect(state.transcript).toEqual([])
  })

  it('transitions to ACTIVE on startSession', () => {
    useSessionStore.getState().startSession('voice')
    const state = useSessionStore.getState()
    expect(state.state).toBe('ACTIVE')
    expect(state.sessionType).toBe('voice')
  })

  it('adds transcript entries', () => {
    useSessionStore.getState().startSession('voice')
    useSessionStore.getState().addTranscriptEntry({
      speaker: 'rep',
      text: 'Just left Roosters',
      timestamp: Date.now(),
    })
    expect(useSessionStore.getState().transcript).toHaveLength(1)
    expect(useSessionStore.getState().transcript[0].text).toBe('Just left Roosters')
  })

  it('resets to IDLE on resetSession', () => {
    useSessionStore.getState().startSession('voice')
    useSessionStore.getState().addTranscriptEntry({
      speaker: 'rep',
      text: 'test',
      timestamp: Date.now(),
    })
    useSessionStore.getState().resetSession()
    const state = useSessionStore.getState()
    expect(state.state).toBe('IDLE')
    expect(state.transcript).toEqual([])
  })
})
