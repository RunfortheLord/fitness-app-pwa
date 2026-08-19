import { describe, expect, it } from 'vitest'

import {
  accumulatedWorkoutPauseSeconds,
  formatClockDuration,
  formatWorkoutDuration,
  inactivityPauseAt,
  workoutElapsedSeconds,
} from '@domain/workoutTiming'

describe('workoutTiming', () => {
  it('freezes elapsed time at the current workout pause', () => {
    expect(
      workoutElapsedSeconds(
        {
          startedAt: '2026-08-03T10:00:00.000Z',
          pausedAt: '2026-08-03T11:00:00.000Z',
          elapsedPausedSeconds: 300,
        },
        '2026-08-03T15:00:00.000Z',
      ),
    ).toBe(3300)
  })

  it('adds the current pause when a workout resumes', () => {
    expect(
      accumulatedWorkoutPauseSeconds(
        {
          pausedAt: '2026-08-03T11:00:00.000Z',
          elapsedPausedSeconds: 120,
        },
        '2026-08-03T11:15:00.000Z',
      ),
    ).toBe(1020)
  })

  it('pauses exactly fifteen minutes after the last activity', () => {
    const lastActivityAt = Date.parse('2026-08-03T10:00:00.000Z')
    expect(
      inactivityPauseAt(lastActivityAt, lastActivityAt + 899_999),
    ).toBeNull()
    expect(inactivityPauseAt(lastActivityAt, lastActivityAt + 900_000)).toBe(
      '2026-08-03T10:15:00.000Z',
    )
  })

  it('uses hours for long workout clocks and summaries', () => {
    expect(formatClockDuration(51_298 * 60 + 42)).toBe('854:58:42')
    expect(formatClockDuration(65)).toBe('1:05')
    expect(formatWorkoutDuration(5_700)).toBe('1 hr 35 min')
  })
})
