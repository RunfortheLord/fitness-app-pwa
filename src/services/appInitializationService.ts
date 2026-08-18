import {
  appMetadataRepository,
  ensureAppMetadata,
} from '@repositories/appMetadataRepository'
import { settingsRepository } from '@repositories/settingsRepository'
import type { AppMetadata } from '@shared-types/app'

export type StoragePersistenceStatus = NonNullable<
  AppMetadata['storagePersistenceStatus']
>

export async function initializeAppData(
  options: {
    deferExpandedExerciseSeed?: boolean
    skipNonCriticalWork?: boolean
  } = {},
) {
  await ensureAppMetadata()
  await settingsRepository.ensureSettings()
  if (options.skipNonCriticalWork) {
    return
  }

  await initializeNonCriticalAppData({
    deferExpandedExerciseSeed: options.deferExpandedExerciseSeed,
  })
}

export async function initializeNonCriticalAppData(
  options: { deferExpandedExerciseSeed?: boolean } = {},
) {
  await requestPersistentStorage()
  const { exerciseRepository } =
    await import('@repositories/exerciseRepository')
  if (options.deferExpandedExerciseSeed) {
    // Only the compact core library belongs on the launch-critical path. The
    // expanded exercise and program libraries install in short background
    // chunks so first-run WebKit does not hold the launch screen for tens of
    // seconds.
    await exerciseRepository.seedBuiltInExercises({
      deferExpanded: true,
      onExpandedSeeded: async () => {
        const { programRepository } =
          await import('@repositories/programRepository')
        await programRepository.seedBuiltInPrograms()
      },
    })
  } else {
    await exerciseRepository.seedBuiltInExercises()
  }
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
