# Product Requirements

## Version 1 Scope Freeze

- Version 1 scope is frozen as of 2026-08-18. `docs/V1_SCOPE_FREEZE.md` records
  the approved boundary and the repository inventory captured at the freeze.
- **Vigorune** is the temporary public-facing working name. It may change after
  naming and trademark review.
- A public-name change must not rename the current bundle/application
  identifiers, IndexedDB database, local-storage keys, persisted record IDs, or
  backup-format identifiers. Existing installations must keep access to their
  local data.
- Version 1 includes local-first offline use without an account; optional Google
  and Apple authentication; optional cloud snapshot backup; in-app account and
  cloud-data deletion; nutrition and bodyweight tracking; programs and live
  workouts; run tracking; provider-backed barcode scanning; user-initiated
  AI meal-photo analysis; and public Apple App Store and Google Play
  distribution.
- Scope inclusion is not proof that every release path is implemented or
  validated. Remaining gaps are release work and must not be filled by unrelated
  feature expansion.

## Product Goals

- Build a single-user, local-first, mobile-first fitness tracking Progressive Web App.
- Support manual nutrition logging, bodyweight logging, custom exercise management, program creation, active workout logging, GPS run tracking, and workout history.
- Support installed PWA use and public native distribution through the Apple App
  Store and Google Play without weakening the local-first data model.
- Provide an optional native iOS wrapper for device-scheduled rest-timer
  notifications when the app is backgrounded, closed, or the phone is locked.
- Provide optional Web Push rest-timer completion alerts for an installed
  iPhone Home Screen PWA when the native wrapper is unavailable. This alert path
  may require internet access and separately configured free-tier services.
- Work after installation without a user account, cloud backup, subscription,
  internet connection, bundled external food database, or push-notification
  dependency. Explicitly network-dependent optional workflows may report that
  connectivity is required without blocking local features.
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
- Native store builds may distribute publicly through Apple App Store and Google
  Play. They must preserve local records and the compatibility identifiers
  documented by the Version 1 freeze.
- The native iOS wrapper must reuse the same React application and local-first
  data model without introducing a required backend or account.
- The app must use standalone display mode when installed.
- The app must cache the application shell for offline use.
- User records must be stored in IndexedDB, not in the service-worker cache.
- The app must activate a ready service-worker update automatically and reload
  the app shell under the new worker. The reopened version surfaces its
  versioned What’s New banner instead of presenting a manual update button.
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
  - log food
  - log bodyweight
  - create exercise
  - create program

### Home Dashboard

- Home must include selected-date control, previous-day button, next-day button, and return-to-today action.
- Home must show calories consumed, calorie target, and calories remaining.
- Home must replace the prior Nutrition card with a similarly sized calorie
  graph. The user can switch between one-week and one-month views; separated
  bars show calories logged per day and a contrasting line shows the target
  applicable to each day.
- The Home calorie graph must provide a View more action to a dedicated calorie
  details subpage. The subpage offers one-week, one-month, and three-month
  ranges, food-logging consistency, and average logged calories above or below
  the saved daily target for eligible logged days.
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
- Calorie consistency means the share of calendar days in the chosen range with
  at least one positive-calorie food log. It is a logging-completeness measure,
  not an adherence or coaching score. Average surplus or deficit is the mean
  logged-calorie difference from the applicable positive target across logged
  days that have a target. An exact zero difference is shown as on target; when
  no logged day has a positive target, the comparison averages are unavailable.
- English external-food search must use USDA FoodData Central as the primary
  provider. Spanish external-food search must use Open Food Facts multilingual
  data and prefer its Spanish product names and categories.
- Users must be able to search recent, custom, previously used, and eligible
  provider foods from the Nutrition screen.
- With an empty Log Food search, the app must show up to four distinct reusable
  foods most recently logged near the current time of day during the previous
  two local calendar dates, excluding today. This recommendation section must disappear as
  soon as the user enters a search query.
- A strong saved-recipe match must appear in its own Recipes section before
  food results. Typo-only recipe matches must not create a separate recipe
  section.
- External provider foods are eligible only when calories, protein, total
  carbohydrates, and fat are all present and usable. Numeric zero is valid.
- Logging an external provider food must store an immutable nutrition snapshot
  so historical logs work offline and do not change when provider data changes.
- The app must display calories, protein, total carbohydrates, and fat only.
- The first release includes local barcode scanning for UPC/EAN lookup through
  USDA branded foods and Open Food Facts fallback.
- The camera action must expose separate barcode and AI-photo options. AI-photo
  analysis is optional and uses the server-only OpenAI credential through the
  same-origin `/api/meal-analysis` route. No provider secret is accepted or
  stored on the device. Structured output creates an unsaved recipe draft from
  one to three bounded meal photos captured in the app or selected from the
  device photo library. The user must review the estimate and explicitly press
  Log food before estimated ingredient snapshots are added to the selected
  date.
- Each estimated ingredient must be an editable food-style row. Opening it shows
  the detected serving amount, detailed calories and macros, and controls for
  changing that amount before logging. The draft must show its recalculated
  total calories prominently.
- AI-photo analysis must not create reusable foods, adjust nutrition targets, or
  save a recipe automatically. Save as recipe is an off-by-default checkmark
  option beside the primary Log food action. It must clearly identify generated
  nutrition as an estimate.
- The first release must continue to exclude barcode submission, automatic
  calorie adjustments, bundled bulk food databases, micronutrients,
  search-as-you-type Open Food Facts calls, and generated or coaching-based meal
  recommendations. Local meal-aware recent-food shortcuts are allowed. Spanish
  Open Food Facts search must require an explicit keyboard or on-screen Search
  action and remain server-cached.
- A user-created nutrition goal may expose a manual Update Calories action. With
  sufficient recent weigh-in and logged-calorie history, it must estimate
  maintenance by blending a responsive recency-weighted 28-day signal with a
  stabilizing recency-weighted signal of up to 90 days. Longer history must gain
  influence only as calorie-log coverage, calendar span, and weigh-in coverage
  accumulate, and must never fully override recent behavior. The action combines
  that estimate with the desired weight and selected weekly rate, sets the
  resulting target to the nearest whole calorie, and reports a qualitative
  history-confidence level. It must never run automatically.
- Nutrition Targets must show the saved estimated maintenance above the calorie
  target fields when a goal has produced a valid maintenance value. Manual
  targets without that data must not show an estimate.

### Bodyweight

- Users must be able to add at most one bodyweight entry per local calendar
  date and edit or delete that entry for correction.
- Pounds must be the default unit.
- Historical values must remain available in a graph-ready record format.
- The most recent dated bodyweight entry is the current bodyweight.
- Home must show the entry for the selected date when one exists.
- History must include a bodyweight graph with one-month, three-month,
  six-month, and all-time ranges.
- Legacy same-day records restored from an older backup must remain preserved,
  but only the latest record for that date contributes to trend weight.
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
- Program editing must add workout days from a compact plus control at the end
  of the horizontal day tabs. The day-name input is shown only while adding a
  day; the selected-day panel must not repeat a persistent day-name field.
- Workout days must contain name, optional notes, and ordered exercises.
- Prescribed exercises may contain exercise reference, target set count, optional target reps or range, optional target RIR, optional rest-time override, and optional notes.
- Activating a template must create an independent active-cycle copy.
- Users must manually choose which workout day to perform.
- The active program must expose a selectable 1-based week control. Switching
  weeks must preserve each week's independent day check-offs. Completing every
  day in the selected week advances the selection to the next incomplete higher
  week, bounded by the program length; it does not change prescriptions or
  choose a workout day.
- Program templates and active cycles may opt into scheduling deload weeks from
  Program settings. Scheduling is disabled by default; when first enabled, week
  1 is selected as an editable example. A deload week
  uses one fewer programmed set per exercise (minimum one) and adds 3 to each
  configured target RIR (maximum 10) without mutating the reusable base
  prescription.
- Programs must not force calendar schedules, assume completion, or choose the next day automatically.
- Editing a template later must not rewrite completed workouts, existing historical sets, or an active workout already in progress.

### Live Workout

- Only one active workout is required at a time.
- A workout must start from a manually selected workout day.
- An active workout must be resumable after navigation, refresh, closing, and reopening the installed PWA.
- Active workout edits must persist immediately or near-immediately.
- The live workout must display workout name, elapsed duration, exercise
  workspace, previous performance, set rows, and rest timer.
- Set rows must display fields appropriate to the exercise tracking method.
- Typical weighted set rows must show set number, previous performance, weight,
  reps, an RIR field when RIR tracking is enabled, and a completed control.
- RIR tracking must default off and remain enabled or disabled across refresh,
  browser close, and installed-PWA restart.
- Workout set autofill must default to Recorded history, which copies the
  corresponding usable completed set values from the latest comparable
  exercise session. Users may opt into Smart progression for editable local
  estimates that account for the prior set sequence and fatigue. Smart
  progression may use historical and target RIR only while RIR tracking is
  enabled.
- Exercises without usable completed history must start with blank performance
  fields. In Smart progression mode, when only cross-day history exists,
  rep-based exercises must receive
  one editable set-sequence estimate centered on the current rep range; weighted
  estimates must use historical RIR, round load to the nearest 5 lb, and retain
  the prior sequence's fatigue effect on later sets only when it materially
  improves the estimate. Smart progression must prefer a level rep scheme and
  cap the full suggested set-to-set rep spread at two. When same-day history
  exists, the estimate must advance the sequence by one total rep, or by 5 lb
  after every programmed set reached the range top and the RIR-adjusted estimate
  still supports the range. Startup estimates must not mutate history or a
  permanent program prescription.
- Scheduled deloads must not use Smart progression. They use the latest
  non-deload completion of the same program day, falling back to the latest
  comparable non-deload exercise history, to estimate reduced load or reps for
  the higher RIR target. Deloads must show and record RIR even when global RIR
  tracking is disabled. Deload history must not become the source for later
  workout autofill or next-workout progression recommendations.
- Users must be able to add sets, delete sets, edit completed sets, complete
  sets, skip exercises, replace exercises, add exercises, reorder exercises
  where practical, edit session exercise notes, change session rest time, and
  discard the active workout with confirmation.
- The live workout must lock the outer document and current-exercise card to
  the visual viewport. Only the set list may scroll when additional sets no
  longer fit; the exercise header and actions remain fixed. Exercise notes must
  open from a compact notepad control aligned with the exercise name.
- Exercise-to-exercise navigation must use horizontal swiping instead of
  Previous and Next buttons. Skipping an exercise or completing its final
  incomplete set advances to the adjacent next exercise when one exists.
  Manually returning to an already-completed exercise must not re-advance it.
- Scrollable rest-duration wheels must offer seconds in five-second increments.
- Finishing must wait for pending active-workout edits to persist before the
  completed history snapshot is created.
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
- The finish confirmation must offer one checkbox to save all detected live
  workout changes to the source program. The checkbox must be unchecked by
  default.
- When the checkbox is unchecked, the completed workout keeps its performed
  structure while the source active cycle and reusable template remain
  unchanged.
- When the checkbox is checked, all detected structural changes and progression
  recommendations must be applied to both the source active cycle and reusable
  template when both are available.
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
- When a lifting workout is already active, the idle Run screen must replace
  run-start actions with a Finish current workout action that returns to the
  live workout.
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
- History must offer Most recent and By program organization. By program opens
  a program drilldown that reuses the complete workout detail view. The chosen
  organization and selected program filter must persist across History visits.
- Selecting a workout history row must open a detail view that includes local workout date, workout name, program and day source when applicable, start time, completion time, duration, exercises, performed sets, weight, reps, RIR, completion status, notes, skipped exercises, and applied or rejected structural changes.
- Completed run history must include a dedicated run detail view with distance,
  elapsed time, moving time, average moving pace, mile splits, walking/rest
  classifications, and GPS-gap indication.
- Users must be able to view full workout details.
- Completed workout history must be read-only after saving.
- Deleting a historical workout day must require explicit list selection and
  confirmation.
- History must include estimated one-repetition-maximum graphs for eligible
  weighted-repetition exercises. The graph uses completed historical sets only,
  applies the Epley formula, plots the highest eligible estimate per workout,
  and does not rewrite workout records.
- Strength graphs must also offer total volume as a selectable metric. Total
  volume plots one point per exercise per completed workout by summing
  `weight × repetitions` across every completed weighted-repetition set in that
  workout.
- Scheduled deload workouts remain saved and readable in History, are labeled
  `Deload` followed by the day name, and are excluded from Estimated 1RM and
  Total volume graph points.
- History must not show weekly adherence score, strength score, automated
  trend, opaque coaching recommendation, or non-history graphs in the first
  release. Completed workouts may show deterministic progression review reasons
  and recommendation audit metadata.

### Backup and Portability

- The app must provide full JSON backup, validated JSON restore, CSV export, backup schema version, database schema version, import preview, replace versus merge explanation, destructive confirmation before replacing data, and destructive confirmation before clearing all data.
- JSON must be the authoritative full-fidelity backup format.
- CSV must be readable export format for spreadsheets.
- Local JSON export must remain available without an account. When the user
  explicitly signs in with Google or Apple, the app may automatically upload
  versioned, restorable cloud snapshots to that user's protected Supabase row.
  Cloud snapshots may omit exact deterministic built-in seed records when
  restore reconstructs them before validation; manual JSON remains the
  full-fidelity format, and offline and signed-out operation is preserved.
- Automatic cloud snapshots must be throttled to no more than once every 15
  minutes and must never block or discard local data when a request fails.
- Signed-in users must be able to delete their cloud snapshot data while
  retaining local data.
- Settings must provide in-app deletion of the app-managed account and all
  app-controlled cloud data. Account deletion and local Clear all data are
  separate destructive actions; deleting the account must not silently delete
  IndexedDB records.

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

- Required accounts or cloud connectivity for core app use.
- Realtime multi-device synchronization, automatic cloud restore, or cloud data
  replacing IndexedDB as the source of truth.
- Social features, friends, followers, public profiles, subscriptions, and
  advertisements.
- Wearable and Apple Health integration.
- AI coaching, automatic AI logging, generated meal recommendations, or
  automatic AI changes to calories, loads, repetitions, or programs.
- Bundled external food databases, barcode submission, micronutrients, meal
  plans, and automatic calorie adjustment.
- Automatic training progression or automatic program/day advancement.
- Trend-weight calculations, weekly adherence percentages, strength scores, and
  non-history graphs.
- Route maps, external map tiles, and guaranteed fully backgrounded GPS
  tracking.
- Required push notifications for core app use.

Optional Google or Apple sign-in with cloud snapshot backup, user-initiated
provider-backed barcode lookup, user-initiated AI meal-photo estimation,
outside-app rest-timer alerts, and public native-store distribution are within
Version 1 scope subject to the local-first constraints above.

## Acceptance Criteria

- A user can install the app to an iPhone home screen and open it in standalone mode.
- A user can complete every local core flow offline after installation without
  creating an account.
- A user can use Home, Nutrition, Add, Training, History, and Settings while offline after installation.
- A user can set nutrition targets, create foods, log foods with decimal serving multipliers, and see correct daily totals from snapshotted values.
- A user can add one bodyweight entry per selected date, edit that entry, and
  view bodyweight progress.
- A user can create exercises using all required tracking presets.
- A user can create a program template, activate it into an independent active cycle, manually select a workout day, and start a workout.
- A user can close and reopen the installed PWA with preserved set entries and
  an active workout paused at the time it left the foreground.
- A user can finish a workout, save history, and explicitly choose whether all
  detected structural/program changes are applied; the default leaves programs
  unchanged.
- A user can start a run explicitly, pause, resume, finish, recover it after
  reload, and review the completed run in History.
- A user can export full JSON, restore from validated JSON with preview and confirmation, export CSV, and clear data only after confirmation.
- If the user opts into an account, Google or Apple authentication and cloud
  snapshot backup do not block local use; the user can delete the app-managed
  account and cloud data in-app without silently deleting local data.
- Public iOS and Android store builds preserve existing local data across app
  updates and do not require authentication for core features.
- No first-release out-of-scope feature appears in the UI as an active product feature.

## MVP Completion Criteria

- All acceptance criteria pass on a physical iPhone installed through Safari.
- IndexedDB schema and backup schema are versioned and documented.
- The service worker caches the app shell and does not cache user records.
- Core flows have automated unit, integration, and end-to-end test coverage.
- Manual physical-iPhone test checklist passes for offline launch, keyboard behavior, safe areas, live workout resume, and backup export/import.
- Product documentation and implementation behavior do not contradict the first-release scope.
