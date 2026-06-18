import { db, type TrainingLogDatabase } from '@db/database'
import { createId } from '@domain/ids'
import type { LocalDateString } from '@domain/dates'
import type { BodyweightEntry } from '@shared-types/app'

export type SaveBodyweightInput = {
  localDate: LocalDateString
  weight: number
  notes?: string
}

export type BodyweightRepositoryTestHooks = {
  afterBodyweightPrepared?: () => void | Promise<void>
}

function validateBodyweight(weight: number) {
  if (!Number.isFinite(weight) || weight <= 0) {
    throw new Error('Bodyweight must be a finite positive value.')
  }
}

export function createBodyweightRepository(
  database: TrainingLogDatabase = db,
  testHooks: BodyweightRepositoryTestHooks = {},
) {
  return {
    async saveBodyweight(input: SaveBodyweightInput) {
      validateBodyweight(input.weight)
      const now = new Date().toISOString()
      return database.transaction(
        'rw',
        database.bodyweightEntries,
        async () => {
          const existing = await database.bodyweightEntries
            .where({ localDate: input.localDate })
            .first()

          const entry: BodyweightEntry = existing
            ? {
                ...existing,
                weight: input.weight,
                notes: input.notes ?? existing.notes,
                updatedAt: now,
              }
            : {
                id: createId(),
                localDate: input.localDate,
                weight: input.weight,
                unit: 'lb',
                notes: input.notes ?? '',
                createdAt: now,
                updatedAt: now,
              }

          await testHooks.afterBodyweightPrepared?.()
          await database.bodyweightEntries.put(entry)
          return entry
        },
      )
    },

    getBodyweightForDate(localDate: LocalDateString) {
      return database.bodyweightEntries.where({ localDate }).first()
    },

    listBodyweightEntries() {
      return database.bodyweightEntries.orderBy('localDate').toArray()
    },

    deleteBodyweightForDate(localDate: LocalDateString) {
      return database.bodyweightEntries.where({ localDate }).delete()
    },
  }
}

export const bodyweightRepository = createBodyweightRepository()
