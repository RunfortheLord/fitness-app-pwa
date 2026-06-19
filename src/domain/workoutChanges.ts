import type {
  ActiveCycleWorkoutExercise,
  DetectedStructuralChangeType,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@shared-types/app'

export type DetectedWorkoutChangeDraft = {
  type: DetectedStructuralChangeType
  description: string
  sourcePath: string
  performedPath: string
}

type DetectWorkoutChangesInput = {
  sourceExercises: ActiveCycleWorkoutExercise[]
  workout: Workout
  performedExercises: WorkoutExercise[]
  performedSetsByExercise: Record<string, WorkoutSet[]>
}

export function detectWorkoutStructuralChanges({
  sourceExercises,
  workout,
  performedExercises,
  performedSetsByExercise,
}: DetectWorkoutChangesInput): DetectedWorkoutChangeDraft[] {
  const changes: DetectedWorkoutChangeDraft[] = []
  const orderedSource = [...sourceExercises].sort(
    (first, second) => first.orderIndex - second.orderIndex,
  )
  const orderedPerformed = [...performedExercises].sort(
    (first, second) => first.orderIndex - second.orderIndex,
  )
  const sourceById = new Map(
    orderedSource.map((exercise) => [exercise.id, exercise]),
  )
  const performedBySourceId = new Map(
    orderedPerformed
      .filter((exercise) => exercise.sourcePrescribedExerciseId)
      .map((exercise) => [exercise.sourcePrescribedExerciseId!, exercise]),
  )

  for (const sourceExercise of orderedSource) {
    const performed = performedBySourceId.get(sourceExercise.id)
    if (!performed) {
      changes.push({
        type: 'exercise_skipped_or_removed',
        description: `Removed ${sourceExercise.exerciseSnapshot.exerciseName}`,
        sourcePath: sourceExercisePath(workout, sourceExercise),
        performedPath: workoutPath(workout),
      })
      continue
    }

    if (performed.skipped) {
      changes.push({
        type: 'exercise_skipped_or_removed',
        description: `Skipped ${sourceExercise.exerciseSnapshot.exerciseName}`,
        sourcePath: sourceExercisePath(workout, sourceExercise),
        performedPath: performedExercisePath(workout, performed),
      })
    }

    if (
      performed.exerciseId !== sourceExercise.exerciseId ||
      performed.replacementOfExerciseId
    ) {
      changes.push({
        type: 'exercise_replaced',
        description: `Replaced ${sourceExercise.exerciseSnapshot.exerciseName} with ${performed.exerciseSnapshot.exerciseName}`,
        sourcePath: sourceExercisePath(workout, sourceExercise),
        performedPath: performedExercisePath(workout, performed),
      })
    }

    const performedSetCount = performedSetsByExercise[performed.id]?.length ?? 0
    if (performedSetCount > sourceExercise.targetSetCount) {
      changes.push({
        type: 'set_added',
        description: `Added ${formatOrdinal(performedSetCount)} ${sourceExercise.exerciseSnapshot.exerciseName} set`,
        sourcePath: sourceExercisePath(workout, sourceExercise),
        performedPath: performedExercisePath(workout, performed),
      })
    }
    if (performedSetCount < sourceExercise.targetSetCount) {
      changes.push({
        type: 'set_removed',
        description: `Removed ${formatOrdinal(sourceExercise.targetSetCount)} ${sourceExercise.exerciseSnapshot.exerciseName} set`,
        sourcePath: sourceExercisePath(workout, sourceExercise),
        performedPath: performedExercisePath(workout, performed),
      })
    }
  }

  for (const performed of orderedPerformed) {
    if (!performed.sourcePrescribedExerciseId) {
      changes.push({
        type: 'exercise_added',
        description: `Added ${performed.exerciseSnapshot.exerciseName}`,
        sourcePath: workout.sourceDayId
          ? `cycle:${workout.sourceActiveCycleId ?? ''};day:${workout.sourceDayId};template:${workout.sourceTemplateId ?? ''}`
          : workoutPath(workout),
        performedPath: performedExercisePath(workout, performed),
      })
    }
  }

  const performedSourceOrder = orderedPerformed
    .map((exercise) => exercise.sourcePrescribedExerciseId)
    .filter((id): id is string => Boolean(id))
    .filter((id) => sourceById.has(id))
  const sourceOrderInPerformed = orderedSource
    .map((exercise) => exercise.id)
    .filter((id) => performedBySourceId.has(id))
  if (
    performedSourceOrder.length > 1 &&
    performedSourceOrder.some(
      (id, index) => id !== sourceOrderInPerformed[index],
    )
  ) {
    changes.push({
      type: 'exercise_order_changed',
      description: 'Changed exercise order',
      sourcePath: workout.sourceDayId
        ? `cycle:${workout.sourceActiveCycleId ?? ''};day:${workout.sourceDayId};template:${workout.sourceTemplateId ?? ''}`
        : workoutPath(workout),
      performedPath: workoutPath(workout),
    })
  }

  return changes
}

function sourceExercisePath(
  workout: Workout,
  exercise: ActiveCycleWorkoutExercise,
) {
  return `cycle:${workout.sourceActiveCycleId ?? ''};day:${exercise.dayId};exercise:${exercise.id};template:${workout.sourceTemplateId ?? ''};templateExercise:${exercise.sourceTemplateExerciseId ?? ''}`
}

function performedExercisePath(workout: Workout, exercise: WorkoutExercise) {
  return `workout:${workout.id};exercise:${exercise.id}`
}

function workoutPath(workout: Workout) {
  return `workout:${workout.id}`
}

function formatOrdinal(value: number) {
  const remainder = value % 100
  if (remainder >= 11 && remainder <= 13) {
    return `${value}th`
  }
  switch (value % 10) {
    case 1:
      return `${value}st`
    case 2:
      return `${value}nd`
    case 3:
      return `${value}rd`
    default:
      return `${value}th`
  }
}
