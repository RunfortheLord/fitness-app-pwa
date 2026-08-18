import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createAppMetadataRepository } from '@repositories/appMetadataRepository'
import { createTestDatabase, destroyTestDatabase } from '@test/database'
import type { TrainingLogDatabase } from '@db/database'

let database: TrainingLogDatabase

beforeEach(() => {
  database = createTestDatabase()
})

afterEach(async () => {
  await destroyTestDatabase(database)
})

describe('appMetadataRepository', () => {
  it('returns null when no automatic backup has been recorded', async () => {
    const repository = createAppMetadataRepository(database)
    await repository.ensureAppMetadata()

    expect(await repository.getLastAutomaticBackupAt()).toBeNull()
  })

  it('returns null before any app metadata exists', async () => {
    const repository = createAppMetadataRepository(database)

    expect(await repository.getLastAutomaticBackupAt()).toBeNull()
  })

  it('records and reads back the last automatic backup timestamp', async () => {
    const repository = createAppMetadataRepository(database)
    const at = '2026-07-08T12:00:00.000Z'

    await repository.recordAutomaticBackup(at)

    expect(await repository.getLastAutomaticBackupAt()).toBe(at)
  })

  it('preserves the recorded timestamp across ensureAppMetadata calls', async () => {
    const repository = createAppMetadataRepository(database)
    const at = '2026-07-08T12:00:00.000Z'

    await repository.recordAutomaticBackup(at)
    await repository.ensureAppMetadata()

    expect(await repository.getLastAutomaticBackupAt()).toBe(at)
  })

  it('stores bounded account-scoped daily nutrition fingerprints', async () => {
    const repository = createAppMetadataRepository(database)
    const fingerprints = Object.fromEntries(
      Array.from({ length: 370 }, (_, index) => {
        const date = new Date(Date.UTC(2026, 0, 1 + index))
          .toISOString()
          .slice(0, 10)
        return [date, `fingerprint-${index}`]
      }),
    )

    await repository.recordDailyNutritionSync('user-1', fingerprints)
    const state = await repository.getDailyNutritionSyncState()
    expect(state.userId).toBe('user-1')
    expect(Object.keys(state.fingerprints)).toHaveLength(366)

    await repository.recordDailyNutritionSync('user-2', {
      '2026-06-27': 'replacement',
    })
    await expect(repository.getDailyNutritionSyncState()).resolves.toEqual({
      fingerprints: { '2026-06-27': 'replacement' },
      userId: 'user-2',
    })

    await repository.clearDailyNutritionSyncState()
    await expect(repository.getDailyNutritionSyncState()).resolves.toEqual({
      fingerprints: {},
      userId: null,
    })
  })
})
