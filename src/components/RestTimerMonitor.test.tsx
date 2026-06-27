import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RestTimerMonitor } from '@components/RestTimerMonitor'

const mocks = vi.hoisted(() => ({
  completeRestTimer: vi.fn(),
  ensureSettings: vi.fn(),
  getActiveWorkout: vi.fn(),
  playTimerSoundOnce: vi.fn(),
  preloadTimerSound: vi.fn(),
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

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-06-27T12:00:00.000Z'))
  mocks.ensureSettings.mockResolvedValue({
    timerSoundEnabled: true,
    selectedTimerSoundId: 'bright-bell',
  })
  mocks.completeRestTimer.mockResolvedValue(undefined)
  mocks.playTimerSoundOnce.mockResolvedValue(undefined)
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
})
