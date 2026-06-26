import { describe, expect, it } from 'vitest'

import {
  clampProgramDurationWeeks,
  currentProgramWeek,
  DEFAULT_PROGRAM_DURATION_WEEKS,
  formatProgramWeek,
  MAX_PROGRAM_DURATION_WEEKS,
  MIN_PROGRAM_DURATION_WEEKS,
  nextUpDayId,
} from './programWeeks'

describe('currentProgramWeek', () => {
  const activatedAt = '2026-01-01T08:00:00.000Z'

  it('treats the activation day as week 1', () => {
    expect(
      currentProgramWeek(activatedAt, new Date('2026-01-01T20:00:00Z')),
    ).toBe(1)
  })

  it('stays in week 1 through the first six days', () => {
    expect(
      currentProgramWeek(activatedAt, new Date('2026-01-07T08:00:00Z')),
    ).toBe(1)
  })

  it('rolls to week 2 on the seventh day', () => {
    expect(
      currentProgramWeek(activatedAt, new Date('2026-01-08T08:00:00Z')),
    ).toBe(2)
  })

  it('counts further weeks', () => {
    // Jan 1 -> Feb 12 is 42 days = exactly six full weeks, i.e. week 7.
    expect(
      currentProgramWeek(activatedAt, new Date('2026-02-12T08:00:00Z')),
    ).toBe(7)
  })

  it('returns week 1 for a future activation or invalid date', () => {
    expect(
      currentProgramWeek(activatedAt, new Date('2025-12-01T08:00:00Z')),
    ).toBe(1)
    expect(
      currentProgramWeek('not-a-date', new Date('2026-02-01T08:00:00Z')),
    ).toBe(1)
  })
})

describe('formatProgramWeek', () => {
  it('labels the current week', () => {
    expect(
      formatProgramWeek(
        '2026-01-01T08:00:00Z',
        new Date('2026-01-15T08:00:00Z'),
      ),
    ).toBe('Week 3')
  })
})

describe('nextUpDayId', () => {
  const days = ['a', 'b', 'c']

  it('returns the first unchecked day in order', () => {
    expect(nextUpDayId(days, new Set(['a']))).toBe('b')
    expect(nextUpDayId(days, new Set(['a', 'b']))).toBe('c')
    expect(nextUpDayId(days, new Set())).toBe('a')
  })

  it('skips checked days that are out of order', () => {
    expect(nextUpDayId(days, new Set(['b']))).toBe('a')
  })

  it('wraps to the first day when every day is checked', () => {
    expect(nextUpDayId(days, new Set(['a', 'b', 'c']))).toBe('a')
  })

  it('returns null when there are no days', () => {
    expect(nextUpDayId([], new Set())).toBeNull()
  })
})

describe('clampProgramDurationWeeks', () => {
  it('rounds and clamps to the supported range', () => {
    expect(clampProgramDurationWeeks(10)).toBe(10)
    expect(clampProgramDurationWeeks(0)).toBe(MIN_PROGRAM_DURATION_WEEKS)
    expect(clampProgramDurationWeeks(500)).toBe(MAX_PROGRAM_DURATION_WEEKS)
    expect(clampProgramDurationWeeks(8.4)).toBe(8)
    expect(clampProgramDurationWeeks(Number.NaN)).toBe(
      DEFAULT_PROGRAM_DURATION_WEEKS,
    )
  })
})
