import { createMeteringVAD } from '../../../lib/vad/metering-vad'

describe('metering VAD', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('initializes as not speaking', () => {
    const vad = createMeteringVAD()
    expect(vad.isSpeaking()).toBe(false)
  })

  it('detects speech start when level exceeds threshold', () => {
    const onSpeechStart = jest.fn()
    const vad = createMeteringVAD({ threshold: -40 })
    vad.onSpeechStart(onSpeechStart)

    vad.processLevel(-30) // above threshold
    expect(onSpeechStart).toHaveBeenCalledTimes(1)
    expect(vad.isSpeaking()).toBe(true)
  })

  it('does not trigger speech start for levels below threshold', () => {
    const onSpeechStart = jest.fn()
    const vad = createMeteringVAD({ threshold: -40 })
    vad.onSpeechStart(onSpeechStart)

    vad.processLevel(-50) // below threshold
    expect(onSpeechStart).not.toHaveBeenCalled()
    expect(vad.isSpeaking()).toBe(false)
  })

  it('detects speech end after silence duration', () => {
    const onSpeechEnd = jest.fn()
    const vad = createMeteringVAD({ threshold: -40, silenceDurationMs: 1500 })
    vad.onSpeechEnd(onSpeechEnd)

    // Start speaking
    vad.processLevel(-30)
    expect(vad.isSpeaking()).toBe(true)

    // Go silent
    vad.processLevel(-60)
    expect(onSpeechEnd).not.toHaveBeenCalled()

    // Wait for silence duration
    jest.advanceTimersByTime(1500)
    expect(onSpeechEnd).toHaveBeenCalledTimes(1)
    expect(vad.isSpeaking()).toBe(false)
  })

  it('cancels speech end if speech resumes before silence duration', () => {
    const onSpeechEnd = jest.fn()
    const vad = createMeteringVAD({ threshold: -40, silenceDurationMs: 1500 })
    vad.onSpeechEnd(onSpeechEnd)

    // Start speaking
    vad.processLevel(-30)

    // Brief pause
    vad.processLevel(-60)
    jest.advanceTimersByTime(500) // not long enough

    // Resume speaking
    vad.processLevel(-30)
    jest.advanceTimersByTime(1500) // timer was reset

    expect(onSpeechEnd).not.toHaveBeenCalled()
    expect(vad.isSpeaking()).toBe(true)
  })

  it('does not fire speech start multiple times without speech end', () => {
    const onSpeechStart = jest.fn()
    const vad = createMeteringVAD({ threshold: -40 })
    vad.onSpeechStart(onSpeechStart)

    vad.processLevel(-30)
    vad.processLevel(-25)
    vad.processLevel(-20)

    expect(onSpeechStart).toHaveBeenCalledTimes(1)
  })

  it('fires speech start again after speech end', () => {
    const onSpeechStart = jest.fn()
    const onSpeechEnd = jest.fn()
    const vad = createMeteringVAD({ threshold: -40, silenceDurationMs: 1500 })
    vad.onSpeechStart(onSpeechStart)
    vad.onSpeechEnd(onSpeechEnd)

    // First utterance
    vad.processLevel(-30)
    vad.processLevel(-60)
    jest.advanceTimersByTime(1500)

    // Second utterance
    vad.processLevel(-30)

    expect(onSpeechStart).toHaveBeenCalledTimes(2)
    expect(onSpeechEnd).toHaveBeenCalledTimes(1)
  })

  it('resets state on reset()', () => {
    const vad = createMeteringVAD({ threshold: -40 })
    vad.processLevel(-30)
    expect(vad.isSpeaking()).toBe(true)

    vad.reset()
    expect(vad.isSpeaking()).toBe(false)
  })
})
