import { describe, expect, it } from 'vitest'

import {
  getRestTimerCompletionDate,
  getRestTimerRemainingSeconds,
} from '@domain/restTimer'
import type { RestTimerState } from '@shared-types/app'

describe('restTimer', () => {
  it('derives remaining time from absolute timestamps after resume', () => {
    const timer: RestTimerState = {
      id: 'timer-1',
      startedAt: '2026-06-19T10:00:00.000Z',
      durationSeconds: 120,
      pausedAt: null,
      accumulatedPausedSeconds: 30,
      status: 'running',
    }

    expect(
      getRestTimerRemainingSeconds(timer, '2026-06-19T10:01:15.000Z'),
    ).toBe(75)
  })

  it('freezes remaining time while paused', () => {
    const timer: RestTimerState = {
      id: 'timer-1',
      startedAt: '2026-06-19T10:00:00.000Z',
      durationSeconds: 90,
      pausedAt: '2026-06-19T10:00:20.000Z',
      accumulatedPausedSeconds: 0,
      status: 'paused',
    }

    expect(
      getRestTimerRemainingSeconds(timer, '2026-06-19T10:05:00.000Z'),
    ).toBe(70)
  })

  it('never shows more than the configured duration when the render clock is stale', () => {
    const timer: RestTimerState = {
      id: 'timer-1',
      startedAt: '2026-06-19T10:00:02.000Z',
      durationSeconds: 90,
      pausedAt: null,
      accumulatedPausedSeconds: 0,
      status: 'running',
    }

    expect(
      getRestTimerRemainingSeconds(timer, '2026-06-19T10:00:00.000Z'),
    ).toBe(90)
  })

  it('derives the exact native notification time after resumed pauses', () => {
    const timer: RestTimerState = {
      id: 'timer-1',
      startedAt: '2026-06-19T10:00:00.000Z',
      durationSeconds: 90,
      pausedAt: null,
      accumulatedPausedSeconds: 30,
      status: 'running',
    }

    expect(getRestTimerCompletionDate(timer)?.toISOString()).toBe(
      '2026-06-19T10:02:00.000Z',
    )
  })

  it('does not schedule paused, completed, or malformed timers', () => {
    const timer: RestTimerState = {
      id: 'timer-1',
      startedAt: 'invalid',
      durationSeconds: 90,
      pausedAt: null,
      accumulatedPausedSeconds: 0,
      status: 'running',
    }

    expect(getRestTimerCompletionDate(timer)).toBeNull()
    expect(
      getRestTimerCompletionDate({
        ...timer,
        startedAt: '2026-06-19T10:00:00.000Z',
        status: 'paused',
      }),
    ).toBeNull()
  })
})
