import type {
  ActiveCycleWorkoutExercise,
  WorkoutHistoryExercise,
  WorkoutHistorySet,
} from '@shared-types/app'

export type RirPrefillMap = Record<string, Record<number, number>>

export function mapLastWorkoutRirToCurrentDay({
  currentExercises,
  previousExercises,
  previousSetsByExercise,
}: {
  currentExercises: ActiveCycleWorkoutExercise[]
  previousExercises: WorkoutHistoryExercise[]
  previousSetsByExercise: Record<string, WorkoutHistorySet[]>
}): RirPrefillMap {
  const previousBySource = new Map(
    previousExercises
      .filter((exercise) => exercise.sourcePrescribedExerciseId)
      .map((exercise) => [exercise.sourcePrescribedExerciseId!, exercise]),
  )
  const result: RirPrefillMap = {}

  for (const current of currentExercises) {
    const previous = previousBySource.get(current.id)
    if (!previous || previous.exerciseId !== current.exerciseId) {
      continue
    }
    if (
      previous.exerciseSnapshot.trackingMethodId !==
      current.exerciseSnapshot.trackingMethodId
    ) {
      continue
    }
    const previousSets = previousSetsByExercise[previous.id] ?? []
    for (const set of previousSets) {
      if (
        set.setNumber < 1 ||
        set.setNumber > current.targetSetCount ||
        set.rir === null
      ) {
        continue
      }
      result[current.id] ??= {}
      result[current.id][set.setNumber] = set.rir
    }
  }

  return result
}
