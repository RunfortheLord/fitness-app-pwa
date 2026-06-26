import { db, type TrainingLogDatabase } from '@db/database'
import {
  BUILT_IN_EXERCISES,
  BUILT_IN_EXERCISE_SEED_VERSION,
  normalizeBuiltInExerciseName,
  validateBuiltInExercises,
} from '@domain/exerciseLibrary'
import { createId } from '@domain/ids'
import { getTrackingMethod } from '@domain/trackingMethods'
import type {
  BodyweightLoadMode,
  Exercise,
  TrackingMethodId,
} from '@shared-types/app'

export type CreateExerciseInput = {
  name: string
  notes?: string
  defaultRestSeconds: number
  trackingMethodId: TrackingMethodId
  bodyweightLoadMode?: BodyweightLoadMode
  bodyweightPercentage?: number | null
}

export type UpdateExerciseInput = Partial<CreateExerciseInput>

export type ExerciseSearchOptions = {
  includeArchived?: boolean
  query?: string
  limit?: number
}

export function createExerciseRepository(database: TrainingLogDatabase = db) {
  function validateExerciseInput(input: CreateExerciseInput) {
    if (!input.name.trim()) {
      throw new Error('Exercise name is required.')
    }

    if (
      input.defaultRestSeconds < 0 ||
      !Number.isFinite(input.defaultRestSeconds) ||
      !Number.isInteger(input.defaultRestSeconds)
    ) {
      throw new Error('Default rest time must be a whole number of seconds.')
    }

    const trackingMethod = getTrackingMethod(input.trackingMethodId)
    if (!trackingMethod) {
      throw new Error(
        `Tracking method ${input.trackingMethodId} was not found.`,
      )
    }

    return trackingMethod
  }

  function validateBodyweightLoad(input: {
    bodyweightLoadMode?: BodyweightLoadMode
    bodyweightPercentage?: number | null
  }) {
    if (
      input.bodyweightLoadMode === 'bodyweight_percentage_plus_external' &&
      (input.bodyweightPercentage === null ||
        input.bodyweightPercentage === undefined ||
        !Number.isFinite(input.bodyweightPercentage) ||
        input.bodyweightPercentage < 0 ||
        input.bodyweightPercentage > 100)
    ) {
      throw new Error('Bodyweight percentage must be 0 through 100.')
    }
  }

  async function hasExerciseReferences(id: string) {
    const [
      templateReference,
      activeCycleReference,
      activeWorkoutReference,
      historyReference,
    ] = await Promise.all([
      database.templateWorkoutExercises.where({ exerciseId: id }).first(),
      database.activeCycleWorkoutExercises.where({ exerciseId: id }).first(),
      database.workoutExercises.where({ exerciseId: id }).first(),
      database.workoutHistoryExercises.where({ exerciseId: id }).first(),
    ])

    return Boolean(
      templateReference ||
      activeCycleReference ||
      activeWorkoutReference ||
      historyReference,
    )
  }

  return {
    async seedBuiltInExercises() {
      await seedBuiltInExerciseRecords(database)
    },

    async createExercise(input: CreateExerciseInput) {
      const trackingMethod = validateExerciseInput(input)
      validateBodyweightLoad(input)

      const now = new Date().toISOString()
      const exercise: Exercise = {
        id: createId(),
        name: input.name.trim(),
        notes: input.notes?.trim() ?? '',
        defaultRestSeconds: input.defaultRestSeconds,
        defaultWeightIncrement:
          input.trackingMethodId === 'weight_reps' ||
          input.trackingMethodId === 'assisted_weight_reps' ||
          input.trackingMethodId === 'added_weight_reps'
            ? 5
            : null,
        trackingMethodId: input.trackingMethodId,
        trackingMetrics: trackingMethod.metrics,
        bodyweightLoadMode: input.bodyweightLoadMode ?? 'external_weight_only',
        bodyweightPercentage: input.bodyweightPercentage ?? null,
        primaryMuscleGroups: [],
        secondaryMuscleGroups: [],
        equipmentType: defaultEquipmentForTracking(input.trackingMethodId),
        recordsRepsPerSide: false,
        origin: 'custom',
        seedDataVersion: null,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      }

      await database.exercises.add(exercise)
      return exercise
    },

    async updateExercise(id: string, input: UpdateExerciseInput) {
      const exercise = await database.exercises.get(id)
      if (!exercise) {
        throw new Error(`Exercise ${id} was not found.`)
      }
      if (exercise.origin === 'built_in') {
        throw new Error('Built-in exercises cannot be edited.')
      }

      const trackingMethod = input.trackingMethodId
        ? getTrackingMethod(input.trackingMethodId)
        : undefined
      if (input.trackingMethodId && !trackingMethod) {
        throw new Error(
          `Tracking method ${input.trackingMethodId} was not found.`,
        )
      }

      const updated: Exercise = {
        ...exercise,
        ...input,
        name: input.name?.trim() ?? exercise.name,
        notes: input.notes?.trim() ?? exercise.notes,
        trackingMetrics: trackingMethod?.metrics ?? exercise.trackingMetrics,
        bodyweightLoadMode:
          input.bodyweightLoadMode ??
          exercise.bodyweightLoadMode ??
          'external_weight_only',
        bodyweightPercentage:
          input.bodyweightPercentage ?? exercise.bodyweightPercentage ?? null,
        updatedAt: new Date().toISOString(),
      }
      validateExerciseInput(updated)
      validateBodyweightLoad(updated)
      await database.exercises.put(updated)
      return updated
    },

    async archiveExercise(id: string) {
      const exercise = await database.exercises.get(id)
      if (!exercise) {
        throw new Error(`Exercise ${id} was not found.`)
      }
      if (exercise.origin === 'built_in') {
        throw new Error('Built-in exercises cannot be archived.')
      }
      const updatedCount = await database.exercises.update(id, {
        status: 'archived',
        updatedAt: new Date().toISOString(),
      })
      if (!updatedCount) {
        throw new Error(`Exercise ${id} was not found.`)
      }
    },

    async restoreExercise(id: string) {
      const exercise = await database.exercises.get(id)
      if (!exercise) {
        throw new Error(`Exercise ${id} was not found.`)
      }
      if (exercise.origin === 'built_in') {
        throw new Error('Built-in exercises are always active.')
      }
      const updatedCount = await database.exercises.update(id, {
        status: 'active',
        updatedAt: new Date().toISOString(),
      })
      if (!updatedCount) {
        throw new Error(`Exercise ${id} was not found.`)
      }
    },

    async deleteExercise(id: string) {
      const exercise = await database.exercises.get(id)
      if (!exercise) {
        throw new Error(`Exercise ${id} was not found.`)
      }
      if (exercise.origin === 'built_in') {
        throw new Error('Built-in exercises cannot be deleted.')
      }

      if (await hasExerciseReferences(id)) {
        await hideExerciseRecord(id)
        return 'hidden' as const
      }

      await database.exercises.delete(id)
      return 'deleted' as const
    },

    async hideExercise(id: string) {
      await hideExerciseRecord(id)
    },

    getExercise(id: string) {
      return database.exercises.get(id)
    },

    async searchExercises(options: ExerciseSearchOptions = {}) {
      // The built-in library alone is ~300 entries and grows over time; a cap at
      // its size silently drops late-alphabet exercises (the list is name-sorted
      // before slicing). Keep the ceiling well clear of the full library plus any
      // user-created exercises so search never hides part of someone's library.
      const { includeArchived = false, query = '', limit = 1000 } = options
      const normalizedQuery = query.trim().toLocaleLowerCase()
      const exercises = includeArchived
        ? await database.exercises.toArray()
        : await database.exercises.where('status').equals('active').toArray()

      if (!normalizedQuery) {
        return exercises
          .sort((left, right) => left.name.localeCompare(right.name))
          .slice(0, limit)
      }

      return exercises
        .map((exercise) => {
          const normalizedName = exercise.name.toLocaleLowerCase()
          let rank = Number.POSITIVE_INFINITY
          if (normalizedName === normalizedQuery) {
            rank = 0
          } else if (normalizedName.startsWith(normalizedQuery)) {
            rank = 1
          } else {
            const index = normalizedName.indexOf(normalizedQuery)
            if (index >= 0) {
              rank = 2 + index / 100
            }
          }

          return { exercise, rank }
        })
        .filter((result) => Number.isFinite(result.rank))
        .sort(
          (left, right) =>
            left.rank - right.rank ||
            left.exercise.name.localeCompare(right.exercise.name),
        )
        .slice(0, limit)
        .map((result) => result.exercise)
    },

    async findSimilarExerciseNames(name: string, excludeId?: string) {
      const normalizedName = name.trim().toLocaleLowerCase()
      if (!normalizedName) {
        return []
      }

      const exercises = await database.exercises.toArray()
      return exercises
        .filter(
          (exercise) =>
            exercise.id !== excludeId &&
            exercise.name.trim().toLocaleLowerCase() === normalizedName,
        )
        .sort((left, right) => left.name.localeCompare(right.name))
    },
  }

  async function hideExerciseRecord(id: string) {
    const exercise = await database.exercises.get(id)
    if (!exercise) {
      throw new Error(`Exercise ${id} was not found.`)
    }
    if (exercise.origin === 'built_in') {
      throw new Error('Built-in exercises cannot be hidden.')
    }
    await database.exercises.update(id, {
      status: 'hidden',
      updatedAt: new Date().toISOString(),
    })
  }
}

export const exerciseRepository = createExerciseRepository()

async function seedBuiltInExerciseRecords(database: TrainingLogDatabase) {
  validateBuiltInExercises()
  await database.transaction('rw', database.exercises, async () => {
    const existingBuiltInsByName = new Map(
      (await database.exercises.where({ origin: 'built_in' }).toArray()).map(
        (exercise) => [normalizeBuiltInExerciseName(exercise.name), exercise],
      ),
    )
    const existingRecords = await database.exercises.bulkGet(
      BUILT_IN_EXERCISES.map((seed) => seed.id),
    )
    const recordsToPut: Exercise[] = []

    for (const [index, seed] of BUILT_IN_EXERCISES.entries()) {
      const existing =
        existingRecords[index] ??
        existingBuiltInsByName.get(normalizeBuiltInExerciseName(seed.name))
      if (!existing) {
        recordsToPut.push(seed)
        continue
      }
      if (existing.origin !== 'built_in') {
        continue
      }
      if ((existing.seedDataVersion ?? 0) < BUILT_IN_EXERCISE_SEED_VERSION) {
        recordsToPut.push({
          ...seed,
          id: existing.id,
          createdAt: existing.createdAt,
          status: 'active',
        })
      }
    }

    if (recordsToPut.length) {
      await database.exercises.bulkPut(recordsToPut)
    }
  })
}

function defaultEquipmentForTracking(
  trackingMethodId: TrackingMethodId,
): Exercise['equipmentType'] {
  if (
    trackingMethodId === 'reps_only' ||
    trackingMethodId === 'bodyweight_reps' ||
    trackingMethodId === 'added_weight_reps'
  ) {
    return 'bodyweight'
  }
  return 'barbell'
}
