import { subMonths } from 'date-fns'

import {
  formatLocalDate,
  parseLocalDate,
  type LocalDateString,
} from '@domain/dates'
import {
  formatWeight as formatWeightWithUnit,
  weightDisplayNumber,
  weightUnitSuffix,
} from '@domain/weightUnits'
import {
  latestBodyweightEntryPerCalendarDate,
  trendWeightSeries,
  weeklyTimeAwareTrendChange,
} from '@domain/bodyweightTrend'
import type { BodyweightEntry, WeightUnit } from '@shared-types/app'

export type BodyweightRange = '1m' | '3m' | '6m' | 'all'

export type BodyweightTrendSummary =
  | { status: 'empty' }
  | {
      status: 'single'
      latest: BodyweightEntry
      text: string
    }
  | {
      status: 'ready'
      first: BodyweightEntry
      latest: BodyweightEntry
      weeklyChange: number
      direction: 'up' | 'down' | 'flat'
      text: string
    }

export type BodyweightChartPoint = {
  entry: BodyweightEntry
  x: number
  y: number
}

export type BodyweightChartTrendPoint = {
  localDate: LocalDateString
  weight: number
  x: number
  y: number
}

export type BodyweightChartModel =
  | {
      status: 'empty'
      entries: []
      trendPoints: []
      summary: BodyweightTrendSummary
    }
  | {
      status: 'single' | 'ready'
      entries: BodyweightEntry[]
      points: BodyweightChartPoint[]
      trendPoints: BodyweightChartTrendPoint[]
      minWeight: number
      maxWeight: number
      chartMin: number
      chartMax: number
      summary: BodyweightTrendSummary
    }

const rangeMonths: Record<Exclude<BodyweightRange, 'all'>, number> = {
  '1m': 1,
  '3m': 3,
  '6m': 6,
}

export function latestBodyweight(entries: BodyweightEntry[]) {
  return sortBodyweightEntries(entries).at(-1)
}

export function sortBodyweightEntries(entries: BodyweightEntry[]) {
  return [...entries].sort((left, right) => {
    const localDateOrder = left.localDate.localeCompare(right.localDate)
    if (localDateOrder !== 0) {
      return localDateOrder
    }
    const timestampOrder =
      Date.parse(left.updatedAt) - Date.parse(right.updatedAt)
    if (timestampOrder !== 0) {
      return timestampOrder
    }
    return left.id.localeCompare(right.id)
  })
}

export function filterBodyweightEntriesForRange({
  entries,
  range,
  today,
}: {
  entries: BodyweightEntry[]
  range: BodyweightRange
  today: LocalDateString
}) {
  const sorted = sortBodyweightEntries(entries)
  if (range === 'all') {
    return sorted
  }

  const start = formatLocalDate(
    subMonths(parseLocalDate(today), rangeMonths[range]),
  )
  return sorted.filter((entry) => entry.localDate >= start)
}

export function summarizeBodyweightTrend(
  entries: BodyweightEntry[],
  unit: WeightUnit = 'lb',
): BodyweightTrendSummary {
  const sorted = sortBodyweightEntries(entries)
  const latest = sorted.at(-1)
  if (!latest) {
    return { status: 'empty' }
  }

  const first = sorted[0]
  if (!first || sorted.length === 1) {
    return {
      status: 'single',
      latest,
      text: `Current bodyweight is ${formatWeightWithUnit(latest.weight, unit, 'bodyweight')}. Add another entry to show a trend.`,
    }
  }

  const weeklyTrendChange = weeklyTimeAwareTrendChange(sorted)
  if (!weeklyTrendChange) {
    return {
      status: 'single',
      latest,
      text: `Current bodyweight is ${formatWeightWithUnit(latest.weight, unit, 'bodyweight')}. Add another entry to show a trend.`,
    }
  }

  // Stored weights are canonical pounds; the weekly change is a pounds delta
  // that we convert into the display unit for human-readable summary text.
  const weeklyChange = weeklyTrendChange.weeklyChangeLb
  const direction =
    Math.abs(weeklyChange) < 0.05 ? 'flat' : weeklyChange > 0 ? 'up' : 'down'
  const directionText =
    direction === 'flat'
      ? `0 ${weightUnitSuffix(unit)} per week`
      : `${weeklyChange > 0 ? 'up' : 'down'} ${weightDisplayNumber(Math.abs(weeklyChange), unit, 'bodyweight')} ${weightUnitSuffix(unit)} per week`

  return {
    status: 'ready',
    first,
    latest,
    weeklyChange,
    direction,
    text: `Trend weight is changing ${directionText}.`,
  }
}

export function createBodyweightChartModel(
  entries: BodyweightEntry[],
  unit: WeightUnit = 'lb',
  trendEntries: BodyweightEntry[] = entries,
): BodyweightChartModel {
  const sorted = sortBodyweightEntries(entries)
  const summary = summarizeBodyweightTrend(sorted, unit)
  if (!sorted.length) {
    return { status: 'empty', entries: [], trendPoints: [], summary }
  }

  const chartEntries = [...sorted].sort(
    (left, right) =>
      chartTime(left) - chartTime(right) || left.id.localeCompare(right.id),
  )
  const fullTrendSeries = trendWeightSeries(trendEntries)
  const firstVisibleDate = sorted[0].localDate
  const lastVisibleDate = sorted.at(-1)!.localDate
  const visibleTrendTimeline =
    fullTrendSeries.length < 2
      ? []
      : createBodyweightTrendTimeline(trendEntries, fullTrendSeries).filter(
          (point) =>
            point.localDate >= firstVisibleDate &&
            point.localDate <= lastVisibleDate,
        )
  const drawableTrendTimeline =
    visibleTrendTimeline.length >= 2 ? visibleTrendTimeline : []
  const weights = [
    ...sorted.map((entry) => entry.weight),
    ...drawableTrendTimeline.map((point) => point.weight),
  ]
  const minWeight = Math.min(...weights)
  const maxWeight = Math.max(...weights)
  const chartTimes = [
    ...chartEntries.map(chartTime),
    ...drawableTrendTimeline.map((point) => point.timestamp),
  ]
  const firstTime = Math.min(...chartTimes)
  const lastTime = Math.max(...chartTimes)
  const weightSpread = maxWeight - minWeight
  const timeSpread = Math.max(1, lastTime - firstTime)
  const yPadding = weightSpread === 0 ? 2 : weightSpread * 0.12
  const chartMin = minWeight - yPadding
  const chartMax = maxWeight + yPadding
  const chartSpread = Math.max(1, chartMax - chartMin)
  // A lone entry has no time spread to position against; center it so it floats
  // in the plot area instead of sitting at x=0, on top of the y-axis labels.
  const isSingleEntry = sorted.length === 1

  return {
    status: sorted.length === 1 ? 'single' : 'ready',
    entries: sorted,
    points: chartEntries.map((entry) => ({
      entry,
      x: isSingleEntry
        ? 50
        : ((chartTime(entry) - firstTime) / timeSpread) * 100,
      y: 100 - ((entry.weight - chartMin) / chartSpread) * 100,
    })),
    trendPoints: drawableTrendTimeline.map((point) => ({
      localDate: point.localDate,
      weight: point.weight,
      x: ((point.timestamp - firstTime) / timeSpread) * 100,
      y: 100 - ((point.weight - chartMin) / chartSpread) * 100,
    })),
    minWeight,
    maxWeight,
    chartMin,
    chartMax,
    summary,
  }
}

function createBodyweightTrendTimeline(
  entries: BodyweightEntry[],
  series: ReturnType<typeof trendWeightSeries>,
) {
  const observedEntries = latestBodyweightEntryPerCalendarDate(entries)
  const seriesIndexByDate = new Map(
    series.map((point, index) => [point.localDate, index]),
  )
  const observedPoints = observedEntries.flatMap((entry) => {
    const seriesIndex = seriesIndexByDate.get(entry.localDate)
    return seriesIndex === undefined
      ? []
      : [{ seriesIndex, timestamp: chartTime(entry) }]
  })

  let segmentIndex = 0
  return series.map((point, seriesIndex) => {
    while (
      segmentIndex + 1 < observedPoints.length - 1 &&
      observedPoints[segmentIndex + 1].seriesIndex < seriesIndex
    ) {
      segmentIndex += 1
    }
    const segmentStart = observedPoints[segmentIndex]
    const segmentEnd = observedPoints[segmentIndex + 1] ?? segmentStart
    const segmentLength = segmentEnd.seriesIndex - segmentStart.seriesIndex
    const segmentProgress =
      segmentLength === 0
        ? 0
        : (seriesIndex - segmentStart.seriesIndex) / segmentLength
    const timestamp =
      segmentStart.timestamp +
      (segmentEnd.timestamp - segmentStart.timestamp) * segmentProgress

    return {
      localDate: point.localDate,
      weight: point.trend,
      timestamp,
    }
  })
}

export function formatWeight(weight: number) {
  return Number.isInteger(weight) ? String(weight) : weight.toFixed(1)
}

export function formatBodyweightChange(
  change: number,
  unit: WeightUnit = 'lb',
) {
  const suffix = weightUnitSuffix(unit)
  if (Math.abs(change) < 0.05) {
    return `0 ${suffix}`
  }
  const sign = change > 0 ? '+' : '-'
  const displayChange =
    unit === 'lb'
      ? formatWeight(Math.abs(change))
      : weightDisplayNumber(Math.abs(change), unit, 'bodyweight')
  return `${sign}${displayChange} ${suffix}`
}

export function formatBodyweightWeeklyChange(
  change: number,
  unit: WeightUnit = 'lb',
) {
  return `${formatBodyweightChange(change, unit)}/week`
}

function chartTime(entry: BodyweightEntry) {
  const localDate = parseLocalDate(entry.localDate)
  const createdAt = Date.parse(entry.createdAt)
  if (Number.isFinite(createdAt)) {
    const createdTime = new Date(createdAt)
    localDate.setHours(
      createdTime.getHours(),
      createdTime.getMinutes(),
      createdTime.getSeconds(),
      createdTime.getMilliseconds(),
    )
    return localDate.getTime()
  }
  localDate.setHours(12, 0, 0, 0)
  return localDate.getTime()
}
