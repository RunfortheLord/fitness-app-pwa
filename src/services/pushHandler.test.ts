import fs from 'node:fs'
import vm from 'node:vm'

import { afterEach, describe, expect, it, vi } from 'vitest'

describe('push handler', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('replaces legacy timer alerts and removes the banner after six seconds', async () => {
    vi.useFakeTimers()
    const listeners = new Map<string, (event: PushEventStub) => void>()
    const closeLegacy = vi.fn()
    const closeCurrent = vi.fn()
    const getNotifications = vi
      .fn()
      .mockResolvedValueOnce([
        { close: closeLegacy, tag: 'rest-timer-legacy-id' },
      ])
      .mockResolvedValueOnce([
        { close: closeCurrent, tag: 'nutrifit-rest-timer' },
      ])
    const showNotification = vi.fn().mockResolvedValue(undefined)
    const worker = {
      addEventListener: vi.fn(
        (eventName: string, listener: (event: PushEventStub) => void) => {
          listeners.set(eventName, listener)
        },
      ),
      clients: {},
      location: { origin: 'https://fitness.example.test' },
      registration: { getNotifications, showNotification },
    }
    const source = fs.readFileSync('public/push-handler.js', 'utf8')
    vm.runInNewContext(source, {
      Promise,
      URL,
      self: worker,
      setTimeout,
    })

    let completion: Promise<void> | undefined
    listeners.get('push')?.({
      data: {
        json: () => ({
          body: 'Ready.',
          tag: 'rest-timer-new-id',
          title: 'Timer',
        }),
      },
      waitUntil: (promise) => {
        completion = promise
      },
    })

    await vi.advanceTimersByTimeAsync(6_000)
    await completion

    expect(closeLegacy).toHaveBeenCalledTimes(1)
    expect(showNotification).toHaveBeenCalledWith('Timer', {
      badge: '/icons/icon-192.png',
      body: 'Ready.',
      data: { url: '/workout' },
      icon: '/icons/icon-192.png',
      renotify: false,
      tag: 'nutrifit-rest-timer',
    })
    expect(closeCurrent).toHaveBeenCalledTimes(1)
  })
})

type PushEventStub = {
  data?: {
    json(): unknown
  }
  waitUntil(promise: Promise<void>): void
}
