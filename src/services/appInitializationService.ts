import {
  appMetadataRepository,
  ensureAppMetadata,
} from '@repositories/appMetadataRepository'
import { exerciseRepository } from '@repositories/exerciseRepository'
import { settingsRepository } from '@repositories/settingsRepository'
import type { AppMetadata } from '@shared-types/app'

export type StoragePersistenceStatus = NonNullable<
  AppMetadata['storagePersistenceStatus']
>

export async function initializeAppData() {
  await ensureAppMetadata()
  await settingsRepository.ensureSettings()
  await requestPersistentStorage()
  await exerciseRepository.seedBuiltInExercises()
  // The built-in program library is seeded lazily when the Training page first
  // mounts (see TrainingPage), so its larger write does not contend with the
  // initial render of the Home, Nutrition, and other pages.
}

export async function requestPersistentStorage(): Promise<StoragePersistenceStatus> {
  const storageManager = globalThis.navigator?.storage
  if (!storageManager?.persist) {
    return saveStoragePersistenceStatus('unsupported')
  }

  try {
    const granted = await storageManager.persist()
    return saveStoragePersistenceStatus(granted ? 'granted' : 'denied')
  } catch {
    return saveStoragePersistenceStatus('error')
  }
}

async function saveStoragePersistenceStatus(status: StoragePersistenceStatus) {
  try {
    await appMetadataRepository.updateStoragePersistenceStatus(status)
  } catch {
    // Startup storage persistence is a best-effort durability request. If the
    // database is unavailable or closes during app/test teardown, app startup
    // should not fail.
  }
  return status
}
