import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createAutomaticCloudBackupService } from '@services/automaticCloudBackupService'

const DAY_MS = 24 * 60 * 60 * 1_000

type ServiceOptions = Parameters<typeof createAutomaticCloudBackupService>[0]

// Isolate the unit under test from the real database by injecting the
// persistence hooks; individual tests override what they exercise.
function createService(overrides: ServiceOptions = {}) {
  return createAutomaticCloudBackupService({
    getLastSuccessfulBackupAt: () => Promise.resolve(null),
    recordSuccessfulBackup: () => undefined,
    subscribeToMutations: () => () => undefined,
    ...overrides,
  })
}

describe('automaticCloudBackupService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('backs up on start and throttles relevant database changes', async () => {
    const backupToCloud = vi.fn().mockResolvedValue(undefined)
    let notifyMutation: () => void = () => undefined
    const unsubscribe = vi.fn()
    const service = createService({
      backupIntervalMs: 50,
      backupToCloud,
      canSafelyBackUp: () => Promise.resolve(true),
      subscribeToMutations: (listener) => {
        notifyMutation = listener
        return unsubscribe
      },
    })

    const stop = service.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(backupToCloud).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(10)
    notifyMutation()
    await vi.advanceTimersByTimeAsync(20)
    notifyMutation()
    await vi.advanceTimersByTimeAsync(19)
    expect(backupToCloud).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(backupToCloud).toHaveBeenCalledTimes(2)

    notifyMutation()
    await vi.advanceTimersByTimeAsync(49)
    expect(backupToCloud).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(backupToCloud).toHaveBeenCalledTimes(3)

    stop()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })

  it('keeps the throttle when the app becomes visible again', async () => {
    const backupToCloud = vi.fn().mockResolvedValue(undefined)
    let notifyMutation: () => void = () => undefined
    const service = createService({
      backupIntervalMs: 50,
      backupToCloud,
      canSafelyBackUp: () => Promise.resolve(true),
      subscribeToMutations: (listener) => {
        notifyMutation = listener
        return () => undefined
      },
    })

    const stop = service.start()
    await vi.advanceTimersByTimeAsync(0)
    notifyMutation()
    await vi.advanceTimersByTimeAsync(10)

    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(0)
    expect(backupToCloud).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(40)
    expect(backupToCloud).toHaveBeenCalledTimes(2)
    stop()
  })

  it('waits while offline and backs up when the connection returns', async () => {
    let online = false
    const backupToCloud = vi.fn().mockResolvedValue(undefined)
    const service = createService({
      backupToCloud,
      canSafelyBackUp: () => Promise.resolve(true),
      isOnline: () => online,
    })

    const stop = service.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(backupToCloud).not.toHaveBeenCalled()

    online = true
    window.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(0)
    expect(backupToCloud).toHaveBeenCalledOnce()
    stop()
  })

  it('records the timestamp of each successful backup', async () => {
    const recordSuccessfulBackup = vi.fn()
    const service = createService({
      backupToCloud: () => Promise.resolve(undefined),
      canSafelyBackUp: () => Promise.resolve(true),
      recordSuccessfulBackup,
    })

    const stop = service.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(recordSuccessfulBackup).toHaveBeenCalledWith(expect.any(Number))
    stop()
  })

  it('retries a failed backup without discarding the queued backup', async () => {
    const backupToCloud = vi
      .fn()
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce(undefined)
    const onSuccess = vi.fn()
    const service = createService({
      backupToCloud,
      canSafelyBackUp: () => Promise.resolve(true),
      retryDelayMs: 100,
    })

    const stop = service.start({ onSuccess })
    await vi.advanceTimersByTimeAsync(0)
    expect(backupToCloud).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(100)
    expect(backupToCloud).toHaveBeenCalledTimes(2)
    expect(onSuccess).toHaveBeenCalledOnce()
    stop()
  })

  it('stays silent on a transient failure when a backup succeeded recently', async () => {
    const recentlyBackedUpAt = Date.now() - 60_000
    const backupToCloud = vi.fn().mockRejectedValue(new Error('network'))
    const onError = vi.fn()
    const service = createService({
      backupToCloud,
      canSafelyBackUp: () => Promise.resolve(true),
      getLastSuccessfulBackupAt: () => Promise.resolve(recentlyBackedUpAt),
      retryDelayMs: 100,
      staleBackupThresholdMs: 3 * DAY_MS,
    })

    const stop = service.start({ onError })
    await vi.advanceTimersByTimeAsync(0)
    expect(backupToCloud).toHaveBeenCalledTimes(1)
    expect(onError).not.toHaveBeenCalled()
    stop()
  })

  it('warns after repeated failures even when no backup has succeeded yet', async () => {
    const backupToCloud = vi.fn().mockRejectedValue(new Error('network'))
    const onError = vi.fn()
    const service = createService({
      backupToCloud,
      canSafelyBackUp: () => Promise.resolve(true),
      getLastSuccessfulBackupAt: () => Promise.resolve(null),
      retryDelayMs: 100,
      staleBackupThresholdMs: 200,
    })

    const stop = service.start({ onError })
    await vi.advanceTimersByTimeAsync(199)
    expect(onError).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(101)
    expect(onError).toHaveBeenCalledWith(expect.any(Error))
    stop()
  })

  it('warns once backups have been failing for longer than the threshold', async () => {
    const staleBackupAt = Date.now() - 4 * DAY_MS
    const backupToCloud = vi.fn().mockRejectedValue(new Error('network'))
    const onError = vi.fn()
    const service = createService({
      backupToCloud,
      canSafelyBackUp: () => Promise.resolve(true),
      getLastSuccessfulBackupAt: () => Promise.resolve(staleBackupAt),
      retryDelayMs: 100,
      staleBackupThresholdMs: 3 * DAY_MS,
    })

    const stop = service.start({ onError })
    await vi.advanceTimersByTimeAsync(0)
    expect(onError).toHaveBeenCalledWith(expect.any(Error))
    stop()
  })

  it('stops warning after a backup succeeds again', async () => {
    let notifyMutation: () => void = () => undefined
    const backupToCloud = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(undefined)
      .mockRejectedValue(new Error('network'))
    const onError = vi.fn()
    const service = createService({
      backupIntervalMs: 50,
      backupToCloud,
      canSafelyBackUp: () => Promise.resolve(true),
      getLastSuccessfulBackupAt: () => Promise.resolve(Date.now() - 4 * DAY_MS),
      retryDelayMs: 100,
      staleBackupThresholdMs: 3 * DAY_MS,
      subscribeToMutations: (listener) => {
        notifyMutation = listener
        return () => undefined
      },
    })

    const stop = service.start({ onError })
    await vi.advanceTimersByTimeAsync(0)
    expect(onError).toHaveBeenCalledTimes(1)

    // Retry succeeds, refreshing the last-successful timestamp.
    await vi.advanceTimersByTimeAsync(100)
    expect(backupToCloud).toHaveBeenCalledTimes(2)

    // A later failure is no longer stale, so it does not warn again.
    notifyMutation()
    await vi.advanceTimersByTimeAsync(50)
    expect(backupToCloud).toHaveBeenCalledTimes(3)
    expect(onError).toHaveBeenCalledTimes(1)
    stop()
  })

  it('does not overwrite an unrecognized existing cloud backup', async () => {
    const backupToCloud = vi.fn().mockResolvedValue(undefined)
    const onBlocked = vi.fn()
    const onSuccess = vi.fn()
    const service = createService({
      backupToCloud,
      canSafelyBackUp: () => Promise.resolve(false),
    })

    const stop = service.start({ onBlocked, onSuccess })
    await vi.advanceTimersByTimeAsync(0)

    expect(backupToCloud).not.toHaveBeenCalled()
    expect(onBlocked).toHaveBeenCalledOnce()

    service.markCurrentDeviceSafe()
    expect(onSuccess).toHaveBeenCalledOnce()
    stop()
  })
})
