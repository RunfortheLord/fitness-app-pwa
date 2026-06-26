import { describe, expect, it } from 'vitest'

import {
  createBodyweightChartModel,
  filterBodyweightEntriesForRange,
  formatBodyweightChange,
  latestBodyweight,
  summarizeBodyweightTrend,
} from '@domain/bodyweightProgress'
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
      change: -1.5,
      direction: 'down',
    })
    expect(summary.status === 'ready' ? summary.text : '').toContain(
      'from 190 to 188.5 lb',
    )
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
