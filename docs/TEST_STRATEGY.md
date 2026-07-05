# Test Strategy

## Goals

- Verify the app works as a local-first, offline-capable iPhone PWA.
- Protect IndexedDB persistence, snapshot behavior, workout completion, detected-change review, and backup/restore integrity.
- Keep first-release scope clear by testing that excluded features are absent.

## Unit Tests

- Date utilities for local `YYYY-MM-DD` behavior.
- Nutrition total calculations from snapshotted food log entries.
- Decimal serving multiplier calculations.
- Bodyweight upsert behavior by local date.
- Tracking preset field definitions.
- Rest timer remaining-time calculation from timestamps.
- Structural change detection.
- Destination selection mapping for detected changes.
- Archive versus hard-delete eligibility.
- Backup schema validation.

## Component Tests

- Home dashboard cards with populated and empty data.
- Date selector controls.
- Bottom navigation and center Add sheet.
- Nutrition search, recent foods, log food sheet, and create/edit food form.
- Bodyweight entry sheet.
- Exercise create/edit form and tracking preset selector.
- Program builder cards and prescribed exercise editor.
- Live workout exercise card and set rows for every tracking preset.
- Rest timer controls.
- Detected-change checklist.
- History detail view.
- Settings backup/restore forms.
- Validation and error states.

## Integration Tests

- Create food, log food, edit reusable food, verify historical log totals remain unchanged.
- Add and edit bodyweight for a date.
- Create exercise, add to program, activate program, and verify active cycle is independent.
- Start workout from manually selected workout day.
- Edit active workout, refresh app, verify session resumes.
- Complete workout, save history, review detected changes, apply selected destinations transactionally.
- Archive referenced exercise and verify history/program display remains intact.
- Export JSON backup and restore into a clean database.
- Restore failure leaves existing data unchanged.

## End-to-End Tests

- First launch with empty IndexedDB.
- Full nutrition flow from food creation through date-based logging.
- Full bodyweight flow.
- Full training flow from exercise creation to program activation.
- Live workout flow with set completion, rest timer, replacement, and finish.
- Detected-change review with cycle-only, template-only, both, and neither choices.
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
- Service-worker update notification appears when a new version is available.
- App avoids infinite stale-cache behavior by allowing update activation.

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

## Regression Scope Checks

- No account creation or login UI.
- No backend requirement.
- No cloud sync.
- No subscriptions or ads.
- Barcode and AI camera actions remain separate. AI photo analysis requires a
  user-supplied key and never saves or logs without explicit confirmation.
- No AI coaching, meal recommendations, bundled external food database, or
  micronutrients.
- No automatic calorie adjustment, training progression, program advancement, estimated 1RM, trend weight, adherence percentage, or graphs.
