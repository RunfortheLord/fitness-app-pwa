import { describe, expect, it } from 'vitest'

import {
  TREND_SMOOTHING,
  currentTrendWeight,
  latestBodyweightEntryPerCalendarDate,
  trendWeightSeries,
} from '@domain/bodyweightTrend'
import type { LocalDateString } from '@domain/dates'
import type { BodyweightEntry } from '@shared-types/app'

describe('calendar-day-aware bodyweight trend', () => {
  it('uses the daily smoothing factor for consecutive measurements', () => {
    const series = trendWeightSeries([
      entry('a', '2026-01-01', 200),
      entry('b', '2026-01-02', 210),
    ])
    expect(series[1].trend).toBeCloseTo(200 + TREND_SMOOTHING * 10, 5)
  })

  it('linearly interpolates every missing calendar date before smoothing', () => {
    const series = trendWeightSeries([
      entry('a', '2026-06-01', 190),
      entry('b', '2026-06-04', 184),
    ])

    expect(series.map((point) => point.localDate)).toEqual([
      '2026-06-01',
      '2026-06-02',
      '2026-06-03',
      '2026-06-04',
    ])
    expect(series.map((point) => point.weight)).toEqual([190, 188, 186, 184])
    expect(series.at(-1)?.trend).toBeCloseTo(188.878, 5)
  })

  it('does not give a post-gap measurement the full compounded influence', () => {
    const series = trendWeightSeries([
      entry('a', '2026-06-01', 190),
      entry('b', '2026-06-08', 180),
    ])
    const latest = series.at(-1)

    expect(latest?.weight).toBe(180)
    expect(latest?.trend).toBeGreaterThan(180)
    expect(latest?.trend).toBeLessThan(189)
    expect(
      currentTrendWeight([
        entry('a', '2026-06-01', 190),
        entry('b', '2026-06-08', 180),
      ]),
    ).toBeCloseTo(latest!.trend, 1)
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
