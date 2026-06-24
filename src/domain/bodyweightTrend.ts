import { parseLocalDate, type LocalDateString } from '@domain/dates'
import { sortBodyweightEntries } from '@domain/bodyweightProgress'
import type { BodyweightEntry } from '@shared-types/app'

// Exponential smoothing factor applied per entry. A "trend weight" damps daily
// scale fluctuations so a single high or low reading does not dominate.
export const TREND_SMOOTHING = 0.25

const MS_PER_DAY = 86_400_000

export type TrendWeightPoint = {
  localDate: LocalDateString
  weight: number
  trend: number
}

/**
 * Returns the smoothed (EMA) trend weight at each entry, oldest first. The first
 * point seeds the trend with the raw weight.
 */
export function trendWeightSeries(
  entries: BodyweightEntry[],
): TrendWeightPoint[] {
  const sorted = sortBodyweightEntries(entries)
  let ema: number | null = null
  return sorted.map((entry) => {
    ema =
      ema === null ? entry.weight : ema + TREND_SMOOTHING * (entry.weight - ema)
    return { localDate: entry.localDate, weight: entry.weight, trend: ema }
  })
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
