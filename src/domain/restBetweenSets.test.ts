import { describe, expect, it } from 'vitest'

import {
  hasRestBetweenSets,
  restBetweenSets,
  type RestSetInput,
} from './restBetweenSets'

function set(overrides: Partial<RestSetInput>): RestSetInput {
  return {
    completed: true,
    completedAt: null,
    restSecondsUsed: null,
    ...overrides,
  }
}

describe('restBetweenSets', () => {
  it('derives actual seconds from consecutive completion timestamps', () => {
    const result = restBetweenSets(
      set({ completedAt: '2026-09-08T10:00:00.000Z' }),
      set({ completedAt: '2026-09-08T10:02:14.000Z' }),
    )
    expect(result.actualSeconds).toBe(134)
  })

  it('rounds sub-second gaps to the nearest second', () => {
    const result = restBetweenSets(
      set({ completedAt: '2026-09-08T10:00:00.000Z' }),
      set({ completedAt: '2026-09-08T10:00:30.400Z' }),
    )
    expect(result.actualSeconds).toBe(30)
  })

  it('returns null actual seconds when either set is incomplete', () => {
    expect(
      restBetweenSets(
        set({ completed: false, completedAt: '2026-09-08T10:00:00.000Z' }),
        set({ completedAt: '2026-09-08T10:02:00.000Z' }),
      ).actualSeconds,
    ).toBeNull()
    expect(
      restBetweenSets(
        set({ completedAt: '2026-09-08T10:00:00.000Z' }),
        set({ completed: false, completedAt: '2026-09-08T10:02:00.000Z' }),
      ).actualSeconds,
    ).toBeNull()
  })

  it('returns null actual seconds when a completion timestamp is missing', () => {
    expect(
      restBetweenSets(
        set({ completedAt: null }),
        set({ completedAt: '2026-09-08T10:02:00.000Z' }),
      ).actualSeconds,
    ).toBeNull()
  })

  it('returns null actual seconds when the later set completed first', () => {
    expect(
      restBetweenSets(
        set({ completedAt: '2026-09-08T10:02:00.000Z' }),
        set({ completedAt: '2026-09-08T10:00:00.000Z' }),
      ).actualSeconds,
    ).toBeNull()
  })

  it('exposes the earlier set planned rest when positive', () => {
    const result = restBetweenSets(
      set({ restSecondsUsed: 120, completedAt: '2026-09-08T10:00:00.000Z' }),
      set({ completedAt: '2026-09-08T10:03:00.000Z' }),
    )
    expect(result.plannedSeconds).toBe(120)
  })

  it('ignores zero or invalid planned rest', () => {
    expect(
      restBetweenSets(set({ restSecondsUsed: 0 }), set({})).plannedSeconds,
    ).toBeNull()
    expect(
      restBetweenSets(set({ restSecondsUsed: -5 }), set({})).plannedSeconds,
    ).toBeNull()
  })

  it('reports whether any rest information is present', () => {
    expect(
      hasRestBetweenSets({ actualSeconds: null, plannedSeconds: null }),
    ).toBe(false)
    expect(
      hasRestBetweenSets({ actualSeconds: 90, plannedSeconds: null }),
    ).toBe(true)
    expect(
      hasRestBetweenSets({ actualSeconds: null, plannedSeconds: 120 }),
    ).toBe(true)
  })
})
