// Pure, privacy-first analytics logic. No React, no Dexie, no network, and — by
// construction — no personal data. An analytics record is only ever an event
// name plus a coarse day (YYYY-MM-DD) tagged with a stable but anonymous install
// id. There is deliberately no time-of-day, no location, no account linkage, and
// no health value here. See docs/ANALYTICS.md.

// Type-only import (erased at emit) so this module stays free of runtime
// dependencies and can be pulled into the server/api Node build safely.
import type { LocalDateString } from './dates.js'

/** Every analytics event the app may emit. This list is exhaustive on purpose:
 * the server rejects any name not in it, so a future code change cannot silently
 * start sending a richer or more identifying event. */
export const ANALYTICS_EVENT_NAMES = [
  'app_opened',
  'workout_logged',
  'meal_logged',
  'run_tracked',
] as const

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number]

/** The events that mean the person actually did something with the app. Used to
 * compute activation. `app_opened` is the returning-visit signal and is not an
 * activation event by itself. */
export const ACTIVATION_EVENT_NAMES = [
  'workout_logged',
  'meal_logged',
  'run_tracked',
] as const satisfies readonly AnalyticsEventName[]

/** A single queued/transmitted event: name + coarse day only. */
export type QueuedAnalyticsEvent = {
  name: AnalyticsEventName
  day: LocalDateString
}

/** The batch body sent to the first-party endpoint. The install id is a random
 * UUID from local storage; it is never derived from or joined to any account. */
export type AnalyticsBatch = {
  installId: string
  events: QueuedAnalyticsEvent[]
}

/** Cap the offline queue so a device that is offline for a long time cannot grow
 * local storage without bound. Oldest events are dropped first. */
export const MAX_ANALYTICS_QUEUE = 200

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const INSTALL_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isAnalyticsEventName(
  value: unknown,
): value is AnalyticsEventName {
  return (
    typeof value === 'string' &&
    (ANALYTICS_EVENT_NAMES as readonly string[]).includes(value)
  )
}

export function isActivationEventName(value: AnalyticsEventName): boolean {
  return (ACTIVATION_EVENT_NAMES as readonly string[]).includes(value)
}

export function isValidAnalyticsDay(value: unknown): value is LocalDateString {
  return typeof value === 'string' && DAY_PATTERN.test(value)
}

export function isValidInstallId(value: unknown): value is string {
  return typeof value === 'string' && INSTALL_ID_PATTERN.test(value)
}

/**
 * Decide whether analytics may run at all. Analytics is active only when it is
 * explicitly enabled for the build AND the user has not signalled they do not
 * want it (Do-Not-Track / Global Privacy Control) AND they have not opted out.
 * Any one of those switches turns everything off.
 */
export function resolveAnalyticsActive(input: {
  enabled: boolean
  doNotTrack: boolean
  optedOut: boolean
}): boolean {
  return input.enabled && !input.doNotTrack && !input.optedOut
}

/**
 * Reduce arbitrary parsed input to a clean list of events, discarding anything
 * that is not a known event + valid day. This runs on both the client (when
 * reading the persisted queue) and the server (before anything is stored), so a
 * corrupted queue or a tampered request can never introduce unexpected fields.
 */
export function sanitizeAnalyticsEvents(
  value: unknown,
): QueuedAnalyticsEvent[] {
  if (!Array.isArray(value)) {
    return []
  }
  const events: QueuedAnalyticsEvent[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      continue
    }
    const candidate = entry as Record<string, unknown>
    if (
      isAnalyticsEventName(candidate.name) &&
      isValidAnalyticsDay(candidate.day)
    ) {
      // Only these two fields survive — nothing else is ever kept.
      events.push({ name: candidate.name, day: candidate.day })
    }
  }
  return events.slice(-MAX_ANALYTICS_QUEUE)
}

// ---------------------------------------------------------------------------
// Launch-metric computation (activation + D1/D7/D30 retention).
//
// These are pure functions over the collected records. The owner reads launch
// metrics by fetching the stored event records and running computeLaunchMetrics
// over them (see docs/ANALYTICS.md). Keeping this here means the exact same
// definitions are unit-tested and documented in one place.
// ---------------------------------------------------------------------------

export type AnalyticsRecord = {
  installId: string
  day: LocalDateString
  name: AnalyticsEventName
}

export type RetentionPoint = {
  /** Installs old enough to have had the chance to return by this horizon. */
  eligible: number
  /** Of those, how many showed any activity on/after firstDay + N days. */
  returned: number
  /** returned / eligible, or 0 when no install is eligible yet. */
  rate: number
}

export type LaunchMetrics = {
  installs: number
  activated: number
  activationRate: number
  retention: {
    d1: RetentionPoint
    d7: RetentionPoint
    d30: RetentionPoint
  }
}

function dayToUtcMillis(day: LocalDateString): number {
  const [year, month, date] = day.split('-').map(Number)
  return Date.UTC(year, month - 1, date)
}

function dayDifference(
  later: LocalDateString,
  earlier: LocalDateString,
): number {
  // Anchored to UTC midnight so the difference is exact whole days regardless of
  // any daylight-saving transition between the two dates.
  const ms = dayToUtcMillis(later) - dayToUtcMillis(earlier)
  return Math.round(ms / 86_400_000)
}

function retentionAtHorizon(
  installs: { firstDay: LocalDateString; days: LocalDateString[] }[],
  referenceDay: LocalDateString,
  horizon: number,
): RetentionPoint {
  let eligible = 0
  let returned = 0
  for (const install of installs) {
    // The install must be old enough that the horizon has actually elapsed,
    // otherwise it cannot count for or against retention yet.
    if (dayDifference(referenceDay, install.firstDay) < horizon) {
      continue
    }
    eligible += 1
    const didReturn = install.days.some(
      (day) => dayDifference(day, install.firstDay) >= horizon,
    )
    if (didReturn) {
      returned += 1
    }
  }
  return {
    eligible,
    returned,
    rate: eligible === 0 ? 0 : returned / eligible,
  }
}

/**
 * Compute activation and D1/D7/D30 retention from raw event records.
 *
 * - **Activation:** an install that produced at least one workout/meal/run event.
 * - **Dn retention:** of installs first seen at least N days before the reference
 *   day (so they had the opportunity), the share that were active again on any
 *   day at least N days after their first day. This matches the launch plan's
 *   "still using at day 30" definition rather than a same-exact-day cohort.
 */
export function computeLaunchMetrics(
  records: AnalyticsRecord[],
  options: { referenceDay?: LocalDateString } = {},
): LaunchMetrics {
  const byInstall = new Map<
    string,
    {
      firstDay: LocalDateString
      days: Set<LocalDateString>
      activated: boolean
    }
  >()
  let maxDay: LocalDateString | undefined

  for (const record of records) {
    if (
      !isValidInstallId(record.installId) ||
      !isValidAnalyticsDay(record.day) ||
      !isAnalyticsEventName(record.name)
    ) {
      continue
    }
    if (!maxDay || record.day > maxDay) {
      maxDay = record.day
    }
    const existing = byInstall.get(record.installId)
    if (!existing) {
      byInstall.set(record.installId, {
        firstDay: record.day,
        days: new Set([record.day]),
        activated: isActivationEventName(record.name),
      })
      continue
    }
    existing.days.add(record.day)
    if (record.day < existing.firstDay) {
      existing.firstDay = record.day
    }
    if (isActivationEventName(record.name)) {
      existing.activated = true
    }
  }

  const referenceDay = options.referenceDay ?? maxDay
  const installs = [...byInstall.values()].map((install) => ({
    firstDay: install.firstDay,
    days: [...install.days],
    activated: install.activated,
  }))

  const activated = installs.filter((install) => install.activated).length
  const total = installs.length

  const emptyPoint: RetentionPoint = { eligible: 0, returned: 0, rate: 0 }
  const retention = referenceDay
    ? {
        d1: retentionAtHorizon(installs, referenceDay, 1),
        d7: retentionAtHorizon(installs, referenceDay, 7),
        d30: retentionAtHorizon(installs, referenceDay, 30),
      }
    : { d1: emptyPoint, d7: emptyPoint, d30: emptyPoint }

  return {
    installs: total,
    activated,
    activationRate: total === 0 ? 0 : activated / total,
    retention,
  }
}
