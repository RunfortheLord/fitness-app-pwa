import type { Exercise } from '@shared-types/app'

export type RankedExerciseReplacement = {
  exercise: Exercise
  score: number
}

export function rankedExerciseReplacements({
  candidates,
  current,
  excludedExerciseIds = [],
  limit = 8,
}: {
  candidates: Exercise[]
  current: Exercise
  excludedExerciseIds?: string[]
  limit?: number
}): Exercise[] {
  const excluded = new Set([current.id, ...excludedExerciseIds])
  return candidates
    .filter((exercise) => exercise.status === 'active')
    .filter((exercise) => !excluded.has(exercise.id))
    .map((exercise) => ({
      exercise,
      score: replacementScore(current, exercise),
    }))
    .filter((result) => result.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.exercise.name.localeCompare(right.exercise.name),
    )
    .slice(0, limit)
    .map((result) => result.exercise)
}

function replacementScore(current: Exercise, candidate: Exercise) {
  const primaryOverlap = overlapScore(
    current.primaryMuscleGroups,
    candidate.primaryMuscleGroups,
    1,
  )
  const relatedOverlap =
    primaryOverlap +
    overlapScore(
      current.primaryMuscleGroups,
      candidate.secondaryMuscleGroups,
      1,
    )
  if (relatedOverlap === 0) {
    return 0
  }
  let score = 0
  if (candidate.trackingMethodId === current.trackingMethodId) {
    score += 8
  }
  if (candidate.equipmentType === current.equipmentType) {
    score += 3
  }
  score += overlapScore(
    current.primaryMuscleGroups,
    candidate.primaryMuscleGroups,
    5,
  )
  score += overlapScore(
    current.primaryMuscleGroups,
    candidate.secondaryMuscleGroups,
    2,
  )
  score += overlapScore(
    current.secondaryMuscleGroups,
    candidate.primaryMuscleGroups,
    2,
  )
  return score
}

function overlapScore(left: string[], right: string[], weight: number) {
  const rightSet = new Set(right)
  return left.filter((value) => rightSet.has(value)).length * weight
}
