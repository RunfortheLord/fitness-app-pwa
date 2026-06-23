import { describe, expect, it } from 'vitest'

import { calculateEffectiveLoad } from './effectiveLoad'

describe('calculateEffectiveLoad', () => {
  it('keeps barbell-style exercises external-load only', () => {
    expect(
      calculateEffectiveLoad({
        bodyweight: 185,
        bodyweightLoadMode: 'external_weight_only',
        externalLoad: 225,
      }),
    ).toBe(225)
  })

  it('adds bodyweight for suspended bodyweight movements', () => {
    expect(
      calculateEffectiveLoad({
        bodyweight: 185,
        bodyweightLoadMode: 'bodyweight_plus_external',
        externalLoad: 45,
      }),
    ).toBe(230)
  })

  it('adds a bodyweight percentage for pushup-style movements', () => {
    expect(
      calculateEffectiveLoad({
        bodyweight: 185,
        bodyweightLoadMode: 'bodyweight_percentage_plus_external',
        bodyweightPercentage: 64,
        externalLoad: 25,
      }),
    ).toBeCloseTo(143.4)
  })
})
