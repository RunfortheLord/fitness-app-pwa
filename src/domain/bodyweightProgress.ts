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
import { weeklyTimeAwareTrendChange } from '@domain/bodyweightTrend'
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

export type BodyweightChartModel =
  | {
      status: 'empty'
      entries: []
      summary: BodyweightTrendSummary
    }
  | {
      status: 'single' | 'ready'
      entries: BodyweightEntry[]
      points: BodyweightChartPoint[]
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
): BodyweightChartModel {
  const sorted = sortBodyweightEntries(entries)
  const summary = summarizeBodyweightTrend(sorted, unit)
  if (!sorted.length) {
    return { status: 'empty', entries: [], summary }
  }

  const weights = sorted.map((entry) => entry.weight)
  const minWeight = Math.min(...weights)
  const maxWeight = Math.max(...weights)
  const firstTime = chartTime(sorted[0])
  const lastTime = chartTime(sorted.at(-1) ?? sorted[0])
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
    points: sorted.map((entry) => ({
      entry,
      x: isSingleEntry
        ? 50
        : ((chartTime(entry) - firstTime) / timeSpread) * 100,
      y: 100 - ((entry.weight - chartMin) / chartSpread) * 100,
    })),
    minWeight,
    maxWeight,
    chartMin,
    chartMax,
    summary,
  }
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
  const parsed = Date.parse(entry.updatedAt || entry.createdAt)
  if (Number.isFinite(parsed)) {
    return parsed
  }
  return parseLocalDate(entry.localDate).getTime()
}
