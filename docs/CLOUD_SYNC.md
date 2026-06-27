# Cloud Backup

Cloud backup is a manual snapshot feature layered on top of the local-first app.
IndexedDB remains the source of truth, and the app remains usable when signed
out or offline.

## Behavior

- Sign-in uses Supabase Auth with the Google OAuth provider.
- `Back up now` uploads the existing JSON backup snapshot from
  `backupService.createJsonBackup()` to the signed-in user's `public.backups`
  row.
- `Restore from cloud` downloads that snapshot, validates it with
  `backupService.validateBackup()`, and then calls
  `backupService.restoreReplace()`.
- Restore is replace-only. It clears local app data before importing the
  validated cloud snapshot.
- There is no realtime sync, merge, conflict resolution, automatic backup, or
  automatic restore.

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
