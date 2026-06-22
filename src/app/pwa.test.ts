import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const workboxState = vi.hoisted(() => ({
  instances: [] as Array<{
    listeners: Record<string, Array<() => void>>
    messageSkipWaiting: ReturnType<typeof vi.fn>
    register: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }>,
}))

vi.mock('workbox-window', () => ({
  Workbox: class {
    listeners: Record<string, Array<() => void>> = {}
    messageSkipWaiting = vi.fn()
    register = vi.fn(() => Promise.resolve())
    update = vi.fn(() => Promise.resolve())

    constructor() {
      workboxState.instances.push(this)
    }

    addEventListener(eventName: string, listener: () => void) {
      this.listeners[eventName] = this.listeners[eventName] ?? []
      this.listeners[eventName].push(listener)
    }
  },
}))

describe('PWA service worker updates', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubEnv('PROD', true)
    workboxState.instances.length = 0
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {},
    })
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    })
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it('checks for updates on install, visibility return, online return, pageshow, and interval', async () => {
    const { registerServiceWorkerUpdateHandler } = await import('@app/pwa')

    const handle = registerServiceWorkerUpdateHandler(vi.fn())
    const workbox = workboxState.instances[0]

    expect(workbox).toBeDefined()
    await Promise.resolve()
    expect(workbox.update).toHaveBeenCalledTimes(1)

    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('online'))
    window.dispatchEvent(new Event('pageshow'))
    vi.advanceTimersByTime(30 * 60 * 1000)

    expect(workbox.update).toHaveBeenCalledTimes(5)

    handle?.cleanup()
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('online'))
    vi.advanceTimersByTime(30 * 60 * 1000)

    expect(workbox.update).toHaveBeenCalledTimes(5)
  })

  it('exposes a waiting update and applies it with skipWaiting', async () => {
    const onUpdateReady = vi.fn()
    const { registerServiceWorkerUpdateHandler } = await import('@app/pwa')

    registerServiceWorkerUpdateHandler(onUpdateReady)
    const workbox = workboxState.instances[0]
    workbox.listeners.waiting?.forEach((listener) => listener())

    expect(onUpdateReady).toHaveBeenCalledTimes(1)
    onUpdateReady.mock.calls[0]?.[0].applyUpdate()

    expect(workbox.messageSkipWaiting).toHaveBeenCalledTimes(1)
  })
})
