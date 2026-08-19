# Cloud Backup

Cloud backup is an automatic snapshot feature for signed-in users layered on
top of the local-first app. IndexedDB remains the source of truth, and the app
remains usable when signed out or offline.

Authentication and cloud backup are optional Version 1 capabilities. Google and
Apple use the same local-first, PKCE relay, and deletion boundaries.

## Behavior

- Sign-in uses Supabase Auth. Google and Apple are the approved optional OAuth
  providers; neither may gate core local features.
- Signed-in users receive a restorable compact automatic snapshot when the app opens, when
  connectivity returns, and within fifteen minutes of backed-up local data
  changing. Returning to a visible app respects the same throttle rather than
  forcing another upload.
- Automatic backups retry after transient failures. Changes made offline stay
  local and are backed up after connectivity returns.
- Automatic-backup failures and existing-snapshot conflicts remain silent in
  the app shell while the service keeps retrying. Manual backup status and
  controls remain available in Settings. The last successful time remains
  persisted in `appMetadata.lastAutomaticBackupAt` across app restarts.
- A device does not automatically replace an existing cloud snapshot unless
  its local backup history proves that the snapshot was created or restored on
  that device. This prevents a new or cleared device from overwriting a useful
  cloud backup with an empty local database.
- `Back up now` uploads cloud snapshot format 1 from
  `backupService.createCloudBackup()` to the signed-in user's `public.backups`
  row and remains available as a manual fallback. The compact payload omits
  only exact deterministic built-in exercise/program seed records. Custom
  copies, modified built-ins, archived or hidden user choices, user-created
  templates, active state, and history remain present. GPS run samples stay
  local and are intentionally excluded; manual JSON exports retain the full
  local backup format 1.
- `Restore from cloud` accepts both existing legacy JSON snapshots and compact
  cloud snapshot format 1. A compact payload is schema-checked, expanded from
  the application's current deterministic seed definitions, overlaid with all
  preserved records, and validated as a complete full backup before
  `backupService.restoreReplace()` is called. Unsupported future compact
  versions are rejected without changing local data.
- Restore is replace-only. It clears local app data before importing the
  validated cloud snapshot.
- There is no realtime sync, merge, conflict resolution, or automatic restore.
- The latest successful snapshot replaces the previous `public.backups` row;
  cloud backup does not provide version history.
- A final serialized backup row larger than 8 MiB is rejected before any Supabase
  request. Restore format and replace-only behavior are unchanged.
- The automatic overwrite guard selects only `updated_at`; it does not download
  and validate the full remote snapshot merely to compare metadata.
- Signed-in users can delete both their backup snapshot and daily nutrition
  rows without changing local data; the app signs out afterward.
- Version 1 account management must also provide an in-app action that deletes
  the app-managed authentication account and all app-controlled cloud rows.
  Account deletion must not clear IndexedDB; local Clear all data remains a
  separate confirmed action.
- Signed-out users see a local-first onboarding prompt only until they choose
  to continue offline on that device.

## Manual Setup

Run `db/supabase/schema.sql` in Supabase SQL editor, then set these variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Compact cloud snapshots require no schema change to `public.backups`; the
versioned JSON envelope remains stored in the existing `snapshot` column.

For production, configure the Vercel and native-app redirect URLs in Supabase
and in each enabled Google or Apple provider. Store-release configuration must
be validated separately from development sign-in.

## Installed iOS PWA OAuth handoff

iOS opens Google OAuth outside a Home Screen PWA and returns ordinary HTTPS
callbacks to Safari. The installed PWA therefore uses a five-minute, one-time
Redis relay with Supabase's PKCE flow:

- The installed PWA creates a random relay identifier and retrieval secret.
- Supabase stores the PKCE verifier only in the installed PWA's local storage.
- Safari deposits only the short-lived authorization code into the relay.
- The installed PWA consumes the code once using the retrieval secret and then
  exchanges it with Supabase using its locally held PKCE verifier.
- Access tokens, refresh tokens, email addresses, and fitness records never
  enter the relay. The retrieval secret is stored in Redis only as a SHA-256
  digest, and expired or consumed records are deleted.

Installed callbacks use `/auth/callback/<relay-id>`. Each deployed origin must
allow its narrowly scoped `/auth/callback/*` path in Supabase's redirect URL
configuration. Normal browser sign-in continues to use the exact `/settings`
callback and Supabase's direct PKCE flow without the relay. Google is asked to
show its account picker for every attempt so a previous Safari account is not
silently reused.

## Security Notes

The client uses only the Supabase anon key. Row isolation is enforced by
Supabase Row Level Security policies in `db/supabase/schema.sql`; client-side
checks are only for user experience and clear errors.

Account deletion uses the narrowly scoped `/api/account/delete` server route.
It verifies the caller's Supabase access token, derives the user ID from the
verified identity, fails closed when distributed throttling is unavailable,
and calls the Supabase admin deletion operation. Cascading foreign keys remove
the app-controlled rows. The route never receives or replaces local IndexedDB
records and never accepts a client-provided user ID.

# Daily Nutrition Graph Rows

- Signed-in graph loads upsert `local_date`, `logged_calories`, and
  `target_calories` to the Supabase `daily_nutrition` table.
- Account-scoped fingerprints in optional local app metadata suppress unchanged
  rows. A changed or new date uploads only that row; failed writes do not
  advance the fingerprint. The bounded state retains at most 366 dates and is
  cleared on account changes and cloud-data deletion.
- `(user_id, local_date)` is the primary key and row-level security limits all
  reads and writes to the authenticated user.
- IndexedDB remains authoritative. Offline, signed-out, and failed sync states
  continue rendering the same graph from local records.
