import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RestTimerMonitor } from '@components/RestTimerMonitor'

const mocks = vi.hoisted(() => ({
  completeRestTimer: vi.fn(),
  ensureSettings: vi.fn(),
  getActiveWorkout: vi.fn(),
  nativeCancel: vi.fn(),
  nativeShowImmediateAlert: vi.fn(),
  nativeSync: vi.fn(),
  playTimerSoundOnce: vi.fn(),
  preloadTimerSound: vi.fn(),
  usesSystemNotificationTimerSound: vi.fn(),
  webPushCancel: vi.fn(),
  webPushShowImmediateAlert: vi.fn(),
  webPushSync: vi.fn(),
}))

vi.mock('@repositories/workoutRepository', () => ({
  workoutRepository: {
    completeRestTimer: mocks.completeRestTimer,
    getActiveWorkout: mocks.getActiveWorkout,
  },
}))

vi.mock('@repositories/settingsRepository', () => ({
  settingsRepository: {
    ensureSettings: mocks.ensureSettings,
  },
}))

vi.mock('@domain/timerSounds', () => ({
  DEFAULT_TIMER_SOUND_ID: 'rest-complete-chime',
  playTimerSoundOnce: mocks.playTimerSoundOnce,
  preloadTimerSound: mocks.preloadTimerSound,
}))

vi.mock('@services/nativeRestTimerNotificationService', () => ({
  nativeRestTimerNotificationService: {
    cancel: mocks.nativeCancel,
    showImmediateAlert: mocks.nativeShowImmediateAlert,
    sync: mocks.nativeSync,
  },
}))

vi.mock('@services/webPushRestTimerNotificationService', () => ({
  WEB_PUSH_REST_TIMER_NOTIFICATION_TAG: 'nutrifit-rest-timer',
  usesSystemNotificationTimerSound: mocks.usesSystemNotificationTimerSound,
  webPushRestTimerNotificationService: {
    cancel: mocks.webPushCancel,
    showImmediateAlert: mocks.webPushShowImmediateAlert,
    sync: mocks.webPushSync,
  },
}))

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-06-27T12:00:00.000Z'))
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: 'visible',
  })
  mocks.ensureSettings.mockResolvedValue({
    timerSoundEnabled: true,
    selectedTimerSoundId: 'bright-bell',
  })
  mocks.completeRestTimer.mockResolvedValue(undefined)
  mocks.nativeCancel.mockResolvedValue('unavailable')
  mocks.nativeShowImmediateAlert.mockResolvedValue('unavailable')
  mocks.nativeSync.mockResolvedValue('unavailable')
  mocks.playTimerSoundOnce.mockResolvedValue(undefined)
  mocks.usesSystemNotificationTimerSound.mockReturnValue(false)
  mocks.webPushCancel.mockResolvedValue('canceled')
  mocks.webPushShowImmediateAlert.mockResolvedValue('scheduled')
  mocks.webPushSync.mockResolvedValue('unavailable')
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('RestTimerMonitor', () => {
  it('completes and announces an expired timer outside the workout route', async () => {
    mocks.getActiveWorkout.mockResolvedValue({
      id: 'workout-1',
      activeRestTimer: {
        id: 'timer-1',
        startedAt: '2026-06-27T11:59:00.000Z',
        durationSeconds: 30,
        pausedAt: null,
        accumulatedPausedSeconds: 0,
        status: 'running',
      },
    })
    const completionListener = vi.fn()
    window.addEventListener(
      'fitness-log:rest-timer-completed',
      completionListener,
    )

    render(<RestTimerMonitor />)

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mocks.playTimerSoundOnce).toHaveBeenCalledWith('bright-bell')
    expect(mocks.completeRestTimer).toHaveBeenCalledWith('workout-1')
    expect(completionListener).toHaveBeenCalledTimes(1)

    window.removeEventListener(
      'fitness-log:rest-timer-completed',
      completionListener,
    )
  })

  it('keeps polling while another screen is mounted and alerts at expiry', async () => {
    mocks.getActiveWorkout.mockResolvedValue({
      id: 'workout-1',
      activeRestTimer: {
        id: 'timer-1',
        startedAt: '2026-06-27T12:00:00.000Z',
        durationSeconds: 2,
        pausedAt: null,
        accumulatedPausedSeconds: 0,
        status: 'running',
      },
    })

    render(<RestTimerMonitor />)
    await act(async () => {
      await Promise.resolve()
    })
    expect(mocks.playTimerSoundOnce).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000)
    })

    expect(mocks.playTimerSoundOnce).toHaveBeenCalledTimes(1)
    expect(mocks.completeRestTimer).toHaveBeenCalledWith('workout-1')
  })

  it('does not take over media playback when Web Push owns the audible alert', async () => {
    mocks.webPushSync.mockResolvedValue('scheduled')
    mocks.getActiveWorkout.mockResolvedValue({
      id: 'workout-1',
      activeRestTimer: {
        id: 'timer-1',
        startedAt: '2026-06-27T11:59:00.000Z',
        durationSeconds: 30,
        pausedAt: null,
        accumulatedPausedSeconds: 0,
        status: 'running',
      },
    })

    render(<RestTimerMonitor />)
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mocks.webPushSync).toHaveBeenCalled()
    expect(mocks.playTimerSoundOnce).not.toHaveBeenCalled()
    expect(mocks.completeRestTimer).toHaveBeenCalledWith('workout-1')
  })

  it('uses a system notification for visible installed iPhone timer completion', async () => {
    mocks.usesSystemNotificationTimerSound.mockReturnValue(true)
    mocks.webPushSync.mockResolvedValue('failed')
    mocks.getActiveWorkout.mockResolvedValue({
      id: 'workout-1',
      activeRestTimer: {
        id: 'timer-1',
        startedAt: '2026-06-27T11:59:00.000Z',
        durationSeconds: 30,
        pausedAt: null,
        accumulatedPausedSeconds: 0,
        status: 'running',
      },
    })

    render(<RestTimerMonitor />)
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mocks.playTimerSoundOnce).not.toHaveBeenCalled()
    expect(mocks.webPushShowImmediateAlert).toHaveBeenCalledWith({
      body: 'Your next set is ready.',
      tag: 'nutrifit-rest-timer',
      title: 'Rest timer complete',
    })
  })

  it('does not play bundled timer audio in a hidden installed iPhone web app', async () => {
    mocks.usesSystemNotificationTimerSound.mockReturnValue(true)
    mocks.webPushSync.mockResolvedValue('failed')
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    })
    mocks.getActiveWorkout.mockResolvedValue({
      id: 'workout-1',
      activeRestTimer: {
        id: 'timer-1',
        startedAt: '2026-06-27T11:59:00.000Z',
        durationSeconds: 30,
        pausedAt: null,
        accumulatedPausedSeconds: 0,
        status: 'running',
      },
    })

    render(<RestTimerMonitor />)
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mocks.playTimerSoundOnce).not.toHaveBeenCalled()
  })

  it('cancels outside-app alerts when timer banners are disabled', async () => {
    mocks.ensureSettings.mockResolvedValue({
      timerBannersEnabled: false,
      timerSoundEnabled: true,
      selectedTimerSoundId: 'bright-bell',
    })
    mocks.getActiveWorkout.mockResolvedValue({
      id: 'workout-1',
      activeRestTimer: {
        id: 'timer-1',
        startedAt: '2026-06-27T12:00:00.000Z',
        durationSeconds: 120,
        pausedAt: null,
        accumulatedPausedSeconds: 0,
        status: 'running',
      },
    })

    render(<RestTimerMonitor />)
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mocks.nativeSync).not.toHaveBeenCalled()
    expect(mocks.nativeCancel).toHaveBeenCalledTimes(1)
    expect(mocks.webPushCancel).toHaveBeenCalledTimes(1)
  })
})
