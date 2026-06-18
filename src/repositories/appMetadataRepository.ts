import { z } from 'zod'

import {
  BACKUP_SCHEMA_VERSION,
  DATABASE_SCHEMA_VERSION,
  db,
  type TrainingLogDatabase,
} from '@db/database'
import type { AppMetadata } from '@shared-types/app'

const appMetadataSchema = z.object({
  id: z.literal('app'),
  databaseSchemaVersion: z.number().int().positive(),
  backupSchemaVersion: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export function createAppMetadataRepository(
  database: TrainingLogDatabase = db,
) {
  return {
    getAppMetadata() {
      return database.appMetadata.get('app')
    },

    async ensureAppMetadata() {
      const existing = await database.appMetadata.get('app')
      const now = new Date().toISOString()

      if (existing) {
        const current: AppMetadata = {
          ...existing,
          databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
          backupSchemaVersion: BACKUP_SCHEMA_VERSION,
          updatedAt:
            existing.databaseSchemaVersion === DATABASE_SCHEMA_VERSION &&
            existing.backupSchemaVersion === BACKUP_SCHEMA_VERSION
              ? existing.updatedAt
              : now,
        }
        await database.appMetadata.put(appMetadataSchema.parse(current))
        return current
      }

      const metadata: AppMetadata = {
        id: 'app',
        databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
        backupSchemaVersion: BACKUP_SCHEMA_VERSION,
        createdAt: now,
        updatedAt: now,
      }

      const parsed = appMetadataSchema.parse(metadata)
      await database.appMetadata.put(parsed)

      return parsed
    },
  }
}

export const appMetadataRepository = createAppMetadataRepository()
export const getAppMetadata = appMetadataRepository.getAppMetadata
export const ensureAppMetadata = appMetadataRepository.ensureAppMetadata
