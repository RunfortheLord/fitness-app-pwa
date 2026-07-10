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
})
