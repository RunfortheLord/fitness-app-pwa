import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { nativeRestTimerNotificationService } from '@services/nativeRestTimerNotificationService'
import type { RestTimerState } from '@shared-types/app'

const mocks = vi.hoisted(() => ({
  cancel: vi.fn(),
  checkPermissions: vi.fn(),
  getDeliveredNotifications: vi.fn(),
  getPlatform: vi.fn(),
  isNativePlatform: vi.fn(),
  removeDeliveredNotifications: vi.fn(),
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
    getDeliveredNotifications: mocks.getDeliveredNotifications,
    requestPermissions: mocks.requestPermissions,
    removeDeliveredNotifications: mocks.removeDeliveredNotifications,
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
  mocks.getDeliveredNotifications.mockResolvedValue({
    notifications: [
      {
        id: 71_001,
        title: 'Rest timer complete',
        body: 'Your next set is ready.',
      },
      {
        id: 71_002,
        title: 'Timer alert test',
        body: 'This is the iPhone alert used for rest timers.',
      },
      {
        id: 123,
        title: 'NutriFit Timer',
        body: 'Rest complete. Your next set is ready.',
      },
    ],
  })
  mocks.removeDeliveredNotifications.mockResolvedValue(undefined)
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
      nativeRestTimerNotificationService.sync(runningTimer, {}),
    ).resolves.toBe('unavailable')
    expect(mocks.cancel).not.toHaveBeenCalled()
    expect(mocks.schedule).not.toHaveBeenCalled()
  })

  it('replaces the pending notification with the persisted completion time', async () => {
    await expect(
      nativeRestTimerNotificationService.sync(runningTimer, {}),
    ).resolves.toBe('scheduled')

    expect(mocks.cancel).toHaveBeenCalledWith({
      notifications: [{ id: 71_001 }],
    })
    expect(mocks.removeDeliveredNotifications).toHaveBeenCalledWith({
      notifications: [
        {
          id: 71_001,
          title: 'Rest timer complete',
          body: 'Your next set is ready.',
        },
        {
          id: 71_002,
          title: 'Timer alert test',
          body: 'This is the iPhone alert used for rest timers.',
        },
        {
          id: 123,
          title: 'NutriFit Timer',
          body: 'Rest complete. Your next set is ready.',
        },
      ],
    })
    expect(mocks.schedule).toHaveBeenCalledWith({
      notifications: [
        expect.objectContaining({
          id: 71_001,
          schedule: { at: new Date('2026-06-27T12:02:00.000Z') },
          silent: false,
          interruptionLevel: 'timeSensitive',
          extra: { timerId: 'timer-1' },
        }),
      ],
    })
  })

  it('requests permission from the timer-start gesture when needed', async () => {
    mocks.checkPermissions.mockResolvedValue({ display: 'prompt' })

    await expect(
      nativeRestTimerNotificationService.sync(runningTimer, {
        requestPermission: true,
      }),
    ).resolves.toBe('scheduled')

    expect(mocks.requestPermissions).toHaveBeenCalledTimes(1)
    expect(mocks.schedule).toHaveBeenCalledTimes(1)
  })

  it('schedules a banner without sound when timer sounds are disabled', async () => {
    await nativeRestTimerNotificationService.sync(runningTimer, {
      soundEnabled: false,
    })

    expect(mocks.schedule).toHaveBeenCalledWith({
      notifications: [
        expect.objectContaining({
          id: 71_001,
          silent: true,
        }),
      ],
    })
  })

  it('reports when permission must be requested explicitly', async () => {
    mocks.checkPermissions.mockResolvedValue({ display: 'prompt' })

    await expect(
      nativeRestTimerNotificationService.sync(runningTimer),
    ).resolves.toBe('permission-required')

    expect(mocks.requestPermissions).not.toHaveBeenCalled()
    expect(mocks.schedule).not.toHaveBeenCalled()
  })

  it('cancels without rescheduling paused and expired timers', async () => {
    await expect(
      nativeRestTimerNotificationService.sync({
        ...runningTimer,
        status: 'paused',
      }),
    ).resolves.toBe('canceled')
    expect(mocks.schedule).not.toHaveBeenCalled()

    vi.setSystemTime(new Date('2026-06-27T12:03:00.000Z'))
    await expect(
      nativeRestTimerNotificationService.sync(runningTimer),
    ).resolves.toBe('expired')
    expect(mocks.schedule).not.toHaveBeenCalled()
  })

  it('sends an immediate default iPhone alert preview', async () => {
    await expect(nativeRestTimerNotificationService.preview()).resolves.toBe(
      'scheduled',
    )

    expect(mocks.cancel).toHaveBeenCalledWith({
      notifications: [{ id: 71_002 }],
    })
    expect(mocks.removeDeliveredNotifications).toHaveBeenCalledWith({
      notifications: [
        {
          id: 71_001,
          title: 'Rest timer complete',
          body: 'Your next set is ready.',
        },
        {
          id: 71_002,
          title: 'Timer alert test',
          body: 'This is the iPhone alert used for rest timers.',
        },
        {
          id: 123,
          title: 'NutriFit Timer',
          body: 'Rest complete. Your next set is ready.',
        },
      ],
    })
    expect(mocks.schedule).toHaveBeenCalledWith({
      notifications: [
        expect.objectContaining({
          id: 71_002,
          title: 'Timer alert test',
          body: 'This is the iPhone alert used for rest timers.',
          interruptionLevel: 'timeSensitive',
          extra: { preview: true },
        }),
      ],
    })
    expect(
      mocks.schedule.mock.calls[0]?.[0].notifications[0],
    ).not.toHaveProperty('sound')
  })
})
