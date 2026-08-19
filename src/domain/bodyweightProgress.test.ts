import { describe, expect, it } from 'vitest'

import {
  createBodyweightChartModel,
  filterBodyweightEntriesForRange,
  formatBodyweightChange,
  formatBodyweightWeeklyChange,
  latestBodyweight,
  summarizeBodyweightTrend,
} from '@domain/bodyweightProgress'
import { currentTrendWeight } from '@domain/bodyweightTrend'
import type { BodyweightEntry } from '@shared-types/app'

describe('bodyweightProgress', () => {
  it('uses the latest timestamped same-day entry as current bodyweight', () => {
    const entries = [
      entry('a', '2026-06-19', 188, '2026-06-19T12:00:00.000Z'),
      entry('b', '2026-06-19', 189, '2026-06-19T22:00:00.000Z'),
    ]

    expect(latestBodyweight(entries)).toMatchObject({ id: 'b', weight: 189 })
  })

  it('summarizes empty, one-point, and multi-point trends accessibly', () => {
    expect(summarizeBodyweightTrend([])).toEqual({ status: 'empty' })
    expect(
      summarizeBodyweightTrend([
        entry('a', '2026-06-19', 188, '2026-06-19T12:00:00.000Z'),
      ]),
    ).toMatchObject({ status: 'single' })

    const summary = summarizeBodyweightTrend([
      entry('a', '2026-06-01', 190, '2026-06-01T12:00:00.000Z'),
      entry('b', '2026-06-19', 188.5, '2026-06-19T12:00:00.000Z'),
    ])

    expect(summary).toMatchObject({
      status: 'ready',
      weeklyChange: expect.any(Number),
      direction: 'down',
    })
    expect(summary.status === 'ready' ? summary.weeklyChange : 0).toBeLessThan(
      0,
    )
    expect(summary.status === 'ready' ? summary.text : '').toContain('per week')
  })

  it('filters ranges by local dates across daylight-saving boundaries', () => {
    const entries = [
      entry('before', '2026-02-28', 190, '2026-03-01T04:30:00.000Z'),
      entry('start', '2026-03-08', 189, '2026-03-08T07:30:00.000Z'),
      entry('latest', '2026-04-08', 188, '2026-04-08T12:00:00.000Z'),
    ]

    expect(
      filterBodyweightEntriesForRange({
        entries,
        range: '1m',
        today: '2026-04-08',
      }).map((item) => item.id),
    ).toEqual(['start', 'latest'])
  })

  it('creates chart points for long history without dropping source records', () => {
    const entries = Array.from({ length: 40 }, (_, index) =>
      entry(
        `weight-${index}`,
        `2026-05-${String((index % 28) + 1).padStart(2, '0')}` as BodyweightEntry['localDate'],
        180 + index * 0.1,
        `2026-05-${String((index % 28) + 1).padStart(2, '0')}T12:00:00.000Z`,
      ),
    )

    const model = createBodyweightChartModel(entries)

    expect(model.status).toBe('ready')
    expect(model.entries).toHaveLength(40)
    expect(model.status === 'ready' ? model.points : []).toHaveLength(40)
  })

  it('adds a smoothed trend series without replacing raw chart points', () => {
    const model = createBodyweightChartModel([
      entry('first', '2026-06-01', 190, '2026-06-01T12:00:00.000Z'),
      entry('latest', '2026-06-03', 186, '2026-06-03T12:00:00.000Z'),
    ])

    expect(model.status).toBe('ready')
    if (model.status === 'empty') {
      throw new Error('Expected chart data.')
    }
    expect(model.points).toHaveLength(2)
    expect(model.trendPoints.map((point) => point.localDate)).toEqual([
      '2026-06-01',
      '2026-06-02',
      '2026-06-03',
    ])
    expect(model.trendPoints.map((point) => point.x)).toEqual([0, 50, 100])
    expect(model.trendPoints[1].weight).toBeCloseTo(189.8, 5)
    expect(model.trendPoints[2].weight).toBeCloseTo(189.42, 5)
  })

  it('does not create a trend line from same-day raw entries alone', () => {
    const model = createBodyweightChartModel([
      entry('early', '2026-06-01', 190, '2026-06-01T12:00:00.000Z'),
      entry('late', '2026-06-01', 188, '2026-06-01T20:00:00.000Z'),
    ])

    expect(model.status).toBe('ready')
    if (model.status === 'empty') {
      throw new Error('Expected chart data.')
    }
    expect(model.points).toHaveLength(2)
    expect(model.trendPoints).toEqual([])
  })

  it('smooths full history before clipping the trend to the visible range', () => {
    const allEntries = [
      entry('seed', '2026-01-01', 220, '2026-01-01T12:00:00.000Z'),
      entry('visible-first', '2026-06-01', 190, '2026-06-01T12:00:00.000Z'),
      entry('visible-latest', '2026-06-03', 188, '2026-06-03T12:00:00.000Z'),
    ]
    const model = createBodyweightChartModel(
      allEntries.slice(1),
      'lb',
      allEntries,
    )

    expect(model.status).toBe('ready')
    if (model.status === 'empty') {
      throw new Error('Expected chart data.')
    }
    expect(model.trendPoints[0].localDate).toBe('2026-06-01')
    expect(Number(model.trendPoints.at(-1)?.weight.toFixed(1))).toBe(
      currentTrendWeight(allEntries),
    )
    expect(
      model.trendPoints.every(
        (point) =>
          point.x >= 0 && point.x <= 100 && point.y >= 0 && point.y <= 100,
      ),
    ).toBe(true)
  })

  it('keeps an edited backdated entry between its neighboring chart dates', () => {
    const edited = {
      ...entry('edited', '2026-06-02', 189, '2026-07-20T20:00:00.000Z'),
      createdAt: '2026-06-02T08:00:00.000Z',
    }
    const model = createBodyweightChartModel([
      entry('first', '2026-06-01', 190, '2026-06-01T08:00:00.000Z'),
      edited,
      entry('latest', '2026-06-03', 188, '2026-06-03T08:00:00.000Z'),
    ])

    expect(model.status).toBe('ready')
    if (model.status === 'empty') {
      throw new Error('Expected chart data.')
    }
    const pointX = (id: string) => {
      const point = model.points.find((candidate) => candidate.entry.id === id)
      if (!point) {
        throw new Error(`Expected chart point ${id}.`)
      }
      return point.x
    }
    expect(pointX('first')).toBeLessThan(pointX('edited'))
    expect(pointX('edited')).toBeLessThan(pointX('latest'))
  })

  it('centers a lone chart point so it clears the y-axis labels', () => {
    const model = createBodyweightChartModel([
      entry('only', '2026-06-19', 188, '2026-06-19T12:00:00.000Z'),
    ])

    expect(model.status).toBe('single')
    expect(model.status !== 'empty' ? model.points[0]?.x : null).toBe(50)
  })

  it('formats bodyweight changes without relying only on direction', () => {
    expect(formatBodyweightChange(1.25)).toBe('+1.3 lb')
    expect(formatBodyweightChange(-1)).toBe('-1 lb')
    expect(formatBodyweightChange(0.01)).toBe('0 lb')
    expect(formatBodyweightWeeklyChange(1.25)).toBe('+1.3 lb/week')
  })

  it('renders the trend summary and change in the chosen unit', () => {
    const entries = [
      entry('a', '2026-06-01', 200, '2026-06-01T12:00:00.000Z'),
      entry('b', '2026-06-19', 190, '2026-06-19T12:00:00.000Z'),
    ]

    // 200 lb -> 90.7 kg, 190 lb -> 86.2 kg, change -10 lb -> 4.5 kg.
    const summary = summarizeBodyweightTrend(entries, 'kg')
    expect(summary.status === 'ready' ? summary.text : '').toContain(
      'kg per week',
    )
    expect(formatBodyweightChange(-10, 'kg')).toBe('-4.5 kg')
    expect(formatBodyweightWeeklyChange(-10, 'kg')).toBe('-4.5 kg/week')
    expect(formatBodyweightChange(0.01, 'kg')).toBe('0 kg')
  })
})

function entry(
  id: string,
  localDate: BodyweightEntry['localDate'],
  weight: number,
  updatedAt: string,
): BodyweightEntry {
  return {
    id,
    localDate,
    weight,
    unit: 'lb',
    notes: '',
    createdAt: updatedAt,
    updatedAt,
  }
}
