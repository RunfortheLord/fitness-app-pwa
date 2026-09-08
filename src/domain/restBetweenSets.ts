import type { WorkoutHistorySet, WorkoutSet } from '@shared-types/app'

/** Minimal shape needed to derive rest between two consecutive sets. */
export type RestSetInput = Pick<
  WorkoutSet | WorkoutHistorySet,
  'completed' | 'completedAt' | 'restSecondsUsed'
>

export type RestBetweenSets = {
  /**
   * Wall-clock seconds between the two sets' completion times. This is the real
   * gap the lifter took, and it includes the execution time of the later set,
   * so it is presented as "between sets" rather than pure rest. Null when either
   * set is incomplete or missing a completion timestamp.
   */
  actualSeconds: number | null
  /**
   * Rest duration configured for the earlier set (the planned rest that led into
   * the later set), when a positive value was recorded.
   */
  plannedSeconds: number | null
}

/**
 * Derives the rest information between two consecutive sets, where `previous`
 * was performed immediately before `current`.
 */
export function restBetweenSets(
  previous: RestSetInput,
  current: RestSetInput,
): RestBetweenSets {
  return {
    actualSeconds: actualRestSeconds(previous, current),
    plannedSeconds:
      typeof previous.restSecondsUsed === 'number' &&
      Number.isFinite(previous.restSecondsUsed) &&
      previous.restSecondsUsed > 0
        ? Math.round(previous.restSecondsUsed)
        : null,
  }
}

/** True when the pair carries any rest information worth displaying. */
export function hasRestBetweenSets(rest: RestBetweenSets): boolean {
  return rest.actualSeconds !== null || rest.plannedSeconds !== null
}

function actualRestSeconds(
  previous: RestSetInput,
  current: RestSetInput,
): number | null {
  if (!previous.completed || !current.completed) {
    return null
  }
  if (!previous.completedAt || !current.completedAt) {
    return null
  }
  const start = Date.parse(previous.completedAt)
  const end = Date.parse(current.completedAt)
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return null
  }
  const diffSeconds = Math.round((end - start) / 1000)
  return diffSeconds > 0 ? diffSeconds : null
}
