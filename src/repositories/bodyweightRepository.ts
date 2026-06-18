import { db, type TrainingLogDatabase } from '@db/database'
import { createId } from '@domain/ids'
import type { LocalDateString } from '@domain/dates'
import type { BodyweightEntry } from '@shared-types/app'

export type SaveBodyweightInput = {
  localDate: LocalDateString
  weight: number
  notes?: string
}

export function createBodyweightRepository(database: TrainingLogDatabase = db) {
  return {
    async saveBodyweight(input: SaveBodyweightInput) {
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

          await database.bodyweightEntries.put(entry)
          return entry
        },
      )
    },

    getBodyweightForDate(localDate: LocalDateString) {
      return database.bodyweightEntries.where({ localDate }).first()
    },
  }
}

export const bodyweightRepository = createBodyweightRepository()
