import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { nativeRestTimerNotificationService } from '@services/nativeRestTimerNotificationService'
import type { RestTimerState } from '@shared-types/app'

const mocks = vi.hoisted(() => ({
  cancel: vi.fn(),
  checkPermissions: vi.fn(),
  getPlatform: vi.fn(),
  isNativePlatform: vi.fn(),
  requestPermissions: vi.fn(),
  schedule: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: mocks.getPlatform,
    isNativePlatform: mocks.isNativePlatform,
  },
}))

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    cancel: mocks.cancel,
    checkPermissions: mocks.checkPermissions,
    requestPermissions: mocks.requestPermissions,
    schedule: mocks.schedule,
  },
}))

const runningTimer: RestTimerState = {
  id: 'timer-1',
  startedAt: '2026-06-27T12:00:00.000Z',
  durationSeconds: 90,
  pausedAt: null,
  accumulatedPausedSeconds: 30,
  status: 'running',
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-06-27T12:00:30.000Z'))
  mocks.isNativePlatform.mockReturnValue(true)
  mocks.getPlatform.mockReturnValue('ios')
  mocks.checkPermissions.mockResolvedValue({ display: 'granted' })
  mocks.requestPermissions.mockResolvedValue({ display: 'granted' })
  mocks.cancel.mockResolvedValue(undefined)
  mocks.schedule.mockResolvedValue({ notifications: [{ id: 71_001 }] })
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('nativeRestTimerNotificationService', () => {
  it('does nothing in the browser', async () => {
    mocks.isNativePlatform.mockReturnValue(false)

    await expect(
      nativeRestTimerNotificationService.sync(runningTimer, 'bright-bell', {}),
    ).resolves.toBe('unavailable')
    expect(mocks.cancel).not.toHaveBeenCalled()
    expect(mocks.schedule).not.toHaveBeenCalled()
  })

  it('replaces the pending notification with the persisted completion time', async () => {
    await expect(
      nativeRestTimerNotificationService.sync(runningTimer, 'bright-bell', {}),
    ).resolves.toBe('scheduled')

    expect(mocks.cancel).toHaveBeenCalledWith({
      notifications: [{ id: 71_001 }],
    })
    expect(mocks.schedule).toHaveBeenCalledWith({
      notifications: [
        expect.objectContaining({
          id: 71_001,
          schedule: { at: new Date('2026-06-27T12:02:00.000Z') },
          sound: 'bright-bell.wav',
          silent: true,
          interruptionLevel: 'timeSensitive',
          extra: { timerId: 'timer-1' },
        }),
      ],
    })
  })

  it('requests permission from the timer-start gesture when needed', async () => {
    mocks.checkPermissions.mockResolvedValue({ display: 'prompt' })

    await expect(
      nativeRestTimerNotificationService.sync(runningTimer, 'clear-ding', {
        requestPermission: true,
      }),
    ).resolves.toBe('scheduled')

    expect(mocks.requestPermissions).toHaveBeenCalledTimes(1)
    expect(mocks.schedule).toHaveBeenCalledTimes(1)
  })

  it('schedules a banner without sound when timer sounds are disabled', async () => {
    await nativeRestTimerNotificationService.sync(runningTimer, 'bright-bell', {
      soundEnabled: false,
    })

    expect(mocks.schedule).toHaveBeenCalledWith({
      notifications: [
        expect.objectContaining({
          id: 71_001,
          sound: undefined,
        }),
      ],
    })
  })

  it('reports when permission must be requested explicitly', async () => {
    mocks.checkPermissions.mockResolvedValue({ display: 'prompt' })

    await expect(
      nativeRestTimerNotificationService.sync(runningTimer, 'clear-ding'),
    ).resolves.toBe('permission-required')

    expect(mocks.requestPermissions).not.toHaveBeenCalled()
    expect(mocks.schedule).not.toHaveBeenCalled()
  })

  it('cancels without rescheduling paused and expired timers', async () => {
    await expect(
      nativeRestTimerNotificationService.sync(
        { ...runningTimer, status: 'paused' },
        'bright-bell',
      ),
    ).resolves.toBe('canceled')
    expect(mocks.schedule).not.toHaveBeenCalled()

    vi.setSystemTime(new Date('2026-06-27T12:03:00.000Z'))
    await expect(
      nativeRestTimerNotificationService.sync(runningTimer, 'bright-bell'),
    ).resolves.toBe('expired')
    expect(mocks.schedule).not.toHaveBeenCalled()
  })
})
