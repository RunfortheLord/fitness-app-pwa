import { describe, expect, it } from 'vitest'

import type { TrainingLogDatabase } from '@db/database'
import { createExerciseRepository } from '@repositories/exerciseRepository'
import { createProgramRepository } from '@repositories/programRepository'
import { createSettingsRepository } from '@repositories/settingsRepository'
import { createBackupService } from '@services/backupService'
import { createTestDatabase, destroyTestDatabase } from '@test/database'
import { seedFood, seedProgram } from '@test/seedFactories'

type SnapshotMeasurement = {
  compactBytes: number
  compactRecords: number
  fullBytes: number
  fullRecords: number
  reductionPercent: number
}

describe('compact cloud snapshot measurements', () => {
  it('measures initialized, seeded-program, and representative states', async () => {
    const measurements = {
      freshInitialized: await measureScenario(),
      seededPrograms: await measureScenario({ seedPrograms: true }),
      representative: await measureScenario({
        seedPrograms: true,
        seedUserRecords: true,
      }),
    }

    expect(measurements.freshInitialized.reductionPercent).toBeGreaterThan(75)
    expect(measurements.seededPrograms.reductionPercent).toBeGreaterThan(75)
    expect(measurements.representative.compactRecords).toBeGreaterThan(0)
    console.info(`CLOUD_SNAPSHOT_MEASUREMENTS ${JSON.stringify(measurements)}`)
  })
})

async function measureScenario(
  options: { seedPrograms?: boolean; seedUserRecords?: boolean } = {},
): Promise<SnapshotMeasurement> {
  const database = createTestDatabase()
  await database.open()
  try {
    await createSettingsRepository(database).ensureSettings()
    await createExerciseRepository(database).seedBuiltInExercises()
    if (options.seedPrograms) {
      await createProgramRepository(database).seedBuiltInPrograms()
    }
    if (options.seedUserRecords) {
      await seedFood(database)
      await seedProgram(database)
      await seedRepresentativeBodyweight(database)
    }

    const exported = await createBackupService(database).createCloudBackup(
      new Date('2026-08-18T18:00:00.000Z'),
    )
    const compactBytes = serializedRowBytes(exported.backup)
    const fullBytes = serializedRowBytes(exported.restorableBackup)
    const compactRecords = countRecords(exported.backup.data)
    const fullRecords = countRecords(exported.restorableBackup.data)
    return {
      compactBytes,
      compactRecords,
      fullBytes,
      fullRecords,
      reductionPercent: Number(
        (((fullBytes - compactBytes) / fullBytes) * 100).toFixed(2),
      ),
    }
  } finally {
    await destroyTestDatabase(database)
  }
}

function serializedRowBytes(snapshot: {
  data: Record<string, unknown[]>
  databaseSchemaVersion: number
  exportedAt: string
}) {
  return new TextEncoder().encode(
    JSON.stringify({
      schema_version: snapshot.databaseSchemaVersion,
      snapshot,
      updated_at: snapshot.exportedAt,
      user_id: 'measurement-user',
    }),
  ).byteLength
}

function countRecords(data: Record<string, unknown[]>) {
  return Object.values(data).reduce((sum, records) => sum + records.length, 0)
}

async function seedRepresentativeBodyweight(database: TrainingLogDatabase) {
  await database.bodyweightEntries.add({
    id: 'representative-bodyweight',
    localDate: '2026-08-18',
    weight: 180,
    unit: 'lb',
    notes: '',
    createdAt: '2026-08-18T12:00:00.000Z',
    updatedAt: '2026-08-18T12:00:00.000Z',
  })
}
