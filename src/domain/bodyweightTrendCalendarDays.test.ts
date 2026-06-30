import { describe, expect, it } from 'vitest'

import {
  TREND_SMOOTHING,
  currentTrendWeight,
  effectiveTrendAlphaForCalendarDays,
  trendWeightSeries,
} from '@domain/bodyweightTrend'
import type { LocalDateString } from '@domain/dates'
import type { BodyweightEntry } from '@shared-types/app'

describe('calendar-day-aware bodyweight trend', () => {
  it('uses the same alpha for a one-day gap', () => {
    expect(effectiveTrendAlphaForCalendarDays(0.1, 1)).toBeCloseTo(0.1)
  })

  it('compounds the daily alpha across the number of calendar days', () => {
    expect(effectiveTrendAlphaForCalendarDays(0.1, 7)).toBeCloseTo(1 - 0.9 ** 7)
  })

  it('preserves the existing one-day smoothing result', () => {
    const series = trendWeightSeries([
      entry('a', '2026-01-01', 200),
      entry('b', '2026-01-02', 210),
    ])
    expect(series[1].trend).toBeCloseTo(200 + TREND_SMOOTHING * 10, 5)
  })

  it('moves farther toward a new measurement after a seven-day gap', () => {
    const oneDay = currentTrendWeight([
      entry('a', '2026-06-01', 190),
      entry('b', '2026-06-02', 180),
    ])
    const sevenDays = currentTrendWeight([
      entry('a', '2026-06-01', 190),
      entry('b', '2026-06-08', 180),
    ])
    expect(sevenDays!).toBeLessThan(oneDay!)
  })

  it('lets every same-day measurement move the trend in its direction', () => {
    const beforeSecondMeasurement = [
      entry('prior', '2026-06-01', 180),
      entry('early', '2026-06-02', 170, '2026-06-02T08:00:00.000Z'),
    ]
    const trendBefore = currentTrendWeight(beforeSecondMeasurement)
    const laterWeight = 175

    expect(laterWeight).toBeLessThan(trendBefore!)

    const trendAfter = currentTrendWeight([
      ...beforeSecondMeasurement,
      entry('late', '2026-06-02', laterWeight, '2026-06-02T20:00:00.000Z'),
    ])

    expect(trendAfter).toBeLessThan(trendBefore!)
    expect(trendAfter).toBe(176.9)
  })

  it('is independent of input order', () => {
    const entries = [
      entry('a', '2026-06-01', 190),
      entry('b', '2026-06-05', 185),
      entry('c', '2026-06-10', 180),
    ]
    expect(currentTrendWeight([...entries].reverse())).toBe(
      currentTrendWeight(entries),
    )
  })
})

function entry(
  id: string,
  localDate: string,
  weight: number,
  timestamp = `${localDate}T12:00:00.000Z`,
): BodyweightEntry {
  return {
    id,
    localDate: localDate as LocalDateString,
    weight,
    unit: 'lb',
    notes: '',
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}
