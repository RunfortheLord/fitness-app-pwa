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
