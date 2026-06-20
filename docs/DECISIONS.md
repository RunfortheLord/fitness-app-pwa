# Decisions

## 2026-06-19 Food Provider Sources

- USDA FoodData Central is the primary external food provider because its
  official API, data type documentation, and CC0/public-domain licensing support
  server-side use for this app.
- Open Food Facts is accepted only as a controlled branded-product fallback. It
  is not used for search-as-you-type, the app does not write records, and images
  and nutrition scores are ignored.
- No additional free provider was added in this prompt. Restaurant and fast-food
  coverage is limited to records supplied by USDA or the controlled fallback;
  the app will not scrape menus or fabricate restaurant coverage.

## Live Workout Final-Set RIR

- Current live-workout UI requests RIR only on the final programmed set for an
  exercise.
- Added unprogrammed sets do not become the final programmed RIR set. This
  matches existing data semantics where added sets are created with `rir: null`
  and are detected later as structural set additions.
- Historical RIR values on non-final sets are preserved in storage and backups
  even when the current UI does not render an input for them.

## Estimated 1RM Graphs

- Estimated one-repetition maximum is now a derived History view rather than a
  persisted record.
- The calculation uses completed weighted-repetition history only, selects the
  highest eligible estimated set per workout, and does not rewrite historical
  workout records.
- Repetition counts above 12 are excluded from the graph because high-rep Epley
  estimates can be misleading for this app's first strength-progress view.

## Architecture and Scope Decisions

- The app is a single-user, local-first Progressive Web App.
- Primary target is iPhone installed through Safari using Add to Home Screen.
- IndexedDB is the source of truth for all primary user records.
- No account, backend, cloud sync, subscription, internet dependency after installation, or external food database is included in the first release.
- JSON is the authoritative full-fidelity backup format.
- CSV is export-only for readable spreadsheet use.
- Backup format version `1` is separate from IndexedDB schema version `5`.
- JSON restore supports replace mode only in this release. Merge restore remains
  unavailable until same-ID, natural-key, duplicate historical workout,
  source-reference, archived-record, and timestamp conflict behavior is defined.
- CSV export is packaged as a local TAR archive with one CSV file per data
  table. CSV import is out of scope.
- Clear-all data removes user data transactionally and reinitializes required
  app metadata without inserting demo data.
- The UI uses a dark, dense, card-based mobile design adapted from the reference analysis without copying branding or proprietary assets.
- Main navigation is fixed bottom navigation: Home, Nutrition, center Add,
  Training, Run, History.
- Settings are reachable from the header or a visible secondary action.
- The center Add button opens a context-aware quick-action bottom sheet.

## Product Behavior Decisions

- Nutrition is manual and simple.
- Food log entries snapshot nutrition values at logging time.
- Bodyweight is one manual entry per local calendar date, pounds by default.
- Exercise tracking uses metric-driven presets to allow future expansion.
- The built-in offline exercise library is an original curated seed list. No
  third-party exercise database, third-party application code, images, videos,
  instructions, or descriptions are imported.
- Built-in exercise IDs use stable `builtin:` identifiers and seed metadata so
  future library updates can add or correct built-in records idempotently.
- Exercises referenced by history or programs should be archived instead of hard deleted.
- Custom exercises can be hidden from future selection while preserving
  program, active-workout, and completed-history references.
- Program Templates and Active Program Cycles are separate concepts.
- Activating a template creates an independent active-cycle copy.
- Activating a template marks any existing active cycle inactive so exactly one
  cycle is current.
- Programs never auto-advance or force a schedule.
- Users manually select workout days.
- Only one active workout is required at a time.
- Runs and lifting workouts are mutually exclusive in this release. Starting a
  run is blocked while a lifting workout is active, and starting a second run is
  blocked while any run is active or paused.
- Active workout state must persist across navigation, refresh, app close, and installed PWA reopen.
- Active run state persists in IndexedDB. GPS is not backfilled after reload,
  browser suspension, or PWA restart; only received samples are stored.
- Rest timers are timestamp-based.
- Completing a workout saves history before any optional structural program update.
- Run moving time is the sum of accepted GPS sample intervals whose implied
  speed meets the configured moving threshold. Paused, rejected, stale, jitter,
  impossible-speed, and long-gap intervals do not add moving time.
- Detected structural changes are reviewed individually and are never applied automatically.
- Applying detected changes to active cycle/template/both is transactional.

## First-Release Exclusions

- Account creation and login.
- Backend server and cloud sync.
- Social features and public profiles.
- Subscriptions and ads.
- Wearables and Apple Health.
- AI coaching and AI food-photo analysis.
- External food database and barcode scanner.
- Micronutrients and meal plans.
- Automated calorie adjustment.
- Automated progression and automatic program advancement.
- Strength scores, trend weight, adherence percentages, and non-history graphs.
- Route maps, external map tiles, and reliable fully backgrounded GPS tracking.
- Public App Store distribution.
- Push-notification dependency.
