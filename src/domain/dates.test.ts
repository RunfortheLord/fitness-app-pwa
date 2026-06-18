import { describe, expect, it } from 'vitest'

import { formatLocalDate } from '@domain/dates'

describe('formatLocalDate', () => {
  it('returns a YYYY-MM-DD local calendar date', () => {
    const date = new Date(2026, 5, 18, 12, 30, 0)

    expect(formatLocalDate(date)).toBe('2026-06-18')
  })
})
