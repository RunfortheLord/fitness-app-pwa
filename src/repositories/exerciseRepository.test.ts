import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { TrainingLogDatabase } from '@db/database'
import { createExerciseRepository } from '@repositories/exerciseRepository'
import { createTestDatabase, destroyTestDatabase } from '@test/database'
import { seedExercise } from '@test/seedFactories'

let database: TrainingLogDatabase

beforeEach(() => {
  database = createTestDatabase()
})

afterEach(async () => {
  await destroyTestDatabase(database)
})

describe('exerciseRepository', () => {
  it('archives referenced exercises instead of deleting them', async () => {
    const repository = createExerciseRepository(database)
    const exercise = await seedExercise(database)

    await repository.archiveExercise(exercise.id)

    await expect(repository.getExercise(exercise.id)).resolves.toMatchObject({
      id: exercise.id,
      status: 'archived',
    })
  })
})
