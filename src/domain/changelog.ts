export type ChangelogEntry = {
  /** Stable id used to remember which update the user has already seen. */
  id: string
  date: string
  title: string
  items: string[]
}

// Newest first. Add a new entry (with a fresh id) whenever a shipped update
// introduces something worth surfacing in-app.
export const CHANGELOG: ChangelogEntry[] = [
  {
    id: '2026-08-21-keyboard-navigation-anchor',
    date: '2026-08-21',
    title: 'Bottom navigation stays anchored after typing',
    items: [
      'Dismissing the numeric keypad during a live workout no longer leaves the workout controls or bottom navigation shifted upward.',
      'History, Nutrition, and other dashboard screens now wait for the iPhone keyboard viewport to fully recover before re-anchoring the bottom navigation.',
    ],
  },
  {
    id: '2026-08-21-live-workout-exercise-and-timer-fixes',
    date: '2026-08-21',
    title: 'Live workout swaps and timers are more reliable',
    items: [
      'Changing a running rest duration now keeps the time already elapsed instead of restarting the countdown.',
      'Unchecking a completed set now leaves the current rest timer running until another set is completed.',
      'Exercises added during a live workout now open with a usable set immediately.',
      'Swapping to an exercise you have completed before restores its prior set count and recorded values for editing.',
      'History returns to all programs after you exit a workout detail, and navigation labels no longer become selected during taps.',
    ],
  },
  {
    id: '2026-08-17-maintenance-and-powerbuilding-program',
    date: '2026-08-17',
    title: 'Targets and programs are clearer',
    items: [
      'Nutrition Targets now shows your estimated maintenance above the calorie target when a saved goal provides one.',
      'Browse Programs now includes Bodybuilding-Biased Powerbuilding with five training days and two rest days.',
    ],
  },
  {
    id: '2026-08-13-workout-preferences-and-export',
    date: '2026-08-13',
    title: 'Workout defaults are in your control',
    items: [
      'RIR tracking now starts off by default, and your choice stays saved after closing or restarting the app.',
      'Workout set autofill defaults to copying recorded history. You can opt into Smart progression for editable estimates that account for earlier-set fatigue and, when enabled, RIR.',
      'Export all fitness data now keeps the download available when older records need a validation warning, with the details included inside the ZIP.',
    ],
  },
  {
    id: '2026-08-13-live-workout-responsiveness',
    date: '2026-08-13',
    title: 'Live workout edits respond faster',
    items: [
      'New sets appear as soon as they are saved, including on exercises added during the workout, and the first set can reuse estimated weight and reps from exercise history.',
      'Exercise Options now opens as a full subpage, and its rest wheel starts from the rest duration saved in the workout editor.',
      'Finishing a workout batches local history writes and checks exercise recommendations together to reduce occasional delays.',
    ],
  },
  {
    id: '2026-08-05-live-workout-keypad-recovery',
    date: '2026-08-05',
    title: 'Workout keypad closes cleanly',
    items: [
      'After entering weight, reps, or RIR, closing the iPhone keypad now returns the live workout and bottom navigation to their normal screen position.',
    ],
  },
  {
    id: '2026-08-05-fast-workout-discard',
    date: '2026-08-05',
    title: 'Workout discard is immediate',
    items: [
      'Discard returns to Training as soon as the local workout deletion finishes instead of waiting for optional timer-notification work.',
      'Timer notification cleanup continues safely in the background after the discarded workout is gone.',
    ],
  },
  {
    id: '2026-08-05-silent-automatic-cloud-backup-retries',
    date: '2026-08-05',
    title: 'Cloud backup retries quietly',
    items: [
      'Automatic cloud-backup failures and existing-snapshot conflicts no longer place warning messages on Home.',
      'Automatic backup keeps retrying silently, and manual backup controls remain available in Settings.',
    ],
  },
  {
    id: '2026-08-05-update-banner-and-live-nav-anchor',
    date: '2026-08-05',
    title: 'Updates stay visible and navigation stays anchored',
    items: [
      'The What’s New banner now stays visible until you open or dismiss it, including when an active workout is restored.',
      'Live Workout keeps the bottom navigation anchored while the iPhone keyboard and visual viewport finish closing during a route change.',
    ],
  },
  {
    id: '2026-08-05-consolidated-rest-timer-controls',
    date: '2026-08-05',
    title: 'Rest controls use less workout space',
    items: [
      'The bottom workout row now shows the rest countdown with 30-second minus and plus controls beside Discard and Finish.',
      'Total workout time and rest-duration wheels now live in Exercise Options instead of a separate timer popup.',
      'Rest-duration changes apply immediately to the current countdown and future sets without Save or Cancel buttons.',
      'Live Workout now resets stale iPhone keyboard positioning so bottom navigation stays on the same baseline as the other dashboards.',
    ],
  },
  {
    id: '2026-08-04-live-layout-and-nav-recovery',
    date: '2026-08-04',
    title: 'Tighter live workout layout',
    items: [
      'Add Set now sits above the Add Exercise and Remove Exercise row.',
      'Exercise Options can be dismissed by swiping the sheet down, while the workout behind it stays fully blocked.',
      'Bottom navigation now clears stale iPhone keyboard positioning after app resume and missing viewport events.',
    ],
  },
  {
    id: '2026-08-04-live-exercise-options',
    date: '2026-08-04',
    title: 'Cleaner live exercise controls',
    items: [
      'Set and rep targets now live in the exercise options sheet, where they can be edited for the current workout without changing the program.',
      'Swap and Skip stay available from the three-dot menu while Add Exercise, Remove Exercise, and Add Set use a simpler fixed layout.',
      'Set rows keep the same height when adding a fourth set.',
    ],
  },
  {
    id: '2026-08-04-fixed-workout-controls-and-autofill',
    date: '2026-08-04',
    title: 'Workout controls stay put',
    items: [
      'Only the set rows scroll; Add Set, exercise actions, workout controls, and bottom navigation stay fixed.',
      'Set deletion and rest-timer cleanup no longer surface stale not-found errors.',
      'Auto-filled sets follow a changing fatigue sequence instead of repeating identical consecutive values.',
      'Generated 1.5-Rep exercise variants have been removed from the active exercise library.',
    ],
  },
  {
    id: '2026-08-04-live-workout-and-food-polish',
    date: '2026-08-04',
    title: 'More room to log workouts and food',
    items: [
      'Live workouts use the full page width, keep the set list visible, show the set-and-rep target beside the exercise name, and place pause beside elapsed time.',
      'Set edits finish saving before a set or exercise is removed, preventing stale “workout set not found” errors.',
      'The timer-settings reminder stays dismissed for the rest of the current workout after you close it once.',
      'Create Food has a clearer serving-first layout, and the Nutrition camera menu opens with a smoother animation.',
      'App updates install automatically; after reopening, this What’s New banner summarizes the new version.',
    ],
  },
  {
    id: '2026-08-03-paid-use-reliability',
    date: '2026-08-03',
    title: 'Safer workouts, backups, and scanning',
    items: [
      'New workouts leave reps and weight blank until you have exercise history, then estimate the whole set sequence from your rep range, RIR, and normal fatigue across later sets.',
      'Workout timers keep running during brief backgrounding, then pause when the app closes or after 15 minutes without input, with one-tap pause and resume in the header.',
      'Long workouts show hours, and paused time is excluded from completed workout duration.',
      'Cloud backups run less often, explain failures more clearly, and can be permanently deleted without removing local data.',
      'Cloud backup warnings stay on Home instead of following you through the app.',
      'Barcode scanning now has a focused camera screen, remembers a successful camera permission on this device, and returns to Nutrition cleanly.',
      'During a workout, the notes button sits beside the exercise name and only the set list scrolls when it grows.',
      'Closing exercise notes keeps the workout screen and bottom navigation fixed in place.',
    ],
  },
  {
    id: '2026-07-30-adaptive-calorie-history',
    date: '2026-07-30',
    title: 'Calorie estimates learn from more history',
    items: [
      'Update Calories now blends a responsive four-week estimate with up to three months of recency-weighted calorie and weigh-in history.',
      'Consistent long-term logging progressively stabilizes the estimate without allowing older behavior to overpower recent changes.',
      'Each update reports developing, moderate, or strong estimate confidence based on the amount and span of supporting history.',
    ],
  },
  {
    id: '2026-07-30-precise-calorie-updates',
    date: '2026-07-30',
    title: 'More precise calorie updates',
    items: [
      'Update Calories now uses recent logged intake, the bodyweight trend, your desired weight, and your selected weekly rate to set a whole-calorie target directly instead of moving in coarse repeated steps.',
      'Once trend weight reaches your desired weight, the same button estimates maintenance calories instead of continuing the previous deficit or surplus.',
    ],
  },
  {
    id: '2026-07-19-calorie-insights-and-workout-polish',
    date: '2026-07-19',
    title: 'Calorie insights and smoother logging',
    items: [
      'Switch the Home calorie graph between one week and one month, then open View more for three-month history, logging consistency, and average calories versus target.',
      "Restaurant foods keep their listed item or count serving; the Chick-fil-A Chicken Sandwich and six-piece McDonald's Chicken McNuggets now use reviewed official U.S. menu nutrition.",
      'The bodyweight graph now includes a trend line, skipped workout exercises no longer block finishing, and exact recipe searches ignore word order.',
    ],
  },
  {
    id: '2026-07-11-dashboard-food-and-data-export',
    date: '2026-07-11',
    title: 'Faster dashboards and cleaner logging',
    items: [
      'Home now returns with its data already in place instead of flashing empty cards.',
      'The Home workout action names and starts the next day in your current program.',
      'Food details now focus on serving, meal, live nutrition, and one Log food action; less-used tools sit under More options.',
      'Export all fitness data creates a spreadsheet-ready archive covering nutrition, weight, programs, workouts, exercises, and runs.',
      'The Finish workout program-save option remains available while late live edits finish saving.',
    ],
  },
  {
    id: '2026-07-05-rir-controls-and-program-editing',
    date: '2026-07-05',
    title: 'RIR your way and simpler program editing',
    items: [
      'Record RIR (reps in reserve) on any set during a workout — not just the last one.',
      'Prefer not to use RIR? Turn it off in Settings and RIR fields disappear from workouts and prescriptions. Your recorded history is kept.',
      'A prescription’s target RIR now clearly applies to the exercise’s last set only, and the weight-target field is gone — log the weight you actually lift during the workout.',
      'Want RIR on every set of a program? Turn on “Track RIR on every set?” when editing that program.',
      'Reorder workout days by dragging their tabs; the old Up, Down, and Duplicate buttons are gone for a cleaner day header.',
      'The prescription editor is tidier: one back button, the RIR target sits next to Sets, and redundant rest text is gone.',
    ],
  },
  {
    id: '2026-07-04-live-workout-and-week-checkoffs',
    date: '2026-07-04',
    title: 'Live workout polish and check-off weeks',
    items: [
      'Added sets now start from your previous set’s weight and reps and keep updating live until you edit them.',
      'Reorder exercises mid-workout with the new Move Earlier / Move Later buttons.',
      'Tapping the Final RIR field selects the existing number, so typing replaces it instead of appending.',
      'Program weeks now advance when you check off every workout day — not on a calendar timer. Checked-off day cards dim, then all reset when the new week starts.',
      'The + button on Recent foods and Favorites logs the food immediately at its usual serving.',
      'The daily nutrition card now leads with calories remaining, with calories eaten below.',
    ],
  },
  {
    id: '2026-07-02-ai-meal-photo-context',
    date: '2026-07-02',
    title: 'Smarter AI meal scans',
    items: [
      'Review your meal photo before analyzing and add optional details — portion sizes, hidden ingredients, cooking fats — that the AI trusts over visual guesses.',
      'Capture up to three photos of the same meal from different angles so the AI can judge portion size better.',
    ],
  },
  {
    id: '2026-06-29-ai-meal-camera',
    date: '2026-06-29',
    title: 'Optional AI meal camera',
    items: [
      'The Nutrition camera now offers separate barcode and AI meal-photo actions.',
      'Connect a personal Gemini API key in Settings to turn a meal photo into a recipe draft.',
      'AI estimates stay unsaved until you review the ingredients and press Save recipe.',
    ],
  },
  {
    id: '2026-06-28-powerlifting-full-body',
    date: '2026-06-28',
    title: 'Powerlifting-focused full body program',
    items: [
      'Full Body Four Days per Week is now a powerlifting-focused squat, bench, and deadlift program.',
      'The four training days include heavy top-set/back-off work, low-fatigue practice lifts, hypertrophy accessories, and detailed technique notes.',
      'The Browse Programs source updates without changing your existing copies, active program, or workout history.',
    ],
  },
  {
    id: '2026-06-28-run-tracking',
    date: '2026-06-28',
    title: 'Run tracking upgrades',
    items: [
      'Outdoor run time and GPS refresh continuously while the tracker is open.',
      'Track treadmill runs with motion-sensed steps and an editable stride estimate.',
      'Log completed outdoor or treadmill runs manually with distance, duration, date, and notes.',
      'Completed runs now appear as individual cards in History.',
      'The native iPhone app no longer opens Undo Typing when running motion shakes the phone.',
    ],
  },
  {
    id: '2026-06-28-timer-fixed',
    date: '2026-06-28',
    title: 'Timer is finally fixed!',
    items: ['Timer is finally fixed!'],
  },
  {
    id: '2026-06-27-guided-goal-setup',
    date: '2026-06-27',
    title: 'Guided nutrition goals',
    items: [
      'Set Goal now asks for your desired weight and activity first, including a Heavily active option.',
      'A second step shows Maintenance, Bulking, or Cutting with a recommended weekly-rate marker.',
      'Adjust the rate to preview your weekly weight change and estimated goal date before saving.',
    ],
  },
  {
    id: '2026-06-27-history-and-shortcuts',
    date: '2026-06-27',
    title: 'Faster logging and clearer history',
    items: [
      'Tap the Home bodyweight summary to log weight, and choose any past date with the date picker.',
      'Tap a recently added food icon while searching to reopen that log and edit its serving.',
      'Home and History now include daily calorie graphs with historical targets.',
      'The What’s New back button now returns cleanly to Settings.',
      'The home-screen app icon has a new fitness-log design.',
    ],
  },
  {
    id: '2026-06-26-kg-units',
    date: '2026-06-26',
    title: 'Pounds or kilograms',
    items: [
      'Switch between pounds and kilograms in Settings — every weight in the app, including your whole history, updates to match.',
      'Bodyweight, lifting weights, targets, graphs, and the macro goal calculator all respect your chosen unit.',
      'Removed the duplicate timer-sound readouts in Settings so the sound picker stands on its own.',
    ],
  },
  {
    id: '2026-06-26-recipes-and-feedback',
    date: '2026-06-26',
    title: 'Edit recipes and send feedback',
    items: [
      'Edit a saved recipe any time — tap Edit on a saved meal to change its name or foods, then save.',
      'Building a recipe now clears the search after each food you add, so the next ingredient starts with a fresh search.',
      'New "Send feedback" box in Settings — tell the developer about bugs or ideas right from the app.',
    ],
  },
  {
    id: '2026-06-26-training-and-bodyweight',
    date: '2026-06-26',
    title: 'Trend weight, recipes, and live-workout upgrades',
    items: [
      'Home now shows your bodyweight trend and last recorded weight, and trend weight also appears on the bodyweight graph.',
      'Build a recipe with the same food search you use for logging — search, pick a serving, and add it to the recipe.',
      'Add a brand-new custom exercise without leaving a live workout, and the same exercise can no longer be added twice.',
      'Rename a program or workout day by tapping its name inline (no more separate Rename button).',
      'Rest-timer sounds now prioritize audible playback, including when iPhone Silent Mode is on; the chime may briefly pause other audio.',
      'Rest-timer completion sound now fires even after navigating away from the live workout screen.',
      'The optional native iPhone build schedules rest-timer alerts that can fire while the app is closed, backgrounded, or the phone is locked.',
      'Graph points and date labels no longer overlap the axes. New exercises: Leg Extension (Single Leg) and Dragon Flag; Back Extension now records weight and reps.',
    ],
  },
  {
    id: '2026-06-25-nutrition-logging',
    date: '2026-06-25',
    title: 'Faster, smarter food logging',
    items: [
      'Serving entry now has quick-amount chips, a −/+ stepper, and shows the resulting grams beside live macros.',
      'Serving amounts default to your remembered unit and amount for each food.',
      'Your daily log is grouped into Breakfast, Lunch, Dinner, and Snacks with per-meal totals.',
      'Star favorite foods and re-log any recent or favorite in one tap.',
      'Build a recipe from your foods (New recipe, beside Quick add) and log the whole thing in one tap.',
    ],
  },
]

export const LATEST_CHANGELOG_ENTRY: ChangelogEntry | null =
  CHANGELOG[0] ?? null
export const LATEST_CHANGELOG_ID: string | null =
  LATEST_CHANGELOG_ENTRY?.id ?? null

const STORAGE_KEY = 'training-log:lastSeenChangelogId'

export function getLastSeenChangelogId(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function markChangelogSeen(
  id: string | null = LATEST_CHANGELOG_ID,
): boolean {
  if (!id) {
    return false
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, id)
    return true
  } catch {
    // Storage can be unavailable (e.g. private mode); the banner simply shows
    // again next time rather than failing.
    return false
  }
}

export function hasUnseenChangelog(): boolean {
  return (
    LATEST_CHANGELOG_ID !== null &&
    getLastSeenChangelogId() !== LATEST_CHANGELOG_ID
  )
}
