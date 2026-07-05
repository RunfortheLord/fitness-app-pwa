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
  it('defaults, persists, and backfills the app language', async () => {
    const repository = createSettingsRepository(database)

    await expect(repository.ensureSettings()).resolves.toMatchObject({
      language: 'en',
    })

    await repository.saveLanguage('es')
    await expect(database.userSettings.get('settings')).resolves.toMatchObject({
      language: 'es',
    })

    const stored = await database.userSettings.get('settings')
    expect(stored).toBeDefined()
    await database.userSettings.put({
      ...stored!,
      language: undefined,
    })

    await expect(repository.ensureSettings()).resolves.toMatchObject({
      language: 'en',
    })
  })

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

  it('stores a nutrition goal additively and preserves its created timestamp', async () => {
    const repository = createSettingsRepository(database)

    const created = await repository.saveNutritionGoal({
      goalWeightLb: 170,
      calculationWeightLb: 180,
      heightInches: 70,
      ageYears: 30,
      sex: 'male',
      activityLevel: 'moderately_active',
      direction: 'cut',
      weeklyRateLb: -0.9,
      maintenanceCalories: 2763,
      targets: {
        calories: 2300,
        proteinGrams: 126,
        carbohydrateGrams: 305,
        fatGrams: 64,
      },
      estimatedFinishDate: '2026-09-09',
      formulaVersion: 1,
      lastCalorieUpdate: null,
    })

    await expect(repository.getNutritionGoal()).resolves.toMatchObject({
      goalWeightLb: 170,
      direction: 'cut',
      formulaVersion: 1,
    })
    // Existing target values are untouched by storing a goal.
    await expect(database.userSettings.get('settings')).resolves.toMatchObject({
      nutritionTargets: { calories: 0 },
    })

    const updated = await repository.saveNutritionGoal({
      ...created,
      targets: { ...created.targets, calories: 2100 },
    })
    expect(updated.createdAt).toBe(created.createdAt)
    expect(updated.targets.calories).toBe(2100)
  })

  it('returns null when no nutrition goal exists', async () => {
    const repository = createSettingsRepository(database)
    await expect(repository.getNutritionGoal()).resolves.toBeNull()
  })

  it('persists timer sound preferences on user settings', async () => {
    const repository = createSettingsRepository(database)

    await expect(repository.ensureSettings()).resolves.toMatchObject({
      timerSoundEnabled: true,
      selectedTimerSoundId: 'rest-complete-chime',
      timerBannersEnabled: true,
    })

    await repository.saveTimerSettings({
      timerSoundEnabled: false,
      selectedTimerSoundId: 'clear-ding',
      timerBannersEnabled: false,
    })

    await expect(database.userSettings.get('settings')).resolves.toMatchObject({
      timerSoundEnabled: false,
      selectedTimerSoundId: 'clear-ding',
      timerBannersEnabled: false,
    })
  })

  it('stores Gemini keys separately and removes them without changing USDA', async () => {
    const repository = createSettingsRepository(database)

    await repository.saveUsdaApiKey('usda-key', 'connected')
    await repository.saveGeminiApiKey('gemini-key', 'testing')
    await repository.updateGeminiApiKeyStatus('connected')

    await expect(repository.getGeminiApiKeySettings()).resolves.toMatchObject({
      id: 'google_gemini',
      apiKey: 'gemini-key',
      status: 'connected',
    })

    await repository.removeGeminiApiKey()
    await expect(repository.getGeminiApiKeySettings()).resolves.toBeUndefined()
    await expect(repository.getUsdaApiKeySettings()).resolves.toMatchObject({
      apiKey: 'usda-key',
    })
  })
})
