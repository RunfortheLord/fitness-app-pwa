import { describe, expect, it } from 'vitest'

import type { LocalDateString } from '@domain/dates'
import type { BodyweightEntry } from '@shared-types/app'

import {
  currentTimeAwareTrendWeight,
  currentTrendWeight,
  timeAwareTrendWeightSeries,
  trendWeightSeries,
  weeklyTimeAwareTrendChange,
  weeklyTrendSlope,
} from './bodyweightTrend'

function dayString(offset: number): LocalDateString {
  const date = new Date(2026, 0, 1)
  date.setDate(date.getDate() + offset)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}` as LocalDateString
}

function entry(offset: number, weight: number): BodyweightEntry {
  const localDate = dayString(offset)
  return {
    id: `bw-${offset}`,
    localDate,
    weight,
    unit: 'lb',
    notes: '',
    createdAt: `${localDate}T08:00:00.000Z`,
    updatedAt: `${localDate}T08:00:00.000Z`,
  }
}

describe('bodyweightTrend', () => {
  it('returns null trend weight with no entries', () => {
    expect(currentTrendWeight([])).toBeNull()
    expect(currentTimeAwareTrendWeight([])).toBeNull()
  })

  it('smooths daily fluctuations with an EMA', () => {
    const series = trendWeightSeries([entry(0, 200), entry(1, 210)])
    expect(series[0].trend).toBe(200)
    // 200 + 0.1 * (210 - 200) = 201
    expect(series[1].trend).toBeCloseTo(201, 5)
    expect(currentTrendWeight([entry(0, 200), entry(1, 210)])).toBe(201)
  })

  it('moves down when the latest daily measurement is below the trend', () => {
    const before = [entry(0, 200), entry(1, 210)]
    const trendBefore = currentTrendWeight(before)
    const latestWeight = 190
    const trendAfter = currentTrendWeight([...before, entry(2, latestWeight)])

    expect(latestWeight).toBeLessThan(trendBefore!)
    expect(trendAfter).toBeLessThan(trendBefore!)
  })

  it('reports a negative weekly slope for a downward trend', () => {
    const slope = weeklyTrendSlope(
      [entry(0, 182), entry(7, 181), entry(14, 180)],
      { asOf: dayString(14) },
    )
    expect(slope).not.toBeNull()
    expect(slope?.pointCount).toBe(15)
    expect(slope?.measurementCount).toBe(3)
    expect(slope?.spanDays).toBe(14)
    expect(slope?.weeklyChangeLb).toBeLessThan(0)
  })

  it('reports a flat slope for constant weight', () => {
    const slope = weeklyTrendSlope(
      [entry(0, 180), entry(7, 180), entry(14, 180)],
      { asOf: dayString(14) },
    )
    expect(slope?.weeklyChangeLb).toBeCloseTo(0, 5)
  })

  it('reports daily points and actual measurements separately', () => {
    const slope = weeklyTrendSlope(
      [entry(-20, 300), entry(7, 180), entry(10, 180), entry(14, 180)],
      { asOf: dayString(14), windowDays: 14 },
    )
    expect(slope?.pointCount).toBe(15)
    expect(slope?.measurementCount).toBe(3)
  })

  it('returns null without at least two points spanning more than one day', () => {
    expect(
      weeklyTrendSlope([entry(14, 180)], { asOf: dayString(14) }),
    ).toBeNull()
    expect(
      weeklyTrendSlope([entry(14, 180), entry(14, 181)], {
        asOf: dayString(14),
      }),
    ).toBeNull()
  })

  it('uses the requested time-aware EWMA alpha for consecutive measurements', () => {
    const series = timeAwareTrendWeightSeries([entry(0, 200), entry(1, 210)])
    const alpha = 1 - Math.pow(2, -1 / 7)

    expect(series[0].trend).toBe(200)
    expect(series[1].trend).toBeCloseTo(200 + alpha * 10, 5)
    expect(currentTimeAwareTrendWeight([entry(0, 200), entry(1, 210)])).toBe(
      200.9,
    )
  })

  it('gives a multi-day gap more influence than a one-day gap', () => {
    const oneDay = timeAwareTrendWeightSeries([entry(0, 200), entry(1, 210)])
    const sevenDays = timeAwareTrendWeightSeries([entry(0, 200), entry(7, 210)])

    expect(sevenDays.at(-1)!.trend).toBeCloseTo(205, 5)
    expect(sevenDays.at(-1)!.trend).toBeGreaterThan(oneDay.at(-1)!.trend)
  })

  it('calculates weekly change from trend behavior instead of raw endpoints', () => {
    const entries = [entry(0, 200), entry(7, 190), entry(14, 200)]
    const change = weeklyTimeAwareTrendChange(entries, { asOf: dayString(14) })

    expect(entries.at(-1)!.weight - entries[0].weight).toBe(0)
    expect(change?.weeklyChangeLb).not.toBeCloseTo(0, 5)
    expect(change?.weeklyChangeLb).toBeLessThan(0)
  })

  it('uses the latest same-day entry for time-aware trend calculations', () => {
    const entries = [
      entry(0, 200),
      {
        ...entry(0, 201),
        id: 'bw-0-late',
        createdAt: `${dayString(0)}T20:00:00.000Z`,
        updatedAt: `${dayString(0)}T20:00:00.000Z`,
      },
      entry(1, 210),
    ]

    const series = timeAwareTrendWeightSeries(entries)

    expect(series).toHaveLength(2)
    expect(series[0].weight).toBe(201)
    expect(series.every((point) => Number.isFinite(point.trend))).toBe(true)
  })
})
