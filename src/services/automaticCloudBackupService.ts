import Dexie, { type ObservabilitySet } from 'dexie'

import { DATABASE_NAME } from '@db/database'
import { appMetadataRepository } from '@repositories/appMetadataRepository'
import { cloudSyncService } from '@services/cloudSyncService'

const DEFAULT_BACKUP_INTERVAL_MS = 5 * 60 * 1_000
const DEFAULT_RETRY_DELAY_MS = 60_000
// Only surface a backup warning once backups have been failing for a few days,
// so transient failures stay silent while the app keeps retrying.
const DEFAULT_STALE_BACKUP_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1_000

const ignoredMutationTables = new Set([
  'activeCycleDayChecks',
  'apiKeyIntegrationSettings',
  'appMetadata',
  'backupMetadata',
  // Run samples can be written every few seconds. Mutations to the parent run
  // still trigger a snapshot when meaningful run state changes.
  'runSamples',
])

type AutomaticCloudBackupCallbacks = {
  onBlocked?: () => void
  onError?: (error: Error) => void
  onSuccess?: () => void
}

type AutomaticCloudBackupDependencies = {
  backupIntervalMs?: number
  backupToCloud?: () => Promise<unknown>
  canSafelyBackUp?: () => Promise<boolean>
  getLastSuccessfulBackupAt?: () => Promise<number | null>
  isOnline?: () => boolean
  recordSuccessfulBackup?: (at: number) => void | Promise<void>
  retryDelayMs?: number
  staleBackupThresholdMs?: number
  subscribeToMutations?: (listener: () => void) => () => void
}

export function createAutomaticCloudBackupService({
  backupIntervalMs = DEFAULT_BACKUP_INTERVAL_MS,
  backupToCloud = () => cloudSyncService.backupToCloud(),
  canSafelyBackUp = () => cloudSyncService.canSafelyBackUpAutomatically(),
  getLastSuccessfulBackupAt = defaultGetLastSuccessfulBackupAt,
  isOnline = () =>
    typeof navigator === 'undefined' || navigator.onLine !== false,
  recordSuccessfulBackup = defaultRecordSuccessfulBackup,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
  staleBackupThresholdMs = DEFAULT_STALE_BACKUP_THRESHOLD_MS,
  subscribeToMutations = subscribeToRelevantDatabaseMutations,
}: AutomaticCloudBackupDependencies = {}) {
  let active = false
  let automaticBackupAllowed: boolean | null = null
  let backupInFlight = false
  let backupBlocked = false
  let backupQueued = false
  let immediateBackupQueued = false
  let callbacks: AutomaticCloudBackupCallbacks = {}
  let lastSuccessfulBackupAt: number | null = null
  let scheduledBackupAt: number | null = null
  let timerId: number | null = null
  let unsubscribeFromMutations: (() => void) | null = null

  function clearScheduledBackup() {
    if (timerId !== null) {
      window.clearTimeout(timerId)
      timerId = null
      scheduledBackupAt = null
    }
  }

  function scheduleBackup(delayMs: number) {
    if (!active) {
      return
    }

    const nextBackupAt = Date.now() + delayMs
    if (
      timerId !== null &&
      scheduledBackupAt !== null &&
      scheduledBackupAt <= nextBackupAt
    ) {
      return
    }

    clearScheduledBackup()
    scheduledBackupAt = nextBackupAt
    timerId = window.setTimeout(() => {
      timerId = null
      scheduledBackupAt = null
      void runBackup()
    }, delayMs)
  }

  function scheduleMutationBackup() {
    const elapsedSinceLastBackup =
      lastSuccessfulBackupAt === null
        ? backupIntervalMs
        : Date.now() - lastSuccessfulBackupAt
    scheduleBackup(Math.max(0, backupIntervalMs - elapsedSinceLastBackup))
  }

  function requestBackup(immediate: boolean) {
    backupQueued = true
    immediateBackupQueued ||= immediate

    if (backupInFlight) {
      return
    }

    if (immediate) {
      scheduleBackup(0)
    } else {
      scheduleMutationBackup()
    }
  }

  function markBackupSucceeded(at: number) {
    lastSuccessfulBackupAt = at
    void Promise.resolve(recordSuccessfulBackup(at)).catch(() => undefined)
  }

  async function isBackupStale() {
    if (lastSuccessfulBackupAt === null) {
      try {
        lastSuccessfulBackupAt = await getLastSuccessfulBackupAt()
      } catch {
        lastSuccessfulBackupAt = null
      }
    }
    return (
      active &&
      lastSuccessfulBackupAt !== null &&
      Date.now() - lastSuccessfulBackupAt >= staleBackupThresholdMs
    )
  }

  async function runBackup() {
    if (!active) {
      return
    }

    if (!isOnline()) {
      backupQueued = true
      return
    }

    if (backupInFlight) {
      backupQueued = true
      return
    }

    backupInFlight = true
    backupQueued = false
    immediateBackupQueued = false

    try {
      if (automaticBackupAllowed === null) {
        automaticBackupAllowed = await canSafelyBackUp()
      }
      if (!automaticBackupAllowed) {
        backupBlocked = true
        backupQueued = true
        if (active) {
          callbacks.onBlocked?.()
        }
        return
      }

      backupBlocked = false
      await backupToCloud()
      markBackupSucceeded(Date.now())
      if (active) {
        callbacks.onSuccess?.()
      }
    } catch (caught) {
      if (active) {
        backupQueued = true
        if (await isBackupStale()) {
          callbacks.onError?.(toError(caught))
        }
        scheduleBackup(retryDelayMs)
      }
    } finally {
      backupInFlight = false
      if (
        active &&
        backupQueued &&
        !backupBlocked &&
        timerId === null &&
        isOnline()
      ) {
        if (immediateBackupQueued) {
          scheduleBackup(0)
        } else {
          clearScheduledBackup()
          scheduleMutationBackup()
        }
      }
    }
  }

  function handleMutation() {
    if (backupBlocked) {
      automaticBackupAllowed = null
    }
    requestBackup(false)
  }

  function handleOnline() {
    if (backupBlocked) {
      automaticBackupAllowed = null
    }
    requestBackup(true)
  }

  function handleVisibilityChange() {
    if (backupBlocked) {
      automaticBackupAllowed = null
    }
    requestBackup(true)
  }

  return {
    markCurrentDeviceSafe() {
      automaticBackupAllowed = true
      backupBlocked = false
      backupQueued = false
      immediateBackupQueued = false
      markBackupSucceeded(Date.now())
      callbacks.onSuccess?.()
    },

    start(nextCallbacks: AutomaticCloudBackupCallbacks = {}) {
      if (active) {
        callbacks = nextCallbacks
        return () => undefined
      }

      active = true
      automaticBackupAllowed = null
      backupBlocked = false
      backupQueued = false
      immediateBackupQueued = false
      lastSuccessfulBackupAt = null
      callbacks = nextCallbacks
      unsubscribeFromMutations = subscribeToMutations(handleMutation)
      window.addEventListener('online', handleOnline)
      document.addEventListener('visibilitychange', handleVisibilityChange)
      requestBackup(true)

      return () => {
        if (!active) {
          return
        }
        active = false
        automaticBackupAllowed = null
        backupBlocked = false
        backupQueued = false
        immediateBackupQueued = false
        lastSuccessfulBackupAt = null
        callbacks = {}
        clearScheduledBackup()
        unsubscribeFromMutations?.()
        unsubscribeFromMutations = null
        window.removeEventListener('online', handleOnline)
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }
    },
  }
}

export const automaticCloudBackupService = createAutomaticCloudBackupService()

async function defaultGetLastSuccessfulBackupAt() {
  const at = await appMetadataRepository.getLastAutomaticBackupAt()
  if (!at) {
    return null
  }
  const parsed = Date.parse(at)
  return Number.isNaN(parsed) ? null : parsed
}

async function defaultRecordSuccessfulBackup(at: number) {
  await appMetadataRepository.recordAutomaticBackup(new Date(at).toISOString())
}

function subscribeToRelevantDatabaseMutations(listener: () => void) {
  const databasePrefix = `idb://${DATABASE_NAME}/`

  function handleStorageMutation(parts: ObservabilitySet) {
    const includesBackedUpData = Object.keys(parts).some((part) => {
      if (!part.startsWith(databasePrefix)) {
        return false
      }
      const tableName = part.slice(databasePrefix.length).split('/')[0]
      return Boolean(tableName) && !ignoredMutationTables.has(tableName)
    })

    if (includesBackedUpData) {
      listener()
    }
  }

  Dexie.on('storagemutated', handleStorageMutation)
  return () => Dexie.on.storagemutated.unsubscribe(handleStorageMutation)
}

function toError(caught: unknown) {
  return caught instanceof Error
    ? caught
    : new Error('Automatic cloud backup failed.')
}
