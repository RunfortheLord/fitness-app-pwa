import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { db, DATABASE_SCHEMA_VERSION } from '@db/database'
import { BUILT_IN_PROGRAMS } from '@domain/programLibrarySeed'
import { createProgramRepository } from '@repositories/programRepository'
import { initializeAppData } from '@services/appInitializationService'
import { backupService } from '@services/backupService'
import {
  cloudSyncService,
  CloudBackupTooLargeError,
  MAX_CLOUD_BACKUP_BYTES,
} from '@services/cloudSyncService'
import { seedFood, seedProgram } from '@test/seedFactories'

const supabaseMocks = vi.hoisted(() => ({
  getSupabaseClient: vi.fn(),
  getSession: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@services/supabaseClient', () => ({
  getSupabaseClient: supabaseMocks.getSupabaseClient,
}))

beforeEach(async () => {
  supabaseMocks.getSession.mockReset()
  supabaseMocks.from.mockReset()
  supabaseMocks.getSupabaseClient.mockReturnValue({
    auth: {
      getSession: supabaseMocks.getSession,
    },
    from: supabaseMocks.from,
  })
  supabaseMocks.getSession.mockResolvedValue({
    data: {
      session: {
        user: { email: 'person@example.com', id: userId },
      },
    },
    error: null,
  })
  await db.delete()
  await db.open()
  await initializeAppData()
})

afterEach(async () => {
  vi.restoreAllMocks()
  await db.delete()
})

const userId = '00000000-0000-4000-8000-000000000001'

describe('cloudSyncService', () => {
  it('uploads a compact versioned snapshot to the signed-in user row', async () => {
    await seedFood(db)
    await db.runs.add({
      id: 'run-1',
      localDate: '2026-06-19',
      status: 'completed',
      startedAt: '2026-06-19T12:00:00.000Z',
      completedAt: '2026-06-19T12:30:00.000Z',
      elapsedSeconds: 1800,
      movingSeconds: 1500,
      distanceMeters: 3218.688,
      currentPaceSecondsPerMile: null,
      averageMovingPaceSecondsPerMile: 750,
      trackingMode: 'gps',
      hasGpsGap: false,
      lowPaceAlertedAt: null,
      notes: '',
      createdAt: '2026-06-19T12:00:00.000Z',
      updatedAt: '2026-06-19T12:30:00.000Z',
    })
    await db.runSamples.add({
      id: 'sample-1',
      runId: 'run-1',
      latitude: 41.88,
      longitude: -87.63,
      timestamp: '2026-06-19T12:00:00.000Z',
      accuracyMeters: 8,
      altitudeMeters: null,
      decision: 'accepted',
      rejectionReason: 'first_sample',
      segmentDistanceMeters: 0,
      createdAt: '2026-06-19T12:00:00.000Z',
    })
    const upsert = vi.fn().mockResolvedValue({ error: null })
    supabaseMocks.from.mockReturnValue({ upsert })

    const info = await cloudSyncService.backupToCloud()

    expect(supabaseMocks.from).toHaveBeenCalledWith('backups')
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        schema_version: DATABASE_SCHEMA_VERSION,
        user_id: userId,
      }),
      { onConflict: 'user_id' },
    )
    const uploaded = upsert.mock.calls[0]?.[0]
    expect(uploaded.snapshot).toMatchObject({
      cloudSnapshotFormatVersion: 1,
      sourceBackupFormatVersion: 1,
    })
    expect(
      uploaded.snapshot.data.exercises.some((exercise: { id: string }) =>
        exercise.id.startsWith('builtin:'),
      ),
    ).toBe(false)
    expect(uploaded.snapshot.data.foods).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Rice' })]),
    )
    expect(uploaded.snapshot.data.runs).toHaveLength(1)
    expect(uploaded.snapshot.data.runSamples).toEqual([])
    expect(info.recordCount).toBeGreaterThan(0)
  })

  it('restores an existing legacy cloud snapshot with replace semantics', async () => {
    const keptFood = await seedFood(db)
    const exportResult = await backupService.createJsonBackup(
      new Date('2026-01-02T03:04:05.000Z'),
    )
    await backupService.clearAllData()
    const removedFood = await seedFood(db)
    mockSelectRow({
      schema_version: exportResult.backup.databaseSchemaVersion,
      snapshot: exportResult.backup,
      updated_at: exportResult.backup.exportedAt,
    })

    const info = await cloudSyncService.restoreFromCloud()

    expect(info.exportedAt).toBe('2026-01-02T03:04:05.000Z')
    await expect(db.foods.get(keptFood.id)).resolves.toMatchObject({
      name: 'Rice',
    })
    await expect(db.foods.get(removedFood.id)).resolves.toBeUndefined()
  })

  it('restores a compact snapshot with custom records and reconstructed built-ins', async () => {
    await createProgramRepository(db).seedBuiltInPrograms()
    const keptFood = await seedFood(db)
    const customProgram = await seedProgram(db)
    const exportResult = await backupService.createCloudBackup(
      new Date('2026-01-02T03:04:05.000Z'),
    )
    await backupService.clearAllData()
    const removedFood = await seedFood(db)
    mockSelectRow({
      schema_version: exportResult.backup.databaseSchemaVersion,
      snapshot: exportResult.backup,
      updated_at: exportResult.backup.exportedAt,
    })

    const info = await cloudSyncService.restoreFromCloud()

    expect(info.exportedAt).toBe('2026-01-02T03:04:05.000Z')
    await expect(db.foods.get(keptFood.id)).resolves.toMatchObject({
      name: keptFood.name,
    })
    await expect(db.foods.get(removedFood.id)).resolves.toBeUndefined()
    await expect(
      db.programTemplates.get(customProgram.template.id),
    ).resolves.toMatchObject({ name: customProgram.template.name })
    await expect(
      db.programTemplates
        .filter((program) => Boolean(program.isBuiltIn))
        .count(),
    ).resolves.toBe(BUILT_IN_PROGRAMS.length)
    await expect(
      db.exercises.where({ origin: 'built_in' }).count(),
    ).resolves.toBeGreaterThan(0)
  })

  it('throws a signed-out error before touching Supabase tables', async () => {
    supabaseMocks.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    })

    await expect(cloudSyncService.backupToCloud()).rejects.toThrow(
      'Sign in before using cloud backup.',
    )
    expect(supabaseMocks.from).not.toHaveBeenCalled()
  })

  it('deletes both cloud data stores for the signed-in user', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const deleteRows = vi.fn().mockReturnValue({ eq })
    supabaseMocks.from.mockReturnValue({ delete: deleteRows })

    await cloudSyncService.deleteCloudData()

    expect(supabaseMocks.from.mock.calls).toEqual([
      ['daily_nutrition'],
      ['backups'],
    ])
    expect(deleteRows).toHaveBeenCalledTimes(2)
    expect(eq).toHaveBeenCalledTimes(2)
    expect(eq).toHaveBeenNthCalledWith(1, 'user_id', userId)
    expect(eq).toHaveBeenNthCalledWith(2, 'user_id', userId)
  })

  it('rejects invalid cloud snapshots without replacing local data', async () => {
    const localFood = await seedFood(db)
    mockSelectRow({
      schema_version: 11,
      snapshot: { backupFormatVersion: 1 },
      updated_at: '2026-01-02T03:04:05.000Z',
    })

    await expect(cloudSyncService.restoreFromCloud()).rejects.toThrow(
      'Cloud backup validation failed. Local data was unchanged.',
    )
    await expect(db.foods.get(localFood.id)).resolves.toMatchObject({
      name: 'Rice',
    })
  })

  it('rejects an invalid compact snapshot before partially clearing local data', async () => {
    const compact = await backupService.createCloudBackup()
    const localFood = await seedFood(db)
    mockSelectRow({
      schema_version: DATABASE_SCHEMA_VERSION,
      snapshot: { ...compact.backup, cloudSnapshotFormatVersion: 999 },
      updated_at: compact.backup.exportedAt,
    })

    await expect(cloudSyncService.restoreFromCloud()).rejects.toThrow(
      'Cloud backup validation failed. Local data was unchanged.',
    )
    await expect(db.foods.get(localFood.id)).resolves.toMatchObject({
      name: localFood.name,
    })
  })

  it('throws an offline error before reading auth state', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)

    await expect(cloudSyncService.getCloudBackupInfo()).rejects.toThrow(
      'Cloud backup requires an internet connection.',
    )
    expect(supabaseMocks.getSession).not.toHaveBeenCalled()
  })

  it('only allows automatic overwrite when this device recognizes the cloud snapshot', async () => {
    const exportResult = await backupService.createJsonBackup(
      new Date('2026-01-02T03:04:05.000Z'),
    )
    mockSelectRow({
      schema_version: exportResult.backup.databaseSchemaVersion,
      snapshot: exportResult.backup,
      updated_at: exportResult.backup.exportedAt,
    })

    await expect(cloudSyncService.canSafelyBackUpAutomatically()).resolves.toBe(
      true,
    )

    await db.backupMetadata.clear()
    await expect(cloudSyncService.canSafelyBackUpAutomatically()).resolves.toBe(
      false,
    )
  })

  it('checks only cloud metadata before allowing an automatic overwrite', async () => {
    const selected = mockSelectRow({
      updated_at: '2026-01-02T03:04:05.000Z',
    })
    await db.backupMetadata.add({
      backupSchemaVersion: 1,
      createdAt: '2026-01-02T03:04:05.000Z',
      databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
      exportedAt: '2026-01-02T03:04:05.000Z',
      id: 'metadata-1',
      importedAt: null,
      mode: 'export',
      summary: 'test',
      updatedAt: '2026-01-02T03:04:05.000Z',
    })

    await expect(cloudSyncService.canSafelyBackUpAutomatically()).resolves.toBe(
      true,
    )
    expect(selected).toHaveBeenCalledWith('updated_at')
  })

  it('rejects an oversized snapshot before opening the backups table', async () => {
    vi.spyOn(backupService, 'createCloudBackup').mockResolvedValue({
      backup: {
        backupFormatVersion: 1,
        data: { oversized: ['x'.repeat(MAX_CLOUD_BACKUP_BYTES)] },
        databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
        exportedAt: '2026-01-02T03:04:05.000Z',
      },
    } as never)

    await expect(cloudSyncService.backupToCloud()).rejects.toBeInstanceOf(
      CloudBackupTooLargeError,
    )
    expect(supabaseMocks.from).not.toHaveBeenCalled()
  })
})

function mockSelectRow(row: unknown) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null })
  const eq = vi.fn().mockReturnValue({ maybeSingle })
  const select = vi.fn().mockReturnValue({ eq })
  supabaseMocks.from.mockReturnValue({ select })
  return select
}
