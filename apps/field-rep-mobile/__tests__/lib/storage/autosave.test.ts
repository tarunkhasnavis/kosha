import { createAutoSave } from '../../../lib/storage/autosave'

describe('auto-save timer', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('calls save function on interval', () => {
    const saveFn = jest.fn()
    const autosave = createAutoSave(saveFn, 10000)

    autosave.start()
    expect(saveFn).not.toHaveBeenCalled()

    jest.advanceTimersByTime(10000)
    expect(saveFn).toHaveBeenCalledTimes(1)

    jest.advanceTimersByTime(10000)
    expect(saveFn).toHaveBeenCalledTimes(2)

    autosave.stop()
  })

  it('stops calling after stop()', () => {
    const saveFn = jest.fn()
    const autosave = createAutoSave(saveFn, 10000)

    autosave.start()
    jest.advanceTimersByTime(10000)
    expect(saveFn).toHaveBeenCalledTimes(1)

    autosave.stop()
    jest.advanceTimersByTime(30000)
    expect(saveFn).toHaveBeenCalledTimes(1)
  })

  it('does not double-start', () => {
    const saveFn = jest.fn()
    const autosave = createAutoSave(saveFn, 10000)

    autosave.start()
    autosave.start()

    jest.advanceTimersByTime(10000)
    expect(saveFn).toHaveBeenCalledTimes(1)

    autosave.stop()
  })

  it('can restart after stop', () => {
    const saveFn = jest.fn()
    const autosave = createAutoSave(saveFn, 10000)

    autosave.start()
    jest.advanceTimersByTime(10000)
    autosave.stop()

    autosave.start()
    jest.advanceTimersByTime(10000)
    expect(saveFn).toHaveBeenCalledTimes(2)

    autosave.stop()
  })

  it('triggers immediate save', () => {
    const saveFn = jest.fn()
    const autosave = createAutoSave(saveFn, 10000)

    autosave.saveNow()
    expect(saveFn).toHaveBeenCalledTimes(1)
  })
})
