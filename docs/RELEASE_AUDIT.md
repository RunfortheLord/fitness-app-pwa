# Release Audit

Audit date: 2026-06-19

## Scope

This audit reviewed the repository as a release candidate against
`AGENTS.md`, `docs/DEFINITION_OF_DONE.md`, `docs/CODE_REVIEW_CHECKLIST.md`,
and `docs/PRODUCT_REQUIREMENTS.md`.

## Checks Run

- `npm ci` initially failed with `EPERM` while unlinking
  `node_modules/@rolldown/binding-win32-x64-msvc/rolldown-binding.win32-x64-msvc.node`.
  Two stale Vite dev-server Node processes from this repository were holding the
  file. After stopping those processes, `npm ci` passed with 0 vulnerabilities.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run format:check` passed.
- `npm run test` passed: 18 test files, 100 tests.
- `npm run test:coverage` passed: 18 test files, 100 tests. Overall coverage was
  68.9% statements, 57.25% branches, 70.25% functions, and 68.82% lines.
- `npm run test:e2e` passed after audit repair: 101 passed, 4 skipped. The skips
  were WebKit service-worker/offline tests intentionally limited to Chromium.
- `npm run build` passed. Vite emitted the existing warning that the main
  JavaScript chunk is larger than 500 kB after minification.
- Targeted audit repair check before the final full e2e run:
  `npx playwright test e2e/app.spec.ts -g "completes the release workflow through backup restore" --project=desktop-chromium`
  passed.

## Inspection Results

- Git status was clean at the start of the audit on `main`.
- Source architecture follows the expected React/Vite/Dexie structure:
  presentation under `src/pages` and `src/components`, domain logic under
  `src/domain`, storage access behind `src/repositories` and `src/services`.
- Dependencies match the required technical direction: React, TypeScript, Vite,
  `vite-plugin-pwa`, Dexie, React Router, Vitest, React Testing Library,
  Playwright, npm, and mobile-first CSS. No backend or server dependency was
  found.
- Database schema is versioned at IndexedDB schema version 2 and backup format
  version 1. The version 1 to 2 migration initializes current metadata and user
  settings.
- Multi-record writes for workout start/completion, detected-change application,
  program editing, nutrition target updates, backup restore, and clear-all use
  Dexie transactions.
- Snapshot behavior is implemented for food logs, exercise snapshots, active
  cycles, active workouts, and completed workout history. Tests cover food-log
  nutrition snapshots and completed workout snapshots surviving later source
  edits.
- Local calendar dates are stored as `YYYY-MM-DD` strings through the date
  domain utilities. Timestamps are ISO strings.
- Active workouts are persisted in IndexedDB and are covered by repository,
  component, and e2e reload/offline recovery tests.
- Rest timers are timestamp-based and compute remaining time from `startedAt`,
  `pausedAt`, and accumulated paused seconds.
- Detected workout changes are pure-domain detected and stored for individual
  review. Application to active cycle, reusable template, both, or neither is
  transactional.
- Backup and restore validate the full JSON backup before mutation; replace
  restore and clear-all are transactional and require destructive confirmation.
- Service worker configuration uses `vite-plugin-pwa` generated precache for app
  shell assets. No runtime API or user-record cache route was found.
- Manifest includes standalone display, portrait orientation, app name, colors,
  start URL, scope, and 192/512/maskable icons.
- Static searches found no production `console.log`, `debugger`, `TODO`,
  `FIXME`, mocked production data, accidental network calls, or obvious
  uncommitted secrets. Type assertions found were narrow UI/event or parser
  assertions and not broad `any`-based escapes.

## Workflow Results

Automated coverage existed before this audit for creating food, decimal serving
logging, bodyweight entry, exercise creation, program creation and activation,
manual workout-day selection, active-workout reload recovery, rest-timer
display, offline shell use, offline IndexedDB persistence, malformed restore
validation, transactional restore, detected-change domain behavior, and history
viewing.

The audit added a browser regression for the full missing release path:

1. Create food and log a decimal serving: passed.
2. Enter bodyweight: passed.
3. Create exercises: passed.
4. Create a program: passed.
5. Activate the program: passed.
6. Manually select a workout day: passed.
7. Start a workout: passed.
8. Complete sets: passed.
9. Add a fourth set: passed.
10. Replace an exercise: passed.
11. Skip an exercise: passed.
12. Refresh during the workout: passed.
13. Resume successfully: passed.
14. Finish the workout: passed.
15. Review each detected change: passed.
16. Apply different changes to different destinations: passed.
17. View workout history: passed.
18. Export JSON: passed.
19. Clear test data: passed.
20. Restore JSON: passed.
21. Reload and confirm restored records: passed.
22. Use core features offline: passed in existing Chromium PWA tests; WebKit PWA
    service-worker inspection/offline tests are skipped by configuration.

## Defects Found

- Release workflow e2e coverage gap: no browser test previously drove workout
  finish, detected-change review with mixed destinations, JSON export, clear,
  restore, reload, and restored-record confirmation as one release workflow.

## Defects Fixed

- Added a Playwright regression covering the full release workflow through JSON
  backup restore in `e2e/app.spec.ts`.

## Unresolved Limitations

- WebKit service-worker/offline tests are skipped because the configured
  service-worker inspection coverage is Chromium-only.
- Production build emits a chunk-size warning for the main JavaScript asset.
  This is not a correctness failure, but it remains a performance follow-up.
- Coverage remains moderate overall, especially in PWA update handling and
  backup-service branches. The release-critical paths are covered, but no formal
  coverage threshold is configured.

## Physical iPhone Checks Still Required

- Install from Safari using Add to Home Screen and confirm standalone launch.
- Confirm offline launch after installation on the physical device.
- Confirm safe-area behavior around Dynamic Island, browser chrome, keyboard,
  and home indicator.
- Confirm input focus does not trigger unwanted iPhone zoom.
- Confirm live workout survives closing and reopening the installed PWA.
- Confirm backup export and restore through iOS Files/share flows.

## Release Recommendation

Release candidate is recommended for physical-device validation. Physical iPhone
installation and iOS file-flow checks remain required before declaring the MVP
fully complete.
