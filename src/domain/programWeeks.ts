/** Built-in programs (and the create-program form) default to a 10-week plan. */
export const DEFAULT_PROGRAM_DURATION_WEEKS = 10

/** Allowed range for a user-set program length, in weeks. */
export const MIN_PROGRAM_DURATION_WEEKS = 1
export const MAX_PROGRAM_DURATION_WEEKS = 104
export const DEFAULT_DELOAD_RIR_INCREASE = 3
export const DEFAULT_DELOAD_SET_REDUCTION = 1
export const DEFAULT_DELOAD_WEEK_NUMBERS = [1] as const
const DEFAULT_TARGET_RIR = 2

/** The subset of an ActiveCycleDayCheck that week derivation needs. */
export type ProgramWeekCheck = {
  weekNumber: number
  dayId: string
  checked: boolean
}

/**
 * 1-based current week of a cycle, driven by day check-offs instead of the
 * calendar. The current week is the latest week holding a checked day; once
 * every day of that week is checked the cycle rolls into the next week (so
 * the fresh week starts with no checks). Weeks complete when the training is
 * done, not when seven calendar days pass. Returns 1 when nothing is checked
 * or the cycle has no days.
 */
export function completionProgramWeek(
  checks: readonly ProgramWeekCheck[],
  dayIds: readonly string[],
): number {
  const dayIdSet = new Set(dayIds)
  if (dayIdSet.size === 0) {
    return 1
  }
  const checkedByWeek = new Map<number, Set<string>>()
  for (const check of checks) {
    if (!check.checked || !dayIdSet.has(check.dayId)) {
      continue
    }
    const days = checkedByWeek.get(check.weekNumber) ?? new Set<string>()
    days.add(check.dayId)
    checkedByWeek.set(check.weekNumber, days)
  }
  if (checkedByWeek.size === 0) {
    return 1
  }
  const latestWeek = Math.max(...checkedByWeek.keys())
  const latestCheckedDays = checkedByWeek.get(latestWeek)
  return latestCheckedDays && latestCheckedDays.size >= dayIdSet.size
    ? latestWeek + 1
    : latestWeek
}

/** The explicitly selected cycle week. Completion advancement is handled by
 * nextProgramWeekAfterCompletion so visiting another week never hides its
 * persisted checks or forces the selected week forward at read time.
 */
export function currentProgramWeek(
  configuredWeek: number | null | undefined,
  checks: readonly ProgramWeekCheck[],
  dayIds: readonly string[],
): number {
  void checks
  void dayIds
  return Number.isFinite(configuredWeek)
    ? Math.max(1, Math.round(configuredWeek ?? 1))
    : 1
}

export function isProgramWeekComplete(
  checks: readonly ProgramWeekCheck[],
  dayIds: readonly string[],
  weekNumber: number,
) {
  const expected = new Set(dayIds)
  if (!expected.size) {
    return false
  }
  const completed = new Set(
    checks
      .filter(
        (check) =>
          check.checked &&
          check.weekNumber === weekNumber &&
          expected.has(check.dayId),
      )
      .map((check) => check.dayId),
  )
  return completed.size === expected.size
}

export function nextProgramWeekAfterCompletion({
  checks,
  dayIds,
  durationWeeks,
  weekNumber,
}: {
  checks: readonly ProgramWeekCheck[]
  dayIds: readonly string[]
  durationWeeks: number
  weekNumber: number
}) {
  const lastWeek = clampProgramDurationWeeks(durationWeeks)
  let nextWeek = Math.min(lastWeek, Math.max(1, Math.round(weekNumber)))
  while (
    nextWeek < lastWeek &&
    isProgramWeekComplete(checks, dayIds, nextWeek)
  ) {
    nextWeek += 1
  }
  return nextWeek
}

export function normalizeDeloadWeekNumbers(
  weeks: readonly number[] | null | undefined,
  durationWeeks: number,
) {
  const lastWeek = clampProgramDurationWeeks(durationWeeks)
  return [...new Set(weeks ?? [])]
    .filter((week) => Number.isInteger(week) && week >= 1 && week <= lastWeek)
    .sort((left, right) => left - right)
}

export function isDeloadWeek(
  weekNumber: number,
  deloadWeekNumbers: readonly number[] | null | undefined,
) {
  return (deloadWeekNumbers ?? []).includes(weekNumber)
}

export function formatProgramWeekLabel(
  weekNumber: number,
  deloadWeekNumbers: readonly number[] | null | undefined,
) {
  const normalized = [...new Set(deloadWeekNumbers ?? [])]
    .filter((week) => Number.isInteger(week) && week >= 1)
    .sort((left, right) => left - right)
  const deloadIndex = normalized.indexOf(Math.round(weekNumber))
  return deloadIndex >= 0 ? `Deload ${deloadIndex + 1}` : `Week ${weekNumber}`
}

export function deloadTargetSetCount(targetSetCount: number) {
  return Math.max(1, targetSetCount - DEFAULT_DELOAD_SET_REDUCTION)
}

export function deloadTargetRir(targetRir: number | null) {
  return Math.min(
    10,
    (targetRir ?? DEFAULT_TARGET_RIR) + DEFAULT_DELOAD_RIR_INCREASE,
  )
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
