import { describe, expect, it } from 'vitest'

import { getRestTimerRemainingSeconds } from '@domain/restTimer'
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
})
