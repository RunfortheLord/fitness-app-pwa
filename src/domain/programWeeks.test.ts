import { describe, expect, it } from 'vitest'

import {
  clampProgramDurationWeeks,
  completionProgramWeek,
  currentProgramWeek,
  deloadTargetRir,
  deloadTargetSetCount,
  DEFAULT_PROGRAM_DURATION_WEEKS,
  MAX_PROGRAM_DURATION_WEEKS,
  MIN_PROGRAM_DURATION_WEEKS,
  nextProgramWeekAfterCompletion,
  normalizeDeloadWeekNumbers,
  formatProgramWeekLabel,
  nextUpDayId,
  type ProgramWeekCheck,
} from './programWeeks'

describe('completionProgramWeek', () => {
  const dayIds = ['a', 'b', 'c']

  function check(
    weekNumber: number,
    dayId: string,
    checked = true,
  ): ProgramWeekCheck {
    return { weekNumber, dayId, checked }
  }

  it('starts at week 1 with no checks', () => {
    expect(completionProgramWeek([], dayIds)).toBe(1)
  })

  it('stays in the latest partially checked week', () => {
    expect(completionProgramWeek([check(1, 'a')], dayIds)).toBe(1)
    expect(completionProgramWeek([check(1, 'a'), check(1, 'b')], dayIds)).toBe(
      1,
    )
  })

  it('rolls into the next week once every day is checked', () => {
    expect(
      completionProgramWeek(
        [check(1, 'a'), check(1, 'b'), check(1, 'c')],
        dayIds,
      ),
    ).toBe(2)
  })

  it('tracks the latest week with checks, ignoring earlier gaps', () => {
    // Legacy calendar-based data can leave week 1 incomplete while week 3
    // already has checks; the current week is driven by the latest activity.
    expect(completionProgramWeek([check(1, 'a'), check(3, 'b')], dayIds)).toBe(
      3,
    )
  })

  it('ignores unchecked records and unknown days', () => {
    expect(
      completionProgramWeek(
        [
          check(1, 'a'),
          check(1, 'b'),
          check(1, 'c', false),
          check(1, 'deleted-day'),
        ],
        dayIds,
      ),
    ).toBe(1)
  })

  it('returns week 1 when the cycle has no days', () => {
    expect(completionProgramWeek([check(1, 'a')], [])).toBe(1)
  })
})

describe('currentProgramWeek', () => {
  const days = ['a', 'b']

  it('uses the persisted selection even when another week has checks', () => {
    expect(currentProgramWeek(4, [], days)).toBe(4)
    expect(
      currentProgramWeek(
        4,
        [
          { weekNumber: 4, dayId: 'a', checked: true },
          { weekNumber: 4, dayId: 'b', checked: true },
        ],
        days,
      ),
    ).toBe(4)
  })
})

describe('nextProgramWeekAfterCompletion', () => {
  const days = ['a', 'b']

  it('advances through completed weeks and stops at the next incomplete week', () => {
    expect(
      nextProgramWeekAfterCompletion({
        checks: [
          { weekNumber: 1, dayId: 'a', checked: true },
          { weekNumber: 1, dayId: 'b', checked: true },
          { weekNumber: 2, dayId: 'a', checked: true },
          { weekNumber: 2, dayId: 'b', checked: true },
        ],
        dayIds: days,
        durationWeeks: 4,
        weekNumber: 1,
      }),
    ).toBe(3)
  })

  it('stays on a partial week and caps at the program duration', () => {
    expect(
      nextProgramWeekAfterCompletion({
        checks: [{ weekNumber: 2, dayId: 'a', checked: true }],
        dayIds: days,
        durationWeeks: 4,
        weekNumber: 2,
      }),
    ).toBe(2)
    expect(
      nextProgramWeekAfterCompletion({
        checks: days.map((dayId) => ({
          weekNumber: 4,
          dayId,
          checked: true,
        })),
        dayIds: days,
        durationWeeks: 4,
        weekNumber: 4,
      }),
    ).toBe(4)
  })
})

describe('deload defaults', () => {
  it('normalizes scheduled weeks and applies the default set and RIR changes', () => {
    expect(normalizeDeloadWeekNumbers([4, 2, 4, 99], 6)).toEqual([2, 4])
    expect(deloadTargetSetCount(4)).toBe(3)
    expect(deloadTargetSetCount(1)).toBe(1)
    expect(deloadTargetRir(2)).toBe(5)
    expect(deloadTargetRir(9)).toBe(10)
    expect(deloadTargetRir(null)).toBe(5)
    expect(formatProgramWeekLabel(5, [1, 5, 8])).toBe('Deload 2')
    expect(formatProgramWeekLabel(6, [1, 5, 8])).toBe('Week 6')
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
