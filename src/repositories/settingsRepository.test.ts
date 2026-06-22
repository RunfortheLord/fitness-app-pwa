import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { TrainingLogDatabase } from '@db/database'
import { createSettingsRepository } from '@repositories/settingsRepository'
import { createTestDatabase, destroyTestDatabase } from '@test/database'

let database: TrainingLogDatabase

beforeEach(() => {
  database = createTestDatabase()
})

afterEach(async () => {
  await destroyTestDatabase(database)
})

describe('settingsRepository', () => {
  it('rolls back nutrition target saves when the transaction fails', async () => {
    const repository = createSettingsRepository(database, {
      afterNutritionTargetAdded: () => {
        throw new Error('forced target failure')
      },
    })

    await expect(
      repository.saveNutritionTargets({
        calories: 2500,
        proteinGrams: 180,
        carbohydrateGrams: 250,
        fatGrams: 70,
      }),
    ).rejects.toThrow('forced target failure')

    await expect(database.nutritionTargets.toArray()).resolves.toEqual([])
    await expect(database.userSettings.get('settings')).resolves.toBeUndefined()
  })

  it('persists timer sound preferences on user settings', async () => {
    const repository = createSettingsRepository(database)

    await expect(repository.ensureSettings()).resolves.toMatchObject({
      timerSoundEnabled: true,
      selectedTimerSoundId: 'rest-complete-chime',
    })

    await repository.saveTimerSettings({
      timerSoundEnabled: false,
      selectedTimerSoundId: 'clear-ding',
    })

    await expect(database.userSettings.get('settings')).resolves.toMatchObject({
      timerSoundEnabled: false,
      selectedTimerSoundId: 'clear-ding',
    })
  })
})
