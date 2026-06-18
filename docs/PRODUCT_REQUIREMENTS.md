# Product Requirements

## Product Goals

- Build a single-user, local-first, mobile-first fitness tracking Progressive Web App.
- Support manual nutrition logging, bodyweight logging, custom exercise management, program creation, active workout logging, and workout history.
- Target iPhone users who install the app through Safari using Add to Home Screen.
- Work after installation without a user account, backend, cloud sync, subscription, internet connection, external food database, or push-notification dependency.
- Store all primary user data locally in IndexedDB with exportable, restorable records.
- Use a dark, dense, card-based interface inspired by the reference recording without copying branding, names, proprietary assets, or exact iconography.

## Personas

### Consistent Solo Lifter

- Trains several days per week and wants fast set logging during workouts.
- Needs resumable workouts, previous performance context, flexible program days, and clear history.
- Does not want automatic progression or coaching decisions.

### Manual Nutrition Tracker

- Tracks calories and macros using personally entered foods.
- Needs recent foods, decimal serving multipliers, editable logs, and daily totals.
- Does not want external food APIs, barcode scanning, AI food recognition, or micronutrient tracking.

### Privacy-First User

- Wants all records on the device by default.
- Needs backup and restore without creating an account or sending data to a cloud service.
- Accepts manual data management in exchange for local control.

## Functional Requirements

### Core Platform

- The app must be installable as a PWA from Safari on iPhone.
- The app must use standalone display mode when installed.
- The app must cache the application shell for offline use.
- User records must be stored in IndexedDB, not in the service-worker cache.
- The app must provide deliberate service-worker update handling and notify the user when a new app version is ready.

### Navigation

- Fixed bottom navigation must include Home, Nutrition, center Add, Training, and History.
- Settings must be reachable from the app header or another clearly visible secondary action.
- The center Add button must open a bottom sheet with context-appropriate quick actions:
  - start or resume workout
  - log food
  - log bodyweight
  - create exercise
  - create program

### Home Dashboard

- Home must include selected-date control, previous-day button, next-day button, and return-to-today action.
- Home must show calories consumed, calorie target, and calories remaining.
- Home must show protein, carbohydrate, and fat consumed and target values.
- Home must include quick bodyweight entry and the selected date's bodyweight value.
- Home must show current active program, start workout action, resume workout action when applicable, most recent completed workout, and compact recent activity.
- Home must not show weekly adherence percentages, adherence graphs, estimated one-repetition maximum graphs, or bodyweight trend graphs.

### Nutrition

- Users must be able to set calorie and macro targets manually.
- Users must be able to create, search, edit, and archive or delete custom foods.
- A custom food must include name, serving quantity, serving unit or description, calories per serving, protein per serving, carbohydrates per serving, fat per serving, and optional notes.
- Users must be able to log foods by local calendar date with decimal serving multipliers.
- A food log entry must snapshot food nutrition values at the time of logging.
- Users must be able to edit and delete logged foods.
- The app must show daily nutrition totals and recent foods.
- The first release must exclude barcode scanning, AI food-photo analysis, automatic calorie adjustments, external food APIs, bundled food databases, micronutrients, and meal recommendations.

### Bodyweight

- Users must be able to add or edit one bodyweight entry per local calendar date.
- Pounds must be the default unit.
- Historical values must remain available in a graph-ready record format.
- The selected date's value must appear on Home.
- The first release must exclude trend-weight calculation, weight-change recommendations, and bodyweight graphs.

### Exercise Library

- Users must be able to create custom exercises with required name, optional notes, default rest time in seconds, selected tracking method, created timestamp, updated timestamp, and active or archived status.
- Tracking methods must use an extensible metric-driven model.
- Initial presets must be Weight + reps, Bodyweight + reps, Assisted weight + reps, Reps only, Duration, and Distance + duration.
- RIR and completion status must be workout-set fields and may be used with applicable tracking presets.
- Deleting an exercise must not corrupt historical workouts. Exercises referenced by history or programs should be archived instead of hard deleted.

### Programs

- The app must separate reusable Program Templates from Active Program Cycles.
- Program templates must contain name, optional notes, ordered workout days, and no required weekday assignment.
- Workout days must contain name, optional notes, and ordered exercises.
- Prescribed exercises may contain exercise reference, target set count, optional target reps or range, optional target RIR, optional rest-time override, and optional notes.
- Activating a template must create an independent active-cycle copy.
- Users must manually choose which workout day to perform.
- Programs must not advance automatically, force calendar schedules, assume completion, or choose the next day automatically.
- Editing a template later must not rewrite completed workouts, existing historical sets, or an active workout already in progress.

### Live Workout

- Only one active workout is required at a time.
- A workout must start from a manually selected workout day.
- An active workout must be resumable after navigation, refresh, closing, and reopening the installed PWA.
- Active workout edits must persist immediately or near-immediately.
- The live workout must display workout name, elapsed duration, exercise cards, previous performance, exercise-level notes, workout-level notes, and rest timer.
- Set rows must display fields appropriate to the exercise tracking method.
- Typical weighted set rows must show set number, previous performance, weight, reps, RIR, and completed control.
- Users must be able to add sets, delete sets, edit completed sets, complete sets, skip exercises, replace exercises, add exercises, reorder exercises where practical, change session rest time, and cancel with confirmation.
- The rest timer must be timestamp-based so remaining time is correct after backgrounding or resuming.
- The first release must exclude automatic weight, repetition, RIR, coaching, progression, or training recommendation decisions.

### Completion and Detected Changes

- Completing a workout must save the performed workout even if no structural changes are applied to a program.
- After completion, the app must compare the performed workout to its source active-cycle day.
- The app must detect set added, set removed, exercise added, exercise skipped or removed, exercise replaced, and exercise order changed.
- The app must not treat performed weight, reps, RIR, set completion status, or duration as template changes.
- Detected changes must be displayed as an individual review checklist.
- Every change must be reviewed individually.
- Each selected change must support destination choices: active cycle only, reusable template only, both, or neither.
- Applying changes must be transactional.
- The user must be able to finish and save the workout without applying changes.

### History

- Workout history must include local workout date, workout name, program and day source when applicable, start time, completion time, duration, exercises, performed sets, weight, reps, RIR, completion status, notes, skipped exercises, and applied or rejected structural changes.
- Users must be able to view full workout details.
- Users must be able to safely edit notes and recorded performance values without changing original program templates.
- Deleting a historical workout must require confirmation.
- History must not show weekly adherence score, strength score, estimated 1RM, automated trend, training recommendation, or graphs in the first release.

### Backup and Portability

- The app must provide full JSON backup, validated JSON restore, CSV export, backup schema version, database schema version, import preview, replace versus merge explanation, destructive confirmation before replacing data, and destructive confirmation before clearing all data.
- JSON must be the authoritative full-fidelity backup format.
- CSV must be readable export format for spreadsheets.
- Backups must not upload to a cloud service.

## Nonfunctional Requirements

- Mobile-first, portrait-first layout.
- No horizontal scrolling in primary screens.
- Large touch targets suitable for iPhone use.
- Safe-area support for Dynamic Island, status bar, browser chrome, keyboard, and home indicator.
- Responsive enough for desktop browser development, but optimized for installed iPhone use.
- Offline-first behavior after installation.
- IndexedDB persistence must be reliable across app restarts.
- Data operations that affect multiple related stores must be transactional.
- Backup restore must validate schema before mutating existing data.
- UI animation must be restrained and must not block data entry.
- Accessibility must include semantic controls, visible focus states, sufficient contrast, and form validation messaging.
- Application code must not require global npm packages.

## Out of Scope

- Account creation, login, backend server, cloud sync, social features, friends, followers, public profiles, subscriptions, advertisements, wearable integrations, Apple Health integration, AI coaching, AI food-photo analysis, external food database, barcode scanner, micronutrients, automatic calorie adjustment, automated training progression, automatic program advancement, estimated one-repetition maximum, trend-weight calculations, weekly adherence percentage, graphs, public App Store distribution, and push-notification dependency.

## Acceptance Criteria

- A user can install the app to an iPhone home screen and open it in standalone mode.
- A user can use Home, Nutrition, Add, Training, History, and Settings while offline after installation.
- A user can set nutrition targets, create foods, log foods with decimal serving multipliers, and see correct daily totals from snapshotted values.
- A user can add and edit bodyweight for a selected date.
- A user can create exercises using all required tracking presets.
- A user can create a program template, activate it into an independent active cycle, manually select a workout day, and start a workout.
- A user can close and reopen the installed PWA and resume the active workout with preserved set entries and timer state.
- A user can finish a workout, save history, review detected structural changes, and choose a destination per change.
- A user can export full JSON, restore from validated JSON with preview and confirmation, export CSV, and clear data only after confirmation.
- No first-release out-of-scope feature appears in the UI as an active product feature.

## MVP Completion Criteria

- All acceptance criteria pass on a physical iPhone installed through Safari.
- IndexedDB schema and backup schema are versioned and documented.
- The service worker caches the app shell and does not cache user records.
- Core flows have automated unit, integration, and end-to-end test coverage.
- Manual physical-iPhone test checklist passes for offline launch, keyboard behavior, safe areas, live workout resume, and backup export/import.
- Product documentation and implementation behavior do not contradict the first-release scope.
