# Test Strategy

## Goals

- Verify the app works as a local-first, offline-capable iPhone PWA.
- Protect IndexedDB persistence, snapshot behavior, workout completion, detected-change review, and backup/restore integrity.
- Keep first-release scope clear by testing both the approved optional release
  surfaces and the absence of excluded feature expansion.

## Command Workflow

Normal development uses the smallest check that covers the change:

- `npm run dev` starts the Vite development server.
- `npm run format` formats tracked project files.
- `npm run test:watch` reruns affected Vitest tests while editing.
- `npm run test:unit` runs domain, repository, service, server, and database
  tests without mounting page components.
- `npm run test:components` runs component, page, feature, hook, and app tests.
- `npm run test -- path/to/file.test.ts` runs a focused test file once.
- `npm run build` and `npm run preview` verify production output when needed.

Pre-deployment smoke verification uses `npm run check:smoke`. It runs format,
lint, type, unit, and production-build checks once, then exercises tagged core
flows in the iPhone-sized Chromium project against that existing build.

Comprehensive release validation uses `npm run check`. It retains the complete
unit and three-project Playwright suites. `npm run test:coverage` remains a
separate, intentionally slower coverage report and is not required after every
small edit. Coverage runs test files serially because instrumentation combined
with concurrent jsdom and IndexedDB work makes UI timing assertions unreliable;
normal unit and component test commands still use up to four workers.

The project Playwright runner owns a project-specific preview port, refuses to
start if another process already occupies it, and closes only the preview it
started. This prevents a stale or unrelated local application from being
mistaken for Vigorune and avoids orphaned Windows preview processes.

## Unit Tests

- Date utilities for local `YYYY-MM-DD` behavior.
- Nutrition total calculations from snapshotted food log entries.
- Decimal serving multiplier calculations.
- Restaurant listed-serving normalization, persistence, and multiplier rebasing.
- Calorie-insight 7/30/90-day eligibility, consistency, and average-difference calculations.
- Bodyweight upsert behavior by local date.
- Tracking preset field definitions.
- Rest timer remaining-time calculation from timestamps.
- Structural change detection.
- Checked and unchecked save-all behavior for detected workout changes.
- Archive versus hard-delete eligibility.
- Backup schema validation.

## Component Tests

- Home dashboard cards with populated and empty data.
- Home calorie 1W/1M controls and calorie-insight 1W/1M/3M summaries, retries,
  stale-request protection, localization, and empty states.
- Date selector controls.
- Bottom navigation and center Add sheet.
- Nutrition search, recent foods, log food sheet, and create/edit food form.
- Bodyweight entry sheet.
- Exercise create/edit form and tracking preset selector.
- Program builder cards and prescribed exercise editor.
- Live workout exercise card and set rows for every tracking preset.
- Rest timer controls.
- Workout-finish save-all confirmation and its unchecked default.
- History detail view.
- Settings backup/restore forms.
- Signed-out launch prompt and signed-in automatic-backup lifecycle.
- Validation and error states.

## Integration Tests

- Create food, log food, edit reusable food, verify historical log totals remain unchanged.
- Add and edit bodyweight for a date.
- Create exercise, add to program, activate program, and verify active cycle is independent.
- Start workout from manually selected workout day.
- Edit active workout, refresh app, verify session resumes.
- Complete workout, save history, review detected changes, and apply all or none
  transactionally according to explicit user choice.
- Archive referenced exercise and verify history/program display remains intact.
- Export JSON backup and restore into a clean database.
- Restore failure leaves existing data unchanged.

## End-to-End Tests

- First launch with empty IndexedDB.
- Full nutrition flow from food creation through date-based logging.
- Persist a calorie target and food log, then verify the Home range controls and
  30/90-day consistency and average deficit on the calorie details subpage.
- Full bodyweight flow.
- Full training flow from exercise creation to program activation.
- Live workout flow with set completion, rest timer, replacement, and finish.
- Detected-change review with unchecked and checked save-all outcomes.
- Workout history detail and safe edit of performance values.
- Backup export, clear data, restore, and verify records.
- Offline launch after service worker installation.

## Offline and PWA Tests

- Installable manifest exists with home-screen icon and Apple touch icon.
- Standalone display mode is configured.
- Service worker caches application shell.
- User data is not stored in service-worker cache.
- App opens offline after installation.
- Food, bodyweight, and workout edits persist offline.
- A waiting service-worker update activates automatically without a manual
  update button.
- App avoids infinite stale-cache behavior by reloading under the updated
  worker, after which the versioned What’s New banner is available.

## Persistence Tests

- IndexedDB initializes from empty state.
- Active workout persists after navigation.
- Active workout persists after browser refresh.
- Active workout persists after closing and reopening installed PWA.
- Rest timer recalculates after backgrounding.
- Transactions do not leave partial data after simulated failure.
- Historical workouts remain readable after exercise/template edits.

## Migration Tests

- Fresh install creates latest schema.
- Each supported prior schema migrates to latest.
- Migration preserves IDs and timestamps.
- Migration preserves food snapshots and workout history snapshots.
- Failed migration shows a clear error and does not silently discard data.
- Unsupported future backup version is rejected.

## Import/Export Tests

- JSON backup includes schema versions and all required stores.
- JSON restore validates shape, required fields, references, and version.
- Import preview shows counts and replace/merge behavior before mutation.
- Replace restore requires destructive confirmation.
- Clear all data requires destructive confirmation.
- CSV export includes readable nutrition, bodyweight, exercise, program, and workout history records.
- CSV is not accepted as a full-fidelity restore source.

## Physical iPhone Testing

- Install through Safari Add to Home Screen.
- Launch in standalone mode.
- Verify safe areas around Dynamic Island, status bar, keyboard, and home indicator.
- Verify bottom navigation and sticky CTAs are not occluded.
- Verify no primary screen requires horizontal scrolling.
- Verify touch targets are comfortable.
- Verify keyboard-aware food search and forms.
- Start a workout, background the app, reopen, and confirm elapsed time and rest timer correctness.
- Turn on airplane mode after installation and complete food, bodyweight, and workout flows.
- Export and restore a JSON backup using iOS file/share flows.
- Validate native release builds on supported iOS and Android devices before
  public store submission, including upgrade preservation and offline launch.

## Regression Scope Checks

- No account or backend requirement for core offline use.
- Optional Google and Apple authentication never blocks signed-out local use.
- Optional cloud backup remains replaceable snapshot backup, with no realtime
  multi-device sync or automatic cloud restore.
- In-app app-account and cloud-data deletion is distinct from local Clear all
  data and requires destructive confirmation.
- No subscriptions or ads.
- Barcode and AI camera actions remain separate. AI photo analysis requires a
  user-supplied key and never saves or logs without explicit confirmation.
- No AI coaching, meal recommendations, bundled external food database, or
  micronutrients.
- No automatic calorie adjustment, automatic training/program advancement,
  calorie-target adherence score, or automatic coaching. Approved deterministic
  local estimates remain user-invoked or opt-in, explainable, editable, and
  unapplied until explicit review.
- Public App Store and Google Play builds preserve IndexedDB authority and
  existing compatibility identifiers.
