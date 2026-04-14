import { createNetworkMonitor } from '../../../lib/storage/network'

describe('network monitor', () => {
  it('defaults to online', () => {
    const monitor = createNetworkMonitor()
    expect(monitor.isOnline()).toBe(true)
  })

  it('calls listeners on state change', () => {
    const monitor = createNetworkMonitor()
    const listener = jest.fn()

    monitor.onChange(listener)
    monitor.setOnline(false)

    expect(listener).toHaveBeenCalledWith(false)
    expect(monitor.isOnline()).toBe(false)
  })

  it('calls listeners on restore', () => {
    const monitor = createNetworkMonitor()
    const listener = jest.fn()

    monitor.onChange(listener)
    monitor.setOnline(false)
    monitor.setOnline(true)

    expect(listener).toHaveBeenCalledTimes(2)
    expect(listener).toHaveBeenLastCalledWith(true)
  })

  it('does not call listener if state unchanged', () => {
    const monitor = createNetworkMonitor()
    const listener = jest.fn()

    monitor.onChange(listener)
    monitor.setOnline(true) // already online

    expect(listener).not.toHaveBeenCalled()
  })

  it('supports multiple listeners', () => {
    const monitor = createNetworkMonitor()
    const listener1 = jest.fn()
    const listener2 = jest.fn()

    monitor.onChange(listener1)
    monitor.onChange(listener2)
    monitor.setOnline(false)

    expect(listener1).toHaveBeenCalledWith(false)
    expect(listener2).toHaveBeenCalledWith(false)
  })

  it('removes listeners', () => {
    const monitor = createNetworkMonitor()
    const listener = jest.fn()

    const unsubscribe = monitor.onChange(listener)
    unsubscribe()
    monitor.setOnline(false)

    expect(listener).not.toHaveBeenCalled()
  })
})
