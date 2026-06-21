import type { Exercise, MuscleGroup } from '@shared-types/app'

export type ExerciseTrackingCategory =
  | 'all'
  | 'strength'
  | 'cardio'
  | 'distance'

export type ExerciseUsageSummary = Record<
  string,
  { count: number; lastUsedAt: string | null }
>

export type ExerciseSearchResult = {
  exercise: Exercise
  reason: 'exact' | 'prefix' | 'word' | 'recent' | 'common' | 'substring'
}

const commonBuiltInIds = new Set([
  'builtin:barbell-bench-press',
  'builtin:dumbbell-bench-press',
  'builtin:smith-machine-bench-press',
  'builtin:machine-chest-press',
  'builtin:high-bar-back-squat',
  'builtin:low-bar-back-squat',
  'builtin:conventional-deadlift',
  'builtin:romanian-deadlift',
  'builtin:pull-up',
  'builtin:lat-pulldown',
  'builtin:barbell-row',
  'builtin:leg-press',
])

export function normalizeExerciseSearchText(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function hasSearchableQuery(query: string) {
  return normalizeExerciseSearchText(query).length >= 2
}

export function searchExercises(
  exercises: Exercise[],
  query: string,
  usage: ExerciseUsageSummary = {},
  limit = 30,
): ExerciseSearchResult[] {
  const normalizedQuery = normalizeExerciseSearchText(query)
  if (normalizedQuery.length < 2) {
    return []
  }

  return uniqueById(exercises)
    .filter((exercise) => exercise.status === 'active')
    .map((exercise) => {
      const normalizedName = normalizeExerciseSearchText(exercise.name)
      const wordIndex = normalizedName
        .split(' ')
        .findIndex((word) => word.startsWith(normalizedQuery))
      const substringIndex = normalizedName.indexOf(normalizedQuery)
      const used = usage[exercise.id]?.count ?? 0
      const common = commonBuiltInIds.has(exercise.id)
      let base = Number.POSITIVE_INFINITY
      let reason: ExerciseSearchResult['reason'] = 'substring'

      if (normalizedName === normalizedQuery) {
        base = 0
        reason = 'exact'
      } else if (normalizedName.startsWith(normalizedQuery)) {
        base = 10
        reason = 'prefix'
      } else if (wordIndex >= 0) {
        base = 20 + wordIndex / 10
        reason = 'word'
      } else if (substringIndex >= 0) {
        base = 50 + substringIndex / 100
        reason = 'substring'
      }

      if (!Number.isFinite(base)) {
        return null
      }

      const boost = Math.min(used, 5) * 0.15 + (common ? 0.1 : 0)
      if (used > 0 && base >= 20) {
        reason = 'recent'
      } else if (common && base >= 20) {
        reason = 'common'
      }

      return { exercise, reason, score: base - boost }
    })
    .filter((result): result is ExerciseSearchResult & { score: number } =>
      Boolean(result),
    )
    .sort(
      (left, right) =>
        left.score - right.score ||
        right.exercise.origin.localeCompare(left.exercise.origin) ||
        left.exercise.name.localeCompare(right.exercise.name),
    )
    .slice(0, limit)
    .map(({ exercise, reason }) => ({ exercise, reason }))
}

export function filterExerciseLibrary(
  exercises: Exercise[],
  {
    primaryMuscle,
    query,
    trackingCategory,
  }: {
    primaryMuscle: MuscleGroup | 'all'
    query: string
    trackingCategory: ExerciseTrackingCategory
  },
) {
  const normalizedQuery = normalizeExerciseSearchText(query)
  return uniqueById(exercises)
    .filter((exercise) => {
      if (!normalizedQuery) {
        return true
      }
      return normalizeExerciseSearchText(exercise.name).includes(
        normalizedQuery,
      )
    })
    .filter((exercise) => {
      if (trackingCategory === 'all') {
        return true
      }
      return getExerciseTrackingCategory(exercise) === trackingCategory
    })
    .filter((exercise) => {
      if (trackingCategory !== 'strength' || primaryMuscle === 'all') {
        return true
      }
      return exercise.primaryMuscleGroups[0] === primaryMuscle
    })
    .sort((left, right) => left.name.localeCompare(right.name))
}

export function getExerciseTrackingCategory(
  exercise: Pick<Exercise, 'name' | 'trackingMethodId'>,
): Exclude<ExerciseTrackingCategory, 'all'> {
  if (exercise.trackingMethodId === 'distance_duration') {
    return 'distance'
  }
  if (
    exercise.trackingMethodId === 'duration' &&
    cardioNamePattern.test(normalizeExerciseSearchText(exercise.name))
  ) {
    return 'cardio'
  }
  return 'strength'
}

export function primaryMuscleLabel(muscle: MuscleGroup) {
  const labels: Record<MuscleGroup, string> = {
    back: 'Back',
    biceps: 'Biceps',
    calves: 'Calves',
    chest: 'Chest',
    core: 'Core',
    forearms: 'Forearms / Grip',
    glutes: 'Glutes',
    hamstrings: 'Hamstrings',
    'hip abductors': 'Hip Abductors',
    'hip adductors': 'Hip Adductors',
    quadriceps: 'Quadriceps',
    shoulders: 'Shoulders',
    traps: 'Other',
    triceps: 'Triceps',
  }
  return labels[muscle]
}

export function defaultExerciseResults(
  exercises: Exercise[],
  usage: ExerciseUsageSummary = {},
  limit = 8,
) {
  return uniqueById(exercises)
    .filter((exercise) => exercise.status === 'active')
    .map((exercise) => ({
      exercise,
      count: usage[exercise.id]?.count ?? 0,
      lastUsedAt: usage[exercise.id]?.lastUsedAt ?? '',
      common: commonBuiltInIds.has(exercise.id),
    }))
    .filter((item) => item.count > 0 || item.common)
    .sort(
      (left, right) =>
        right.count - left.count ||
        right.lastUsedAt.localeCompare(left.lastUsedAt) ||
        Number(right.common) - Number(left.common) ||
        left.exercise.name.localeCompare(right.exercise.name),
    )
    .slice(0, limit)
    .map(({ exercise }) => exercise)
}

function uniqueById(exercises: Exercise[]) {
  const byId = new Map<string, Exercise>()
  for (const exercise of exercises) {
    if (!byId.has(exercise.id)) {
      byId.set(exercise.id, exercise)
    }
  }
  return Array.from(byId.values())
}

const cardioNamePattern =
  /\b(run|running|bike|cycling|row|ergometer|stair|elliptical|jump rope|assault bike|ski erg|shuttle|sprint)\b/u
