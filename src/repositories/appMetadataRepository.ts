import { z } from 'zod'

import {
  BACKUP_SCHEMA_VERSION,
  DATABASE_SCHEMA_VERSION,
  db,
} from '@db/database'
import type { AppMetadata } from '@shared-types/app'

const appMetadataSchema = z.object({
  id: z.literal('app'),
  databaseSchemaVersion: z.number().int().positive(),
  backupSchemaVersion: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export async function getAppMetadata() {
  return db.appMetadata.get('app')
}

export async function ensureAppMetadata() {
  const existing = await getAppMetadata()

  if (existing) {
    return existing
  }

  const now = new Date().toISOString()
  const metadata: AppMetadata = {
    id: 'app',
    databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
    backupSchemaVersion: BACKUP_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
  }

  const parsed = appMetadataSchema.parse(metadata)
  await db.appMetadata.put(parsed)

  return parsed
}
