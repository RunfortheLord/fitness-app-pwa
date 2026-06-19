# Data Model Specification

## Principles

- IndexedDB is the source of truth for primary user data.
- All entities use stable app-generated IDs.
- Use local calendar dates for date-based logs and absolute timestamps for event ordering.
- Use schema versions for both database migrations and backup format.
- Store graph-ready historical records even when graphs are out of scope.
- Snapshot mutable reference data into historical records when needed to preserve history.

## ID Format

- IDs should be opaque strings generated client-side.
- IDs must be unique across each entity store.
- Backup restore must preserve IDs when importing full-fidelity JSON.

## Time Fields

- `createdAt`: ISO 8601 timestamp.
- `updatedAt`: ISO 8601 timestamp.
- `localDate`: `YYYY-MM-DD` in the user's local calendar.
- Workout `startedAt` and `completedAt`: ISO 8601 timestamps.
- Durations are stored in seconds.

## Entities

Implementation note: the persisted IndexedDB schema stores child collections in
separate queryable stores rather than only as nested arrays. The snapshot and
immutability requirements below still apply. Program template days and
exercises, active-cycle days and exercises, live workout exercises and sets, and
workout-history exercises and sets each have their own stores with explicit
foreign-key ID fields and sort indexes.

### AppMetadata

- `id`: fixed value such as `app`
- `databaseSchemaVersion`
- `backupSchemaVersion`
- `createdAt`
- `updatedAt`

### UserSettings

- `id`
- `weightUnit`: default `lb`
- `energyUnit`: default `kcal`
- `nutritionTargets`
- `createdAt`
- `updatedAt`

### NutritionTarget

- `calories`
- `proteinGrams`
- `carbohydrateGrams`
- `fatGrams`
- Targets are manually entered and may be stored as current settings first.
- Future dated target history may be added without changing food log records.

### Food

- `id`
- `name`
- `servingQuantity`
- `servingUnit`
- `servingDescription`
- `caloriesPerServing`
- `proteinGramsPerServing`
- `carbohydrateGramsPerServing`
- `fatGramsPerServing`
- `notes`
- `status`: `active` or `archived`
- `createdAt`
- `updatedAt`

### FoodLogEntry

- `id`
- `localDate`
- `foodId`: nullable if the source food was deleted after logging
- `foodSnapshot`
- `servingMultiplier`
- `computedCalories`
- `computedProteinGrams`
- `computedCarbohydrateGrams`
- `computedFatGrams`
- `notes`
- `createdAt`
- `updatedAt`

### FoodSnapshot

- `foodName`
- `servingQuantity`
- `servingUnit`
- `servingDescription`
- `caloriesPerServing`
- `proteinGramsPerServing`
- `carbohydrateGramsPerServing`
- `fatGramsPerServing`
- `notes`

### BodyweightEntry

- `id`
- `localDate`
- `weight`
- `unit`: default `lb`
- `notes`
- `createdAt`
- `updatedAt`
- Unique constraint: one active bodyweight entry per `localDate`.

### Exercise

- `id`
- `name`
- `notes`
- `defaultRestSeconds`
- `trackingMethodId`
- `trackingMetrics`
- `status`: `active` or `archived`
- `createdAt`
- `updatedAt`

### TrackingMethod

- `id`
- `name`
- `metrics`
- Initial IDs:
  - `weight_reps`
  - `bodyweight_reps`
  - `assisted_weight_reps`
  - `reps_only`
  - `duration`
  - `distance_duration`

### TrackingMetric

- `key`
- `label`
- `valueType`: `number`, `integer`, `durationSeconds`, or `boolean`
- `unit`: nullable
- `requiredForCompletion`

### ProgramTemplate

- `id`
- `name`
- `notes`
- `workoutDays`
- `status`: `active` or `archived`
- `createdAt`
- `updatedAt`

### ProgramTemplateDay

- `id`
- `name`
- `notes`
- `orderIndex`
- `prescribedExercises`

### PrescribedExercise

- `id`
- `exerciseId`
- `exerciseSnapshot`
- `orderIndex`
- `targetSetCount`
- `targetRepsMin`
- `targetRepsMax`
- `targetRir`
- `restSecondsOverride`
- `notes`

### ActiveProgramCycle

- `id`
- `sourceTemplateId`
- `name`
- `notes`
- `workoutDays`
- `status`: `active`, `inactive`, or `archived`
- `activatedAt`
- `createdAt`
- `updatedAt`
- The cycle is an independent working copy of the template at activation time.

### ActiveWorkout

- `id`
- `sourceActiveCycleId`
- `sourceTemplateId`
- `sourceDayId`
- `localDate`
- `name`
- `workoutSnapshot`
- `exercises`
- `notes`
- `startedAt`
- `elapsedPausedSeconds`
- `activeRestTimer`
- `createdAt`
- `updatedAt`

### ActiveWorkoutExercise

- `id`
- `exerciseId`
- `exerciseSnapshot`
- `sourcePrescribedExerciseId`
- `orderIndex`
- `notes`
- `skipped`
- `replacementOfExerciseId`
- `sets`

### ActiveWorkoutSet

- `id`
- `setNumber`
- `metricValues`
- `rir`
- `completed`
- `completedAt`
- `restSecondsUsed`
- `createdAt`
- `updatedAt`

### RestTimerState

- `id`
- `startedAt`
- `durationSeconds`
- `pausedAt`
- `accumulatedPausedSeconds`
- `status`: `running`, `paused`, `dismissed`, or `completed`
- Remaining time is derived from timestamps.

### WorkoutHistoryEntry

- `id`
- `localDate`
- `name`
- `sourceActiveCycleId`
- `sourceTemplateId`
- `sourceDayId`
- `startedAt`
- `completedAt`
- `durationSeconds`
- `exercises`
- `notes`
- `detectedChanges`
- `createdAt`
- `updatedAt`

### WorkoutHistoryExercise

- `id`
- `exerciseId`
- `exerciseSnapshot`
- `orderIndex`
- `notes`
- `skipped`
- `sets`

### WorkoutHistorySet

- `id`
- `setNumber`
- `metricValues`
- `rir`
- `completed`
- `completedAt`
- `restSecondsUsed`

### DetectedStructuralChange

- `id`
- `type`: `set_added`, `set_removed`, `exercise_added`, `exercise_skipped_or_removed`, `exercise_replaced`, or `exercise_order_changed`
- `description`
- `sourcePath`
- `performedPath`
- `selectedDestination`: `cycle_only`, `template_only`, `both`, or `neither`
- `appliedDestination`: nullable until applied
- `status`: `pending`, `applied`, `rejected`, or `failed`
- `createdAt`
- Performed weight, reps, RIR, set completion, and duration are excluded from structural changes.

## Relationships

- `FoodLogEntry.foodId` references `Food.id` but historical totals depend on `foodSnapshot`.
- `PrescribedExercise.exerciseId` references `Exercise.id` and also stores `exerciseSnapshot`.
- `ActiveProgramCycle.sourceTemplateId` references `ProgramTemplate.id`.
- `ActiveWorkout` references the source cycle, template, and day when applicable.
- `WorkoutHistoryEntry` references source IDs and stores full performed snapshots.
- Referenced exercises and foods should be archived rather than hard deleted when deletion would break references.

## Snapshot Behavior

- Food log entries snapshot food values at logging time.
- Program activation copies template structure into the active cycle.
- Active workout creation snapshots the selected active-cycle day.
- Workout history stores performed exercise and set snapshots.
- Later edits to reusable foods, exercises, templates, or active cycles do not silently mutate history.

## Archive Behavior

- `Food`, `Exercise`, and `ProgramTemplate` support `active` and `archived`.
- Archive hides records from default pickers but keeps references valid.
- Hard delete is allowed only when no log, program, active workout, or history references exist.
- Historical workouts can be deleted only with confirmation.

## Migrations

- Every IndexedDB schema change increments `databaseSchemaVersion`.
- Migrations must be deterministic and idempotent where possible.
- Migration failure must leave the prior database usable or surface a clear blocking error.
- Backup imports must validate backup schema version before writing.
- Unsupported future backup versions must not be imported.
- Initial implementation uses IndexedDB schema version 2 because version 1
  existed with only `appMetadata` and `userSettings`. The version 2 migration
  adds the full local fitness model stores and updates app metadata to the
  current schema version.

## Transaction Boundaries

- Creating or editing a food and logging a food are separate transactions.
- Logging food writes the snapshot and computed totals in one transaction.
- Activating a program copies template data into an active cycle in one transaction.
- Starting a workout creates the active workout and source snapshot in one transaction.
- Completing a workout writes history and removes active workout in one transaction after history write succeeds.
- Applying detected changes to cycle/template/both must be transactional. A failed update must not partially update one destination.
- Restore replace must validate first, then replace data in one transaction or staged sequence with rollback-safe behavior.
- Clear all data requires destructive confirmation and clears all user stores together.

## Backup Model

- JSON backup includes metadata, schema versions, exportedAt timestamp, settings, foods, food logs, bodyweight entries, exercises, program templates, active cycles, active workout if present, and workout history.
- JSON backup is authoritative and full fidelity.
- CSV export is derived from stores for readability and does not need to support restore.
- Import preview summarizes counts, schema versions, conflicts, and whether merge or replace is selected.
- Current backup format version is `1`, separate from IndexedDB schema version `2`.
- Backup root fields are `backupFormatVersion`, `databaseSchemaVersion`,
  `applicationVersion`, `exportedAt`, and `data`.
- Restore supports backup format version `1` when the backup database schema
  version is less than or equal to the app's current database schema version.
  Future backup format versions and newer database schema versions are rejected
  before any database mutation.
- Replace is the supported restore mode. Merge restore is unavailable in this
  release because conflict behavior is not yet deterministic enough.
- CSV export produces a local TAR archive with one CSV file per data table.
  CSV import is not supported.

See `docs/BACKUP_FORMAT.md` for the implemented backup root, CSV file list,
validation behavior, restore compatibility rules, and clear-all behavior.
