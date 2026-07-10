import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { db, DATABASE_SCHEMA_VERSION } from '@db/database'
import { initializeAppData } from '@services/appInitializationService'
import { backupService } from '@services/backupService'
import { cloudSyncService } from '@services/cloudSyncService'
import { seedFood } from '@test/seedFactories'

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
  it('uploads a full JSON backup snapshot to the signed-in user row', async () => {
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
    expect(uploaded.snapshot.data.foods).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Rice' })]),
    )
    expect(uploaded.snapshot.data.runs).toHaveLength(1)
    expect(uploaded.snapshot.data.runSamples).toEqual([])
    expect(info.recordCount).toBeGreaterThan(0)
  })

  it('restores a validated cloud snapshot with replace semantics', async () => {
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

  it('throws a signed-out error before touching Supabase tables', async () => {
    supabaseMocks.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    })

    await expect(cloudSyncService.backupToCloud()).rejects.toThrow(
      'Sign in with Google before using cloud backup.',
    )
    expect(supabaseMocks.from).not.toHaveBeenCalled()
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
})

function mockSelectRow(row: unknown) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null })
  const eq = vi.fn().mockReturnValue({ maybeSingle })
  const select = vi.fn().mockReturnValue({ eq })
  supabaseMocks.from.mockReturnValue({ select })
}
