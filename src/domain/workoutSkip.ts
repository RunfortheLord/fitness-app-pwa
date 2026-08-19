/**
 * Skip eligibility for a live-workout exercise.
 *
 * A fully completed exercise must not be skippable: every recorded set is done,
 * so there is nothing left to skip. An already skipped exercise is also not a
 * skip target (it would be toggled back via "Unskip" instead).
 */
export function canSkipWorkoutExercise(
  sets: ReadonlyArray<{ completed: boolean }>,
  alreadySkipped = false,
) {
  const allSetsComplete =
    sets.length > 0 && sets.every((workoutSet) => workoutSet.completed)
  return !alreadySkipped && !allSetsComplete
}

/**
 * Whether an exercise still has recorded sets that require attention.
 *
 * Skipping is an explicit resolution for the exercise. Its incomplete set
 * snapshots stay in the active workout for persistence and history, but they
 * must not send live-workout navigation back to the exercise or block the
 * finish prompt.
 */
export function hasPendingWorkoutExerciseWork(
  sets: ReadonlyArray<{ completed: boolean }>,
  skipped = false,
) {
  return !skipped && sets.some((workoutSet) => !workoutSet.completed)
}
