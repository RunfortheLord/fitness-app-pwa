# Roadmap

## Version 1 Release Freeze — 2026-08-18

The approved Version 1 boundary is recorded in `docs/V1_SCOPE_FREEZE.md` and
`docs/PRODUCT_REQUIREMENTS.md`. Work through release gaps without adding
unrelated features.

### Release Work Remaining

- Reconcile implementation status against the frozen requirements, with focused
  attention to the untracked startup/preload chain, barcode subpage replacement,
  IndexedDB migrations, active-workout persistence, and cloud-data deletion.
- Complete and validate optional Google and Apple authentication without making
  either provider a prerequisite for local use.
- Validate in-app app-account deletion and app-controlled cloud-data deletion as
  operations separate from local Clear all data.
- Prepare and validate public Apple App Store and Google Play packaging while
  preserving all persisted and platform compatibility identifiers.
- Run the full release gate, physical-device offline/data-preservation checks,
  migration/backup checks, and store-specific QA before release.

### Explicitly Deferred Beyond Version 1

- Subscriptions, advertisements, social networking, and public profiles.
- Wearable and health-platform integrations.
- Realtime multi-device synchronization or cloud-first storage.
- AI coaching, automatic AI logging, and automatic target or program changes.
- Automatic program advancement and other unrequested expansion.

## Historical Delivery Sequence

The milestones below are the repository's original implementation sequence.
They are retained for context, not as a conflicting current scope definition.

## Milestone 1: Project Foundation

- Initialize app framework and tooling.
- Add PWA manifest, icons, service-worker strategy, and offline app shell.
- Add IndexedDB wrapper, schema versioning, and migration harness.
- Add global dark theme, safe-area layout, fixed bottom navigation, and center Add sheet.
- Add test harness for unit, component, and end-to-end tests.

## Milestone 2: Settings and Local Data Core

- Implement settings screen.
- Add nutrition target settings.
- Add database metadata and schema version display.
- Add common confirmation, bottom sheet, form, and validation components.
- Add local date utilities.

## Milestone 3: Nutrition MVP

- Implement custom food creation and editing.
- Implement food search and recent foods.
- Implement date-based food logging with decimal serving multipliers.
- Snapshot food values in log entries.
- Implement daily calorie and macro totals.
- Add edit/delete logged food.
- Cover nutrition calculations and snapshot behavior with tests.

## Milestone 4: Bodyweight MVP

- Implement bodyweight entry by local calendar date.
- Add dashboard display for selected date.
- Add edit behavior for existing date entry.
- Store graph-ready historical records without graph UI.
- Add tests for date upsert behavior.

## Milestone 5: Exercise Library

- Implement exercise creation and editing.
- Add tracking presets and metric-driven field definitions.
- Add archive behavior for referenced exercises.
- Add exercise search and picker components.
- Add tests for presets and archive eligibility.

## Milestone 6: Program Templates

- Implement program template library.
- Add program builder with ordered workout days.
- Add prescribed exercise editor.
- Add activate-program flow that creates an independent active cycle.
- Add tests proving template edits do not mutate active cycles or history.

## Milestone 7: Home Dashboard

- Implement selected-date controls.
- Add nutrition summary card.
- Add bodyweight card.
- Add active program and workout actions.
- Add most recent completed workout and recent activity.
- Exclude graph/adherence/estimated-1RM sections.

## Milestone 8: Live Workout MVP

- Start workout from manually selected active-cycle workout day.
- Implement one active workout at a time.
- Persist active workout edits immediately or near-immediately.
- Implement set rows for all initial tracking presets.
- Add previous performance display.
- Add workout and exercise notes.
- Add add/delete/edit/complete set behavior.
- Add skip, replace, add exercise, reorder where practical, and cancel with confirmation.
- Add timestamp-based rest timer with pause, skip, extend, and dismiss.
- Add resume tests across navigation, refresh, close, reopen, and offline use.

## Milestone 9: Workout Completion and Change Review

- Save completed workout history.
- Detect structural changes against source active-cycle day.
- Present an unchecked option to save all detected live changes.
- Leave both the active cycle and reusable template unchanged by default.
- Apply all reviewed changes to both available program sources transactionally
  only after explicit opt-in.
- Record applied and rejected changes in history.
- Add tests for each detected-change type and transaction failure.

## Milestone 10: History

- Implement completed workout list.
- Implement workout detail view.
- Support safe edit of notes and recorded performance values.
- Support delete with confirmation.
- Ensure edits do not mutate source program templates.
- Add history regression tests.

## Milestone 11: Backup, Restore, and CSV

- Implement full JSON backup.
- Implement validated JSON restore with preview.
- Add replace behavior with destructive confirmation.
- Add merge behavior only if resolved from open questions.
- Implement CSV export for readable records.
- Add import/export tests and physical iPhone file-flow testing.

## Milestone 12: Offline and Release Hardening

- Verify installed iPhone standalone behavior.
- Verify offline app launch and offline data mutation.
- Verify service-worker update notification.
- Audit accessibility, contrast, touch targets, and keyboard behavior.
- Run full automated and physical-device regression checklist.
- Confirm excluded first-release features are absent.
