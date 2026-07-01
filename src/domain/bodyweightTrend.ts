import { differenceInCalendarDays } from 'date-fns'

import {
  addLocalDays,
  parseLocalDate,
  type LocalDateString,
} from '@domain/dates'
import type { BodyweightEntry } from '@shared-types/app'

// Daily exponential smoothing factor applied after missing calendar dates are
// filled by linear interpolation. MacroFactor publicly describes this general
// pipeline but does not publish its smoothing coefficient. Ten percent gives
// this approximation a roughly 6.6-day half-life without letting one reading
// after a long gap nearly replace the existing trend.
export const TREND_SMOOTHING = 0.1

const MS_PER_DAY = 86_400_000
const TIME_AWARE_TREND_HALF_LIFE_DAYS = 7
const WEEKLY_CHANGE_HALF_LIFE_DAYS = 14
const WEEKLY_CHANGE_LOOKBACK_DAYS = 28

export type TrendWeightPoint = {
  localDate: LocalDateString
  weight: number
  trend: number
}

export type WeeklyTrendChange = {
  /** Estimated trend-weight change per week, signed and stored in pounds. */
  weeklyChangeLb: number
  /** Number of observed trend points used. */
  pointCount: number
  /** Calendar days spanned by the points used. */
  spanDays: number
}

/**
 * Keeps the latest timestamped entry for every local calendar date, oldest
 * first. New data entry permits only one measurement per date; this also keeps
 * restored legacy duplicates from receiving extra weight in the trend.
 */
export function latestBodyweightEntryPerCalendarDate(
  entries: BodyweightEntry[],
): BodyweightEntry[] {
  const latestByDate = new Map<LocalDateString, BodyweightEntry>()
  for (const entry of entries) {
    const current = latestByDate.get(entry.localDate)
    if (!current || compareEntryRecency(entry, current) > 0) {
      latestByDate.set(entry.localDate, entry)
    }
  }
  return [...latestByDate.values()].sort(
    (left, right) =>
      left.localDate.localeCompare(right.localDate) ||
      compareEntryRecency(left, right),
  )
}

function compareEntryRecency(left: BodyweightEntry, right: BodyweightEntry) {
  return (
    left.updatedAt.localeCompare(right.updatedAt) ||
    left.createdAt.localeCompare(right.createdAt) ||
    left.id.localeCompare(right.id)
  )
}

/**
 * Builds one scale-weight value per local calendar date, linearly interpolating
 * dates between observed measurements, then returns a daily EMA trend. The
 * first observation seeds the trend; no values are extrapolated before the
 * first observation or after the latest one.
 */
export function trendWeightSeries(
  entries: BodyweightEntry[],
): TrendWeightPoint[] {
  const observedEntries = latestBodyweightEntryPerCalendarDate(entries)
  const first = observedEntries[0]
  if (!first) {
    return []
  }

  let ema = first.weight
  const series: TrendWeightPoint[] = [
    {
      localDate: first.localDate,
      weight: first.weight,
      trend: ema,
    },
  ]

  for (let index = 1; index < observedEntries.length; index += 1) {
    const previous = observedEntries[index - 1]
    const current = observedEntries[index]
    const calendarDays = differenceInCalendarDays(
      parseLocalDate(current.localDate),
      parseLocalDate(previous.localDate),
    )

    for (let dayOffset = 1; dayOffset <= calendarDays; dayOffset += 1) {
      const interpolationProgress = dayOffset / calendarDays
      const interpolatedWeight =
        previous.weight +
        interpolationProgress * (current.weight - previous.weight)
      ema += TREND_SMOOTHING * (interpolatedWeight - ema)
      series.push({
        localDate: addLocalDays(previous.localDate, dayOffset),
        weight: interpolatedWeight,
        trend: ema,
      })
    }
  }
  return series
}

/**
 * Builds a trend point for each observed local date using a time-aware EWMA.
 * The actual calendar gap between weigh-ins controls each point's influence.
 */
export function timeAwareTrendWeightSeries(
  entries: BodyweightEntry[],
): TrendWeightPoint[] {
  const observedEntries = latestBodyweightEntryPerCalendarDate(entries).filter(
    (entry) => Number.isFinite(entry.weight) && parseableLocalDate(entry),
  )
  const first = observedEntries[0]
  if (!first) {
    return []
  }

  let trend = first.weight
  const series: TrendWeightPoint[] = [
    {
      localDate: first.localDate,
      weight: first.weight,
      trend,
    },
  ]

  for (let index = 1; index < observedEntries.length; index += 1) {
    const previous = observedEntries[index - 1]
    const current = observedEntries[index]
    const daysElapsed = differenceInCalendarDays(
      parseLocalDate(current.localDate),
      parseLocalDate(previous.localDate),
    )
    if (daysElapsed <= 0) {
      continue
    }

    const alpha =
      1 - Math.pow(2, -daysElapsed / TIME_AWARE_TREND_HALF_LIFE_DAYS)
    trend += alpha * (current.weight - trend)
    series.push({
      localDate: current.localDate,
      weight: current.weight,
      trend,
    })
  }

  return series
}

/**
 * The most recent trend weight, rounded to one decimal, or null when there are
 * no entries.
 */
export function currentTrendWeight(entries: BodyweightEntry[]): number | null {
  const series = trendWeightSeries(entries)
  const latest = series.at(-1)
  if (!latest) {
    return null
  }
  return Math.round(latest.trend * 10) / 10
}

/**
 * The current time-aware trend weight rounded to one decimal, or null when no
 * valid entries exist.
 */
export function currentTimeAwareTrendWeight(
  entries: BodyweightEntry[],
): number | null {
  const series = timeAwareTrendWeightSeries(entries)
  const latest = series.at(-1)
  if (!latest) {
    return null
  }
  return Math.round(latest.trend * 10) / 10
}

export type TrendSlope = {
  /** Observed change in trend weight per week (signed). */
  weeklyChangeLb: number
  /** Number of daily observed or interpolated trend points used. */
  pointCount: number
  /** Number of actual measurements represented in the trend window. */
  measurementCount: number
  /** Calendar days spanned by the points used. */
  spanDays: number
}

/**
 * Fits a least-squares line to the trend-weight points within the trailing
 * window and reports the slope as a weekly change. Returns null when fewer than
 * two points fall in the window or they share a single day. Threshold decisions
 * (minimum points/span) are left to the caller.
 */
export function weeklyTrendSlope(
  entries: BodyweightEntry[],
  options: { asOf: LocalDateString; windowDays?: number },
): TrendSlope | null {
  const windowDays = options.windowDays ?? 14
  const asOfDay = toDayNumber(options.asOf)
  const startDay = asOfDay - windowDays

  const points = trendWeightSeries(entries)
    .map((point) => ({ x: toDayNumber(point.localDate), y: point.trend }))
    .filter((point) => point.x >= startDay && point.x <= asOfDay)
  const measurementCount = latestBodyweightEntryPerCalendarDate(entries).filter(
    (entry) => {
      const day = toDayNumber(entry.localDate)
      return day >= startDay && day <= asOfDay
    },
  ).length

  if (points.length < 2) {
    return null
  }

  const xs = points.map((point) => point.x)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const spanDays = maxX - minX
  if (spanDays <= 0) {
    return null
  }

  const n = points.length
  const sumX = points.reduce((total, point) => total + point.x, 0)
  const sumY = points.reduce((total, point) => total + point.y, 0)
  const sumXy = points.reduce((total, point) => total + point.x * point.y, 0)
  const sumXx = points.reduce((total, point) => total + point.x * point.x, 0)
  const denominator = n * sumXx - sumX * sumX
  if (denominator === 0) {
    return null
  }
  const slopePerDay = (n * sumXy - sumX * sumY) / denominator

  return {
    weeklyChangeLb: slopePerDay * 7,
    pointCount: n,
    measurementCount,
    spanDays,
  }
}

export function weeklyTimeAwareTrendChange(
  entries: BodyweightEntry[],
  options: {
    asOf?: LocalDateString
    lookbackDays?: number
    halfLifeDays?: number
  } = {},
): WeeklyTrendChange | null {
  const series = timeAwareTrendWeightSeries(entries)
  const latest = series.at(-1)
  if (!latest) {
    return null
  }

  const lookbackDays = options.lookbackDays ?? WEEKLY_CHANGE_LOOKBACK_DAYS
  const halfLifeDays = options.halfLifeDays ?? WEEKLY_CHANGE_HALF_LIFE_DAYS
  const asOfDay = toDayNumber(options.asOf ?? latest.localDate)
  const startDay = asOfDay - lookbackDays
  const points = series
    .map((point) => ({
      x: toDayNumber(point.localDate),
      y: point.trend,
    }))
    .filter((point) => point.x >= startDay && point.x <= asOfDay)

  if (points.length < 2) {
    return null
  }

  const fallback = () => fallbackWeeklyChange(points)

  if (points.length < 3) {
    return fallback()
  }

  const regression = weightedSlope(points, asOfDay, halfLifeDays)
  return regression ?? fallback()
}

function toDayNumber(localDate: LocalDateString): number {
  return Math.round(parseLocalDate(localDate).getTime() / MS_PER_DAY)
}

function parseableLocalDate(entry: BodyweightEntry) {
  return Number.isFinite(parseLocalDate(entry.localDate).getTime())
}

function fallbackWeeklyChange(
  points: Array<{ x: number; y: number }>,
): WeeklyTrendChange | null {
  const oldest = points[0]
  const newest = points.at(-1)
  if (!oldest || !newest) {
    return null
  }
  const spanDays = newest.x - oldest.x
  if (spanDays <= 0) {
    return null
  }
  return {
    weeklyChangeLb: ((newest.y - oldest.y) / spanDays) * 7,
    pointCount: points.length,
    spanDays,
  }
}

function weightedSlope(
  points: Array<{ x: number; y: number }>,
  asOfDay: number,
  halfLifeDays: number,
): WeeklyTrendChange | null {
  if (!(halfLifeDays > 0)) {
    return null
  }

  let sumWeight = 0
  let sumX = 0
  let sumY = 0
  let sumXx = 0
  let sumXy = 0
  for (const point of points) {
    const x = point.x - asOfDay
    const daysAgo = Math.max(0, asOfDay - point.x)
    const pointWeight = Math.pow(2, -daysAgo / halfLifeDays)
    sumWeight += pointWeight
    sumX += pointWeight * x
    sumY += pointWeight * point.y
    sumXx += pointWeight * x * x
    sumXy += pointWeight * x * point.y
  }

  const denominator = sumWeight * sumXx - sumX * sumX
  if (!Number.isFinite(denominator) || denominator <= 0) {
    return null
  }

  const slopePerDay = (sumWeight * sumXy - sumX * sumY) / denominator
  const spanDays = points.at(-1)!.x - points[0].x
  if (!Number.isFinite(slopePerDay) || spanDays <= 0) {
    return null
  }

  return {
    weeklyChangeLb: slopePerDay * 7,
    pointCount: points.length,
    spanDays,
  }
}
