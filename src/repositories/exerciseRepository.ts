import { db, type TrainingLogDatabase } from '@db/database'
import { createId } from '@domain/ids'
import { getTrackingMethod } from '@domain/trackingMethods'
import type { Exercise, TrackingMethodId } from '@shared-types/app'

export type CreateExerciseInput = {
  name: string
  notes?: string
  defaultRestSeconds: number
  trackingMethodId: TrackingMethodId
}

export type UpdateExerciseInput = Partial<CreateExerciseInput>

export function createExerciseRepository(database: TrainingLogDatabase = db) {
  return {
    async createExercise(input: CreateExerciseInput) {
      const trackingMethod = getTrackingMethod(input.trackingMethodId)
      if (!trackingMethod) {
        throw new Error(
          `Tracking method ${input.trackingMethodId} was not found.`,
        )
      }

      const now = new Date().toISOString()
      const exercise: Exercise = {
        id: createId(),
        name: input.name,
        notes: input.notes ?? '',
        defaultRestSeconds: input.defaultRestSeconds,
        trackingMethodId: input.trackingMethodId,
        trackingMetrics: trackingMethod.metrics,
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
        notes: input.notes ?? exercise.notes,
        trackingMetrics: trackingMethod?.metrics ?? exercise.trackingMetrics,
        updatedAt: new Date().toISOString(),
      }
      await database.exercises.put(updated)
      return updated
    },

    archiveExercise(id: string) {
      return database.exercises.update(id, {
        status: 'archived',
        updatedAt: new Date().toISOString(),
      })
    },

    getExercise(id: string) {
      return database.exercises.get(id)
    },
  }
}

export const exerciseRepository = createExerciseRepository()
