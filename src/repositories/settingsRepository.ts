import { db, type TrainingLogDatabase } from '@db/database'
import { createId } from '@domain/ids'
import type {
  NutritionTarget,
  NutritionTargetValues,
  ApiKeyIntegrationSettings,
  IntegrationConnectionStatus,
  UserSettings,
} from '@shared-types/app'

const defaultNutritionTargets: NutritionTargetValues = {
  calories: 0,
  proteinGrams: 0,
  carbohydrateGrams: 0,
  fatGrams: 0,
}

export type SettingsRepository = {
  ensureSettings(): Promise<UserSettings>
  getSettings(): Promise<UserSettings | undefined>
  saveNutritionTargets(targets: NutritionTargetValues): Promise<NutritionTarget>
  getUsdaApiKeySettings(): Promise<ApiKeyIntegrationSettings | undefined>
  saveUsdaApiKey(
    apiKey: string,
    status: IntegrationConnectionStatus,
  ): Promise<ApiKeyIntegrationSettings>
  updateUsdaApiKeyStatus(
    status: IntegrationConnectionStatus,
  ): Promise<ApiKeyIntegrationSettings | undefined>
  removeUsdaApiKey(): Promise<void>
}

export type SettingsRepositoryTestHooks = {
  afterNutritionTargetAdded?: () => void | Promise<void>
}

export function createSettingsRepository(
  database: TrainingLogDatabase = db,
  testHooks: SettingsRepositoryTestHooks = {},
): SettingsRepository {
  async function ensureSettings() {
    const existing = await database.userSettings.get('settings')
    if (existing) {
      return existing
    }

    const now = new Date().toISOString()
    const settings: UserSettings = {
      id: 'settings',
      weightUnit: 'lb',
      energyUnit: 'kcal',
      nutritionTargets: defaultNutritionTargets,
      createdAt: now,
      updatedAt: now,
    }

    await database.userSettings.put(settings)
    return settings
  }

  return {
    ensureSettings,

    getSettings() {
      return database.userSettings.get('settings')
    },

    async saveNutritionTargets(targets) {
      const now = new Date().toISOString()
      const target: NutritionTarget = {
        id: createId(),
        ...targets,
        createdAt: now,
        updatedAt: now,
      }

      await database.transaction(
        'rw',
        database.userSettings,
        database.nutritionTargets,
        async () => {
          const settings = await ensureSettings()
          await database.nutritionTargets.add(target)
          await testHooks.afterNutritionTargetAdded?.()
          await database.userSettings.put({
            ...settings,
            nutritionTargets: targets,
            updatedAt: now,
          })
        },
      )

      return target
    },

    getUsdaApiKeySettings() {
      return database.apiKeyIntegrationSettings.get('usda_fooddata_central')
    },

    async saveUsdaApiKey(apiKey, status) {
      const trimmed = apiKey.trim()
      if (!trimmed) {
        throw new Error('USDA API key is required.')
      }
      const now = new Date().toISOString()
      const existing = await database.apiKeyIntegrationSettings.get(
        'usda_fooddata_central',
      )
      const settings: ApiKeyIntegrationSettings = {
        id: 'usda_fooddata_central',
        apiKey: trimmed,
        status,
        lastTestedAt: status === 'testing' ? null : now,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      }
      await database.apiKeyIntegrationSettings.put(settings)
      return settings
    },

    async updateUsdaApiKeyStatus(status) {
      const existing = await database.apiKeyIntegrationSettings.get(
        'usda_fooddata_central',
      )
      if (!existing) {
        return undefined
      }
      const now = new Date().toISOString()
      const updated: ApiKeyIntegrationSettings = {
        ...existing,
        status,
        lastTestedAt: status === 'testing' ? existing.lastTestedAt : now,
        updatedAt: now,
      }
      await database.apiKeyIntegrationSettings.put(updated)
      return updated
    },

    removeUsdaApiKey() {
      return database.apiKeyIntegrationSettings.delete('usda_fooddata_central')
    },
  }
}

export const settingsRepository = createSettingsRepository()
