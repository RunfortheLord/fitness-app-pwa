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
  it('rejects a second bodyweight entry for the same local date', async () => {
    const repository = createBodyweightRepository(database)

    const first = await repository.saveBodyweight({
      localDate: testLocalDate,
      weight: 190,
    })

    await expect(
      repository.saveBodyweight({
        localDate: testLocalDate,
        weight: 191,
      }),
    ).rejects.toThrow('already exists for this date')

    await expect(database.bodyweightEntries.toArray()).resolves.toEqual([first])
    await expect(
      repository.getBodyweightForDate(testLocalDate),
    ).resolves.toEqual(first)
  })

  it('allows only one of two concurrent saves for the same date', async () => {
    const repository = createBodyweightRepository(database)

    const results = await Promise.allSettled([
      repository.saveBodyweight({
        localDate: testLocalDate,
        weight: 190,
      }),
      repository.saveBodyweight({
        localDate: testLocalDate,
        weight: 191,
      }),
    ])

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1)
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1)
    await expect(database.bodyweightEntries.count()).resolves.toBe(1)
  })

  it('updates a bodyweight entry on its existing date', async () => {
    const repository = createBodyweightRepository(database)

    const first = await repository.saveBodyweight({
      localDate: testLocalDate,
      weight: 190,
    })

    await repository.updateBodyweight({
      id: first.id,
      weight: 189.5,
      notes: 'corrected',
    })

    await expect(database.bodyweightEntries.toArray()).resolves.toHaveLength(1)
    await expect(
      repository.getBodyweightEntry(first.id),
    ).resolves.toMatchObject({
      localDate: testLocalDate,
      weight: 189.5,
      notes: 'corrected',
    })
  })

  it('rejects moving a bodyweight entry onto an occupied date', async () => {
    const repository = createBodyweightRepository(database)
    const first = await repository.saveBodyweight({
      localDate: testLocalDate,
      weight: 190,
    })
    const second = await repository.saveBodyweight({
      localDate: '2026-06-19',
      weight: 191,
    })

    await expect(
      repository.updateBodyweight({
        id: first.id,
        localDate: second.localDate,
        weight: 189.5,
      }),
    ).rejects.toThrow('already exists for this date')

    await expect(database.bodyweightEntries.toArray()).resolves.toEqual(
      expect.arrayContaining([first, second]),
    )
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
