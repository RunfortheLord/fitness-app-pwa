import { describe, expect, it } from 'vitest'

import type { LocalDateString } from '@domain/dates'
import type { BodyweightEntry } from '@shared-types/app'

import {
  currentTrendWeight,
  trendWeightSeries,
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
  })

  it('smooths daily fluctuations with an EMA', () => {
    const series = trendWeightSeries([entry(0, 200), entry(1, 210)])
    expect(series[0].trend).toBe(200)
    // 200 + 0.25 * (210 - 200) = 202.5
    expect(series[1].trend).toBeCloseTo(202.5, 5)
    expect(currentTrendWeight([entry(0, 200), entry(1, 210)])).toBe(202.5)
  })

  it('reports a negative weekly slope for a downward trend', () => {
    const slope = weeklyTrendSlope(
      [entry(0, 182), entry(7, 181), entry(14, 180)],
      { asOf: dayString(14) },
    )
    expect(slope).not.toBeNull()
    expect(slope?.pointCount).toBe(3)
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

  it('excludes entries outside the trailing window', () => {
    const slope = weeklyTrendSlope(
      [entry(-20, 300), entry(7, 180), entry(10, 180), entry(14, 180)],
      { asOf: dayString(14), windowDays: 14 },
    )
    expect(slope?.pointCount).toBe(3)
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
})
