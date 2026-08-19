import { describe, expect, it } from 'vitest'

import {
  MAX_ANALYTICS_QUEUE,
  computeLaunchMetrics,
  isAnalyticsEventName,
  isValidInstallId,
  resolveAnalyticsActive,
  sanitizeAnalyticsEvents,
  type AnalyticsRecord,
} from '@domain/analytics'
import type { LocalDateString } from '@domain/dates'

const INSTALL_A = '11111111-1111-4111-8111-111111111111'
const INSTALL_B = '22222222-2222-4222-8222-222222222222'
const INSTALL_C = '33333333-3333-4333-8333-333333333333'

describe('event-name and install-id guards', () => {
  it('accepts only known event names', () => {
    expect(isAnalyticsEventName('app_opened')).toBe(true)
    expect(isAnalyticsEventName('workout_logged')).toBe(true)
    expect(isAnalyticsEventName('meal_logged')).toBe(true)
    expect(isAnalyticsEventName('run_tracked')).toBe(true)
    expect(isAnalyticsEventName('page_view')).toBe(false)
    expect(isAnalyticsEventName(42)).toBe(false)
  })

  it('accepts only UUID-shaped install ids', () => {
    expect(isValidInstallId(INSTALL_A)).toBe(true)
    expect(isValidInstallId('not-a-uuid')).toBe(false)
    expect(isValidInstallId('user@example.com')).toBe(false)
    expect(isValidInstallId(null)).toBe(false)
  })
})

describe('resolveAnalyticsActive', () => {
  it('requires enabled AND not-DNT AND not-opted-out', () => {
    expect(
      resolveAnalyticsActive({
        enabled: true,
        doNotTrack: false,
        optedOut: false,
      }),
    ).toBe(true)
    expect(
      resolveAnalyticsActive({
        enabled: false,
        doNotTrack: false,
        optedOut: false,
      }),
    ).toBe(false)
    expect(
      resolveAnalyticsActive({
        enabled: true,
        doNotTrack: true,
        optedOut: false,
      }),
    ).toBe(false)
    expect(
      resolveAnalyticsActive({
        enabled: true,
        doNotTrack: false,
        optedOut: true,
      }),
    ).toBe(false)
  })
})

describe('sanitizeAnalyticsEvents', () => {
  it('keeps only name + day and drops any extra (potentially identifying) fields', () => {
    const events = sanitizeAnalyticsEvents([
      {
        name: 'app_opened',
        day: '2026-08-01',
        userId: 'secret',
        latitude: 30.27,
        email: 'a@b.com',
      },
    ])
    expect(events).toEqual([{ name: 'app_opened', day: '2026-08-01' }])
    expect(Object.keys(events[0])).toEqual(['name', 'day'])
  })

  it('drops unknown event names and malformed days', () => {
    expect(
      sanitizeAnalyticsEvents([
        { name: 'page_view', day: '2026-08-01' },
        { name: 'app_opened', day: '08/01/2026' },
        { name: 'app_opened', day: '2026-08-02' },
        'garbage',
        null,
      ]),
    ).toEqual([{ name: 'app_opened', day: '2026-08-02' }])
  })

  it('caps the queue at MAX_ANALYTICS_QUEUE, keeping the newest', () => {
    const many = Array.from(
      { length: MAX_ANALYTICS_QUEUE + 50 },
      (_, index) => ({
        name: 'app_opened' as const,
        day: `2026-08-${String((index % 28) + 1).padStart(2, '0')}`,
      }),
    )
    const sanitized = sanitizeAnalyticsEvents(many)
    expect(sanitized).toHaveLength(MAX_ANALYTICS_QUEUE)
    expect(sanitized.at(-1)).toEqual(many.at(-1))
  })

  it('returns an empty list for non-array input', () => {
    expect(sanitizeAnalyticsEvents('nope')).toEqual([])
    expect(sanitizeAnalyticsEvents(undefined)).toEqual([])
  })
})

describe('computeLaunchMetrics', () => {
  const day = (value: string) => value as LocalDateString
  const records: AnalyticsRecord[] = [
    { installId: INSTALL_A, day: day('2026-08-01'), name: 'app_opened' },
    { installId: INSTALL_A, day: day('2026-08-01'), name: 'workout_logged' },
    { installId: INSTALL_A, day: day('2026-08-08'), name: 'app_opened' },
    { installId: INSTALL_B, day: day('2026-08-01'), name: 'app_opened' },
    { installId: INSTALL_C, day: day('2026-08-08'), name: 'app_opened' },
    { installId: INSTALL_C, day: day('2026-08-08'), name: 'meal_logged' },
  ]

  it('computes installs and activation (workout/meal/run count, app_opened alone does not)', () => {
    const metrics = computeLaunchMetrics(records)
    expect(metrics.installs).toBe(3)
    expect(metrics.activated).toBe(2) // A (workout) and C (meal); B only opened
    expect(metrics.activationRate).toBeCloseTo(2 / 3)
  })

  it('computes D1/D7/D30 retention against the newest observed day', () => {
    const metrics = computeLaunchMetrics(records)
    // Reference day is 2026-08-08. C (first seen day 8) is not yet eligible.
    expect(metrics.retention.d1).toEqual({
      eligible: 2,
      returned: 1,
      rate: 0.5,
    })
    expect(metrics.retention.d7).toEqual({
      eligible: 2,
      returned: 1,
      rate: 0.5,
    })
    expect(metrics.retention.d30).toEqual({ eligible: 0, returned: 0, rate: 0 })
  })

  it('ignores records with invalid ids/days/names', () => {
    const metrics = computeLaunchMetrics([
      ...records,
      {
        installId: 'bad',
        day: day('2026-08-01'),
        name: 'app_opened',
      } as AnalyticsRecord,
    ])
    expect(metrics.installs).toBe(3)
  })

  it('returns zeroed metrics for no records', () => {
    const metrics = computeLaunchMetrics([])
    expect(metrics).toEqual({
      installs: 0,
      activated: 0,
      activationRate: 0,
      retention: {
        d1: { eligible: 0, returned: 0, rate: 0 },
        d7: { eligible: 0, returned: 0, rate: 0 },
        d30: { eligible: 0, returned: 0, rate: 0 },
      },
    })
  })
})
