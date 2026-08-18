# Version 1 Scope Freeze

Freeze date: 2026-08-18

This document fixes the Version 1 product boundary and records the repository
state inspected before Phase 1 documentation edits. Scope inclusion means a
capability is approved for Version 1 release work; it does not prove that the
capability is implemented, validated, or store-ready.

## Working Name And Compatibility

- **Vigorune** is the temporary public-facing working name.
- The name may change after naming and trademark review.
- A public rename is presentation-only. Do not rename the native bundle or
  application identifiers, the IndexedDB database (`training-log`), object
  stores, local-storage keys, persisted record IDs, or backup-format
  identifiers.
- Existing PWA and native installations must retain access to their data across
  naming and store-release work.

## Version 1 Includes

- Local-first operation with IndexedDB as the source of truth.
- Full local core use offline and without an account. Optional network-only
  provider, AI, backup, or notification workflows may require connectivity
  without blocking local features.
- Optional Google and Apple authentication.
- Optional cloud snapshot backup, not realtime multi-device synchronization.
- In-app deletion of the app-managed account and app-controlled cloud data,
  separate from local Clear all data.
- Nutrition and bodyweight tracking.
- Workout programs, active program cycles, live workouts, history, and
  user-reviewed structural/program changes.
- Outdoor, treadmill, and manual run tracking within documented platform
  limitations.
- User-initiated provider-backed barcode lookup.
- User-initiated AI meal-photo analysis whose estimates are reviewed and
  explicitly logged by the user.
- User-invoked or opt-in deterministic local calorie, load, or repetition
  estimates that remain explainable, editable, and unapplied until explicit
  review.
- Installed PWA distribution plus public Apple App Store and Google Play
  distribution.

## Version 1 Excludes

- Required account creation or required cloud connectivity for core use.
- Realtime multi-device synchronization, automatic cloud restore, or a
  cloud-first source of truth.
- Subscriptions, advertisements, social networking, followers, or public
  profiles.
- Wearable, Apple Health, or other health-platform integrations.
- AI coaching, automatic AI logging, generated coaching-based meal advice, or
  automatic AI changes to loads, repetitions, calories, targets, or programs.
- Bundled bulk food databases, barcode submission, micronutrient tracking, and
  meal plans.
- Automatic calorie adjustment, automatic training progression, or automatic
  program/day selection and start.
- Route maps, external map tiles, or promises of reliable fully backgrounded
  browser GPS tracking.
- Any unrelated feature expansion not explicitly added to the frozen scope.

Items in this section are future ideas only. They are not Version 1 backlog
items and must not be implemented incidentally during release work.

## Release Invariants

- Accounts are optional and signed-out use remains first-class.
- IndexedDB remains authoritative for primary user data.
- Cloud backup stores replaceable full snapshots and does not become realtime
  merge/sync.
- Local recording never waits on or fails because of cloud availability.
- AI results remain estimates, require user review, and never become automatic
  coaching or automatic mutation.
- Store wrappers and updates must preserve local data, schema migrations,
  backup compatibility, and the existing compatibility identifiers.
- Programs do not automatically choose or start a workout day.
- Workout history snapshots remain immutable after completion.

## Repository Inventory Before Phase 1 Edits

### Branch And Recent History

- Branch: `feat/nutrition-goals-and-program-library`
- Upstream: `origin/feat/nutrition-goals-and-program-library`
- State: 30 commits ahead of upstream, with no reported behind count.
- HEAD: `bfaff08 Generalize broad food search ranking`
- Other recent commits:
  - `b1d4b59 Fix whole-food derivative ranking`
  - `6c3cf70 Remember foods by time of day`
  - `fd0b2d3 Improve food search defaults`
  - `0ee1810 chore: restore unrelated documentation formatting`
  - `a1cf0f2 chore: keep graph release documentation focused`
  - `76d1ce9 feat: add total volume strength graphs`
  - `7b31841 test: align workout e2e flows with current UI`

### Working Tree Size

- 102 modified tracked files.
- 1 deleted tracked file.
- 14 untracked source or test files.
- Tracked diff: approximately 11,610 added lines and 2,427 deleted lines across
  103 files.
- Untracked source/test content: approximately 25 KB and 864 lines.
- Changed-file classification, counting the deleted and untracked files:
  69 application-source files, 34 test files, 11 documentation files, 1
  database/configuration file, and 2 package files.

### Modified Tracked Files By Area

- Database and project configuration: `db/supabase/schema.sql`, `package.json`,
  and `package-lock.json`.
- Documentation: `BACKUP_FORMAT.md`, `CLOUD_SYNC.md`,
  `DATA_MODEL_SPECIFICATION.md`, `DECISIONS.md`, `DEFINITION_OF_DONE.md`,
  `IPHONE_QA_CHECKLIST.md`, `PRODUCT_REQUIREMENTS.md`,
  `PROGRESSION_RECOMMENDATIONS.md`, `TEST_STRATEGY.md`, `USER_FLOWS.md`, and
  `UX_SPECIFICATION.md`.
- End-to-end tests: `e2e/app.spec.ts` and `e2e/pwa.spec.ts`.
- Application startup and routing: `src/app/App.test.tsx`, `src/app/App.tsx`,
  `src/app/ErrorBoundary.tsx`, `src/app/lazyPages.tsx`, and `src/main.tsx`.
- Shared components and shell: `src/components/AppShell.tsx`,
  `FoodCameraMenu.tsx`, `SortableList.tsx`, `SortableList.test.tsx`,
  `sortableDrag.ts`, and `ui.tsx`.
- Local database: `src/db/database.ts` and `src/db/database.test.ts`.
- Domain logic: calorie adjustment, changelog, exercise/program library,
  program weeks, rest timer, set propagation, strength progress, workout
  prefill, history display, and localization modules and their affected tests.
- Nutrition and training features: food form/library/search/goal/quick-add/target
  components plus program browsing, exercise library, program builder, and
  program overview components.
- Hooks and pages: keyboard inset and RIR hooks; calorie insights, history,
  Home, live workout, nutrition, run, settings, and training pages; affected
  tests; and nutrition/training caches.
- Repositories and services: exercise, food, program, settings, and workout
  repositories; initialization, automatic cloud backup, backup, calorie
  history, cloud sync, dashboard, and data export services; provider adapters;
  and their affected tests.
- Styling and types: `src/styles/global.css` and `src/types/app.ts`.

### Deleted Tracked File

- `src/features/nutrition/BarcodeScannerSheet.tsx`

This appears to be an intentional replacement by the untracked focused scanner
subpage, not a safe standalone deletion. Both sides must be reviewed and later
committed together if the implementation is accepted.

### Untracked Source And Test Files

- `src/app/AppLaunchScreen.tsx`
- `src/app/preloadInitialPageData.ts`
- `src/app/preloadRoutePages.ts`
- `src/app/routePageModules.ts`
- `src/components/LoadingState.test.tsx`
- `src/components/ui.test.tsx`
- `src/domain/workoutTiming.test.ts`
- `src/domain/workoutTiming.ts`
- `src/features/nutrition/BarcodeScannerSubpage.test.tsx`
- `src/features/nutrition/BarcodeScannerSubpage.tsx`
- `src/pages/calorieInsightsPageCache.ts`
- `src/pages/historyPageCache.ts`
- `src/pages/runPageCache.ts`
- `src/services/appStartupService.ts`

All 14 files are source or test files. Import/reference inspection found that
the non-test files are used by modified tracked code. None is classified as a
generated artifact or safe cleanup candidate.

## High-Level Change Classification

### Version 1 Work That Appears Cohesive But Still Needs Validation

- Nutrition serving/goal/calorie-maintenance work, food ranking and reuse,
  barcode scanning, and associated component/e2e coverage.
- Program library seeds, selectable weeks, scheduled deloads, workout autofill,
  live-workout timing/persistence, and related domain/repository tests.
- History, calorie, strength, run, and page-cache behavior with expanded tests.
- Automatic cloud snapshot behavior, cloud-row deletion, backup/data export,
  database schema work, and related tests.
- Mobile shell, keyboard/viewport, sortable UI, loading, and broad CSS changes.

"Appears cohesive" is based on file relationships and accompanying tests. No
application test suite or release gate was run during this documentation-only
phase, so these areas are not certified complete.

### Apparently Incomplete Or Release-Blocking Work

- The launch/preload/cache refactor depends on several untracked files and has
  not received a full release validation pass.
- The barcode scanner change deletes the old sheet while its replacement and
  test remain untracked.
- The IndexedDB change advances the working schema through version 21 and
  touches backup, workout, program, and settings persistence. Migration and
  restore compatibility require focused and full-gate review.
- Apple authentication, full in-app app-account deletion, Android native
  packaging, Google Play release work, and public-store release validation are
  approved Version 1 scope but are not demonstrated as complete by the current
  repository inventory. No Android project is present.
- The historical `docs/RELEASE_AUDIT.md` describes an older schema and release
  state. It is not a current Version 1 sign-off.

### Tests

- Test changes span 34 files, including large additions in
  `e2e/app.spec.ts`, `src/pages/TrainingPage.test.tsx`, database migrations,
  workout repositories, live-workout behavior, startup, barcode scanning, and
  page caches.
- The presence of tests lowers implementation risk but does not replace running
  the targeted checks and full release gate after the dirty work is organized.

### Documentation

- Eleven documentation files were already modified before this phase. They
  covered schema/backup changes, cloud backup, decisions, requirements,
  progression, testing, user flows, iPhone QA, and UX.
- The Phase 1 edits add a binding freeze and remove scope conflicts without
  treating the existing dirty implementation as released.

### Changes Requiring Additional Review

- `src/pages/LiveWorkoutPage.tsx`, `src/repositories/workoutRepository.ts`, and
  `src/db/database.ts` contain large persistence-sensitive changes.
- `src/styles/global.css`, `src/components/AppShell.tsx`, keyboard inset logic,
  and route/preload changes affect iPhone viewport behavior and launch/recovery.
- `db/supabase/schema.sql`, cloud services, Settings, backup/export services,
  authentication, and deletion behavior require privacy and per-user isolation
  review.
- The broad e2e and Training page test changes need review for stale assertions
  versus actual Version 1 behavior.

### Duplication Or Obsolete Material

- No source file was proven to be accidental duplication, so nothing was
  deleted as hygiene cleanup.
- The old scanner sheet and new scanner subpage form an apparent intentional
  replacement that must be handled atomically.
- Duplicate scanner UX sections were consolidated during Phase 1.
- The original roadmap milestones and `docs/RELEASE_AUDIT.md` are retained as
  historical context and are not current release status.

## Ignored And Private Files

The existing `.gitignore` correctly covers `node_modules/`, `dist/`,
`coverage/`, Playwright reports/results, `.vercel/`, real `.env` variants,
reference videos and extracted frames/contact sheets, logs, and common OS
artifacts. `.env.example` remains tracked as the safe template.

The following existing files or directories must remain uncommitted:

- `.env.local` and any other real `.env` variant.
- All `*.log` files, including local Vite, test, deploy, and Codex logs.
- `dist/`, `coverage/`, `playwright-report/`, `test-results/`, and `.vercel/`.
- `reference/ui-reference.MP4`, `reference/frames/`, and
  `reference/contact-sheets/`.

At inventory time, ignored generated/reference material included approximately
3.9 MB in `dist`, 5.5 MB in `coverage`, 0.7 MB in `playwright-report`, 2.4 MB in
`test-results`, 3.1 MB of extracted frames, a 0.3 MB contact sheet, and a 145 MB
reference video. These are not candidates for commit.

## Secret Review

- A filename-only, high-confidence credential scan found no apparent real
  secret in tracked or untracked source.
- Generic key-assignment matches were confined to test files. Manual redacted
  review showed test/mock values and export-exclusion assertions, not production
  credentials.
- No private-key, certificate, keystore, Apple key, or Google service-config
  file was found outside ignored dependency/build paths.
- `.env.local` may contain real local configuration and is correctly ignored.
  Its values were not printed or copied into this document.

This review is a hygiene check, not a substitute for the build-time secret leak
assertion and release security review.

## Phase 2 Starting Point

Begin with a read-only implementation-gap and validation pass around the
untracked startup/preload chain, scanner replacement, schema 17-21 migrations,
active-workout persistence, cloud/account deletion, and missing Apple/Android
store paths. Organize only proven coherent changes, run focused tests for each
high-risk area, then run the full release gate before any stable or store
release action.
