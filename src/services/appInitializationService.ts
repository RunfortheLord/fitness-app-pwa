import { ensureAppMetadata } from '@repositories/appMetadataRepository'
import { exerciseRepository } from '@repositories/exerciseRepository'
import { settingsRepository } from '@repositories/settingsRepository'

export async function initializeAppData() {
  await ensureAppMetadata()
  await settingsRepository.ensureSettings()
  await exerciseRepository.seedBuiltInExercises()
  // The built-in program library is seeded lazily when the Training page first
  // mounts (see TrainingPage), so its larger write does not contend with the
  // initial render of the Home, Nutrition, and other pages.
}
