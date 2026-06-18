import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  BACKUP_SCHEMA_VERSION,
  DATABASE_SCHEMA_VERSION,
  TrainingLogDatabase,
} from '@db/database'
import { diagnoseDatabaseHealth } from '@db/health'
import { createAppMetadataRepository } from '@repositories/appMetadataRepository'
import { createTestDatabase, destroyTestDatabase } from '@test/database'

describe('database', () => {
  let database: TrainingLogDatabase

  beforeEach(() => {
    database = createTestDatabase()
  })

  afterEach(async () => {
    await destroyTestDatabase(database)
  })

  it('reports healthy schema diagnostics', async () => {
    await createAppMetadataRepository(database).ensureAppMetadata()

    const diagnostic = await diagnoseDatabaseHealth(database)

    expect(diagnostic).toMatchObject({
      ok: true,
      databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
      backupSchemaVersion: BACKUP_SCHEMA_VERSION,
    })
    expect(diagnostic.storesChecked).toContain('appliedWorkoutChanges')
  })

  it('migrates v1 metadata to the current schema version', async () => {
    const name = `training-log-migration-${crypto.randomUUID()}`
    const oldDatabase = new Dexie(name)
    oldDatabase.version(1).stores({
      appMetadata: '&id',
      userSettings: '&id',
    })
    await oldDatabase.table('appMetadata').put({
      id: 'app',
      databaseSchemaVersion: 1,
      backupSchemaVersion: 1,
      createdAt: '2026-06-18T12:00:00.000Z',
      updatedAt: '2026-06-18T12:00:00.000Z',
    })
    await oldDatabase.table('userSettings').put({
      id: 'settings',
      weightUnit: 'lb',
      energyUnit: 'kcal',
      createdAt: '2026-06-18T12:01:00.000Z',
      updatedAt: '2026-06-18T12:01:00.000Z',
    })
    oldDatabase.close()

    const migratedDatabase = new TrainingLogDatabase(name)
    const metadata = await migratedDatabase.appMetadata.get('app')
    const settings = await migratedDatabase.userSettings.get('settings')

    expect(metadata).toMatchObject({
      id: 'app',
      databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
      backupSchemaVersion: BACKUP_SCHEMA_VERSION,
    })
    expect(settings).toMatchObject({
      id: 'settings',
      weightUnit: 'lb',
      energyUnit: 'kcal',
      nutritionTargets: {
        calories: 0,
        proteinGrams: 0,
        carbohydrateGrams: 0,
        fatGrams: 0,
      },
      createdAt: '2026-06-18T12:01:00.000Z',
    })
    expect(migratedDatabase.tables.map((table) => table.name)).toContain(
      'backupMetadata',
    )

    await destroyTestDatabase(migratedDatabase)
  })
})
