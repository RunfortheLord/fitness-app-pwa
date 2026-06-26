import { differenceInCalendarDays } from 'date-fns'

/** Built-in programs (and the create-program form) default to a 10-week plan. */
export const DEFAULT_PROGRAM_DURATION_WEEKS = 10

/** Allowed range for a user-set program length, in weeks. */
export const MIN_PROGRAM_DURATION_WEEKS = 1
export const MAX_PROGRAM_DURATION_WEEKS = 104

/**
 * 1-based current week of a program cycle, counted in calendar weeks from the
 * activation date — the activation day itself is week 1. Returns 1 for an
 * unparseable date or a future activation.
 */
export function currentProgramWeek(
  activatedAt: string,
  now: Date = new Date(),
): number {
  const start = new Date(activatedAt)
  if (Number.isNaN(start.getTime())) {
    return 1
  }
  const days = differenceInCalendarDays(now, start)
  if (days <= 0) {
    return 1
  }
  return Math.floor(days / 7) + 1
}

/** Short label for the active-cycle card, e.g. "Week 3". */
export function formatProgramWeek(
  activatedAt: string,
  now: Date = new Date(),
): string {
  return `Week ${currentProgramWeek(activatedAt, now)}`
}

/**
 * The next day to train this week: the first day, in order, that has not been
 * checked off. Returns the first day when everything is checked (the week's
 * rotation has wrapped) and null when there are no days.
 */
export function nextUpDayId(
  orderedDayIds: string[],
  checkedDayIds: ReadonlySet<string>,
): string | null {
  if (orderedDayIds.length === 0) {
    return null
  }
  const next = orderedDayIds.find((dayId) => !checkedDayIds.has(dayId))
  return next ?? orderedDayIds[0]
}

/** Clamp a (possibly user-entered) week count to the supported range. */
export function clampProgramDurationWeeks(weeks: number): number {
  if (!Number.isFinite(weeks)) {
    return DEFAULT_PROGRAM_DURATION_WEEKS
  }
  const rounded = Math.round(weeks)
  return Math.min(
    MAX_PROGRAM_DURATION_WEEKS,
    Math.max(MIN_PROGRAM_DURATION_WEEKS, rounded),
  )
}
