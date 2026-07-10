# Cloud Backup

Cloud backup is an automatic snapshot feature for signed-in users layered on
top of the local-first app. IndexedDB remains the source of truth, and the app
remains usable when signed out or offline.

## Behavior

- Sign-in uses Supabase Auth with the Google OAuth provider.
- Signed-in users receive a full automatic snapshot when the app opens or
  resumes, when connectivity returns, and within five minutes of backed-up
  local data changing. Repeated changes do not postpone that five-minute
  snapshot.
- Automatic backups retry after transient failures. Changes made offline stay
  local and are backed up after connectivity returns.
- Transient backup failures are silent. A warning that the data has not been
  backed up in a few days only appears once the last successful backup is older
  than the staleness threshold (three days), measured against the persisted
  `appMetadata.lastAutomaticBackupAt` so it survives app restarts.
- A device does not automatically replace an existing cloud snapshot unless
  its local backup history proves that the snapshot was created or restored on
  that device. This prevents a new or cleared device from overwriting a useful
  cloud backup with an empty local database.
- `Back up now` uploads the existing JSON backup snapshot from
  `backupService.createJsonBackup()` to the signed-in user's `public.backups`
  row and remains available as a manual fallback.
- `Restore from cloud` downloads that snapshot, validates it with
  `backupService.validateBackup()`, and then calls
  `backupService.restoreReplace()`.
- Restore is replace-only. It clears local app data before importing the
  validated cloud snapshot.
- There is no realtime sync, merge, conflict resolution, or automatic restore.
- The latest successful snapshot replaces the previous `public.backups` row;
  cloud backup does not provide version history.
- Signed-out users see a dismissible sign-in prompt on each fresh app launch.

## Manual Setup

Run `db/supabase/schema.sql` in Supabase SQL editor, then set these variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

For production, also add the Vercel production URL to Google OAuth authorized
origins and to the Supabase site/redirect URL configuration.

## Security Notes

The client uses only the Supabase anon key. Row isolation is enforced by
Supabase Row Level Security policies in `db/supabase/schema.sql`; client-side
checks are only for user experience and clear errors.

# Daily Nutrition Graph Rows

- Signed-in graph loads upsert `local_date`, `logged_calories`, and
  `target_calories` to the Supabase `daily_nutrition` table.
- `(user_id, local_date)` is the primary key and row-level security limits all
  reads and writes to the authenticated user.
- IndexedDB remains authoritative. Offline, signed-out, and failed sync states
  continue rendering the same graph from local records.
