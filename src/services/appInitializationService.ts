import { ensureAppMetadata } from '@repositories/appMetadataRepository'
import { settingsRepository } from '@repositories/settingsRepository'

export async function initializeAppData() {
  await ensureAppMetadata()
  await settingsRepository.ensureSettings()
}
