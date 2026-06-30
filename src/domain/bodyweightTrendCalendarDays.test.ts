import { describe, expect, it } from 'vitest'

import {
  TREND_SMOOTHING,
  currentTrendWeight,
  effectiveTrendAlphaForCalendarDays,
  latestBodyweightEntryPerCalendarDate,
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

  it('uses only the latest entry from legacy same-day data', () => {
    const entries = [
      entry('early', '2026-06-01', 190, '2026-06-01T12:00:00.000Z'),
      entry('late', '2026-06-01', 188, '2026-06-01T20:00:00.000Z'),
      entry('next', '2026-06-02', 187, '2026-06-02T12:00:00.000Z'),
    ]
    expect(
      latestBodyweightEntryPerCalendarDate(entries).map((item) => item.id),
    ).toEqual(['late', 'next'])
    expect(trendWeightSeries(entries)).toHaveLength(2)
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
