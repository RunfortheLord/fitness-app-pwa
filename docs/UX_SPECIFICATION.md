# UX Specification

## Design Direction

- Use a dark, card-based interface informed by `docs/VIDEO_UI_ANALYSIS.md`.
- Adapt layout density, bottom sheets, fixed navigation, date controls, compact cards, and live workout ergonomics.
- Do not copy logos, brand names, proprietary illustrations, copyrighted artwork, or exact icon assets from the reference recording.
- Use **Vigorune** as the temporary public display name. Do not expose
  compatibility identifiers as branding or rename them as part of visual work.
- First release should feel utilitarian and quick to use, not like a marketing site.

## Global Layout

- Mobile-first and portrait-first.
- No horizontal scrolling in primary screens.
- Use `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` for iPhone chrome, Dynamic Island, and home indicator.
- Fixed bottom navigation contains Home, Nutrition, Add, Training, and Run.
- In its normal state the fixed navigation has no CSS transform and stays
  pinned to the visual viewport while content scrolls. A keyboard translation
  is applied only while a focused text-entry control produces a meaningful
  visual-viewport inset. That translation survives route changes while iOS is
  still closing the keyboard, then resets only after viewport geometry confirms
  that the keyboard-sized inset has closed. A short geometry poll handles iOS
  versions that omit the final VisualViewport resize event.
- The center Add button is visually prominent, circular, and raised above the tab bar.
- Main content scrolls behind fixed header and nav only when padding prevents occlusion.
- Header contains current screen title plus contextual secondary actions.
  History, Graphs, Bodyweight, and Settings are reachable from Home.

## Visual System

- Background: near black.
- Card surfaces: dark charcoal with subtle elevation or border.
- Raised sheets: slightly lighter charcoal with top radius and grab handle.
- Inputs: muted charcoal fill with clear focus state.
- Primary action: high-contrast light button with dark text.
- Secondary action: muted filled or outlined button.
- Destructive action: red accent.
- Selected state: restrained accent such as purple or blue.
- Minimum touch target: 44 by 44 CSS pixels.
- Typography hierarchy:
  - Screen title: compact semibold.
  - Section title: bold and scannable.
  - Card title: semibold.
  - Metadata: muted and smaller.
  - Numeric totals: larger than labels but not decorative.

## Home Screen

### Cards and Controls

- Header: selected date, previous-day button, next-day button, return-to-today action, Settings access.
- Calorie history card:
  - compact bar graph for logged calories
  - contrasting daily target line
  - visible spacing between daily bars
  - 1W and 1M range control
  - View more action to a dedicated calorie details subpage
- Bodyweight card:
  - current value from the latest timestamped entry or empty state
  - selected-date latest value when available
  - compact, visually secondary trend summary
  - quick Log Bodyweight action
  - Edit Latest action for correcting the selected date's latest entry
  - View Graph route to History
- Training card:
  - current active program
  - next unchecked workout day by name
  - direct start action for that named day
  - resume workout action when an active workout exists
- Compact header actions:
  - View all history
  - Graphs
  - Bodyweight progress
- Home does not show workout history or recent activity as dashboard cards.

### Empty States

- No nutrition target: prompt to set targets in Settings.
- No foods logged: show Log Food quick action.
- No bodyweight: show Log Bodyweight action and explain that a second entry is
  needed before trend change is shown.
- Tapping the compact Home bodyweight summary opens bodyweight logging.
- Bodyweight logging includes a native date picker, defaults to the selected
  date (today on normal entry), and supports past dates.
- No active program: show Create Program and Activate Program actions.
- No workout history: show Start Workout after program setup. Empty ad hoc
  workouts are deferred beyond Version 1.

## Nutrition Screen

### Primary Layout

- Date selector at top.
- Daily total card with calories and macros.
- Prominent barcode scanner entry near the top of Nutrition.
- Search input for recent, custom, previously used, and provider foods.
- English remote provider search waits for at least three normalized
  characters, debounces requests, and uses USDA. Spanish remote search requires
  an explicit keyboard or on-screen Search action, uses Open Food Facts, and
  prefers provider-supplied Spanish product and category fields.
- Results are sectioned in priority order: strict saved recipe match, recent
  and previously used foods, private custom foods, previously used provider
  foods, then provider results. Typo-only recipe queries do not create the
  recipe section.
- Provider loading, offline, timeout, unavailable, rate-limit, server
  configuration, and unexpected-error states are distinct from no acceptable
  results.
- Recent foods list in the Foods tab when no search is active.
- Logged foods grouped for the selected date.
- Create Food action reachable from header, empty state, and Add sheet.

### Set Goal

- Step one collects current and desired weight, height, age, sex, and activity
  outside exercise. Activity choices include Sedentary, Lightly active,
  Moderately active, and Heavily active.
- Step two is headed `Goal Type:` and derives Maintenance, Bulking, or Cutting
  from desired weight compared with current weight.
- Cutting uses a 0.25% to 1% bodyweight-per-week slider starting at the marked
  0.5% recommendation. Bulking uses 0.1% to 0.5%, starting at the marked 0.25%
  recommendation. The recommendation marker stays fixed while the thumb moves.
- The selected weekly rate and estimated goal date update live. Maintenance
  shows an ongoing goal with zero weekly change and no slider.
- Done saves the goal and calorie/macro targets, then returns to Targets.
- The Nutrition targets card shows Estimated maintenance immediately below its
  heading and above the calorie target when a saved goal contains a valid
  maintenance estimate. The row is omitted when no estimate is available.
- Goal progress offers a manual Update Calories action after enough recent
  weigh-in and logged-calorie history exists. It sets a whole-calorie target
  from a recency-weighted blend of responsive 28-day and stabilizing 90-day
  maintenance estimates, the desired weight, and the selected weekly rate.
  Longer consistent history progressively stabilizes the result without
  outweighing recent behavior. The result reports developing, moderate, or
  strong estimate confidence. Reaching the desired weight switches the update
  to estimated maintenance.

### Food Rows

- Food name.
- Brand or restaurant when available.
- Serving definition.
- Calories in collapsed search rows.
- When a local food has a remembered portion, the row labels it `Last used`
  and calculates calories from that same portion. The row and its one-tap log
  action must never describe a different amount than they log.
- Row-level select button for reusable or provider foods.
- Logged rows show the resolved amount in the snapshot serving unit, computed
  totals, edit action, and delete action. Raw serving multipliers are not
  user-facing.
- Provider duplicate groups show one primary result and a compact More Results
  control for alternates.

### Create/Edit Food Form

- The form opens as a full-height subpage.
- The subpage visually groups the food name, serving definition, and nutrition
  values into a numbered, serving-first flow. Its presentation must remain
  separate from the recipe-building subpage.
- Fields: name, serving quantity, serving unit, calories, protein,
  carbohydrates, and fat. The current form does not collect brand or notes.
- Serving amount and unit are grouped as `Serving size`, with a live sentence
  explaining exactly which portion the nutrition values describe. New foods
  start at an amount of one, while the unit remains explicit.
- Required fields are marked without excessive copy.
- Numeric fields reject invalid, negative, or nonnumeric values. Calories are
  required; blank optional macros save as zero.
- Save remains available and reports inline validation errors when required
  fields are invalid. Required-field alerts do not appear before the first save
  attempt.
- Editing a reusable food does not rewrite historical log snapshots.
- Imported provider foods are read-only. Users can create a separate private
  custom copy for corrections.

### Log Food Sheet

- Separates the fixed nutrition `Serving size` from `Your portion`, the amount
  being logged now.
- Selected provider or local food opens a detail sheet with calories, protein,
  total carbohydrates, fat, editable serving amount, and serving unit selector.
- Practical household servings are primary when reliable. Grams and mass
  ounces are secondary only when a reliable gram weight exists; 100 g is a
  quick gram portion rather than a duplicate unit. Fluid ounces are not treated
  as mass ounces.
- The amount field has 44-pixel decrement/increment controls and four compact,
  unit-aware quick portions. Switching units preserves the equivalent nutrition
  amount instead of resetting the portion.
- The most recently logged portion is synchronously preselected and honestly
  labeled `Last used`; logging replaces that last-used value. Provider-only
  household units that are unavailable after import preserve their exact gram
  equivalent. A `Use serving size` action restores the food's reference portion.
- Invalid nonblank amounts receive an inline accessible error. The live preview
  labels any reliable converted gram weight as the portion weight.
- Preview displays computed calories and macros.
- Save logs the snapshot to the selected date.
- Icons in the current-search added-items tray are 44-pixel buttons. Selecting
  one reopens that exact food log in the serving editor.

### Barcode Scanner

- The Nutrition camera action opens a compact vertical menu directly below the
  camera button. It stays within the viewport and uses two clearly labeled,
  44-pixel-or-larger actions for barcode scanning and AI meal-photo analysis.
- The camera trigger and menu items animate open with a short restrained
  transition, while reduced-motion users receive the same menu without the
  animation.
- Scrolling or pressing outside the open camera menu does not dismiss it. The
  camera toggle and Escape can dismiss it explicitly, and navigating away
  resets it before the user returns.
- Scanner opens as a focused Nutrition subpage. Its first visit requests camera
  access only after the user chooses Enable camera. After a successful start, a
  device-local preference may start scanning on later visits unless browser or
  operating-system permission was revoked.
- The scanner shows a Back control, visible frame, privacy note, retry path,
  permission-denied state, no-camera state, duplicate-scan suppression, and
  cleanup when the subpage is left.
- A successful scan opens a food confirmation sheet with product name, brand,
  barcode, serving options, quantity, calories, protein, total carbohydrates,
  fat, and source. It never logs immediately.
- Unknown or incomplete barcode records open the custom-food form with the
  barcode associated locally.

### AI Meal Camera

- The AI action opens a full Nutrition subpage with the rear-facing camera
  preview, capture action, photo-library import action,
  permission/loading/failure states, and retry.
- One to three captured or imported images are resized and compressed before a
  bounded request to the same-origin meal-analysis route. The OpenAI credential
  stays server-only. The app validates the structured result before using it.
- While analysis is running, the captured photo is covered by a friendly robot
  calculation animation and clear processing text.
- A successful result opens the existing recipe builder with an editable name,
  estimated ingredient snapshots, assumptions, and clear estimate context.
- The builder leads with a prominent total formatted as "Calories: XX".
  Estimated ingredients appear as tappable, food-style rows in a vertical list.
  Each row shows its current serving and macro summary; opening it provides the
  detected serving amount, detailed macros, serving controls, and a live
  preview. The existing food search remains available for adding ingredients.
- Save as recipe is an off-by-default checkmark option. Log food is the primary
  action; it logs every estimated ingredient to the selected date, optionally
  saves the recipe, and exits the subpage.
- When analysis returns no detected ingredients, the subpage displays "AI failed"
  for approximately three seconds and returns to the page that launched it.
- Leaving before Log food discards the draft.

## Training Screen

### Primary Layout

- The route title is Current Program. The active program card begins with the
  program name instead of repeating a Current Program section heading.
- Active program card.
- The active card's 44 px-tall native week selector lists every week as
  `Week N` or sequential `Deload N` (numbered by deload occurrence, not calendar
  week). Selecting another week immediately restores its own checked-day state.
  Closing the native selector clears touch focus without leaving a lingering
  highlight.
- Each active program day is one full-width row containing the weekly check,
  flexible day name and exercise count, and Start Workout action. Long day
  names wrap within their middle column without widening the page.
- Program library cards.
- Exercise library entry point.
- Create Program and Create Exercise actions.
- Resume active workout banner when applicable.

### Exercise Library

- Searchable list of active exercises.
- Filter by tracking preset where practical.
- Archived exercises are hidden by default but reachable through a filter.
- Exercise detail shows notes, default rest time, tracking method, created/updated timestamps, and archive status.

### Create/Edit Exercise

- Required name.
- Optional notes.
- Default rest time in seconds.
- Tracking preset selector.
- Archive action when referenced by history or programs.
- Hard delete only when no references exist, with confirmation.

## Program Template Screens

### Program Library

- Compact cards with program name, workout-day count, active status when applicable, and overflow actions.
- Template detail contains ordered workout days.
- No weekday schedule is shown or implied.

### Program Builder

- Program name and notes.
- Program length. Program settings contains a disabled-by-default Schedule
  deload weeks toggle. Enabling it reveals a compact horizontal-only week
  scroller in the editor; week 1 is selected initially and may be changed.
  Weeks are selection buttons, not reorderable items. The active cycle's
  current-week field is not shown in the editor; week navigation belongs on the
  active program card.
- Ordered workout day cards.
- Add Day action.
- Workout day editor with name, notes, and ordered prescribed exercises.
- Prescribed exercise card shows exercise name, target sets, optional reps/range, optional RIR, optional rest override, and notes.
- Exercise options bottom sheet includes edit prescription, replace, move, duplicate, remove, and notes.

### Activation

- Activate Program action explains that an independent active cycle will be created.
- If another active cycle exists, confirmation explains replacement or archiving behavior according to implementation decision.

## Active Workout Screen

### Header

- Workout name.
- Elapsed duration.
- Finish action.
- Compact Discard action behind confirmation.

### Exercise Workspace

- The live workout shows one active exercise workspace at a time instead of a
  full vertical stack of exercise cards.
- Exercise position is visible as "Exercise N of M".
- Horizontal swiping moves to the adjacent exercise; dedicated Previous and
  Next buttons are not shown.
- Skipping an exercise or completing its final incomplete set advances to the
  adjacent next exercise when one exists. Manually swiping back to an
  already-completed exercise does not trigger another automatic advance.
- The active exercise is restored from local UI state for the active workout
  after reload or route return when possible. If that UI state is unavailable,
  the first exercise is selected without mutating workout data.
- The source prescription summary is removed from beside the live exercise
  name. The compact exercise-options sheet presents the current workout target
  as its title and allows editing set count and rep range for this workout only.
  Increasing the count creates blank sets; decreasing it removes only
  uncompleted sets and never deletes completed work.
- Previous performance in compact set rows.
- Skip and replace exercise actions remain available in the compact
  exercise-options sheet opened beside the notes control.
- Add set action.
- Delete set action.
- A compact notepad button sits on the same row as the current exercise name.
  Tapping it opens session exercise notes in a sheet; saving never changes the
  source program prescription.
- The live workout locks the outer page to the stable document viewport rather
  than the keyboard-sensitive dynamic viewport. When all sets
  cannot fit on a small phone, only the set list scrolls internally so the
  exercise header, add-set control, exercise actions, navigator, and session
  controls remain stable.
- Horizontal exercise swipes transform only the exercise header and set list.
  Add Set, exercise actions, the session bar, and bottom navigation never move
  with the swipe. The session bar sits one standard action-grid gap below the
  exercise actions.
- Add Set occupies a fixed full-width row above the fixed Add Exercise and
  Remove Exercise row. Set rows keep a constant height when an added fourth set
  makes the internal list scrollable.
- The fixed session row shows the active rest countdown followed immediately by
  30-second subtract and add controls, then Discard and Finish. It does not show
  the total workout duration or open a separate rest-timer settings sheet.
- Entering or resuming a live workout resets stale keyboard viewport
  compensation. The bottom navigation uses the same viewport-bottom and safe-
  area baseline as Home, Nutrition, and the other dashboard routes.
- Closing a live-workout numeric keypad re-anchors the locked document on the
  next animation frame. The live shell remains full-height while the keypad
  opens and closes. If iOS leaves a residual visual-viewport top offset, the
  live layout compensates until a later viewport event restores baseline.
- Exercise Options opens as a full-height subpage and shows the total workout
  duration and its pause/resume action, plus the current exercise's
  rest-duration wheels. The wheels initially show the workout prescription's
  rest override when one exists. Wheel changes have no Save or Cancel step:
  they restart any current rest countdown at the selected time, reschedule its
  optional completion alert, and become the duration used after later sets for
  that exercise. Rest pause/resume and clear actions also remain available in
  Exercise Options.
- Reorder exercise action where practical.
- Horizontal exercise-tab reordering follows the dragged card's center and uses
  a generous midpoint margin so adjacent drop positions do not switch from
  small movements. Slow edge scrolling is limited to the outer edge of the
  horizontal strip, and that strip does not scroll-snap while positioning
  exercises. Moving an exercise to the first position therefore does not
  require a precise fingertip drop, oscillate, or scroll the workout page.
- The live workout exercise navigator has no visible surrounding card or
  heading; only the horizontal exercise tabs are shown. The row retains an
  accessible "Exercises" region label.
- The navigator shows quiet edge fades only when more tabs exist in that
  direction. Selecting or automatically advancing an exercise brings its tab
  fully into view without interrupting an active drag. Dragged tabs lift only
  along the horizontal axis and settle quickly after release.
- Swiping the exercise-name portion scrolls the horizontal navigator without
  starting a reorder. A horizontal swipe that begins over the dedicated 44 px
  grip also scrolls immediately; holding that grip activates reordering. This
  preserves one-attempt touch navigation and accessible keyboard sorting.
- Completing a set uses brief color and checkmark feedback without moving the
  row. Rest-timer digits transition independently, with a restrained final-five
  second pulse. Reduced-motion preferences replace these effects with immediate
  state changes.

### Set Rows

- Set rows are compact rows inside the active exercise workspace, not separate
  large cards.
- Weight + reps: set number, previous, target weight/reps when present, actual
  weight, actual reps, final-programmed-set RIR, complete.
- Bodyweight + reps and reps only: set number, previous, target reps when
  present, actual reps, final-programmed-set RIR when applicable, complete.
- Assisted weight + reps: set number, previous, target assistance/reps when
  present, actual assistance, actual reps, final-programmed-set RIR, complete.
  Assistance is displayed as assistance, not added load.
- Added weight + reps: set number, previous, target added weight/reps when
  present, actual external added weight, actual reps, final-programmed-set RIR,
  complete.
- Duration: set number, previous, target duration when present, actual duration,
  complete.
- Distance + duration: set number, previous, target distance/duration when
  present, actual distance and duration, complete.
- Exercises that record repetitions per side label rep targets and actual rep
  fields as per-side values. Stored rep counts remain the canonical entered
  per-side value and are not doubled.
- RIR tracking defaults off. When enabled, RIR is requested only on the final
  programmed set unless the program tracks it on every set. Historical RIR
  remains stored when tracking is disabled.
- Programmed targets appear as compact context. With no usable exercise history,
  actual reps and load stay blank. Recorded history is the default autofill and
  copies corresponding completed set values. Opt-in Smart progression estimates
  an editable whole-set sequence so later sets reflect prior-session fatigue;
  RIR affects the estimate only when RIR tracking is enabled.
- A scheduled deload snapshots one fewer set per exercise and target RIR +3
  (capped at 10). It uses comparable non-deload history for editable estimates,
  never Smart progression. The reusable prescription is unchanged.

### Rest Timer

- Appears after completing a set when rest is configured.
- Uses a legacy set or prescription rest override when one exists in the active
  workout snapshot; otherwise uses the exercise default rest duration.
- Shows remaining time calculated from start timestamp and duration.
- Controls: pause/resume, add 30 seconds, subtract 30 seconds without going
  negative, stop, and clear.
- On resume from background, recalculates remaining time instead of trusting an interval count.
- Timer state is stored on the active workout and continues while navigating
  between exercises or returning to the workout route.
- Scrollable rest-duration wheels list seconds in five-second increments.
- The app shell monitors timer expiry across all routes, so completion feedback
  fires while the user is viewing Home, Nutrition, Training, Run, or Settings.
  - Live workouts never show an outside-app timer-alert reminder or status
    banner. Notification setup and delivery status remain in Settings so they
    cannot cover or interrupt set entry.
- Completion feedback uses UI status, vibration when supported, a short audible
  tone when browser autoplay policy allows it, and browser notifications only
  when permission has already been granted. The app does not repeatedly request
  notification permission and does not claim alerts work while the browser or
  installed PWA is fully suspended. Foreground completion uses a transient
  audio-session hint so other audio may keep playing or briefly duck; previews
  use media playback so users can hear the selected sound. Calls, Silent Mode,
  and browser suspension may still suppress playback.
- In the native iOS wrapper, starting a rest timer requests notification
  permission in context when needed and schedules a time-sensitive local
  notification. Pause, resume, adjustment, dismissal, discard, and finish
  replace or cancel the pending notification.
- In an installed iPhone Home Screen PWA, Settings exposes **Enable outside-app
  timer alerts** when Web Push is supported. The copy states that internet
  access and iPhone notification sounds are required. Timer changes replace or
  cancel the pending server-delayed notification.
- Checking a completed set must not start or pause media merely to prime the
  later timer sound. Foreground completion uses transient audio; outside-app
  completion uses one standard iPhone notification.
- When outside-app alerts are scheduled, the same system notification is also
  used while the PWA is visible and the app does not play a second HTML-media
  chime.
- When outside-app alerts are not scheduled and the installed iPhone PWA is
  visibly open, the app shell may play the bundled foreground chime after
  navigation away from the live workout screen.
- On Web Push-capable installed iPhone PWAs, Settings identifies the alert as
  the default iPhone notification sound and does not present bundled sound
  selection or preview controls.

## Completion and Change Review

- Finish Workout waits for pending live edits, then saves the historical
  workout first.
- The confirmation includes one "Save all live workout changes to my program"
  checkbox. It is always available and unchecked every time the confirmation
  opens so changes that finish persisting after the dialog opens can still be
  applied deliberately.
- Leaving the checkbox unchecked saves the completed workout but rejects all
  detected program changes, preserving the source cycle and template.
- Checking it applies every detected structural change and progression
  recommendation to both available program sources in one transaction.
- Failed apply operation shows an error and leaves saved workout intact.

## History Screen

- The History list offers Most recent and By program controls. Most recent is a
  date-sorted dense list of completed workouts and completed runs. By program
  shows program summary rows and opens a program subpage containing its workout
  rows. Both paths open the same complete workout detail.
- The selected organization and program drilldown persist in local settings.
- Selecting a workout or run row opens that item's detail view.
- History search/filter is deferred beyond Version 1 unless a binding
  requirement is added.
- Workout detail shows local date, source program/day, start and completion times, duration, exercises, sets, skipped exercises, and change review results.
- Run detail shows local date, distance, elapsed time, moving time, average
  moving pace, mile splits, walking/rest classifications, and GPS-gap state.
- Completed workout and run details are read-only after saving.
- Delete is available from list selection only, requires confirmation, and
  permanently removes the selected history day.
- Graphs opens to Bodyweight progress by default and is reachable from Home,
  History query state, and the `/graphs` route.
- Bodyweight graph shows local date/time on the horizontal axis through stored
  entry timestamps and bodyweight in pounds on the vertical axis.
- Horizontal-axis date ticks occupy their own row above the Date label so the
  last month/day never overlaps the axis title on narrow screens.
- Range controls: 1M, 3M, 6M, and All.
- Empty state explains that Home logging creates graph data.
- One-point state shows the point, current value, and a non-misleading message
  that more data is needed for a trend line.
- Same-day entries are plotted as separate points by timestamp. The graph never
  averages or removes same-day source records for visualization.
- Point controls are keyboard and tap accessible and expose selected entry
  details.
- Summary text includes first value, latest value, net change, and date range
  when enough data exists.
- Additional graph categories are reachable from History and Graphs. Strength
  graphs show the specified empty state when no eligible implementation data is
  available; placeholders are not a release substitute.
- Calories is available from History Graphs with 1W, 1M, and 3M controls.
  Logged calories use separated bars and the daily target uses a contrasting
  line.
- The calorie details subpage uses the same 1W, 1M, and 3M ranges and displays
  logging consistency, average intake, average target, and the average calorie
  surplus or deficit versus the applicable target. Consistency is explicitly
  labeled as days with positive calories logged, not target adherence. An exact
  zero average difference is shown as on target, and comparison averages are
  unavailable when no positive logged day also has a positive target.
- Strength graph range controls are 1M, 3M, 6M, 1Y, and All.
- Strength graph metric controls are Estimated 1RM and Total volume.
- Both strength metrics exclude workouts snapshotted as scheduled deloads.
- Estimated 1RM plots one point per completed workout per exercise, selected
  from the highest eligible Epley estimate in that workout.
- Total volume plots one point per completed workout per exercise by summing
  `weight × repetitions` across all completed sets for that exercise.
- Empty, one-point, tap detail, and accessible text summary states are shown.
- The detail view lists local date and metric-specific values. Estimated 1RM
  shows the source set; Total volume shows completed set count. Both metrics
  include latest value and all-time best in the accessible summary.

## Run Screen

- The default empty state shows Start Run and states that GPS collection starts
  only after that action.
- If a lifting workout is active, the Run screen replaces its outdoor,
  treadmill, and manual start actions with one Finish current workout action
  that returns to the live workout.
- Active run metrics show elapsed time, moving time, distance, current pace, and
  average moving pace in large, tap-readable cards.
- Primary controls are Start Run, Pause, Resume, and Finish. Finish requires a
  confirmation dialog.
- Mile splits are shown as a list after each completed mile.
- Paused, GPS-error, and GPS-gap states use text labels/status messages, not
  color alone.
- The low-pace prompt asks whether the user is walking, resting, or continuing,
  and offers Pause. The prompt records classification separately from GPS
  samples.
- The screen documents foreground tracking support and states that installed
  PWAs or browsers may suspend geolocation while backgrounded.

## Settings Screen

- Preferences include English/Spanish interface language, timer completion
  sound on/off, sound selection, selected-state display, and one-shot preview.
- Preferences include a persistent, default-off RIR switch and a persistent
  Workout set autofill selector. Recorded history is the default; Smart
  progression is opt-in.
- The native iOS wrapper also exposes an **Enable outside-app timer alerts**
  action and explains that delivery remains controlled by iPhone notification
  and volume settings.
- Nutrition targets are managed from the Nutrition dashboard, not Settings.
- Settings explains that OpenAI meal analysis uses a server-only deployment
  credential and that estimates require explicit review. No provider-key field
  or connection test is exposed on the device.
- Backup export.
- CSV export.
- Restore backup.
- Clear all data.
- Account and cloud controls clearly state that sign-in is optional and offer
  Google and Apple when configured. They include sign out, delete cloud data,
  and Delete account actions.
- Delete cloud data and Delete account require destructive confirmation and do
  not silently clear IndexedDB. Clear all data remains a separate local action.
- Cloud backup uses larger vertical spacing between account status, backup
  status, and actions.
- What's new shows the latest update by default. A Show all action opens a
  What's New subpage with all logged updates.
- The app-wide What's New banner remains visible until the user explicitly
  opens it or dismisses it. Loading an active workout or merely visiting
  Settings does not mark the update as seen.
- App version and update status.
- Data schema version.

## Bottom Sheets

- Used for quick actions, log food, bodyweight entry, exercise options, set edit actions, rest timer controls, run low-pace classification, detected-change destination selection, and destructive confirmations.
- Include grab handle, close control, title, and safe-area bottom padding.
- Avoid nested sheets deeper than one level unless replacing the current sheet.

## Validation States

- Required text fields show inline error after blur or submit.
- Numeric fields show unit, accepted range, and clear error message.
- Duplicate food, exercise, or program names may be allowed but should warn if confusing.
- Save buttons either disable while required data is missing or remain
  available and surface inline validation errors on submit.
- Destructive actions require explicit confirmation.

## Error States

- IndexedDB unavailable: show blocking local storage error and explain that the app cannot safely store data.
- Backup restore validation failed: show a concise reason and do not modify
  data. Fitness data export validation warnings do not block the download; the
  archive includes the raw backup and an `EXPORT_WARNINGS.txt` report.
- Restore transaction failed: show failure and confirm current data was preserved.
- Service worker update failed: continue using current version and allow retry.
- Active workout persistence failed: keep user on screen and retry; do not claim a set was saved if it was not.
