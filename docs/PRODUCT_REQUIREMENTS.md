# Product Requirements

## Product Goals

- Build a single-user, local-first, mobile-first fitness tracking Progressive Web App.
- Support manual nutrition logging, bodyweight logging, custom exercise management, program creation, active workout logging, GPS run tracking, and workout history.
- Target iPhone users who install the app through Safari using Add to Home Screen.
- Provide an optional native iOS wrapper for device-scheduled rest-timer
  notifications when the app is backgrounded, closed, or the phone is locked.
- Provide optional Web Push rest-timer completion alerts for an installed
  iPhone Home Screen PWA when the native wrapper is unavailable. This alert path
  may require internet access and separately configured free-tier services.
- Work after installation without a user account, cloud sync, subscription, internet connection, bundled external food database, or push-notification dependency.
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
- Wants manual food entry first, with optional USDA FoodData Central lookup
  through the configured provider route.

### Privacy-First User

- Wants all records on the device by default.
- Needs backup and restore without creating an account or sending data to a cloud service.
- Accepts manual data management in exchange for local control.

## Functional Requirements

### Core Platform

- The app must be installable as a PWA from Safari on iPhone.
- The native iOS wrapper must reuse the same React application and local-first
  data model without introducing a required backend or account.
- The app must use standalone display mode when installed.
- The app must cache the application shell for offline use.
- User records must be stored in IndexedDB, not in the service-worker cache.
- The app must provide deliberate service-worker update handling and notify the user when a new app version is ready.
- Settings must allow the interface language to switch between English and
  Spanish. The preference must persist locally across reloads and installed-PWA
  restarts; user-entered names and notes must not be modified. Spanish-language
  Nutrition searches must use Open Food Facts multilingual data and prefer
  Spanish product names and categories when supplied by the provider.

### Navigation

- Fixed bottom navigation must include Home, Nutrition, center Add, Training,
  and Run. History must not appear as a bottom navigation tab.
- History, Graphs, Bodyweight, and Settings must be reachable from Home.
- The center Add button must open a bottom sheet with context-appropriate quick actions:
  - start or resume workout
  - start or resume run
  - log food
  - log bodyweight
  - create exercise
  - create program

### Home Dashboard

- Home must include selected-date control, previous-day button, next-day button, and return-to-today action.
- Home must show calories consumed, calorie target, and calories remaining.
- Home must replace the prior Nutrition card with a similarly sized seven-day
  calorie graph: separated bars show calories logged per day and a contrasting
  line shows the target applicable to each day.
- Home must include quick bodyweight entry, the latest current bodyweight,
  selected-date bodyweight status, and a compact bodyweight trend summary when
  enough data exists.
- Home must show current active program, start workout action, and resume workout action when applicable.
- Home must provide compact access to full history, graphs, and bodyweight progress without showing workout history or recent activity as dashboard cards.
- Home must not show weekly adherence percentages, adherence graphs, estimated one-repetition maximum graphs, or a large bodyweight graph.

### Nutrition

- Users must be able to set calorie and macro targets manually.
- Set Goal must collect current bodyweight, desired weight, height, age, sex,
  and activity level (including a heavily active option) before showing a
  second step. The desired weight determines Maintenance, Bulking, or Cutting.
  Bulking and Cutting show an adjustable weekly-rate slider, initialized at a
  visibly marked recommended rate, with live rate and estimated end-date
  feedback. Done saves the calculated targets and returns to Targets.
- Users must be able to create, search, edit, and archive or delete custom foods.
- A custom food must include name, serving quantity, serving unit, calories per
  serving, and optional protein, carbohydrate, and fat. Blank optional macros
  are stored as zero; invalid or negative nutrition values are rejected. The
  current custom-food form does not collect brand or notes.
- Users must be able to log foods by local calendar date with decimal serving multipliers.
- A food log entry must snapshot food nutrition values at the time of logging.
- Users must be able to edit and delete logged foods.
- The app must show daily nutrition totals and recent foods.
- History Graphs must include calorie views for one week, one month, and three
  months. Each calendar day retains its logged calorie total and the target
  applicable on that day.
- English external-food search must use USDA FoodData Central as the primary
  provider. Spanish external-food search must use Open Food Facts multilingual
  data and prefer its Spanish product names and categories.
- Users must be able to search recent, custom, previously used, and eligible
  provider foods from the Nutrition screen.
- A strong saved-recipe match must appear in its own Recipes section before
  food results. Typo-only recipe matches must not create a separate recipe
  section.
- External provider foods are eligible only when calories, protein, total
  carbohydrates, and fat are all present and usable. Numeric zero is valid.
- Logging an external provider food must store an immutable nutrition snapshot
  so historical logs work offline and do not change when provider data changes.
- The app must display calories, protein, total carbohydrates, and fat only.
- The first release includes local barcode scanning for UPC/EAN lookup through
  USDA branded foods and Open Food Facts fallback. It must exclude barcode
  submission, AI food-photo analysis, automatic calorie adjustments, bundled bulk food
  databases, micronutrients, search-as-you-type Open Food Facts calls, and meal
  recommendations. Spanish Open Food Facts search must require an explicit
  keyboard or on-screen Search action and remain server-cached.

### Bodyweight

- Users must be able to add multiple bodyweight entries per local calendar date.
- Users must be able to edit or delete a selected bodyweight entry for
  correction.
- Pounds must be the default unit.
- Historical values must remain available in a graph-ready record format.
- The latest timestamped bodyweight entry is the current bodyweight.
- Home must show the latest entry for the selected date when one exists.
- History must include a bodyweight graph with one-month, three-month,
  six-month, and all-time ranges.
- Same-day records must be retained. The graph plots each stored entry by its
  timestamp; it does not average, delete, or rewrite source records for display.
- The first release must exclude trend-weight calculation and weight-change recommendations.

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
- The live workout must display workout name, elapsed duration, exercise
  workspace, previous performance, set rows, and rest timer.
- Set rows must display fields appropriate to the exercise tracking method.
- Typical weighted set rows must show set number, previous performance, weight, reps, RIR, and completed control.
- Repeating a weighted-repetition exercise must prefill every programmed set
  from its most recent completed session for the same stable exercise,
  regardless of program or prescribed rep range. Suggested loads are derived
  from the prior set's estimated one-repetition maximum and the new target
  reps, and remain editable.
- Users must be able to add sets, delete sets, edit completed sets, complete
  sets, skip exercises, replace exercises, add exercises, reorder exercises
  where practical, change session rest time, and discard the active workout
  with confirmation.
- The rest timer must be timestamp-based so remaining time is correct after backgrounding or resuming.
- In the installed Home Screen PWA, every rest-timer mutation must cancel or
  reschedule the optional server-delayed Web Push completion alert from the
  persisted timer timestamp.
- In the native iOS wrapper, every rest-timer mutation must cancel or reschedule
  the device-local completion notification from the persisted timer timestamp.
- The first release excludes coaching, automatic program advancement, and opaque
  recommendation services. Deterministic local progression recommendations may
  suggest future targets, but they must remain explainable, editable, and
  unapplied to permanent prescriptions until explicit post-workout review.

### Completion and Detected Changes

- Completing a workout must save the performed workout even if no structural changes are applied to a program.
- After completion, the app must compare the performed workout to its source active-cycle day.
- The app must detect set added, set removed, exercise added, exercise skipped or removed, exercise replaced, and exercise order changed.
- The app must not treat performed weight, reps, RIR, set completion status, or duration as template changes.
- Detected changes must be displayed as an individual review checklist.
- Every change must be reviewed individually.
- Each selected structural or progression recommendation change must support
  destination choices: active cycle only, reusable template only, or both.
  Unchecked items are not applied.
- Applying changes must be transactional.
- The user must be able to finish and save the workout without applying changes.

### Runs

- Running must be a separate section and must not force run data into lifting set rows.
- Users must be able to start an outdoor GPS run, start a motion-sensed
  treadmill run with an editable stride length, or manually save a completed
  outdoor/treadmill run with date, distance, duration, and notes.
- GPS collection must begin only after the user presses Start Outdoor Run.
- Active runs must support Start Run, Pause, Resume, Finish, elapsed time,
  moving time, distance, current pace, average moving pace, and per-mile splits.
- Active runs must persist start time, pause periods, samples, accepted
  distance, splits, moving time, walking/rest classifications, GPS gaps, and
  status across reloads without inventing missing GPS points.
- The app must prevent two simultaneous active runs.
- The app must not start a run while a lifting workout is active. The user must
  resume, finish, or explicitly discard the lifting workout first.
- GPS samples must store latitude, longitude, timestamp, accuracy, optional
  altitude, decision, rejection reason, and accepted segment distance.
- Distance processing must reject poor accuracy, duplicate or stale samples,
  jitter, unrealistic speed, and long gaps. Long gaps must be marked and must
  not create fabricated straight-line distance.
- Moving time is the sum of accepted sample intervals whose implied speed meets
  the configured moving threshold. Paused time and rejected/gap intervals do
  not add moving time.
- Splits must be created at every completed mile from accepted distance only.
- Current pace must use a stable recent accepted-sample window rather than a
  single point. Average pace uses accepted distance and moving time.
- While an outdoor run is active, elapsed time must refresh from timestamps
  every second and high-accuracy GPS must be refreshed throughout the run
  without fabricating distance between missing samples.
- Treadmill sensing must use foreground device-motion step detection and a
  user-visible stride estimate. Sensed step count, estimated distance, elapsed
  time, and pause-adjusted moving time must persist.
- A conservative low-pace detector may ask whether the user is walking,
  resting, or continuing, with hysteresis/cooldown. It must not automatically
  discard time or distance.
- Completed runs must appear as individual History cards with date, tracking
  type, total distance, elapsed
  time, moving time, average moving pace, mile splits, classifications, and
  GPS-gap indication.
- Foreground browser tracking is supported when permission exists. iOS and
  other browsers may suspend geolocation after the browser or installed PWA is
  backgrounded. Service workers cannot guarantee continuous GPS sampling.
- Location history remains local. Route samples must not be logged to analytics
  or sent to third parties.

### History

- Workout history must open first as a date-sorted list of completed workouts
  and runs, with one distinct card per history item.
- Selecting a workout history row must open a detail view that includes local workout date, workout name, program and day source when applicable, start time, completion time, duration, exercises, performed sets, weight, reps, RIR, completion status, notes, skipped exercises, and applied or rejected structural changes.
- Completed run history must include a dedicated run detail view with distance,
  elapsed time, moving time, average moving pace, mile splits, walking/rest
  classifications, and GPS-gap indication.
- Users must be able to view full workout details.
- Users must be able to safely edit recorded performance values without
  changing original program templates.
- Deleting a historical workout must require confirmation.
- History must include estimated one-repetition-maximum graphs for eligible
  weighted-repetition exercises. The graph uses completed historical sets only,
  applies the Epley formula, plots the highest eligible estimate per workout,
  and does not rewrite workout records.
- History must not show weekly adherence score, strength score, automated
  trend, opaque coaching recommendation, or non-history graphs in the first
  release. Completed workouts may show deterministic progression review reasons
  and recommendation audit metadata.

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

- Account creation, login, persistent database server, required cloud sync, social features, friends, followers, public profiles, subscriptions, advertisements, wearable integrations, Apple Health integration, AI coaching, AI food-photo analysis, bundled external food database, barcode submission, micronutrients, automatic calorie adjustment, automated training progression, automatic program advancement, trend-weight calculations, weekly adherence percentage, non-history graphs, route maps or external map tiles, reliable fully backgrounded GPS tracking, public App Store distribution, and required push notifications for core app use. Optional outside-app rest-timer Web Push alerts and development-signed personal-device installation of the native iOS wrapper are supported.

## Acceptance Criteria

- A user can install the app to an iPhone home screen and open it in standalone mode.
- A user can use Home, Nutrition, Add, Training, History, and Settings while offline after installation.
- A user can set nutrition targets, create foods, log foods with decimal serving multipliers, and see correct daily totals from snapshotted values.
- A user can add bodyweight for a selected date, preserve multiple same-day
  records, edit the latest selected-date entry, and view bodyweight progress.
- A user can create exercises using all required tracking presets.
- A user can create a program template, activate it into an independent active cycle, manually select a workout day, and start a workout.
- A user can close and reopen the installed PWA and resume the active workout with preserved set entries and timer state.
- A user can finish a workout, save history, review detected structural changes, and choose a destination per change.
- A user can start a run explicitly, pause, resume, finish, recover it after
  reload, and review the completed run in History.
- A user can export full JSON, restore from validated JSON with preview and confirmation, export CSV, and clear data only after confirmation.
- No first-release out-of-scope feature appears in the UI as an active product feature.

## MVP Completion Criteria

- All acceptance criteria pass on a physical iPhone installed through Safari.
- IndexedDB schema and backup schema are versioned and documented.
- The service worker caches the app shell and does not cache user records.
- Core flows have automated unit, integration, and end-to-end test coverage.
- Manual physical-iPhone test checklist passes for offline launch, keyboard behavior, safe areas, live workout resume, and backup export/import.
- Product documentation and implementation behavior do not contradict the first-release scope.
