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
  it('preserves same-day entries and returns the latest timestamped entry for a local date', async () => {
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

    expect(second.id).not.toBe(first.id)
    await expect(database.bodyweightEntries.toArray()).resolves.toHaveLength(2)
    await expect(
      repository.getBodyweightForDate(testLocalDate),
    ).resolves.toMatchObject({
      weight: 191,
      notes: 'updated',
    })
  })

  it('updates a selected bodyweight entry without rewriting other same-day entries', async () => {
    const repository = createBodyweightRepository(database)

    const first = await repository.saveBodyweight({
      localDate: testLocalDate,
      weight: 190,
    })
    const second = await repository.saveBodyweight({
      localDate: testLocalDate,
      weight: 191,
    })

    await repository.updateBodyweight({
      id: first.id,
      weight: 189.5,
      notes: 'corrected',
    })

    await expect(database.bodyweightEntries.toArray()).resolves.toHaveLength(2)
    await expect(
      repository.getBodyweightEntry(first.id),
    ).resolves.toMatchObject({
      weight: 189.5,
      notes: 'corrected',
    })
    await expect(
      repository.getBodyweightEntry(second.id),
    ).resolves.toMatchObject({
      weight: 191,
    })
  })

  it('rolls back bodyweight saves when the transaction fails', async () => {
    const repository = createBodyweightRepository(database, {
      afterBodyweightPrepared: () => {
        throw new Error('forced bodyweight failure')
      },
    })

    await expect(
      repository.saveBodyweight({
        localDate: testLocalDate,
        weight: 190,
      }),
    ).rejects.toThrow('forced bodyweight failure')

    await expect(database.bodyweightEntries.toArray()).resolves.toEqual([])
  })

  it('rejects invalid finite positive values', async () => {
    const repository = createBodyweightRepository(database)

    await expect(
      repository.saveBodyweight({
        localDate: testLocalDate,
        weight: Number.NaN,
      }),
    ).rejects.toThrow('finite positive')
    await expect(
      repository.saveBodyweight({
        localDate: testLocalDate,
        weight: 0,
      }),
    ).rejects.toThrow('finite positive')
    await expect(
      repository.saveBodyweight({
        localDate: testLocalDate,
        weight: 1500.1,
      }),
    ).rejects.toThrow('realistic')
    await expect(database.bodyweightEntries.toArray()).resolves.toEqual([])
  })

  it('deletes only the selected bodyweight entry', async () => {
    const repository = createBodyweightRepository(database)

    const first = await repository.saveBodyweight({
      localDate: testLocalDate,
      weight: 190,
    })
    await repository.saveBodyweight({
      localDate: '2026-06-19',
      weight: 191,
    })

    await repository.deleteBodyweightEntry(first.id)

    await expect(repository.getBodyweightForDate(testLocalDate)).resolves.toBe(
      undefined,
    )
    await expect(
      repository.getBodyweightForDate('2026-06-19'),
    ).resolves.toMatchObject({ weight: 191 })
  })
})
