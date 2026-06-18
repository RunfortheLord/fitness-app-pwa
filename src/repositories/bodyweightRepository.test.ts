import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { TrainingLogDatabase } from '@db/database'
import { createBodyweightRepository } from '@repositories/bodyweightRepository'
import { createTestDatabase, destroyTestDatabase } from '@test/database'
import { testLocalDate } from '@test/seedFactories'

let database: TrainingLogDatabase

beforeEach(() => {
  database = createTestDatabase()
})

afterEach(async () => {
  await destroyTestDatabase(database)
})

describe('bodyweightRepository', () => {
  it('keeps one bodyweight entry per local date', async () => {
    const repository = createBodyweightRepository(database)

    const first = await repository.saveBodyweight({
      localDate: testLocalDate,
      weight: 190,
    })
    const second = await repository.saveBodyweight({
      localDate: testLocalDate,
      weight: 191,
      notes: 'updated',
    })

    expect(second.id).toBe(first.id)
    await expect(database.bodyweightEntries.toArray()).resolves.toHaveLength(1)
    await expect(
      repository.getBodyweightForDate(testLocalDate),
    ).resolves.toMatchObject({
      weight: 191,
      notes: 'updated',
    })
  })
})
