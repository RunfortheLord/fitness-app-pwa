# UX Specification

## Design Direction

- Use a dark, card-based interface informed by `docs/VIDEO_UI_ANALYSIS.md`.
- Adapt layout density, bottom sheets, fixed navigation, date controls, compact cards, and live workout ergonomics.
- Do not copy logos, brand names, proprietary illustrations, copyrighted artwork, or exact icon assets from the reference recording.
- First release should feel utilitarian and quick to use, not like a marketing site.

## Global Layout

- Mobile-first and portrait-first.
- No horizontal scrolling in primary screens.
- Use `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` for iPhone chrome, Dynamic Island, and home indicator.
- Fixed bottom navigation contains Home, Nutrition, Add, Training, and Run.
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
  - compact seven-day bar graph for logged calories
  - contrasting daily target line
  - visible spacing between daily bars
- Bodyweight card:
  - current value from the latest timestamped entry or empty state
  - selected-date latest value when available
  - compact, visually secondary trend summary
  - quick Log Bodyweight action
  - Edit Latest action for correcting the selected date's latest entry
  - View Graph route to History
- Training card:
  - current active program
  - selected workout-day entry point
  - start workout action
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
- No workout history: show Start Workout after program setup or Empty Workout if supported later.

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

### Food Rows

- Food name.
- Brand or restaurant when available.
- Serving definition.
- Calories in collapsed search rows.
- Row-level select button for reusable or provider foods.
- Logged rows show multiplier, computed totals, edit action, and delete action.
- Provider duplicate groups show one primary result and a compact More Results
  control for alternates.

### Create/Edit Food Form

- The form opens as a full-height subpage.
- Fields: name, serving quantity, serving unit, calories, protein,
  carbohydrates, and fat. The current form does not collect brand or notes.
- Required fields are marked without excessive copy.
- Numeric fields reject invalid, negative, or nonnumeric values. Calories are
  required; blank optional macros save as zero.
- Save remains available and reports inline validation errors when required
  fields are invalid.
- Editing a reusable food does not rewrite historical log snapshots.
- Imported provider foods are read-only. Users can create a separate private
  custom copy for corrections.

### Log Food Sheet

- Shows selected food and serving definition.
- Selected provider or local food opens a detail sheet with calories, protein,
  total carbohydrates, fat, editable serving amount, and serving unit selector.
- Practical household servings are primary when reliable. Grams, 100 g, and
  mass-ounce options are secondary when a reliable gram weight exists. Fluid
  ounces are not treated as mass ounces.
- Preview displays computed calories and macros.
- Save logs the snapshot to the selected date.
- Icons in the current-search added-items tray are 44-pixel buttons. Selecting
  one reopens that exact food log in the serving editor.

### Barcode Scanner

- The Nutrition camera action opens a compact vertical menu directly below the
  camera button. Its bottom edge forms a semicircle matching the camera action,
  and it contains two large, contrasted circular actions: barcode and AI.
- Scanner opens from the Nutrition screen and requests camera access only after
  user action.
- The scanner shows a visible frame, cancel control, retry path, permission
  denied state, no-camera state, duplicate-scan suppression, and cleanup when
  closed.
- A successful scan opens a food confirmation sheet with product name, brand,
  barcode, serving options, quantity, calories, protein, total carbohydrates,
  fat, and source. It never logs immediately.
- Unknown or incomplete barcode records open the custom-food form with the
  barcode associated locally.

### AI Meal Camera

- The AI action opens a full Nutrition subpage with the rear-facing camera
  preview, capture action, permission/loading/failure states, and retry.
- Without a configured Gemini key, the subpage links to the Gemini integration
  in Settings and does not request camera access.
- Capturing a photo sends a resized JPEG directly to Gemini 3.5 Flash. The app
  validates the structured result before using it.
- While analysis is running, the captured photo is covered by a friendly robot
  calculation animation and clear processing text.
- A successful result opens the existing recipe builder with an editable name,
  estimated ingredient snapshots, assumptions, and a prominent estimate
  warning.
- Estimated ingredients appear as a vertical list. Save as recipe is an
  off-by-default checkmark option. Log food is the primary action; it logs every
  estimated ingredient to the selected date, optionally saves the recipe, and
  exits the subpage.
- When Gemini returns no detected ingredients, the subpage displays "AI failed"
  for approximately three seconds and returns to the page that launched it.
- Leaving before Log food discards the draft.

## Training Screen

### Primary Layout

- Active program card.
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
- Discard Workout action behind confirmation.

### Exercise Workspace

- The live workout shows one active exercise workspace at a time instead of a
  full vertical stack of exercise cards.
- Exercise position is visible as "Exercise N of M".
- Previous and Next buttons are available when another exercise exists.
- The active exercise is restored from local UI state for the active workout
  after reload or route return when possible. If that UI state is unavailable,
  the first exercise is selected without mutating workout data.
- Source prescription summary.
- Previous performance in compact set rows.
- Skip exercise action.
- Replace exercise action.
- Add set action.
- Delete set action.
- Reorder exercise action where practical.

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
- RIR is requested only on the final programmed set. Historical RIR stored on
  other sets remains in data but is not shown in the current live UI.
- Programmed targets appear as compact context. Actual-result inputs are
  prefilled from the source target when available and may be edited by the user.

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
- The app shell monitors timer expiry across all routes, so completion feedback
  fires while the user is viewing Home, Nutrition, Training, Run, or Settings.
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

- Finish Workout saves the historical workout first.
- If structural changes are detected, show a compact checklist.
- Each selected item has a destination selector: active cycle only, template
  only, or both. Unchecked items are saved as not applied.
- User can finish without applying any changes.
- Failed apply operation shows an error and leaves saved workout intact.

## History Screen

- Default view is a date-sorted dense list of completed workouts and completed runs, with one compact row per history item and no expanded detail content.
- Selecting a workout or run row opens that item's detail view.
- Search/filter can be deferred unless needed for usability.
- Workout detail shows local date, source program/day, start and completion times, duration, exercises, sets, skipped exercises, and change review results.
- Run detail shows local date, distance, elapsed time, moving time, average
  moving pace, mile splits, walking/rest classifications, and GPS-gap state.
- Editing is limited to recorded performance values.
- Delete requires confirmation.
- Graphs opens to Bodyweight progress by default and is reachable from Home,
  History query state, and the `/graphs` route.
- Bodyweight graph shows local date/time on the horizontal axis through stored
  entry timestamps and bodyweight in pounds on the vertical axis.
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
  graph placeholders may be deferred when no eligible implementation data is
  available.
- Calories is available from History Graphs with 1W, 1M, and 3M controls.
  Logged calories use separated bars and the daily target uses a contrasting
  line.
- Strength graph range controls are 1M, 3M, 6M, 1Y, and All.
- The chart plots one point per completed workout per exercise, selected from
  the highest eligible Epley estimate in that workout.
- Empty, one-point, tap detail, and accessible text summary states are shown.
- The detail view lists local date, completed weight, repetitions, estimated
  1RM, latest value, and all-time best.

## Run Screen

- The default empty state shows Start Run and states that GPS collection starts
  only after that action.
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
- The native iOS wrapper also exposes an **Enable outside-app timer alerts**
  action and explains that delivery remains controlled by iPhone notification
  and volume settings.
- Nutrition targets are managed from the Nutrition dashboard, not Settings.
- AI meal analysis includes a device-local Gemini API key field, connection
  test, status, replacement, and removal controls. The key is excluded from
  backups. Settings explains that meal photos go directly to Google and that
  free-tier requests may be used by Google to improve its products.
- Backup export.
- CSV export.
- Restore backup.
- Clear all data.
- Cloud backup uses larger vertical spacing between account status, backup
  status, and actions.
- What's new shows the latest update by default. A Show all action opens a
  What's New subpage with all logged updates.
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
- Backup validation failed: show a concise reason and do not modify data.
- Restore transaction failed: show failure and confirm current data was preserved.
- Service worker update failed: continue using current version and allow retry.
- Active workout persistence failed: keep user on screen and retry; do not claim a set was saved if it was not.
