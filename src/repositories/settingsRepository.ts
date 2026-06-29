import { db, type TrainingLogDatabase } from '@db/database'
import { createId } from '@domain/ids'
import type {
  NutritionGoal,
  NutritionTarget,
  NutritionTargetValues,
  ApiKeyIntegrationSettings,
  AppLanguage,
  IntegrationConnectionStatus,
  UserSettings,
  WeightUnit,
} from '@shared-types/app'

export type NutritionGoalInput = Omit<NutritionGoal, 'createdAt' | 'updatedAt'>

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
  getNutritionGoal(): Promise<NutritionGoal | null>
  saveNutritionGoal(goal: NutritionGoalInput): Promise<NutritionGoal>
  getUsdaApiKeySettings(): Promise<ApiKeyIntegrationSettings | undefined>
  saveUsdaApiKey(
    apiKey: string,
    status: IntegrationConnectionStatus,
  ): Promise<ApiKeyIntegrationSettings>
  updateUsdaApiKeyStatus(
    status: IntegrationConnectionStatus,
  ): Promise<ApiKeyIntegrationSettings | undefined>
  removeUsdaApiKey(): Promise<void>
  saveTimerSettings(input: {
    timerSoundEnabled: boolean
    selectedTimerSoundId: string
    timerBannersEnabled: boolean
  }): Promise<UserSettings>
  saveDefaultRestSeconds(seconds: number | null): Promise<UserSettings>
  saveWeightUnit(unit: WeightUnit): Promise<UserSettings>
  saveLanguage(language: AppLanguage): Promise<UserSettings>
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
      if (
        existing.timerSoundEnabled !== undefined &&
        existing.selectedTimerSoundId &&
        existing.language &&
        existing.timerBannersEnabled !== undefined
      ) {
        return existing
      }
      const now = new Date().toISOString()
      const upgraded: UserSettings = {
        ...existing,
        language: existing.language ?? 'en',
        timerSoundEnabled: existing.timerSoundEnabled ?? true,
        selectedTimerSoundId:
          existing.selectedTimerSoundId ?? 'rest-complete-chime',
        timerBannersEnabled: existing.timerBannersEnabled ?? true,
        updatedAt: now,
      }
      await database.userSettings.put(upgraded)
      return upgraded
    }

    const now = new Date().toISOString()
    const settings: UserSettings = {
      id: 'settings',
      language: 'en',
      weightUnit: 'lb',
      energyUnit: 'kcal',
      nutritionTargets: defaultNutritionTargets,
      timerSoundEnabled: true,
      selectedTimerSoundId: 'rest-complete-chime',
      timerBannersEnabled: true,
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

    async getNutritionGoal() {
      const settings = await database.userSettings.get('settings')
      return settings?.nutritionGoal ?? null
    },

    async saveNutritionGoal(goal) {
      const now = new Date().toISOString()
      return database.transaction('rw', database.userSettings, async () => {
        const settings = await ensureSettings()
        const stored: NutritionGoal = {
          ...goal,
          createdAt: settings.nutritionGoal?.createdAt ?? now,
          updatedAt: now,
        }
        await database.userSettings.put({
          ...settings,
          nutritionGoal: stored,
          updatedAt: now,
        })
        return stored
      })
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

    async saveTimerSettings(input) {
      const settings = await ensureSettings()
      const now = new Date().toISOString()
      const updated: UserSettings = {
        ...settings,
        timerSoundEnabled: input.timerSoundEnabled,
        selectedTimerSoundId: input.selectedTimerSoundId,
        timerBannersEnabled: input.timerBannersEnabled,
        updatedAt: now,
      }
      await database.userSettings.put(updated)
      return updated
    },

    async saveDefaultRestSeconds(seconds) {
      const settings = await ensureSettings()
      const now = new Date().toISOString()
      const normalized =
        seconds === null || !Number.isFinite(seconds) || seconds <= 0
          ? undefined
          : Math.round(seconds)
      const updated: UserSettings = {
        ...settings,
        defaultRestSeconds: normalized,
        updatedAt: now,
      }
      await database.userSettings.put(updated)
      return updated
    },

    async saveWeightUnit(unit) {
      const settings = await ensureSettings()
      const now = new Date().toISOString()
      const updated: UserSettings = {
        ...settings,
        weightUnit: unit,
        updatedAt: now,
      }
      await database.userSettings.put(updated)
      return updated
    },

    async saveLanguage(language) {
      const settings = await ensureSettings()
      const now = new Date().toISOString()
      const updated: UserSettings = {
        ...settings,
        language,
        updatedAt: now,
      }
      await database.userSettings.put(updated)
      return updated
    },
  }
}

export const settingsRepository = createSettingsRepository()
