# Decisions

## 2026-06-29: Optional Gemini Meal Photos And Isolated Developer Stable

- The direct request for AI meal-photo analysis supersedes the earlier
  first-release exclusion only for this user-initiated workflow. It does not
  enable AI coaching, recommendations, automatic targets, or automatic logging.
- Gemini 3.5 Flash receives one resized meal photo and returns validated,
  structured ingredient estimates. The result becomes a snapshot-only recipe
  draft; no foods, logs, or saved meals are written until Save recipe is
  pressed.
- The user supplies a Gemini key in Settings. It is stored in the existing
  device-local API-key store, sent only to Google, and excluded from backups,
  exports, and diagnostics.
- Phone/PWA updates deploy to the separate `fitness-app-pwa-dev-stable` Vercel
  production project by default. The existing `fitness-app-pwa` stable project
  is deployed only after an explicit promotion request.

## 2026-06-27: Optional Web Push Rest-Timer Alerts

- The product owner explicitly approved a free Web Push dependency for the
  installed iPhone Home Screen PWA so timer completion can alert while another
  app or the Home Screen is active.
- Timer jobs use the existing persisted completion timestamp. The client sends
  only the push subscription and timer identifier to a Vercel endpoint, which
  uses QStash to delay delivery and cancels or replaces the prior job after
  pause, resume, adjustment, dismissal, workout completion, or discard.
- The QStash callback verifies its signature before sending Web Push, and the
  subscription-bearing payload is redacted from QStash logs.
- Primary fitness data remains local-first and usable offline. Outside-app
  alerts are optional and require internet access, notification permission,
  configured free-tier services, and an installed Home Screen app on iPhone.
- Web Push uses the standard iOS notification sound and cannot override Silent
  Mode, Focus, notification settings, output routing, or system volume. It does
  not provide a live Lock Screen countdown or timer adjustment controls.
- Each timer mutation cancels every pending QStash message labeled for the
  device subscription before scheduling a replacement. Delivery retries are
  disabled and repeated pushes use a non-renotifying notification tag so one
  timer completion produces one alert.
- QStash cancellation is requested once per mutation. Cancellation completion
  is asynchronous, so repeatedly canceling until the API reports zero can keep
  a Vercel request open, cause the client to retry synchronization, and cancel
  the newly scheduled replacement.
- Starting a timer does not play muted media to prime browser audio because that
  interrupts Spotify on iPhone. Foreground completion uses a transient audio
  session so iOS may mix or briefly duck other audio instead of taking over the
  media session.
- When a native or Web Push alert is scheduled, timer completion never starts
  HTML media. The system notification is the sole audible alert, and any
  manually previewed media session is reset to `auto` when playback ends or
  fails. This avoids retaining ownership of Spotify's audio session; web code
  cannot directly restart another app.
- Installed iPhone web apps may use bundled HTML timer audio only as a visible
  foreground fallback when no outside-app alert is scheduled. This lets a timer
  started on the live workout page still alert after the user navigates to
  another in-app screen. It remains subject to iOS Silent Mode and browser audio
  policy.

## 2026-06-27: Native iOS Wrapper And Rest-Timer Notifications

- The product owner explicitly expanded the PWA-only direction to include a
  Capacitor iOS wrapper because iOS suspends Home Screen web apps outside the
  foreground and cannot reliably execute their JavaScript timer callbacks.
- The wrapper reuses the React/Vite build and IndexedDB data model. It does not
  introduce a required account, server, push service, or cloud dependency.
- Rest timers schedule one device-local notification with a stable numeric ID.
  Start, pause, resume, time adjustment, dismissal, workout discard, workout
  completion, and app startup cancel or replace that notification from the
  persisted timestamp.
- Timer sounds are bundled as mono PCM WAV files for iOS notification playback.
  Notifications are time-sensitive but not critical. They remain subject to the
  user's notification permissions, Focus configuration, output route, and system
  volume.
- The bundle identifier defaults to `com.adamshugart.fitnesslog`. The native app
  and Home Screen PWA use separate storage containers, so existing data moves by
  JSON export and restore.
- Xcode signing and physical-device installation require macOS and cannot be
  completed or verified from the Windows development environment.

## 2026-06-28: Timer Notification Banner Control

- Settings include a local `timerBannersEnabled` preference so outside-app
  rest-timer notification banners can be disabled without changing in-app timer
  sounds.
- When timer banners are disabled, the app cancels the pending native or Web
  Push timer alert and does not schedule replacement banners for later timer
  mutations.
- Web Push timer deliveries and foreground completion alerts use one stable tag
  across every timer. The service worker closes current and legacy timer
  notifications before showing the next banner, then closes the displayed
  notification after six seconds so it does not linger in Notification Center.
- Native foreground presentation requests the iOS banner and sound options but
  omits the notification-list option. Native cleanup also recognizes legacy
  timer titles so opening or resynchronizing the app removes older delivered
  entries created before stable notification IDs were introduced.

## 2026-06-26: Alpha Feedback Relay

- Added an in-app "Send feedback" form (Settings) for alpha testers to send typed
  feedback to the developer.
- This required extending the serverless layer beyond the food-provider proxy: a
  new `api/feedback` function (logic in `src/server/feedbackApi.ts`) relays the
  message to a chat webhook (`FEEDBACK_WEBHOOK_URL`, a Discord or Slack incoming
  webhook). The payload sends both `content` and `text` so either service works.
- No user feedback is persisted anywhere (no backend database, no accounts) — the
  function only forwards to the webhook, keeping the app local-first. The webhook
  URL is a server-only env var and is never bundled into the client.
- When the env var is unset the endpoint returns `not_configured` and the UI shows
  a clear message; the build still succeeds.

## 2026-06-25: Nutrition Logging Upgrades (Meal Grouping, Favorites, Saved Meals)

- The daily food log groups entries by meal (Breakfast/Lunch/Dinner/Snacks) via a
  required `mealType` on `FoodLogEntry`. A v10 migration backfills existing logs
  from each entry's local time of day; `mealTypeForHour` also seeds the meal
  selector default when logging. Empty meals are hidden in the day view.
- Foods gain an optional `isFavorite` flag (no migration; undefined means not
  favorite) with one-tap re-log that reuses the food's remembered unit+amount and
  the current time-of-day meal.
- **Saved meals** (a named reusable combination of foods, e.g. "my usual oatmeal
  bowl") are added as a new `savedMeals` table (v11 migration). This intentionally
  overrides the documented First-Release Exclusion "meal plans" at the product
  owner's explicit request. Components store immutable food snapshots so a saved
  meal logs identically even after its source foods change or are removed; logging
  expands it into individual `FoodLogEntry` rows for the chosen date and meal.
  Recipes are built in a dedicated "New recipe" sheet (a top-level action beside
  Quick add) where foods are searched, added, and given per-component servings;
  saved meals are included in backups. Logged-list rows show the resolved portion
  in the food's own unit (e.g. "1.7 cup") rather than a raw serving multiplier.
- Serving entry defaults are habit-driven first: the add-food sheet defaults to the
  food's representative portion (label serving / first USDA portion) and overrides
  with the user's remembered last unit+amount when present.
- New implementations are surfaced in-app via a versioned changelog ("What's new"),
  shown once after an update and listed on the Settings page.

## 2026-06-27: Two-Step Nutrition Goal Setup

- Set Goal uses two steps. Basic information and desired weight come first;
  desired weight then determines Maintenance, Bulking, or Cutting on the rate
  step so users cannot create a goal type that conflicts with their target.
- Cutting supports 0.25%–1% of current bodyweight per week and defaults to the
  fixed 0.5% recommendation. Bulking supports 0.1%–0.5% and defaults to the
  fixed 0.25% recommendation. Maintenance has no rate slider.
- The recommended label is a fixed track marker, not a moving label attached to
  the selected value. Rate and estimated finish date update live, and the
  selected canonical pounds-per-week rate is stored with the nutrition goal.

## 2026-06-23: Custom Nutrition Goal Workflow

- The Set Goal subpage collects current bodyweight, height (feet + inches),
  activity level, goal weight, age, and sex. Maintenance calories use the
  Mifflin–St Jeor BMR times an activity multiplier; the goal direction is derived
  from goal weight minus current weight.
- The default weekly rate is 0.5% of bodyweight per week for a cut and 0.25% for
  a bulk, converted to a daily calorie delta at 3500 kcal per pound. Protein is 0.7 g per
  pound of calculation weight, fat is ~25% of goal calories (protected so carbs
  never go negative), and carbs take the reconciled remainder. A
  `GOAL_FORMULA_VERSION` is stored with the goal for reproducibility.
- Calorie targets never adjust automatically. A manual Update Calories action runs
  a bounded trend-weight adjustment (regression over up to 14 days, ≥3 points
  spanning ≥7 days, rounded to 25 kcal, capped at ±200 kcal, 50 kcal deadband)
  and is idempotent via a trend-data signature.
- The goal is stored additively on `userSettings.nutritionGoal` (no schema
  version bump) and included in backups; users without a goal are unaffected.

## 2026-06-23: 28 Built-In Program Library

- The 28 seed programs were transcribed directly from the supplied source-of-truth
  document into `programLibrarySeed.ts`. Day names keep their wording; em/en
  dashes in day titles are normalized to hyphens (cosmetic only).
- Final-set RIR is a single integer in the data model. Where the source lists a
  range (e.g. "1–2 RIR"), the lower bound is stored; where no per-exercise RIR is
  given, the global default lower bound of 1 is used.
- Rest follows each exercise's existing default rest (compound vs isolation),
  i.e. `restSecondsOverride` is null; no second timing model was introduced.
- Programs 20 and 21 omit an explicit Goal line in the source (they list
  exercises-per-workout instead), so their goal text was set to match the
  frequency theme of the rest of the full-body series.
- Exercise names map to existing canonical library entries where one exists;
  8 genuinely-absent exercises were added (barbell back squat, paused barbell
  squat/bench, low-incline barbell/dumbbell bench, roman chair sit-up, wide-grip
  lat pulldown, cable Y-raise) at exercise seed version 5. Distinct squat, press,
  pulldown, and ab variants were preserved, not collapsed.
- Built-in templates use stable IDs (`builtin-program:<slug>`) and a seed version
  for idempotent re-seeding; they are read-only (edits/deletes throw — the user
  duplicates to customize), and activation snapshots into an active cycle so the
  source stays immutable.
- In the Training UI the main Program library card lists only user-owned programs
  (capped, with Show More opening a full-library sub-page). Built-ins live behind
  a separate Browse programs sub-page where "Add to library" clones one into the
  user's editable library; both sub-pages keep activate/edit/clone/delete.

## 2026-06-28: Powerlifting-Focused Four-Day Full Body Revision

- The stable `full-body-four-days-per-week` built-in was revised in place and
  renamed to Powerlifting-Focused Full Body - Four Days per Week. Seed version
  2 refreshes the immutable Browse Programs source but never rewrites user
  copies, active cycles, or completed history.
- The user's Monday/Tuesday/Thursday/Saturday schedule is retained as program
  guidance only; weekday scheduling remains outside the current product model.
- Heavy squat, deadlift, and paused-bench prescriptions store three sets of
  three plus notes identifying one top set and two 8-10%-lighter back-off sets.
  The schema intentionally does not fabricate separate per-set loads.
- The supplied edit says the Romanian deadlift and hip thrust were moved between
  days, while one Thursday line says "Belt Deadlift" and does not include that
  in the stated six substitutions. The implemented Thursday movement is
  Romanian Deadlift; Saturday uses the explicitly requested Belt Squat.
- Percent-of-1RM guidance, technique cues, fatigue constraints, and the
  four-week-block reminder are stored as prescription notes. No automatic load
  or progression behavior was added.

## 2026-06-23: Food Category Icons Instead Of Provider Or Bundled Images

- Food search results and food lists show a representative category icon on the
  left (keyword based, e.g. chicken to a drumstick icon), rendered with the
  existing icon set.
- We did not surface provider product photos: USDA FoodData Central supplies no
  food images and the Open Food Facts integration deliberately ignores images
  (see 2026-06-19 entry), so reintroducing them was out of scope.
- We did not bundle a large library of per-food artwork. Shipping hundreds of
  images would bloat the offline PWA and raise sourcing and licensing concerns,
  while category icons stay small, offline, and license-clean.
- Foods that do not match a known category fall back to a generic utensils icon.

## 2026-06-21: Barcode Cache, Serving Preferences, And Timer Sounds

- Remembered food units, cached barcode products, custom barcode associations,
  selected timer sound, timer sound enabled state, and active-program references
  are included in JSON backups because they are local user workflow state.
- USDA API keys remain excluded from backups, CSV exports, diagnostics, and
  source code.
- Barcode scans use browser camera APIs plus ZXing. Product lookup queries USDA
  branded foods and Open Food Facts; USDA wins conflicts when both are complete.
- Timer completion audio is best effort and plays once after timer completion
  when browser autoplay policy allows it. iOS PWA locked-screen audio is not
  guaranteed, and calls or browser suspension may still suppress playback.
- WebKit maps transient audio to an iOS category that the hardware Silent switch
  suppresses even when `play()` succeeds. Muted priming remains transient, but
  actual previews and completion chimes use the playback category so they remain
  audible in Silent Mode. The chime may briefly pause other audio.
- Rest timers remain timestamp based so elapsed time stays accurate after the
  app is backgrounded, suspended, or reopened. Timer expiry is monitored by the
  persistent app shell rather than the live-workout route so completion feedback
  still fires after in-app navigation. True iOS Live Activities and lock-screen
  countdown surfaces are not exposed to installed web PWAs, so this app cannot
  show a native lock-screen timer without a native iOS wrapper.

## 2026-06-19 Food Provider Sources

- USDA FoodData Central is the primary external food provider because its
  official API, data type documentation, and CC0/public-domain licensing support
  server-side use for this app.
- Open Food Facts is accepted only as a controlled branded-product fallback. It
  is also the explicit-search provider when the interface language is Spanish,
  because USDA does not supply localized food names. Spanish search requests
  ask for Spanish product/category fields and fall back to the provider's base
  fields when a translation is absent. It is not used for search-as-you-type,
  the app does not write records, and images and nutrition scores are ignored.
- No additional free provider was added in this prompt. Restaurant and fast-food
  coverage is limited to records supplied by USDA or the controlled fallback;
  the app will not scrape menus or fabricate restaurant coverage.

## Live Workout Final-Set RIR

- Current live-workout UI requests RIR only on the final programmed set for an
  exercise.
- Added unprogrammed sets do not become the final programmed RIR set. This
  matches existing data semantics where added sets are created with `rir: null`
  and are detected later as structural set additions.
- Historical RIR values on non-final sets are preserved in storage and backups
  even when the current UI does not render an input for them.

## Repeated-Exercise Prefill

- Workout-start prefills use the most recent completed session with the same
  stable exercise ID across all programs and workout days.
- Each prior weighted-repetition set is converted to an Epley estimated
  one-repetition maximum, translated to the new prescription's minimum reps,
  and rounded to the exercise's configured weight increment. Additional new
  sets reuse the last usable prior set. Reps and load are editable suggestions,
  not automatic progression or permanent prescription changes.

## Estimated 1RM Graphs

- Estimated one-repetition maximum is now a derived History view rather than a
  persisted record.
- The calculation uses completed weighted-repetition history only, selects the
  highest eligible estimated set per workout, and does not rewrite historical
  workout records.
- Repetition counts above 12 are excluded from the graph because high-rep Epley
  estimates can be misleading for this app's first strength-progress view.

## Architecture and Scope Decisions

## 2026-06-27: Logging Shortcuts and App Icon

- The Home bodyweight metric is a native button that opens the existing
  bodyweight sheet. The sheet uses the platform date input so iPhone presents
  its native scrolling date control; existing entries may also be moved to a
  corrected local date.
- Added-food search chips retain the created food-log ID and reopen the normal
  edit-log sheet rather than creating a second log.
- What’s New close actions clear both URL query state and local subpage state.
- PWA and native iOS icon assets share the new purple fitness-log mark.

## 2026-06-27: Daily Calorie History Graph

- Home replaces its macro-oriented Nutrition card with a compact seven-day
  calorie bar graph. Logged calories use separated bars and the applicable
  calorie target is overlaid as a contrasting line.
- History Graphs includes one-week, one-month, and three-month calorie ranges.
- Graph rows are derived from immutable local food-log calories and timestamped
  target history. IndexedDB remains the offline source of truth.
- When Supabase is configured and the user is signed in, the graph's exact
  daily logged and target calorie rows are upserted to `daily_nutrition` under
  row-level security. Graph rendering does not depend on network availability.

- The app is a single-user, local-first Progressive Web App.
- Primary target is iPhone installed through Safari using Add to Home Screen.
- IndexedDB is the source of truth for all primary user records.
- No account, backend, cloud sync, subscription, internet dependency after installation, or external food database is included in the first release.
- JSON is the authoritative full-fidelity backup format.
- CSV is export-only for readable spreadsheet use.
- Backup format version `1` is separate from IndexedDB schema version `6`.
- JSON restore supports replace mode only in this release. Merge restore remains
  unavailable until same-ID, natural-key, duplicate historical workout,
  source-reference, archived-record, and timestamp conflict behavior is defined.
- CSV export is packaged as a local TAR archive with one CSV file per data
  table. CSV import is out of scope.
- Clear-all data removes user data transactionally and reinitializes required
  app metadata without inserting demo data.
- The UI uses a dark, dense, card-based mobile design adapted from the reference analysis without copying branding or proprietary assets.
- Main navigation is fixed bottom navigation: Home, Nutrition, center Add,
  Training, Run. History, Graphs, Bodyweight, and Settings access are exposed
  from Home while their routes remain available.
- Settings are reachable from the header or a visible secondary action.
- The center Add button opens a context-aware quick-action bottom sheet.

## Product Behavior Decisions

- Interface language is a local `UserSettings` preference (`en` or `es`) with
  English as the backward-compatible default. It changes presentation only;
  user-entered names, notes, measurements, and historical snapshots remain
  stored unchanged. Adding this non-indexed field does not change the Dexie
  store schema, so no IndexedDB version bump is required. Provider-owned search
  results are the exception to presentation-only localization: Spanish mode
  queries Open Food Facts and prefers provider-supplied Spanish display fields.
- Nutrition is manual and simple.
- Food log entries snapshot nutrition values at logging time.
- Bodyweight supports multiple timestamped entries per local calendar date,
  pounds by default.
- Exercise tracking uses metric-driven presets to allow future expansion.
- The built-in offline exercise library is an original curated seed list. No
  third-party exercise database, third-party application code, images, videos,
  instructions, or descriptions are imported.
- "Similar size to MacroFactor" is implemented as at least 1,000 original
  offline exercise seeds. Controlled-tempo, paused, eccentric, and 1.5-rep
  variants inherit the base movement's tracking and muscle metadata while using
  their own stable IDs.
- Built-in exercise IDs use stable `builtin:` identifiers and seed metadata so
  future library updates can add or correct built-in records idempotently.
- Basic neck exercise seeds use the existing `traps` muscle category because
  adding a separate `neck` muscle enum would broaden the persisted schema beyond
  the exercise-library update.
- Exercises referenced by history or programs should be archived instead of hard deleted.
- Custom exercises can be hidden from future selection while preserving
  program, active-workout, and completed-history references.
- Program Templates and Active Program Cycles are separate concepts.
- Activating a template creates an independent active-cycle copy.
- Activating a template marks any existing active cycle inactive so exactly one
  cycle is current.
- Programs never auto-advance or force a schedule.
- Users manually select workout days.
- Only one active workout is required at a time.
- Runs and lifting workouts are mutually exclusive in this release. Starting a
  run requires the user to resume, finish, or explicitly discard an active
  lifting workout, and starting a second run is blocked while any run is active
  or paused.
- Active workout state must persist across navigation, refresh, app close, and installed PWA reopen.
- Active run state persists in IndexedDB. GPS is not backfilled after reload,
  browser suspension, or PWA restart; only received samples are stored.
- Outdoor run elapsed time is rendered from timestamps every second. The app
  keeps a high-accuracy geolocation watch and requests a fresh foreground fix
  every five seconds because iOS may otherwise leave a watch subscription
  unchanged. Missing fixes never create distance.
- GPS-gap decisions remain in local run data for audit and backup, but the
  recurring run-screen/history warning is intentionally not shown.
- Treadmill sensing counts foreground device-motion peaks with a refractory
  interval. Estimated distance is step count multiplied by the user-entered
  stride length; the UI labels this as estimated rather than GPS distance.
- Manual run entries are completed history records with user-entered date,
  distance, duration, type, and notes. Pace is derived locally.
- Rest timers are timestamp-based.
- Completing a workout saves history before any optional structural program update.
- Run moving time is the sum of accepted GPS sample intervals whose implied
  speed meets the configured moving threshold. Paused, rejected, stale, jitter,
  impossible-speed, and long-gap intervals do not add moving time.
- Detected structural changes are reviewed individually and are never applied automatically.
- Applying detected changes to active cycle/template/both is transactional.
- Weights are stored canonically in pounds; the `weightUnit` preference (lb/kg)
  only changes display and how freshly entered values are interpreted, so
  switching units re-renders existing history with no data migration and never
  mutates frozen workout history. Conversion uses 1 lb = 0.45359237 kg. Display
  rounding: kilogram lifting weights snap to the nearest 0.5 kg, kilogram
  bodyweight shows one decimal, and pounds are shown as stored (trimmed of
  float noise) to preserve any micro-plate precision.

## First-Release Exclusions

- Account creation and login.
- Backend server and cloud sync.
- Social features and public profiles.
- Subscriptions and ads.
- Wearables and Apple Health.
- AI coaching and AI nutrition recommendations. User-initiated Gemini
  meal-photo estimates are the only approved AI nutrition workflow.
- Bundled external food database and barcode scanner.
- Micronutrients and meal plans.
- Automated calorie adjustment.
- Automated progression and automatic program advancement.
- Strength scores, trend weight, adherence percentages, and non-history graphs.
- Route maps, external map tiles, and reliable fully backgrounded GPS tracking.
- Public App Store distribution.
- Push-notification dependency.
