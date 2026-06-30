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

export type TrendWeightPoint = {
  localDate: LocalDateString
  weight: number
  trend: number
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

function toDayNumber(localDate: LocalDateString): number {
  return Math.round(parseLocalDate(localDate).getTime() / MS_PER_DAY)
}
