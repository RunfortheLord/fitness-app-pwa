import {
  BACKUP_SCHEMA_VERSION,
  DATABASE_SCHEMA_VERSION,
  db,
  type TrainingLogDatabase,
} from '@db/database'

export type DatabaseHealthDiagnostic = {
  ok: boolean
  databaseSchemaVersion: number
  backupSchemaVersion: number
  storesChecked: string[]
  errors: string[]
}

export async function diagnoseDatabaseHealth(
  database: TrainingLogDatabase = db,
): Promise<DatabaseHealthDiagnostic> {
  const requiredStores = [
    'appMetadata',
    'userSettings',
    'nutritionTargets',
    'foods',
    'foodLogEntries',
    'bodyweightEntries',
    'exercises',
    'programTemplates',
    'templateWorkoutDays',
    'templateWorkoutExercises',
    'activeProgramCycles',
    'activeCycleWorkoutDays',
    'activeCycleWorkoutExercises',
    'workouts',
    'workoutExercises',
    'workoutSets',
    'workoutHistoryEntries',
    'workoutHistoryExercises',
    'workoutHistorySets',
    'detectedWorkoutChanges',
    'appliedWorkoutChanges',
    'backupMetadata',
  ]
  const errors: string[] = []

  try {
    await database.open()
  } catch (error) {
    errors.push(
      error instanceof Error ? error.message : 'Database failed to open.',
    )
  }

  for (const store of requiredStores) {
    if (!database.tables.some((table) => table.name === store)) {
      errors.push(`Missing store: ${store}`)
    }
  }

  const metadata = await database.appMetadata.get('app')
  if (metadata && metadata.databaseSchemaVersion !== DATABASE_SCHEMA_VERSION) {
    errors.push('App metadata database schema version is stale.')
  }

  return {
    ok: errors.length === 0,
    databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
    backupSchemaVersion: BACKUP_SCHEMA_VERSION,
    storesChecked: requiredStores,
    errors,
  }
}
