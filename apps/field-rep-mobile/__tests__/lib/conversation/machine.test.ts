import { createConversationMachine } from '../../../lib/conversation/machine'

describe('conversation state machine', () => {
  it('starts in IDLE', () => {
    const machine = createConversationMachine()
    expect(machine.getState()).toBe('IDLE')
  })

  it('transitions IDLE → ACTIVE on START', () => {
    const machine = createConversationMachine()
    machine.send({ type: 'START' })
    expect(machine.getState()).toBe('ACTIVE')
  })

  it('transitions ACTIVE → ENDING on REP_TAP_END', () => {
    const machine = createConversationMachine()
    machine.send({ type: 'START' })
    machine.send({ type: 'REP_TAP_END' })
    expect(machine.getState()).toBe('ENDING')
  })

  it('transitions ACTIVE → ENDING on FAREWELL_DETECTED', () => {
    const machine = createConversationMachine()
    machine.send({ type: 'START' })
    machine.send({ type: 'FAREWELL_DETECTED' })
    expect(machine.getState()).toBe('ENDING')
  })

  it('transitions ACTIVE → ENDING on MUTUAL_SILENCE_TIMEOUT', () => {
    const machine = createConversationMachine()
    machine.send({ type: 'START' })
    machine.send({ type: 'MUTUAL_SILENCE_TIMEOUT' })
    expect(machine.getState()).toBe('ENDING')
  })

  it('transitions ENDING → COMPLETE on SIGNOFF_COMPLETE', () => {
    const machine = createConversationMachine()
    machine.send({ type: 'START' })
    machine.send({ type: 'REP_TAP_END' })
    machine.send({ type: 'SIGNOFF_COMPLETE' })
    expect(machine.getState()).toBe('COMPLETE')
  })

  it('ignores START when not IDLE', () => {
    const machine = createConversationMachine()
    machine.send({ type: 'START' })
    machine.send({ type: 'START' }) // should be ignored
    expect(machine.getState()).toBe('ACTIVE')
  })

  it('ignores REP_TAP_END when not ACTIVE', () => {
    const machine = createConversationMachine()
    machine.send({ type: 'REP_TAP_END' }) // IDLE, should be ignored
    expect(machine.getState()).toBe('IDLE')
  })

  it('BARGE_IN does not change state', () => {
    const machine = createConversationMachine()
    machine.send({ type: 'START' })
    machine.send({ type: 'BARGE_IN' })
    expect(machine.getState()).toBe('ACTIVE')
  })

  it('calls onTransition callback', () => {
    const machine = createConversationMachine()
    const callback = jest.fn()
    machine.onTransition(callback)

    machine.send({ type: 'START' })
    expect(callback).toHaveBeenCalledWith('IDLE', 'ACTIVE')

    machine.send({ type: 'REP_TAP_END' })
    expect(callback).toHaveBeenCalledWith('ACTIVE', 'ENDING')
  })

  it('resets to IDLE', () => {
    const machine = createConversationMachine()
    machine.send({ type: 'START' })
    machine.reset()
    expect(machine.getState()).toBe('IDLE')
  })
})
