import { describe, expect, it } from 'vitest'

import {
  hasRestBetweenSets,
  restBetweenSets,
  type RestSetInput,
} from './restBetweenSets'

function set(overrides: Partial<RestSetInput>): RestSetInput {
  return {
    restSecondsUsed: null,
    ...overrides,
  }
}

describe('restBetweenSets', () => {
  it('exposes the earlier set planned rest when positive', () => {
    const result = restBetweenSets(set({ restSecondsUsed: 120 }))
    expect(result.plannedSeconds).toBe(120)
  })

  it('falls back to the saved exercise default when the set has no override', () => {
    expect(restBetweenSets(set({}), 120).plannedSeconds).toBe(120)
  })

  it('preserves a recorded override including an explicitly disabled timer', () => {
    expect(
      restBetweenSets(set({ restSecondsUsed: 45 }), 120).plannedSeconds,
    ).toBe(45)
    expect(
      restBetweenSets(set({ restSecondsUsed: 0 }), 120).plannedSeconds,
    ).toBeNull()
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'does not display an invalid or disabled saved default: %s',
    (defaultSeconds) => {
      expect(restBetweenSets(set({}), defaultSeconds).plannedSeconds).toBeNull()
    },
  )

  it('ignores zero or invalid planned rest', () => {
    expect(
      restBetweenSets(set({ restSecondsUsed: 0 })).plannedSeconds,
    ).toBeNull()
    expect(
      restBetweenSets(set({ restSecondsUsed: -5 })).plannedSeconds,
    ).toBeNull()
  })

  it('uses an exercise default only when a recorded rest is missing', () => {
    expect(restBetweenSets(set({ restSecondsUsed: null }), 90)).toEqual({
      plannedSeconds: 90,
    })
    expect(restBetweenSets(set({ restSecondsUsed: 0 }), 90)).toEqual({
      plannedSeconds: null,
    })
  })

  it('reports whether any rest information is present', () => {
    expect(hasRestBetweenSets({ plannedSeconds: null })).toBe(false)
    expect(hasRestBetweenSets({ plannedSeconds: 120 })).toBe(true)
  })
})
