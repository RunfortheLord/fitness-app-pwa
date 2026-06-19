import { db, type TrainingLogDatabase } from '@db/database'
import type { LocalDateString } from '@domain/dates'
import {
  latestBodyweight,
  sortBodyweightEntries,
} from '@domain/bodyweightProgress'
import { createId } from '@domain/ids'
import type { BodyweightEntry } from '@shared-types/app'

export type SaveBodyweightInput = {
  localDate: LocalDateString
  weight: number
  notes?: string
}

export type UpdateBodyweightInput = {
  id: string
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
  if (weight > 1500) {
    throw new Error('Bodyweight must be a realistic value.')
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
          const entry: BodyweightEntry = {
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

    async updateBodyweight(input: UpdateBodyweightInput) {
      validateBodyweight(input.weight)
      const existing = await database.bodyweightEntries.get(input.id)
      if (!existing) {
        throw new Error('Bodyweight entry was not found.')
      }

      const entry: BodyweightEntry = {
        ...existing,
        weight: input.weight,
        notes: input.notes ?? existing.notes,
        updatedAt: new Date().toISOString(),
      }
      await database.bodyweightEntries.put(entry)
      return entry
    },

    getBodyweightEntry(id: string) {
      return database.bodyweightEntries.get(id)
    },

    getBodyweightForDate(localDate: LocalDateString) {
      return database.bodyweightEntries
        .where({ localDate })
        .toArray()
        .then((entries) => latestBodyweight(entries))
    },

    listBodyweightEntriesForDate(localDate: LocalDateString) {
      return database.bodyweightEntries
        .where({ localDate })
        .toArray()
        .then(sortBodyweightEntries)
    },

    listBodyweightEntries() {
      return database.bodyweightEntries
        .orderBy('localDate')
        .toArray()
        .then(sortBodyweightEntries)
    },

    deleteBodyweightEntry(id: string) {
      return database.bodyweightEntries.delete(id)
    },
  }
}

export const bodyweightRepository = createBodyweightRepository()
