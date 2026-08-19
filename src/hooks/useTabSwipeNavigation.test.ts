import { describe, expect, it } from 'vitest'

import { resolveTabSwipeTarget } from './useTabSwipeNavigation'

describe('resolveTabSwipeTarget', () => {
  it('advances to the next tab on a decisive left swipe', () => {
    expect(resolveTabSwipeTarget('/', -80, 0)).toBe('/nutrition')
    expect(resolveTabSwipeTarget('/nutrition', -80, 0)).toBe('/training')
    expect(resolveTabSwipeTarget('/training', -80, 0)).toBe('/run')
  })

  it('returns to the previous tab on a decisive right swipe', () => {
    expect(resolveTabSwipeTarget('/run', 80, 0)).toBe('/training')
    expect(resolveTabSwipeTarget('/nutrition', 80, 0)).toBe('/')
  })

  it('does not wrap around past the first or last tab', () => {
    expect(resolveTabSwipeTarget('/', 80, 0)).toBeNull()
    expect(resolveTabSwipeTarget('/run', -80, 0)).toBeNull()
  })

  it('ignores swipes that are too short to be intentional', () => {
    expect(resolveTabSwipeTarget('/', -40, 0)).toBeNull()
  })

  it('ignores swipes dominated by vertical movement (a scroll)', () => {
    expect(resolveTabSwipeTarget('/', -70, 200)).toBeNull()
  })

  it('ignores routes that are not part of the primary tab set', () => {
    expect(resolveTabSwipeTarget('/workout', -120, 0)).toBeNull()
    expect(resolveTabSwipeTarget('/settings', -120, 0)).toBeNull()
  })
})
