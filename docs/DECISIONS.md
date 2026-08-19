# Decisions

## 2026-08-18: Version 1 Scope Freeze And Working Name

- Version 1 is frozen to the feature boundary in `docs/V1_SCOPE_FREEZE.md`.
  Scope entries describe approved release behavior, not proof that every path is
  already complete or store-ready.
- **Vigorune** is the temporary public-facing working name pending later naming
  and trademark review.
- The working-name change is presentation-only. The existing bundle/application
  identifiers, IndexedDB database name (`training-log`), local-storage keys,
  persisted IDs, and backup-format identifiers remain unchanged so installed
  users retain access to their data.
- Version 1 permits optional Google and Apple authentication, optional cloud
  snapshot backup, in-app account and cloud-data deletion, and public Apple App
  Store and Google Play distribution. Core features remain fully usable without
  an account, and IndexedDB remains authoritative.
- Cloud backup is not realtime multi-device synchronization. AI is limited to
  user-initiated meal-photo analysis whose estimates must be reviewed before
  logging; it does not authorize automatic coaching or automatic changes.
- Subscriptions, advertisements, social networking, wearables, automatic
  program advancement, and unrelated feature expansion remain excluded.

## 2026-08-17: Stable Smart Progression Rep Schemes

- Smart progression prefers a level rep scheme and preserves a later-set taper
  only when the history/capacity estimate supports it. The full suggested rep
  spread is capped at two, preventing unrelated schemes such as 12 then 6.
- The estimator no longer fabricates rep or load changes solely to make
  consecutive suggested sets different. Recorded-history mode remains an exact
  copy of usable completed sets.

## 2026-08-17: Selectable Program Weeks, Deloads, And Program History

- The active program card owns week selection. Each week keeps independent day
  check-offs, navigation never clears them, and completing all days advances to
  the next incomplete higher week within the configured duration.
- Templates and active cycles store an opt-in flag plus explicit scheduled
  deload week numbers. The flag defaults off; enabling a new schedule starts
  with week 1 selected as an editable interaction hint. Deload labels are
  ordinal (`Deload 1`, `Deload 2`) rather than the underlying program week.
  Starting one snapshots the week and deload status, removes one set per
  exercise (minimum one), and raises configured target RIR by 3 (maximum 10).
  A dedicated remembered-history estimate—not Smart progression—uses the most
  recent matching day and then comparable non-deload exercise history to lower
  load or reps for the higher reserve. RIR remains visible during deloads even
  when globally disabled. Deload completion does not produce progression changes.
- Deload workouts remain immutable History entries named `Deload <day>`, but
  derived Estimated 1RM and Total volume graphs skip them.
- History persists a Most recent versus By program choice and the selected
  program drilldown in user settings. Program drilldowns reuse the existing
  read-only workout detail rather than creating a second detail model.

## 2026-08-13: Persistent Workout Tracking And Autofill Preferences

- RIR tracking defaults off for new and legacy settings that do not contain an
  explicit preference. The choice is stored in IndexedDB and included in local
  backups, so closing or restarting the PWA does not reset it.
- Workout autofill defaults to Recorded history, which copies corresponding
  usable set values from the latest comparable completed session. Smart
  progression is an explicit preference and produces editable, fatigue-aware
  local estimates from existing exercise history.
- Smart progression uses historical and target RIR only while RIR tracking is
  enabled. Disabling RIR hides the inputs and removes RIR from new estimates
  without deleting historical values.
- Fitness data ZIP validation errors caused by legacy records are nonfatal. The
  archive retains the raw canonical backup and includes `EXPORT_WARNINGS.txt`;
  restore validation remains strict and unchanged.

## 2026-08-17: Nutrition Maintenance And Powerbuilding Program

- Nutrition Targets displays the valid maintenance value stored with a custom
  goal above the editable calorie target. Users with manual targets and no goal
  do not see an unavailable estimate.
- `Bodybuilding-Biased Powerbuilding` is an additive immutable built-in with a
  seven-day Upper/Lower/Rest/Chest-Back/Lower/Arms-Shoulders/Rest schedule. Its
  two rest days have no exercises and cannot start an empty workout.
- The prescription model continues to store one integer RIR target. Following
  the established built-in convention, an RIR range stores its lower bound and
  keeps the complete range in exercise notes. Top-set/backoff differences are
  likewise preserved in notes without adding per-set prescription fields.
- This built-in keeps deload scheduling disabled by default. Users may enable it
  after duplicating the read-only built-in or on its active-cycle copy.

## 2026-08-13: Live Exercise Options And Set Responsiveness

- Exercise Options opens as a full-height subpage with back navigation so the
  target, workout timer, rest wheels, and exercise actions fit together on an
  iPhone-sized screen.
- A prescribed rest override becomes the active exercise snapshot's effective
  rest duration. Changing it during the workout preserves completed-set history
  and updates every upcoming set.
- A live-added exercise's first set uses the same history-based estimate path
  as workout-start prefill. Added sets are inserted into the rendered workout
  state directly after persistence instead of waiting on a second full reload.
- Workout completion bulk-copies its local history records and evaluates
  independent exercise recommendations concurrently inside the same atomic
  completion transaction.

## 2026-07-19: Audited Official Restaurant Menu Corrections

- USDA remains the generic provider and provider-category serving behavior
  applies to every restaurant/fast-food record; there is no restaurant brand
  allowlist in serving selection or persistence.
- USDA is not treated as a universal current restaurant-menu feed. An exact FDC
  record may receive a reviewed correction only when the restaurant's official
  U.S. source supplies the exact item, serving/count, calories, protein,
  carbohydrate, and fat. Each correction is keyed by both FDC ID and expected
  item name and stores its official URL and review date.
- FDC 170790 is corrected to one Chick-fil-A Chicken Sandwich (420 kcal, 29 g
  protein, 41 g carbohydrate, 18 g fat). FDC 173297 is corrected to six
  McDonald's Chicken McNuggets (250 kcal, 14 g protein, 15 g carbohydrate,
  15 g fat); dipping sauce is not included.
- Official menu pages for these records do not publish a reliable mass needed
  for conversion. Corrected results therefore expose only the official
  item/count serving and do not mix current serving macros with USDA's older
  gram weight or per-100-gram profile.
- Corrections update future searches and reusable provider-food upserts. They
  never mutate completed food-log or saved-meal snapshots. Other restaurant
  values remain provider estimates, and the product does not promise complete
  or universally current restaurant coverage.

## 2026-07-16: Nutrition Serving Size And Portion Language

- `Serving size` is the fixed reference that the food's calories and macros
  describe. `Your portion` is the amount being logged or edited now.
- The existing food-unit preference remains an automatic last-used value, not a
  separately configured regular or usual portion. Search rows, calories,
  accessible quick-log names, and one-tap logging all resolve from that same
  value. Logging a different portion replaces it. If a provider-only alternate
  household unit cannot survive provider persistence, its exact gram equivalent
  is remembered instead of falling back to a nutritionally different portion.
- The logger uses concise measurement labels, unit-aware steppers and quick
  portions, and preserves equivalent nutrition when the unit changes. A visible
  action restores the reference serving size.
- Logged entries keep the existing immutable snapshot plus serving-multiplier
  model. Editing presents the resolved amount in the snapshot unit and converts
  it back internally, so this UX change needs no IndexedDB migration and does
  not alter historical snapshots.
- Gram and mass-ounce controls appear only when conversion is reliable. The old
  `100g` pseudo-unit is represented as a 100 g quick portion; persisted `g`,
  `oz`, and `100g` keys resolve to their compatible controls for backward
  compatibility.
- Provider records with complete per-100-gram nutrition but no usable serving
  weight use an explicit 100 g reference instead of presenting those values as
  an undefined `1 serving`.
- Restaurant handling uses provider categories and portions for every eligible
  restaurant record, not a hardcoded brand list. A listed whole-item or count
  serving takes priority over generic meat-weight defaults, and the provider
  category is retained when the food is saved for later reuse.

## 2026-07-11: Manual Active-Program Week

- The active program editor exposes a 1-based current-week field bounded by
  the program length.
- Superseded 2026-08-17: changing the selected week preserves all per-week
  check-offs so moving forward and backward restores prior state.
- Completing every workout day still advances the cycle automatically from
  the manually selected baseline.

## 2026-07-07: Training Tab Resumes Active Workouts

- The bottom navigation resolves the Training tab to `/workout` while an
  active workout exists, instead of redirecting every `/training` route. This
  keeps explicit Training sub-routes such as quick-action create flows usable
  while making the primary tab behave as a live-workout resume control.

## 2026-07-05: Meal-Aware Recent Foods And Compact Day Creation

- Empty Log Food search now surfaces at most four distinct active reusable
  foods most recently logged near the current time of day during the previous
  two local calendar dates, excluding today. Quick-add-only snapshots are excluded
  because they have no reusable food record. Entering any query removes the
  recommendation section and restores normal search ranking.
- This local recency shortcut supersedes the blanket first-release exclusion of
  meal recommendations. It does not generate foods, rank nutritional quality,
  call an external recommendation service, or log automatically.
- Program editing replaces the persistent Add workout day form with a plus
  control after the horizontal day tabs. Tapping plus reveals an inline name
  field with save/cancel controls. The selected-day panel no longer repeats a
  workout-day name field or header; the selected tab remains the visible day
  name.

## 2026-07-05: Per-Program RIR-Every-Set And Prescription-Editor Layout

- New per-program `trackRirEverySet` flag (on `ProgramTemplate`,
  snapshotted onto `ActiveProgramCycle` at activation and onto `Workout` at
  start; optional, defaults false; added to the backup schemas). A "Track RIR
  on every set?" checkbox in the program builder toggles it, shown only when
  global RIR tracking is on. When on, `startWorkout` prefills the exercise's
  target RIR onto every set (not just the final), and the live workout treats
  every set as a target set (prescribed placeholder + required to complete).
  The prescription editor relabels its RIR field "RIR target" vs "Final-set
  RIR" accordingly.
- Prescription editor layout: the RIR-target field moved up beside Sets to
  save vertical space; the "<rest>s rest - <increment> increment" line was
  removed (that detail lives on the exercise itself); and the weight-target
  field stays gone.
- The editor's redundant second back arrow is gone: the nested header was
  removed so the BottomSheet's single page-header back arrow is the only one.
  It still guards unsaved edits — `PrescriptionEditor` reports dirtiness up via
  `onDirtyChange` and the builder shows the discard confirmation before
  closing. The sheet title stays "Edit template"/"Edit current cycle" (not
  retitled per screen) so existing dialog-by-name references keep working.

## 2026-07-05: Automatic Cloud Backups And Signed-Out Launch Warning

- The direct request for automatic signed-in backups supersedes the earlier
  manual-only cloud-backup decision. IndexedDB remains authoritative and the
  app remains fully usable without an account or network connection.
- A signed-in app uploads a full JSON snapshot on launch/resume and
  reconnection. Mutation-driven snapshots are throttled to once every five
  minutes; repeated changes do not postpone the pending snapshot.
  High-frequency run-sample writes do not independently trigger uploads;
  parent run-state changes do.
- Existing cloud data is protected from a new or cleared device: automatic
  overwrite is blocked until local backup metadata proves that the current
  cloud snapshot was created or restored on that device. Manual backup and
  validated replace-restore remain available in Settings.
- Signed-out users receive a dismissible “Prevent data loss” Google sign-in
  dialog on each fresh Home launch. Dismissing it does not restrict local or
  offline use.

## 2026-07-05: RIR Recording Options And Program-Editor Trims

- RIR can be recorded on any set during a live workout, not only the final
  programmed set. Only the final programmed set still requires an RIR value to
  complete (when tracking is on) and shows the prescribed target as its
  placeholder; earlier sets take an optional value with no target. At workout
  start the prescribed `targetRir` is prefilled onto the final set only (was
  every set), so earlier sets begin blank.
- New `rirTrackingEnabled` UserSettings flag (defaults true, backfilled in
  `ensureSettings`, added to the backup schema and a live `useRirTracking`
  hook). When off, RIR inputs disappear from the live workout and the
  prescription editor and no RIR is required to complete a set. Previously
  recorded RIR values are preserved in storage and backups.
- The prescription editor no longer has a weight-target field. Weight is
  logged during the workout, and prescriptions carry set/rep/RIR/rest targets
  only. The target-RIR field is relabeled "Final-set RIR" to match where it
  applies. (`targetWeight` remains in the data model and is untouched on
  existing records; new prescription saves persist `targetWeight: null` as
  before when no value is entered.)
- The program day header drops its Up / Down / Duplicate buttons, leaving only
  "Remove day". Day reordering is drag-only via the day tabs. Accessibility
  tradeoff accepted per explicit request: dragging tabs has no keyboard
  equivalent now that the Up/Down buttons are gone.

## 2026-07-05: Prescription Editor Polish (Phase 3)

- The selected-exercise card swaps its metadata sentence for the same
  equipment/muscle chips used on builder rows, plus a tracking-method chip.
- Default search results carry a "Recent & common" section label, and the
  notes field grew to three rows with vertical resize.

## 2026-07-05: Prescription Editor Capability (Phase 2)

- Existing prescriptions can swap their exercise ("Change exercise" returns to
  the search step; `updateTemplateExercise` already re-snapshots on
  `exerciseId` change, so no repository work was needed). Search offers "Back
  to prescription" so browsing does not lose entered targets; entered targets
  carry over and re-validate against the new exercise's tracking method.
- When Save is disabled and the form is dirty, the blocking validation message
  shows live above the action bar instead of leaving a silently dead button.
- "Create custom exercise" prefills the name from the search query that found
  no results.

## 2026-07-05: Prescription Editor Ergonomics (Phase 1)

- Numeric prescription fields (sets, min/max reps, RIR, weight) use a new
  `StepperInput` ui primitive: −/+ 44px buttons around the existing
  NumericInput, so common adjustments never open the keyboard. Weight steps by
  the exercise's `defaultWeightIncrement` (converted to the display unit),
  falling back to 5 lb / 2.5 kg. Steppers only adjust user-entered values —
  they never suggest a starting load or rep count.
- Rest is chosen from preset chips (0:30–5:00) with the minute/second inputs
  kept beneath for custom values; the matching chip shows as pressed.
- Field order is now Sets → Reps → Weight/RIR → Rest → Notes (rest used to
  come first), and Cancel + Save live together in a sticky bottom action bar
  instead of Save floating at the top.
- The selected-exercise card shows a live summary line (via
  `PrescriptionInputSummaryText`) of exactly what the builder row will read.
- The Sets field no longer autofocuses, so opening an existing prescription
  does not pop the keyboard over the form.

## 2026-07-05: Builder Quick-Add, Duplicate Exercise, Chips, And Bulk Edit

- Exercise rows show equipment and up to two primary-muscle chips looked up
  from the live `Exercise` record (`ExerciseSnapshot` does not carry them);
  rows for deleted exercises simply omit the chips.
- Each row gained a Duplicate action:
  `duplicateTemplateExercise`/`duplicateActiveCycleExercise` insert the copy
  directly after the original. An active-cycle duplicate gets
  `sourceTemplateExerciseId: null` so template change detection never pairs it
  with a template exercise it did not come from.
- A quick-add search sits under the exercise list; picking a result adds the
  exercise with the prescription form's default (3 sets, exercise default
  rest) for later editing by tapping the row. The full Add exercise flow
  remains for setting targets up front.
- Select mode replaces drag handles with checkboxes (drag disabled while
  selecting) and offers bulk "Move to day" (a select of the other days) and
  bulk delete behind a confirmation dialog — bulk delete spans records, so it
  confirms instead of offering single-exercise Undo.
- Superset grouping stayed out of scope: it needs a data-model addition, a
  Dexie migration, and live-workout semantics, so it belongs in a product
  spec (ROADMAP) rather than piggybacking on builder UI work.

## 2026-07-05: Cross-Day Drag, Tap-To-Edit Rows, And Undo Delete In The Builder

- Builder exercise rows and day tabs now share one drag context
  (`SortableArea`/`SortableZone` in `components/SortableList.tsx`): dragging an
  exercise onto a day tab moves it to the end of that day
  (`moveTemplateExercise`/`moveActiveCycleExercise`), with the hovered tab
  highlighted. Collision detection prefers what the pointer is inside, so
  in-list reorders and tab drops coexist.
- Removing an exercise no longer asks for confirmation; it removes immediately
  and offers a 6-second Undo toast (Toast gained an optional action button).
  Undo restores the exact prescription at its original position via
  `restoreTemplateExercise`/`restoreActiveCycleExercise`. Day removal keeps
  the confirmation dialog because it deletes multiple records.
- Exercise rows slimmed to grip + tappable body + delete: tapping the row body
  opens the prescription editor (the pencil button is gone).
- Optimistic builder updates renumber `orderIndex` locally so captured records
  (e.g. for undo) never carry stale positions.
- Live workout exercise reordering intentionally keeps its Move Earlier/Later
  buttons: the live page shows one exercise at a time (no list to drag) and
  that flow shipped from alpha feedback on 2026-07-04.

## 2026-07-04: Touch Drag-And-Drop Reordering In The Program Builder

- Program builder exercise rows and day tabs reorder by drag using a shared
  `SortableList` primitive (`components/SortableList.tsx`) built on dnd-kit —
  the first UI runtime dependency beyond lucide-react. Chosen over a custom
  pointer-events hook because keyboard sortability, screen-reader
  announcements, and drag auto-scroll are hard to get right by hand; the
  previous HTML5 `draggable` day tabs never worked on touch at all.
- Touch lifts after a 200 ms long-press (quick swipes still scroll), mouse
  after 6 px of movement, and drops vibrate where supported. Reorders apply
  optimistically to local state and persist once on drop; failures surface the
  error and reload from the repository.
- Exercise rows dropped their Move up/down arrow buttons — the grip handle is
  keyboard-operable (Space to lift, arrows to move) with live announcements.
  Day tabs keep their Up/Down buttons as the accessible path because the tab's
  Enter/Space must keep selecting the day, so tabs drag with pointer only
  (`pointerActivatorProps` in `components/sortableDrag.ts`).
- A 2026-07-30 follow-up makes the live workout's horizontal exercise tabs use
  the dragged card's center for drop selection instead of the fingertip alone.
  A 44 px target-change margin keeps adjacent positions from flickering near
  their midpoint. Horizontal edge scrolling is restricted to the tab strip,
  runs on a 16 ms interval at low acceleration, and starts only within the
  outermost 18% of the strip. Scroll snapping is disabled on this row so it
  cannot fight drag auto-scroll near the first position.
- A 2026-07-31 follow-up keeps the same activation and 44 px target-change
  sensitivity, constrains card movement to the horizontal axis, and modestly
  raises the edge-scroll top speed so longer exercise rows pass more quickly.
- A later 2026-07-31 polish pass adds directional overflow fades, keeps the
  selected exercise tab visible, and adds short drag, set-completion, and timer
  feedback using the existing reduced-motion fallback. Nutrition's empty-search
  recommendations explain their two-day source, successful one-tap logs briefly
  show a checkmark, and delayed page loads use card-shaped placeholders.
- Follow-up tuning fixes timer digits in place instead of animating every tick,
  increases horizontal edge-scroll's maximum step to 4 px per interval, and
  expands midpoint hysteresis to 56 px. Loading placeholders now resemble a
  page toolbar, summary, and list; unbroken workout-day names wrap inside their
  cards.
- Active program days use one full-width horizontal row per day. The Training
  route title is Current Program, and the active program card starts directly
  with the program name instead of repeating an internal section title.
- Discarding an active workout is a single guarded operation rather than a
  generic workout mutation: repeat confirmation taps are ignored, stale load
  results are suppressed after deletion begins, and no post-delete reload is
  scheduled before returning to Current Program.
- Mobile follow-up separates exercise-tab scrolling from sorting: the tab name
  surface permits native horizontal panning, while only a dedicated 44 px grip
  activates drag. Bodyweight date ticks sit above the axis title. The fixed
  bottom navigation has no transform in normal use; keyboard translation is
  added only for a meaningful focused-input viewport inset and is reset across
  page visibility transitions, preventing Safari from leaving the bar floating.
- Exercise-tab grips permit native horizontal panning before their delayed drag
  activation. A swipe therefore scrolls even when it starts on a grip, while a
  deliberate hold still enters horizontal-only reorder mode.
- The live workout navigator keeps an accessible "Exercises" region label but
  removes the visible card surface, heading, and drag-instruction copy so only
  the exercise tabs occupy the row.
- The idle Run screen checks for an active lifting workout before rendering its
  start actions. When one exists, outdoor, treadmill, and manual actions are
  replaced by a single Finish current workout link to `/workout`; the existing
  start-time conflict dialog remains as protection against races.

## 2026-07-04: Completion-Based Program Weeks (Tester Feedback)

- Program weeks now advance from day check-offs, not the calendar: the current
  week is the latest week holding a checked day, and it rolls into the next
  week the moment every day of the cycle is checked
  (`completionProgramWeek` in `domain/programWeeks.ts`). Checked day cards
  darken (`.program-day-card.is-done`) and all reset together at rollover.
- Rationale: alpha feedback — training cadence rarely matches calendar weeks,
  and testers wanted "complete the week when the workouts are done".
- Legacy calendar-keyed check records stay valid: the derivation uses the
  latest week with any checked day, so nobody regresses to week 1. The
  calendar helpers `currentProgramWeek`/`formatProgramWeek` were removed.
- Not automatic program advancement (still a first-release exclusion): nothing
  changes prescriptions or completes the cycle; only the week counter and the
  weekly check-off reset are driven by completion.

## 2026-07-04: Live Workout Set/Order Edits Follow Live Behavior

- Sets added mid-workout inherit the previous set's current values with
  source `auto`, so live rep/weight propagation keeps flowing into them until
  the lifter edits them manually. Add/delete also recompute target
  recommendations.
- Exercises can be reordered mid-workout (Move Earlier / Move Later), reusing
  `reorderWorkoutExercises`; the active exercise follows its id to the new slot.
- The nutrition daily totals card leads with calories remaining when a calorie
  target exists (calories eaten shown beneath); without a target it keeps the
  eaten headline since "remaining" is meaningless.

## 2026-07-02: AI Meal Scan Context — Review Step, Note, Multiple Photos

- Capturing or importing a meal photo now lands on a review step instead of
  analyzing immediately. The extra tap buys user control: an optional free-text
  note and up to three photos of the same meal (different angles) per analysis.
- The note is sent to Gemini as user-trusted context that overrides visual
  guesses about the food (portions, hidden ingredients, cooking fats). It is
  capped at 500 characters, task-scoped in the prompt, and never stored.
- Multiple photos are always treated as one meal, never summed per photo.
- This stays within the user-initiated meal-photo estimate workflow; it adds
  no coaching, recommendations, or automatic logging.

## 2026-06-29: Optional Gemini Meal Photos And Isolated Developer Stable

- The direct request for AI meal-photo analysis supersedes the earlier
  first-release exclusion only for this user-initiated workflow. It does not
  enable AI coaching, recommendations, automatic targets, or automatic logging.
- Gemini 3.5 Flash receives one resized meal photo and returns validated,
  structured ingredient estimates. The result becomes a snapshot-only recipe
  draft. Log food atomically writes each ingredient snapshot to the selected
  date; Save as recipe is a separate, off-by-default checkmark applied in the
  same transaction.
- The AI processing state uses a lightweight code-native robot calculation
  animation. An empty ingredient result shows "AI failed" for approximately
  three seconds, then restores the page that launched the camera.
- Meal analysis accepts either a new camera capture or a user-selected image
  from the device photo library. Imported images are resized and converted to
  the same JPEG input used by camera capture.
- AI drafts lead with total calories and use tappable food-style ingredient
  rows. Serving edits scale the ingredient snapshot macros without changing the
  original per-serving estimate. Existing food search remains available for
  adding ingredients.
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
- Calorie targets never adjust automatically. A manual Update Calories action
  blends two recency-weighted maintenance estimates: a responsive 28-day signal
  (14-day half-life) and a stabilizing 90-day signal (42-day half-life).
- The 90-day estimate starts with no influence and grows only as calorie-log
  days, calendar span, weigh-in count, and weigh-in span accumulate. It reaches
  at most 50% influence after at least 60 logged days spanning 70 days and 12
  weigh-ins spanning 70 days. Result messages describe this data support as
  developing, moderate, or strong rather than claiming physiological certainty.
- The blended maintenance estimate receives the selected goal-rate energy
  delta. The resulting target is set directly, rounded to the nearest 1 kcal
  with a 1,200 kcal floor; there is no coarse increment, deadband, or per-click
  adjustment cap. The desired goal weight determines direction, and reaching it
  switches the estimate to maintenance. Updates remain idempotent via a
  signature covering the relevant 90-day weight and calorie inputs.
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

- An exercise with no usable completed history starts with blank performance
  fields. Programmed RIR remains target context; the app does not invent reps
  or load from the prescription alone.
- If the exercise has history but not for the selected program day, the most
  recent completed set sequence is translated to the midpoint of the current
  rep range. Weighted estimates use an RIR-adjusted Epley capacity, round load
  to the nearest 5 lb, and carry the observed set-to-set fatigue curve through
  the whole proposed sequence. Additional sets extend that curve instead of
  repeating an independent first-set estimate.
- If the same exercise was completed on the same program day, the last set
  sequence is the starting point. The estimator adds one total repetition at
  the position that best preserves a fatigue-shaped sequence. When every
  programmed set reached the range maximum, it may instead add 5 lb (or remove
  5 lb of assistance) only when the prior RIR-adjusted capacity still supports
  the current range at the prescribed RIR.
- Historical RIR informs the estimate but is not copied into the new workout as
  an observed result. Current target RIR remains the editable prefill on the
  configured target set(s). All rep/load values are editable startup estimates;
  completed history and permanent program prescriptions are never rewritten.
- Consecutive auto-filled sets do not repeat the same load-and-repetition pair.
  Repetitions step down first, then weighted methods adjust load by 5 lb when a
  repetition step would pass the range floor. Programs that track RIR on every
  set step the editable RIR prefill toward the final-set target.

## Estimated 1RM Graphs

- Estimated one-repetition maximum is now a derived History view rather than a
  persisted record.
- The calculation uses completed weighted-repetition history only, selects the
  highest eligible estimated set per workout, and does not rewrite historical
  workout records.
- Repetition counts above 12 are excluded from the graph because high-rep Epley
  estimates can be misleading for this app's first strength-progress view.

## 2026-07-30: Total Volume Strength Graphs

- Strength history keeps Estimated 1RM as the default metric and adds Total
  volume as a user-selected alternative.
- A total-volume point is derived per exercise and completed workout by summing
  `weight × repetitions` across all completed weighted-repetition sets.
- Volume includes completed high-repetition sets that are intentionally
  ineligible for Epley estimation. The graph remains derived from immutable
  workout history and adds no persisted records or automatic coaching.

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

## 2026-07-19: Calorie Ranges and Intake Insights

- Home keeps 1W as the default calorie range and adds a 1M option. View more
  opens a dedicated calorie details route with 1W, 1M, and 3M ranges.
- Logging consistency is days with positive logged calories divided by all
  calendar days in the selected range. It is not an adherence score and does
  not judge whether the user met a target.
- Average calorie surplus or deficit means average logged intake minus the
  applicable saved target, using only days that have both positive logged
  calories and a positive target. The UI describes this as versus target so it
  is not confused with measured energy expenditure. An exact zero mean is on
  target; all comparison averages remain unavailable when no eligible day
  exists.

- The app is a single-user, local-first Progressive Web App.
- Primary interaction target remains iPhone portrait. Version 1 may also be
  distributed publicly through Apple App Store and Google Play.
- IndexedDB is the source of truth for all primary user records.
- Core use has no account, cloud, subscription, or internet dependency after
  installation. Optional Google or Apple sign-in and Supabase snapshot backup
  are the documented exception; they do not replace IndexedDB as the source of
  truth.
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
- Bodyweight permits one entry per local calendar date, pounds by default.
  Legacy duplicate-date records remain restorable without destructive cleanup.
- Trend weight uses a MacroFactor-like approximation: missing dates between
  measurements are filled by linear interpolation, then a 10% daily
  exponential moving average is applied. MacroFactor publicly documents the
  interpolation and recency-weighted moving-average approach but not its exact
  coefficient, so this is intentionally not represented as an exact clone.
- Exercise tracking uses metric-driven presets to allow future expansion.
- The built-in offline exercise library is an original curated seed list. No
  third-party exercise database, third-party application code, images, videos,
  instructions, or descriptions are imported.
- The offline library uses original controlled-tempo, paused, and eccentric
  variants with stable IDs. Generated 1.5-rep variants are retired; unreferenced
  records are removed during seeding and referenced records stay hidden so
  existing program and workout history links remain valid.
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
- Finish confirmation offers one unchecked-by-default option to apply all
  detected workout changes. The option stays visible even before a change has
  finished persisting, because Finish waits for pending edits and performs final
  detection afterward. Without explicit opt-in, the source program remains
  unchanged.
- Home caches the last fully loaded dashboard per selected date so returning
  from another tab never renders false empty-state cards while IndexedDB is
  refreshing. A background reload still replaces the cached snapshot.
- The Home training action names and directly starts the first unchecked day in
  the current program week. This is still a user-selected action and does not
  automatically start or advance a program.
- The selected-food sheet keeps amount, unit, meal, live nutrition, and Log food
  in the primary path. Provider alternates and corrected-copy creation remain
  available under a collapsed More options disclosure.
- The existing per-table CSV archive is surfaced as Export all fitness data; it
  is the readable analysis export, while JSON remains the authoritative restore
  backup.
- Applying detected changes to active cycle/template/both is transactional.
- Weights are stored canonically in pounds; the `weightUnit` preference (lb/kg)
  only changes display and how freshly entered values are interpreted, so
  switching units re-renders existing history with no data migration and never
  mutates frozen workout history. Conversion uses 1 lb = 0.45359237 kg. Display
  rounding: kilogram lifting weights snap to the nearest 0.5 kg, kilogram
  bodyweight shows one decimal, and pounds are shown as stored (trimmed of
  float noise) to preserve any micro-plate precision.

## 2026-08-03: Paid-use reliability polish

- Automatic cloud snapshots run at most every 15 minutes while signed in. A
  failed attempt waits five minutes before retrying; local recording never
  depends on cloud availability. Users may permanently delete their cloud rows
  without deleting local data.
- An active lifting workout keeps running during ordinary in-app navigation and
  brief backgrounding. It pauses when the page/app actually closes (`pagehide`)
  or after 15 minutes without pointer, keyboard, input, or change activity. The
  pause timestamp and accumulated paused seconds are persisted, and resuming is
  always an explicit user action. Workout durations display hours once needed.
- Barcode scanning is a focused Nutrition subpage. After the first successful
  camera start, a device-local preference starts the scanner automatically on
  later visits. Browser or operating-system permission revocation still takes
  precedence and clears that preference after a denial. Leaving the scanner
  explicitly stops its video layer before the Nutrition overview remounts so
  iOS does not leave the date and mode controls visually blank.
- The live workout keeps the current exercise card itself fixed. Its notepad is
  aligned with the exercise name, and only the set list becomes scrollable as
  extra sets exceed the available height.
- Exercise notes do not request keyboard focus when their sheet opens. Closing
  the sheet restores focus to the notepad without scrolling, preventing iOS
  from panning the fixed workout viewport or lifting the bottom navigation.

## First-Release Exclusions

- Required account creation or login.
- Realtime multi-device cloud sync or an application backend beyond the
  optional Supabase snapshot-backup integration.
- Social features and public profiles.
- Subscriptions and ads.
- Wearables and Apple Health.
- AI coaching and AI nutrition recommendations. User-initiated AI
  meal-photo estimates are the only approved AI nutrition workflow.
- Bundled external food database. Barcode lookup remains provider-backed and
  user-initiated.
- Micronutrients and meal plans.
- Automated calorie adjustment.
- Automated progression and automatic program advancement.
- Strength scores, trend weight, adherence percentages, and non-history graphs.
- Route maps, external map tiles, and reliable fully backgrounded GPS tracking.
- Push-notification dependency.

## 2026-08-04: Automatic PWA Updates And Per-Workout Timer Notices

- A waiting service worker activates automatically; the app no longer asks the
  user to press an update button. The versioned What’s New banner is the
  user-facing summary after the updated shell reopens.
- Dismissing the outside-app timer-settings notice stores only the active
  workout ID in local storage. Further timer changes in that workout stay
  unobstructed, while a new workout can show the notice once.

## 2026-08-05: Consolidated Live Rest-Timer Controls

- The live exercise header no longer contains a rest-timer toolbar or a nested
  timer-settings sheet. The fixed bottom session row uses that space for the
  current rest countdown and its 30-second subtract/add controls.
- Total workout duration, workout pause/resume, exercise rest-duration wheels,
  and rest pause/clear actions live in Exercise Options. Wheel changes commit
  immediately without Save or Cancel buttons.
- Changing the wheel restarts a running or completed rest timer from the newly
  selected duration, preserves a paused timer's paused state, updates the
  exercise default used by later sets, and resynchronizes optional alerts.
- Keyboard viewport compensation survives route changes while iOS closes the
  keyboard, so the bottom navigation does not jump upward during Live Workout.
  It clears when the visual viewport is restored or the close fallback expires.
- After a live-workout numeric field blurs, the next animation frame resets the
  locked document scroll position. When WebKit reports a residual visual-
  viewport top offset with no remaining keyboard inset, the live shell and
  bottom navigation compensate for that offset until the viewport returns to
  baseline, without moving the set list's own scroll position.

## 2026-08-05: Persistent Update Banner And Live Navigation Anchor

- The app-wide What's New banner is marked seen only when the user explicitly
  opens or dismisses it. Restoring an active workout or visiting Settings does
  not hide an unseen update.
- Keyboard compensation remains active across route transitions while the iOS
  visual viewport is still contracted, keeping Live Workout navigation on the
  same bottom baseline as Home and Nutrition.

## 2026-08-05: Silent Automatic Cloud-Backup Failures

- Automatic cloud-backup failures and existing-snapshot conflicts do not render
  app-wide warnings. The background service continues retrying, while explicit
  manual backup operations and their status remain available in Settings.

## 2026-08-05: Non-Blocking Workout Discard

- Discard waits only for the local IndexedDB deletion transaction. It does not
  wait for pending edits or optional native/web notification work because all
  active-workout data is being permanently removed.
- Rest-timer notification cancellation is best-effort background cleanup after
  the local workout is deleted, so a slow platform API cannot delay navigation.

## 2026-08-18: Phase 1 Scalability And Server-Side Meal Analysis

- The OpenAI meal-analysis route supersedes the earlier device-supplied Gemini
  credential and direct-provider request mechanics. This changes the provider
  boundary, not the approved feature scope: analysis remains user-initiated,
  produces an editable estimate, and never logs food, saves a recipe, changes a
  target, or gives coaching without explicit user review and action.
- `OPENAI_API_KEY` and the optional `OPENAI_MEAL_MODEL` remain server-only. The
  browser submits one to three compressed images to a bounded same-origin
  route. The route requests strict structured output with provider storage
  disabled. Legacy internal `gemini` source identifiers remain unchanged to
  preserve persisted and backup compatibility.
- Server safeguards are narrowly scoped: bounded bodies and outputs, explicit
  deadlines, safe structured logging, cache coalescing, fixed-window
  per-instance limiting, and idempotent timer scheduling. Food lookup is the
  documented fail-open exception when limiter storage is unavailable because it
  uses read-only free providers; meal analysis, feedback, and timer scheduling
  fail closed.
- These in-memory controls reduce amplification on one warm serverless instance
  but do not claim a global concurrency limit. A shared limiter/cache is future
  infrastructure work when production traffic requires cross-instance quotas.
- Cloud snapshots remain replace-only and local-first. They are capped at 8 MiB
  before upload, omit GPS run samples, and use a metadata-only overwrite guard.
  Daily nutrition synchronization persists bounded account-scoped fingerprints
  so unchanged dates do not produce conflict writes.

## 2026-08-18: Phase 1.5 Distributed AI Protection And Compact Cloud Rows

- Production meal analysis keeps the six-request/ten-minute anonymous-client
  policy but moves its enforcement to an atomic Redis fixed window shared by
  every serverless instance. Redis configuration, tokens, and the independent
  HMAC key remain server-only. The shared key contains a scoped HMAC-SHA-256
  digest rather than a raw IP address or user agent.
- Missing, slow, failed, or malformed Redis responses fail the paid route
  closed before OpenAI. The in-memory `ServerRateLimiter` remains available for
  tests and local injection, while the documented free food-provider limiter
  policy is unchanged.
- Manual JSON backup format 1 remains full fidelity. Cloud writes use the
  separate `cloudSnapshotFormatVersion: 1` envelope and omit only records that
  exactly equal deterministic built-in exercise/program seeds. Modified
  built-ins and every custom or user-owned record remain explicit.
- Compact restore expands current seed definitions and overlays preserved
  records in memory, validates the complete backup and relationships, and only
  then uses the existing transactional replace operation. Legacy cloud JSON
  snapshots remain readable, future compact versions fail clearly, and GPS run
  samples remain excluded from cloud payloads.
- Final serialized-row measurements were 1,401 bytes for initialized and
  seeded-program baselines and 4,034 bytes for a representative user dataset,
  down from 513,176, 1,315,541, and 1,318,178 bytes respectively. The existing
  8 MiB pre-Supabase cap remains unchanged.

## 2026-08-18: Relay iOS Home Screen OAuth authorization codes with PKCE

- iOS can return a Home Screen PWA's Google OAuth callback to Safari, whose
  storage is separate from the installed app.
- Installed-mode sign-in uses a five-minute, single-use Redis relay for the
  PKCE authorization code. The PKCE verifier remains in the initiating PWA, so
  the relay cannot exchange the code or obtain a session.
- The relay never stores Supabase sessions, provider tokens, email addresses,
  or fitness data. Normal browser sign-in remains a direct Supabase PKCE flow.

## 2026-08-18: Do not interrupt an active app to apply PWA updates

- A waiting service worker activates immediately but does not force a page
  reload. The current, already-preloaded app stays usable and the next natural
  launch uses the updated build, avoiding a second launch screen and scroll
  loss a few seconds after startup.

## 2026-08-18: Complete OAuth callbacks in their actual display context

- When iOS returns the callback inside the installed PWA, the callback page
  automatically replaces itself with Settings after the relay accepts the
  authorization code and shows a manual Continue fallback. When the callback
  opens in ordinary Safari, it retains the close-tab and return-to-app guidance.

## 2026-08-18: Keep Google and add Apple with store-compliant account controls

- Version 1 keeps optional Google cloud sign-in and adds Apple through the same
  Supabase PKCE and one-time Redis relay boundary. Core local features remain
  available without an account.
- Capacitor opens provider authorization in the iOS system browser. The HTTPS
  callback relays only the one-time code, then the fixed
  `vigorune://auth-complete` scheme returns to the native app. Provider tokens,
  account identifiers, and fitness records never enter the relay.
- Permanent deletion is distinct from cloud-row deletion and local clearing.
  `/api/account/delete` verifies the Supabase access token, derives the user ID
  from that verified identity, rate limits the operation, and uses the
  server-only service role to delete the Auth user. Database foreign-key
  cascades remove app-controlled cloud rows; IndexedDB remains unchanged.
- Public `/privacy`, `/account-deletion`, and `/support` routes describe actual
  local, cloud, AI, food-provider, feedback, retention, and deletion behavior.
- The public name becomes Vigorune while the bundle ID, IndexedDB name, storage
  keys, persisted IDs, and backup-format identifiers remain unchanged.

## 2026-08-19: Worldwide distribution, platform-only billing, 18+ launch (publication track)

Owner decisions for the app-store/legal publication workstream (Adam Shugart,
individual — no LLC — Texas). These supersede the earlier "US-only first" and
"13+" working assumptions used by Publication tasks #1–#11. See
`docs/PUBLICATION_READINESS_MASTER_AUDIT.md`.

- **Territories: WORLDWIDE.** The app is to be available to anyone on iPhone or
  Android regardless of location. This pulls in GDPR/UK GDPR (fitness = special-
  category health data → Art. 9 explicit consent; a US individual offering to the
  EU needs an Art. 27 EU representative), EU/UK consumer law (14-day withdrawal
  right, auto-renewal / easy-cancellation duties), and non-US privacy/consumer
  regimes. Legal drafts (#9/#10) and the age/deletion docs (#6/#8) must be
  re-generalised from US-only to worldwide.
- **Billing channels: Apple In-App Purchase + Google Play Billing ONLY at
  launch. Stripe / web billing is DEFERRED.** Rationale: Apple and Google act as
  merchant of record in most territories and collect/remit VAT/GST/sales tax
  worldwide, which is what makes global distribution viable for a solo
  individual. Do NOT build or describe web/Stripe billing as a launch channel.
  The entitlement engine stays provider-neutral, but only the `apple` and
  `google_play` providers are wired for launch.
- **Minimum age: 18+ at launch (supersedes 13+).** Chosen to remove the
  worldwide-minor compliance surface in one move — COPPA, GDPR Art. 8
  (13–16 varies by country), Texas TASAA/SCOPE, and the UK Age Appropriate
  Design Code. Teen (13–17) support may be revisited post-revenue. Terms/Privacy/
  age docs should state an 18+ eligibility floor; keep the neutral age-assurance
  design notes for a possible future teen tier but do not implement minor flows.
- Unchanged from prior: mandatory Apple/Google auth via Supabase; records local
  unless cloud backup separately enabled; one server-recorded 14-day no-card
  trial that never auto-charges; one monthly auto-renewing full-access
  subscription targeted ~USD $2 (localized price from the provider); service-role
  complimentary grants; ≤72h server-verified offline lease; locked users keep
  legal/auth/billing/account/export/sign-out routes; cancellation/expiration
  never deletes local records.
- Still open (owner/counsel): published postal address + trader identity (no home
  address — required now under EU/consumer trader-identification rules),
  dispute forum (court vs arbitration), EULA choice (Apple Standard EDLA vs
  custom — custom requires a published phone+address), ongoing-subscription-value
  statement, trial-start event, cross-platform entitlement, existing-user trial,
  complimentary-grant revocation. LLC + insurance strongly worth revisiting given
  worldwide health-data processing as an individual.

## 2026-08-19: Two-phase launch — validation config vs store/subscription target

Clarifies the relationship between the two prior 2026-08-19 entries so agents do
not conflate them. See `docs/LAUNCH_PLAN.md` (authoritative).

- **Steps 0–7 (soft-launch validation):** free, US-only, no mandatory login,
  subscription/entitlement/locked-mode code OFF, PWA first. Purpose: measure
  retention at ~$0 legal cost.
- **Step 8 (store/subscription target, only after retention is proven):** the
  worldwide + 18+ + Apple IAP/Google Play billing decisions apply HERE. That is
  when the built subscription code is turned on, stores are configured, and the
  worldwide legal drafts (Terms/Privacy/EU reps/etc.) come into force.
- Storefront/marketing copy (`docs/STOREFRONT_LISTING.md`) is scoped to the
  soft-launch config; reusing it for the app stores must revisit age gating,
  territory, and subscription language.
