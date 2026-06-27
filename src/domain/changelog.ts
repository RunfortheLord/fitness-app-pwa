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
