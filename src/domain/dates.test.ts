import { describe, expect, it } from 'vitest'

import {
  addLocalDays,
  formatLocalDate,
  formatSelectedDateLabel,
  parseLocalDate,
} from '@domain/dates'

describe('formatLocalDate', () => {
  it('returns a YYYY-MM-DD local calendar date', () => {
    const date = new Date(2026, 5, 18, 12, 30, 0)

    expect(formatLocalDate(date)).toBe('2026-06-18')
  })

  it('uses the local calendar date near UTC midnight', () => {
    const date = new Date(2026, 5, 18, 23, 59, 0)

    expect(formatLocalDate(date)).toBe('2026-06-18')
  })

  it('adds days by local calendar date without relying on UTC conversion', () => {
    expect(addLocalDays('2026-06-18', 1)).toBe('2026-06-19')
    expect(addLocalDays('2026-06-18', -1)).toBe('2026-06-17')
  })

  it('parses local dates at local midnight for date labels', () => {
    const parsed = parseLocalDate('2026-06-18')

    expect(parsed.getFullYear()).toBe(2026)
    expect(parsed.getMonth()).toBe(5)
    expect(parsed.getDate()).toBe(18)
    expect(formatSelectedDateLabel('2026-06-18')).toBe('Thu, Jun 18')
  })
})
