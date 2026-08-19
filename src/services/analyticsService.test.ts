import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createAnalyticsService } from '@services/analyticsService'

const INSTALL_ID = '44444444-4444-4444-8444-444444444444'

function createMemoryStorage() {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  }
}

function makeService(
  overrides: {
    enabled?: boolean
    doNotTrack?: boolean
    online?: () => boolean
    fetchImpl?: typeof fetch
  } = {},
) {
  const storage = createMemoryStorage()
  const fetchImpl =
    overrides.fetchImpl ??
    (vi.fn(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    ) as unknown as typeof fetch)
  const service = createAnalyticsService({
    getEnabled: () => overrides.enabled ?? true,
    getDoNotTrack: () => overrides.doNotTrack ?? false,
    storage,
    fetchImpl,
    now: () => new Date('2026-08-19T10:00:00.000Z'),
    isOnline: overrides.online ?? (() => true),
    resolveEndpoint: () => '/api/analytics',
    generateId: () => INSTALL_ID,
  })
  return {
    service,
    storage,
    fetchImpl: fetchImpl as unknown as ReturnType<typeof vi.fn>,
  }
}

function queueOf(storage: ReturnType<typeof createMemoryStorage>) {
  const raw = storage.getItem('vigorune.analytics.queue')
  return raw ? (JSON.parse(raw) as unknown[]) : []
}

describe('analytics client service', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('emits an event on each tracked action', () => {
    const { service, storage } = makeService({ online: () => false })
    service.track('app_opened')
    service.track('workout_logged')
    service.track('meal_logged')
    service.track('run_tracked')
    expect(queueOf(storage)).toEqual([
      { name: 'app_opened', day: '2026-08-19' },
      { name: 'workout_logged', day: '2026-08-19' },
      { name: 'meal_logged', day: '2026-08-19' },
      { name: 'run_tracked', day: '2026-08-19' },
    ])
    expect(storage.getItem('vigorune.analytics.installId')).toBe(INSTALL_ID)
  })

  it('does nothing when disabled (off by default), never creating an id or calling the endpoint', async () => {
    const { service, storage, fetchImpl } = makeService({ enabled: false })
    service.track('workout_logged')
    await service.flush()
    expect(queueOf(storage)).toEqual([])
    expect(storage.getItem('vigorune.analytics.installId')).toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('suppresses everything under Do-Not-Track', async () => {
    const { service, storage, fetchImpl } = makeService({ doNotTrack: true })
    service.track('run_tracked')
    await service.flush()
    expect(service.isActive()).toBe(false)
    expect(queueOf(storage)).toEqual([])
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('flushes queued events and sends only install id + name + day (no PII)', async () => {
    let online = false
    const { service, storage, fetchImpl } = makeService({
      online: () => online,
    })
    service.track('meal_logged')
    expect(fetchImpl).not.toHaveBeenCalled() // offline: queued, not sent

    online = true
    await service.flush()

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/analytics')
    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(Object.keys(body).sort()).toEqual(['events', 'installId'])
    expect(body.installId).toBe(INSTALL_ID)
    expect(body.events).toEqual([{ name: 'meal_logged', day: '2026-08-19' }])
    // The serialized payload must not leak any device/account/location field.
    const serialized = String(init.body)
    for (const forbidden of [
      'email',
      'latitude',
      'longitude',
      'userId',
      'ipAddress',
    ]) {
      expect(serialized).not.toContain(forbidden)
    }
    // Queue is cleared after a successful flush.
    expect(queueOf(storage)).toEqual([])
  })

  it('swallows endpoint failures and keeps the queue for retry', async () => {
    const failing = vi.fn(async () => {
      throw new Error('network down')
    }) as unknown as typeof fetch
    const { service, storage } = makeService({ fetchImpl: failing })

    // track() triggers a background flush that must not throw.
    service.track('workout_logged')
    await expect(service.flush()).resolves.toBeUndefined()
    expect(queueOf(storage)).toEqual([
      { name: 'workout_logged', day: '2026-08-19' },
    ])
  })

  it('keeps the queue when the endpoint responds non-ok, then clears it on a later success', async () => {
    let ok = false
    const fetchImpl = vi.fn(
      async () => new Response('{}', { status: ok ? 200 : 503 }),
    ) as unknown as typeof fetch
    const { service, storage } = makeService({ fetchImpl })

    service.track('run_tracked')
    await service.flush()
    expect(queueOf(storage)).toEqual([
      { name: 'run_tracked', day: '2026-08-19' },
    ])

    ok = true
    await service.flush()
    expect(queueOf(storage)).toEqual([])
  })

  it('opting out suppresses tracking and forgets the queue and install id', async () => {
    const { service, storage, fetchImpl } = makeService()
    service.track('app_opened')
    expect(storage.getItem('vigorune.analytics.installId')).toBe(INSTALL_ID)

    service.setOptOut(true)
    expect(service.isActive()).toBe(false)
    expect(service.isOptedOut()).toBe(true)
    expect(storage.getItem('vigorune.analytics.installId')).toBeNull()
    expect(queueOf(storage)).toEqual([])

    fetchImpl.mockClear()
    service.track('workout_logged')
    await service.flush()
    expect(queueOf(storage)).toEqual([])
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
