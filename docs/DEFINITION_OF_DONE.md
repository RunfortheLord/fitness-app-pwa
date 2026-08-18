# Definition of Done

Use this checklist before reporting completion for implementation work.

## Product Correctness

- Relevant docs under `docs/` were read before implementation.
- The change satisfies the requested behavior and does not add unrequested product scope.
- The change does not introduce excluded first-release features such as
  required accounts, realtime multi-device cloud sync, AI coaching or automatic
  AI actions, subscriptions, advertisements, social features, wearable
  integrations, automatic calorie adjustment, or automatic program
  advancement. Optional Google/Apple authentication, snapshot backup,
  user-reviewed AI meal-photo estimates, and public store distribution are
  approved only within the frozen Version 1 constraints.
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

- Programs do not choose or start workout days automatically. Completion-based
  week selection does not change prescriptions or start a workout.
- Active workouts persist across navigation, reload, browser close, and installed PWA restart.
- Rest timers derive remaining time from timestamps.
- Workout-start load and rep estimates are deterministic, history-based,
  explainable, and editable. They never rewrite completed history or permanent
  program prescriptions automatically; opaque coaching remains excluded.
- Workout completion saves history separately from program-change application.
- Detected structural changes are never auto-applied. Version 1's unchecked
  save-all option must preserve the active cycle and reusable template unless
  the user explicitly opts in.

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
- Public-name changes did not rename platform or persisted compatibility
  identifiers or make existing local data inaccessible.
- Changed files and checks run are reported.
