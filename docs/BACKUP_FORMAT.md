# Backup Format

## Current Versions

- Backup format version: `1`
- Compatible database schema versions: backups with `databaseSchemaVersion` less than or equal to the app's current IndexedDB schema version can be restored after validation.
- Application restore support: application version `0.0.0` can restore backup format version `1`.

The backup format version is intentionally separate from the IndexedDB database schema version. A database migration does not automatically imply a backup format change, and a backup format change does not automatically imply an IndexedDB migration.

## JSON Backup

JSON is the authoritative full-fidelity backup format. A backup root contains:

- `backupFormatVersion`
- `databaseSchemaVersion`
- `applicationVersion`
- `exportedAt`
- `data`

`data` contains arrays for settings, nutrition target history, foods, food logs, bodyweight entries, exercises, program templates, template workout days, template workout exercises, active program cycles, active-cycle workout days, active-cycle workout exercises, active workout records, workout exercises, workout sets, completed workout history, history exercises, history sets, detected workout changes, and applied workout changes.

Stable IDs, parent IDs, ordering fields, local dates, timestamps, archived status, source IDs, and snapshots are preserved.

## Restore Behavior

Restore validates the complete backup before modifying IndexedDB. Validation covers root metadata, supported backup format version, database schema compatibility, required fields, IDs, duplicate IDs, timestamps, local dates, numeric values, enum values, parent-child relationships, source references, and snapshot structure.

Unsupported future backup versions are rejected. Backups from a newer database schema are rejected. Invalid records are not silently ignored, and failed backups are not partially imported.

The supported restore mode is replace. Merge restore is unavailable in this release because same-ID, natural-key, duplicate historical workout, source-reference, and timestamp conflict behavior is not yet defined safely enough to automate.

Replace restore validates first, then writes all restored user data in one Dexie transaction. If the transaction fails, the original database state is preserved. Required app metadata is reinitialized after a successful restore.

## CSV Export

CSV export creates a local TAR archive containing one CSV file per exported table:

- `userSettings.csv`
- `nutritionTargets.csv`
- `foods.csv`
- `foodLogEntries.csv`
- `bodyweightEntries.csv`
- `exercises.csv`
- `programTemplates.csv`
- `templateWorkoutDays.csv`
- `templateWorkoutExercises.csv`
- `activeProgramCycles.csv`
- `activeCycleWorkoutDays.csv`
- `activeCycleWorkoutExercises.csv`
- `workouts.csv`
- `workoutExercises.csv`
- `workoutSets.csv`
- `workoutHistoryEntries.csv`
- `workoutHistoryExercises.csv`
- `workoutHistorySets.csv`
- `detectedWorkoutChanges.csv`
- `appliedWorkoutChanges.csv`

CSV files include headers, stable IDs, parent IDs, ordering fields, timestamps, local dates, archived status, source IDs, and escaped values for commas, quotation marks, line breaks, and empty values. Nested snapshot fields are serialized as JSON inside the CSV cell.

CSV is intended for readable analysis and spreadsheet use. CSV import is not supported.

## Clear All Data

Clear all data requires explicit confirmation. It removes local settings, nutrition data, bodyweight entries, exercises, programs, active workouts, completed history, detected changes, and applied changes in one transaction. App metadata may be reinitialized. Demo data is not inserted.

Users should export a JSON backup before clearing data if they may need to restore later.

## Privacy

Backup, restore, CSV export, and clear-all operations use browser APIs and IndexedDB on the local device. Files are not uploaded to a server, cloud backup is not created, and accounts are not involved.
