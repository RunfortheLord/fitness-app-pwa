import { subMonths } from 'date-fns'

import {
  formatLocalDate,
  parseLocalDate,
  type LocalDateString,
} from '@domain/dates'
import type { BodyweightEntry } from '@shared-types/app'

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
      change: number
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
      text: `Current bodyweight is ${formatWeight(latest.weight)} ${latest.unit}. Add another entry to show a trend.`,
    }
  }

  const change = latest.weight - first.weight
  const direction =
    Math.abs(change) < 0.05 ? 'flat' : change > 0 ? 'up' : 'down'
  const directionText =
    direction === 'flat'
      ? 'no meaningful change'
      : `${change > 0 ? 'up' : 'down'} ${formatWeight(Math.abs(change))} ${latest.unit}`

  return {
    status: 'ready',
    first,
    latest,
    change,
    direction,
    text: `From ${first.localDate} to ${latest.localDate}, bodyweight is ${directionText}, from ${formatWeight(first.weight)} to ${formatWeight(latest.weight)} ${latest.unit}.`,
  }
}

export function createBodyweightChartModel(
  entries: BodyweightEntry[],
): BodyweightChartModel {
  const sorted = sortBodyweightEntries(entries)
  const summary = summarizeBodyweightTrend(sorted)
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

  return {
    status: sorted.length === 1 ? 'single' : 'ready',
    entries: sorted,
    points: sorted.map((entry) => ({
      entry,
      x: ((chartTime(entry) - firstTime) / timeSpread) * 100,
      y: 100 - ((entry.weight - chartMin) / chartSpread) * 100,
    })),
    minWeight,
    maxWeight,
    summary,
  }
}

export function formatWeight(weight: number) {
  return Number.isInteger(weight) ? String(weight) : weight.toFixed(1)
}

export function formatBodyweightChange(change: number) {
  if (Math.abs(change) < 0.05) {
    return '0 lb'
  }
  return `${change > 0 ? '+' : '-'}${formatWeight(Math.abs(change))} lb`
}

function chartTime(entry: BodyweightEntry) {
  const parsed = Date.parse(entry.updatedAt || entry.createdAt)
  if (Number.isFinite(parsed)) {
    return parsed
  }
  return parseLocalDate(entry.localDate).getTime()
}
