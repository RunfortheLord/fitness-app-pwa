import { ensureAppMetadata } from '@repositories/appMetadataRepository'
import { exerciseRepository } from '@repositories/exerciseRepository'
import { settingsRepository } from '@repositories/settingsRepository'

export async function initializeAppData() {
  await ensureAppMetadata()
  await settingsRepository.ensureSettings()
  await exerciseRepository.seedBuiltInExercises()
}
