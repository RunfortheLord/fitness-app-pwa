import type { WorkoutHistorySet, WorkoutSet } from '@shared-types/app'

/** Minimal shape needed to derive rest between two consecutive sets. */
export type RestSetInput = Pick<
  WorkoutSet | WorkoutHistorySet,
  'restSecondsUsed'
>

export type RestBetweenSets = {
  /**
   * Rest duration configured for the earlier set (the planned rest that led into
   * the later set), when a positive value was recorded. History treats the next
   * set as starting when this timer finished instead of deriving a wall-clock
   * gap from completion timestamps.
   */
  plannedSeconds: number | null
}

/**
 * Derives the selected rest between consecutive sets from the earlier set.
 */
export function restBetweenSets(
  previous: RestSetInput,
  fallbackSeconds: number | null = null,
): RestBetweenSets {
  const selectedSeconds = previous.restSecondsUsed ?? fallbackSeconds
  return {
    plannedSeconds:
      typeof selectedSeconds === 'number' &&
      Number.isFinite(selectedSeconds) &&
      selectedSeconds > 0
        ? Math.round(selectedSeconds)
        : null,
  }
}

/** True when the pair carries any rest information worth displaying. */
export function hasRestBetweenSets(rest: RestBetweenSets): boolean {
  return rest.plannedSeconds !== null
}
