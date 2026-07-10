import { db, DATABASE_SCHEMA_VERSION } from '@db/database'
import {
  backupService,
  validateBackup,
  type JsonBackup,
} from '@services/backupService'
import { authService } from '@services/authService'
import { getSupabaseClient } from '@services/supabaseClient'

export type CloudBackupInfo = {
  databaseSchemaVersion: number
  exportedAt: string
  recordCount: number
  updatedAt: string
}

type BackupRow = {
  schema_version: number
  snapshot: unknown
  updated_at: string
}

export const cloudSyncService = {
  async backupToCloud(): Promise<CloudBackupInfo> {
    const session = await requireOnlineSession()
    const exportResult = await backupService.createCloudBackup()
    const row: BackupRow & { user_id: string } = {
      user_id: session.user.id,
      snapshot: exportResult.backup,
      schema_version: exportResult.backup.databaseSchemaVersion,
      updated_at: exportResult.backup.exportedAt,
    }

    const { error } = await getSupabaseClient()
      .from('backups')
      .upsert(row, { onConflict: 'user_id' })

    if (error) {
      throw new Error(error.message || 'Cloud backup could not be saved.')
    }

    return infoFromBackup(exportResult.backup, exportResult.backup.exportedAt)
  },

  async restoreFromCloud(): Promise<CloudBackupInfo> {
    const session = await requireOnlineSession()
    const row = await fetchBackupRow(session.user.id)
    const validation = validateBackup(row.snapshot, 'cloud backup')
    if (!validation.ok) {
      throw new Error(
        'Cloud backup validation failed. Local data was unchanged.',
      )
    }

    await backupService.restoreReplace(validation.backup)
    return infoFromBackup(validation.backup, row.updated_at)
  },

  async getCloudBackupInfo(): Promise<CloudBackupInfo | null> {
    const session = await requireOnlineSession()
    const row = await fetchBackupRow(session.user.id, { allowMissing: true })
    if (!row) {
      return null
    }

    const validation = validateBackup(row.snapshot, 'cloud backup')
    if (!validation.ok) {
      throw new Error('Cloud backup validation failed.')
    }

    return infoFromBackup(validation.backup, row.updated_at)
  },

  async canSafelyBackUpAutomatically(): Promise<boolean> {
    const cloudBackup = await cloudSyncService.getCloudBackupInfo()
    if (!cloudBackup) {
      return true
    }

    const localBackupHistory = await db.backupMetadata.toArray()
    return localBackupHistory.some(
      (entry) => entry.exportedAt === cloudBackup.exportedAt,
    )
  },
}

async function requireOnlineSession() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('Cloud backup requires an internet connection.')
  }

  const session = await authService.getSession()
  if (!session?.user) {
    throw new Error('Sign in with Google before using cloud backup.')
  }

  return session
}

async function fetchBackupRow(
  userId: string,
  options: { allowMissing: true },
): Promise<BackupRow | null>
async function fetchBackupRow(
  userId: string,
  options?: { allowMissing?: false },
): Promise<BackupRow>
async function fetchBackupRow(
  userId: string,
  options: { allowMissing?: boolean } = {},
) {
  const { data, error } = await getSupabaseClient()
    .from('backups')
    .select('snapshot, schema_version, updated_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'Cloud backup could not be loaded.')
  }

  if (!data) {
    if (options.allowMissing) {
      return null
    }
    throw new Error('No cloud backup exists for this Google account.')
  }

  return data as BackupRow
}

function infoFromBackup(
  backup: JsonBackup,
  updatedAt: string,
): CloudBackupInfo {
  return {
    databaseSchemaVersion:
      backup.databaseSchemaVersion ?? DATABASE_SCHEMA_VERSION,
    exportedAt: backup.exportedAt,
    recordCount: Object.values(backup.data).reduce(
      (sum, records) => sum + records.length,
      0,
    ),
    updatedAt,
  }
}
