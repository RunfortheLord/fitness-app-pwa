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
    id: '2026-06-26-training-and-bodyweight',
    date: '2026-06-26',
    title: 'Trend weight, recipes, and live-workout upgrades',
    items: [
      'Home now shows your bodyweight trend and last recorded weight, and trend weight also appears on the bodyweight graph.',
      'Build a recipe with the same food search you use for logging — search, pick a serving, and add it to the recipe.',
      'Add a brand-new custom exercise without leaving a live workout, and the same exercise can no longer be added twice.',
      'Rename a program or workout day by tapping its name inline (no more separate Rename button).',
      'The rest-timer sound now plays over background music like Spotify instead of pausing it.',
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
