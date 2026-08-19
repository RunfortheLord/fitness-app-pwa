# Backup Format

## Current Versions

- Backup format version: `1`
- Compact cloud snapshot format version: `1` (a separate envelope, not a
  reinterpretation of backup format 1)
- Compatible database schema versions: backups with `databaseSchemaVersion`
  less than or equal to the app's current IndexedDB schema version `21` can be
  restored after validation.
- API key integration settings are not exported in backups. Replacing local data
  from a backup clears the saved API key integration record.
- Application restore support: application version `0.9.0` can restore backup format version `1`.

The backup format version is intentionally separate from the IndexedDB database schema version. A database migration does not automatically imply a backup format change, and a backup format change does not automatically imply an IndexedDB migration.

## Compact Cloud Snapshot

Automatic and manual cloud backup writes use a separate root envelope with:

- `cloudSnapshotFormatVersion`
- `sourceBackupFormatVersion`
- `databaseSchemaVersion`
- `applicationVersion`
- `exportedAt`
- `seedManifest`
- `data`

Compact cloud snapshot format 1 uses source backup format 1 and keeps the same
table names and record schemas. It excludes a built-in exercise, built-in
program template, template day, or template exercise only when the stored
record exactly equals the application's deterministic seed record. A stable ID
or built-in-looking name alone is never enough to omit data. Custom copies,
modified built-ins, user-created templates, archived or hidden choices, and all
non-seed records remain explicit.

Cloud restore continues to accept legacy JSON backup-format-1 snapshots. For a
compact snapshot, restore validates the compact envelope, reconstructs current
deterministic seed records from the same application seed definitions, overlays
preserved records by stable ID, and validates the resulting full backup and all
relationships before modifying IndexedDB. The expanded data then uses the same
single replace transaction as manual restore. Unsupported future cloud snapshot
versions and compact snapshots containing GPS run samples are rejected without
partial clearing.

The compact representation is cloud-only. It does not change the user-facing
manual JSON backup, ZIP export, IndexedDB schema, local source-of-truth model,
replace-only semantics, or 8 MiB final serialized cloud-row cap.

## JSON Backup

JSON is the authoritative full-fidelity backup format. A backup root contains:

- `backupFormatVersion`
- `databaseSchemaVersion`
- `applicationVersion`
- `exportedAt`
- `data`

`data` contains arrays for settings, nutrition target history, foods, food logs,
remembered food-unit preferences, cached barcode product associations,
bodyweight entries, exercises, program templates, template workout days,
template workout exercises, active program cycles, active-cycle workout days,
active-cycle workout exercises, active workout records, workout exercises,
workout sets, completed workout history, history exercises, history sets,
detected workout changes, applied workout changes, runs, run samples, run
pauses, run splits, and run classifications.

Stable IDs, parent IDs, ordering fields, local dates, timestamps, archived or hidden status, source IDs, built-in exercise metadata, custom exercise metadata, and snapshots are preserved.

Exercise snapshots may include `recordsRepsPerSide`. Older backups that do not
include this snapshot field restore it as `false`; restore does not rewrite or
double historical repetition values.

Workout set records may include optional per-field value ownership metadata
`metricValueSources` for live-workout propagation. Older backups that omit it
restore each set with an empty ownership map. Workout set records may also
include optional progression metadata: `targetSnapshot` and
`targetRecommendation`. These preserve the original target, engine suggestion,
user-edited target, effective-target inputs, source set, reason code,
explanation, and generated timestamp used for explainable live recommendations.
Older backups that omit these fields remain valid.

Workout and workout-exercise records may include legacy `notes` fields. The
current live-workout UI does not write workout-level or exercise-level notes,
but restore keeps older fields readable so historical backups do not corrupt
unrelated workout data. These legacy note fields do not create active UI
controls.

Workout records include nullable `pausedAt` state and accumulated paused
seconds. Older backups that omit `pausedAt` restore it as `null`. Completed
history always stores `pausedAt: null` after folding any final pause into the
accumulated total.

Detected workout changes may include type `progression_recommendation` with
optional `recommendationReason` and `recommendationSummary`. These records are
unchecked by default in review and are applied only to selected future
prescription destinations; completed actual workout results are not rewritten.

Food and food-log snapshot records may include optional external-provider
metadata for normalized USDA or Open Food Facts records: provider identity,
provider record ID, provider data type, source reference, barcode metadata,
source update timestamp, ingestion timestamp, normalizer version, serving weight
conversion metadata, macro basis, and raw/cooked status. Older backups that omit
these fields restore as local or legacy food records where appropriate.

Food-log nutrition history remains snapshot based. Restored historical food logs
do not require a live provider call and are not recalculated from future
provider data.

Remembered food-unit preferences, cached barcode products, custom barcode
associations, timer sound enabled/disabled state, selected timer sound, and
active-program references are included in JSON backups because they are local
user workflow state needed to restore the app faithfully. USDA API key
integration settings remain excluded.

RIR tracking and workout-autofill mode are also backed up. Older backups that
omit them restore with RIR tracking disabled and Recorded history autofill.
History organization and selected-program filter are backed up; older backups
restore to Most recent with no selected program. Program/template records back
up scheduled deload week numbers, and workout/history records back up their
snapshotted week number and deload status. Older backups restore with no
scheduled deload weeks and regular workout status.

## Restore Behavior

Restore validates the complete backup before modifying IndexedDB. Validation covers root metadata, supported backup format version, database schema compatibility, required fields, IDs, duplicate IDs, timestamps, local dates, numeric values, enum values, parent-child relationships, source references, and snapshot structure.

Unsupported future backup versions are rejected. Backups from a newer database schema are rejected. Invalid records are not silently ignored, and failed backups are not partially imported.

The supported restore mode is replace. Merge restore is unavailable in this release because same-ID, natural-key, duplicate historical workout, source-reference, and timestamp conflict behavior is not yet defined safely enough to automate.

Replace restore validates first, then writes all restored user data in one Dexie transaction. If the transaction fails, the original database state is preserved. Required app metadata is reinitialized after a successful restore. Built-in exercises are reseeded idempotently after restore so older backups gain the offline library without duplicating records.

## Fitness Data ZIP Export

The user-facing **Export all fitness data** action creates a conventional ZIP
archive. Every entry is contained by one timestamped top-level directory. The
archive contains:

- `README.txt`, with versions, units, timezone, inventory, and a privacy warning;
- `manifest.json`, with export metadata, table counts, table descriptions,
  generated column metadata, and SHA-256 checksums when Web Crypto is available;
- `backup/fitness-data-backup.json`, the existing restore-compatible,
  full-fidelity JSON backup;
- `backup/schema.json`, generated from the same Zod schema used to validate
  restore files;
- one typed JSON array under `backup/` for every explicitly allowlisted backup
  table, including empty arrays;
- spreadsheet-oriented reports under `reports/`: workout history, daily
  nutrition, food log, bodyweight, programs, exercise library, and export
  summary.

The complete JSON backup remains authoritative. Individual table JSON files
preserve nulls, booleans, numbers, arrays, nested objects, stable IDs, and
relationships without double-stringifying nested values. The schema file and
manifest retain the complete defined structure when a table has no records.
`apiKeyIntegrationSettings`, backup audit metadata, transient active-cycle
check-offs, and object URLs are not exported.

Human-readable CSV reports use explicit headers, RFC 4180 quoting, CRLF line
endings, Unicode, predictable ordering, normal unit columns, and `true`/`false`
booleans. Text beginning with `=`, `+`, `-`, or `@` is prefixed with an
apostrophe in reports to prevent spreadsheet formula injection. Authoritative
JSON values are never modified for spreadsheet safety.

Bodyweight CSV and JSON exports include every stored bodyweight entry,
including legacy duplicate-date records restored from older backups. Export
does not collapse, average, or rewrite source records.

Run CSV and JSON exports include active and completed runs plus raw GPS samples,
sample decisions, rejection reasons, pause periods, splits, GPS-gap markers,
and walking/rest classifications. Location history is sensitive data and stays
inside the user-initiated local export file; the app does not upload route
samples.

Estimated one-repetition-maximum graph values are derived from exported
workout-history sets after restore. They are not a separate backup table and do
not change the backup format version.

Nutrition report and JSON exports use stored historical food-log snapshots. They
include enough snapshot information to reconstruct local date, log timestamp,
food name, optional brand or restaurant, provider identity when known, serving
definition, consumed multiplier, calories, protein, total carbohydrates, fat,
and reliable conversion metadata when available. Export never refetches provider
records.

CSV reports are intended for readable analysis and spreadsheet use. CSV import
is not supported.

Before compression and download, export validation checks required and unique
paths, manifest record counts, JSON parsing, restore-schema and relationship
validation, table checksums when supported, and disallowed secret field names.
If legacy local records fail the latest relationship or schema validation, the
archive is still downloaded with its authoritative raw backup and an
`EXPORT_WARNINGS.txt` report. Packaging failures and unsafe archive paths still
prevent download.

## Clear All Data

Clear all data requires explicit confirmation. It removes local settings, nutrition data, bodyweight entries, custom exercises, programs, active workouts, completed history, detected changes, applied changes, runs, run samples, run pauses, run splits, and run classifications in one transaction. App metadata may be reinitialized. Built-in exercises are reseeded idempotently. Demo data is not inserted.

Users should export a JSON backup before clearing data if they may need to restore later.

## Privacy

Local backup, restore, CSV export, and clear-all operations use browser APIs and
IndexedDB on the device. Creating a local export never uploads that file or
requires an account. Optional signed-in cloud backup separately uploads a
validated snapshot as documented in `docs/CLOUD_SYNC.md`; GPS run samples remain
local-only while manual JSON export retains the full-fidelity local format.
Cloud backup does not change that local format or make cloud data authoritative.
