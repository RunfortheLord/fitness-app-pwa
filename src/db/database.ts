import Dexie, { type EntityTable } from 'dexie'

import type { AppMetadata, UserSettings } from '@shared-types/app'

export const DATABASE_SCHEMA_VERSION = 1
export const BACKUP_SCHEMA_VERSION = 1

export class TrainingLogDatabase extends Dexie {
  appMetadata!: EntityTable<AppMetadata, 'id'>
  userSettings!: EntityTable<UserSettings, 'id'>

  constructor() {
    super('training-log')

    this.version(DATABASE_SCHEMA_VERSION).stores({
      appMetadata: '&id',
      userSettings: '&id',
    })
  }
}

export const db = new TrainingLogDatabase()
