import { differenceInCalendarDays } from 'date-fns'

import { parseLocalDate, type LocalDateString } from '@domain/dates'
import type { BodyweightEntry } from '@shared-types/app'

// Per-calendar-day exponential smoothing factor. A "trend weight" damps daily
// scale fluctuations so a single high or low reading does not dominate. This is
// the one-day alpha; gaps of several days compound it (see
// effectiveTrendAlphaForCalendarDays) so a long pause between weigh-ins lets the
// trend move proportionally further toward the new measurement.
export const TREND_SMOOTHING = 0.25

const MS_PER_DAY = 86_400_000

export type TrendWeightPoint = {
  localDate: LocalDateString
  weight: number
  trend: number
}

/**
 * Converts the one-calendar-day smoothing coefficient into the equivalent
 * coefficient for a gap of several calendar days. Applying it once equals
 * applying the daily update once per elapsed calendar day.
 */
export function effectiveTrendAlphaForCalendarDays(
  dailyAlpha: number,
  calendarDays: number,
): number {
  return calendarDays <= 0 ? 0 : 1 - Math.pow(1 - dailyAlpha, calendarDays)
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
 * Returns the smoothed (EMA) trend weight at each local calendar date, oldest
 * first. The first point seeds the trend with the raw weight; each later point
 * smooths using a coefficient scaled by the number of calendar days since the
 * previous weigh-in.
 */
export function trendWeightSeries(
  entries: BodyweightEntry[],
): TrendWeightPoint[] {
  const dailyEntries = latestBodyweightEntryPerCalendarDate(entries)
  const series: TrendWeightPoint[] = []
  let ema = 0
  for (let index = 0; index < dailyEntries.length; index += 1) {
    const entry = dailyEntries[index]
    if (index === 0) {
      ema = entry.weight
    } else {
      const calendarDays = Math.max(
        1,
        differenceInCalendarDays(
          parseLocalDate(entry.localDate),
          parseLocalDate(dailyEntries[index - 1].localDate),
        ),
      )
      const effectiveAlpha = effectiveTrendAlphaForCalendarDays(
        TREND_SMOOTHING,
        calendarDays,
      )
      ema += effectiveAlpha * (entry.weight - ema)
    }
    series.push({
      localDate: entry.localDate,
      weight: entry.weight,
      trend: ema,
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

export type TrendSlope = {
  /** Observed change in trend weight per week (signed). */
  weeklyChangeLb: number
  /** Number of trend points used. */
  pointCount: number
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
    spanDays,
  }
}

function toDayNumber(localDate: LocalDateString): number {
  return Math.round(parseLocalDate(localDate).getTime() / MS_PER_DAY)
}
