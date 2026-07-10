# Definition of Done

Use this checklist before reporting completion for implementation work.

## Product Correctness

- Relevant docs under `docs/` were read before implementation.
- The change satisfies the requested behavior and does not add unrequested product scope.
- The change does not introduce excluded first-release features such as
  required accounts, realtime multi-device cloud sync, AI recommendations,
  subscriptions, social features, wearable integrations, adherence scores,
  automatic calorie adjustment, or automatic progression.
- Any unavoidable product or technical assumption is recorded in `docs/DECISIONS.md`.

## Data Integrity

- IndexedDB access remains behind repository or service abstractions.
- Historical snapshots are preserved.
- Food log entries keep snapshotted nutrition values.
- Completed workout history is not mutated by later template edits.
- Multi-record writes use transactions.
- Schema changes include migrations and do not delete or rename persisted fields without a migration.
- Local dates are stored as `YYYY-MM-DD`; timestamps are ISO strings.
- Import, restore, and other external data paths are validated before mutation.

## UI and Accessibility

- Layout is iPhone portrait first.
- Safe-area insets are respected.
- Primary screens avoid horizontal scrolling.
- Touch targets are at least 44 by 44 CSS pixels.
- Inputs use text sizes that avoid unwanted iPhone zoom.
- Loading, empty, validation, offline, and failure states are present.
- Controls use semantic HTML and accessible labels.
- Dark card hierarchy, bottom navigation, bottom sheets, and visual density remain consistent with the UX specification.

## Workout Behavior

- Programs do not auto-advance or choose workout days.
- Active workouts persist across navigation, reload, browser close, and installed PWA restart.
- Rest timers derive remaining time from timestamps.
- Load, reps, calories, RIR, and progression are not recommended automatically.
- Workout completion saves history separately from program-change application.
- Detected structural changes are reviewed individually and are never auto-applied.

## Testing

- Unit tests cover pure calculations, domain decisions, validation, and migrations touched by the change.
- Component tests cover interactive UI states touched by the change.
- Integration tests cover persistence and IndexedDB behavior touched by the change.
- End-to-end tests cover major workflows touched by the change.
- Empty and populated database states are covered where applicable.
- Persistence after reload is covered where applicable.
- Error paths are covered.
- Chromium and WebKit are tested where practical.

## Required Checks

Once package scripts exist, run:

```powershell
npm run typecheck
npm run lint
npm run format:check
npm run test
npm run test:e2e
npm run build
```

If a check cannot run, report the exact reason. Do not describe skipped checks as passed.

## Final Review

- Final Git diff was reviewed.
- Temporary debug output was removed.
- No secrets were committed.
- Reference video and extracted frame/contact-sheet artifacts were not committed.
- Changed files and checks run are reported.
