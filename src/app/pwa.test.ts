import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type WorkboxListener = (event?: {
  isUpdate?: boolean
  isExternal?: boolean
}) => void

const workboxState = vi.hoisted(() => ({
  instances: [] as Array<{
    listeners: Record<string, WorkboxListener[]>
    messageSkipWaiting: ReturnType<typeof vi.fn>
    register: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }>,
}))

vi.mock('workbox-window', () => ({
  Workbox: class {
    listeners: Record<string, WorkboxListener[]> = {}
    messageSkipWaiting = vi.fn()
    register = vi.fn(() => Promise.resolve())
    update = vi.fn(() => Promise.resolve())

    constructor() {
      workboxState.instances.push(this)
    }

    addEventListener(eventName: string, listener: WorkboxListener) {
      this.listeners[eventName] = this.listeners[eventName] ?? []
      this.listeners[eventName].push(listener)
    }
  },
}))

const reloadMock = vi.fn()
const originalLocation = window.location

describe('PWA service worker updates', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubEnv('PROD', true)
    workboxState.instances.length = 0
    reloadMock.mockClear()
    document.body.classList.remove('live-workout-open')
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
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: 'http://localhost/', reload: reloadMock },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    document.body.classList.remove('live-workout-open')
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    })
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

  it('activates a waiting update and reloads onto the new worker', async () => {
    const onUpdateReady = vi.fn()
    const { registerServiceWorkerUpdateHandler } = await import('@app/pwa')

    const handle = registerServiceWorkerUpdateHandler(onUpdateReady)
    const workbox = workboxState.instances[0]
    workbox.listeners.waiting?.forEach((listener) => listener())

    expect(onUpdateReady).toHaveBeenCalledTimes(1)
    onUpdateReady.mock.calls[0]?.[0].applyUpdate()
    expect(workbox.messageSkipWaiting).toHaveBeenCalledTimes(1)

    // The updated worker taking control reloads the app onto the fresh assets.
    workbox.listeners.controlling?.forEach((listener) =>
      listener({ isUpdate: true }),
    )
    expect(reloadMock).toHaveBeenCalledTimes(1)

    handle?.cleanup()
  })

  it('does not reload on the first install (no prior controller)', async () => {
    const { registerServiceWorkerUpdateHandler } = await import('@app/pwa')

    const handle = registerServiceWorkerUpdateHandler(vi.fn())
    const workbox = workboxState.instances[0]

    workbox.listeners.controlling?.forEach((listener) =>
      listener({ isUpdate: false }),
    )
    expect(reloadMock).not.toHaveBeenCalled()

    handle?.cleanup()
  })

  it('defers the update reload during a live workout and applies it once the workout closes', async () => {
    document.body.classList.add('live-workout-open')
    const { registerServiceWorkerUpdateHandler } = await import('@app/pwa')

    const handle = registerServiceWorkerUpdateHandler(vi.fn())
    const workbox = workboxState.instances[0]

    workbox.listeners.controlling?.forEach((listener) =>
      listener({ isUpdate: true }),
    )
    expect(reloadMock).not.toHaveBeenCalled()

    // Leaving the live workout returns to a safe checkpoint; the deferred
    // reload then applies (via the visibility checkpoint) exactly once.
    document.body.classList.remove('live-workout-open')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(reloadMock).toHaveBeenCalledTimes(1)

    handle?.cleanup()
  })
})
