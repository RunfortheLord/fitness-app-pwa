import { db, type TrainingLogDatabase } from '@db/database'
import { createId } from '@domain/ids'
import type {
  NutritionTarget,
  NutritionTargetValues,
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
}

export function createSettingsRepository(
  database: TrainingLogDatabase = db,
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
          await database.userSettings.put({
            ...settings,
            nutritionTargets: targets,
            updatedAt: now,
          })
        },
      )

      return target
    },
  }
}

export const settingsRepository = createSettingsRepository()
