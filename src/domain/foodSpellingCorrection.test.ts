import { describe, expect, it } from 'vitest'

import { correctFoodQuery } from './foodSpellingCorrection'

describe('correctFoodQuery', () => {
  it('corrects an obvious one-edit misspelling of a common food', () => {
    expect(correctFoodQuery('chiken')).toBe('chicken')
    expect(correctFoodQuery('brocoli')).toBe('broccoli')
    expect(correctFoodQuery('Chiken')).toBe('chicken')
  })

  it('only rewrites the misspelled token in a multiword query', () => {
    expect(correctFoodQuery('grilled chiken')).toBe('grilled chicken')
    expect(correctFoodQuery('avacado toast')).toBe('avocado toast')
  })

  it('leaves a token ambiguous between several lexicon words unchanged', () => {
    // Equidistant from both "meatball" and "meatballs".
    expect(correctFoodQuery('meatballz')).toBeNull()
  })

  it('leaves correctly spelled queries unchanged', () => {
    expect(correctFoodQuery('chicken')).toBeNull()
    expect(correctFoodQuery('chicken breast')).toBeNull()
    expect(correctFoodQuery('white rice')).toBeNull()
    expect(correctFoodQuery('premier protein')).toBeNull()
  })

  it('does not touch short tokens or unknown words far from the lexicon', () => {
    expect(correctFoodQuery('greek')).toBeNull()
    expect(correctFoodQuery('chobani')).toBeNull()
    expect(correctFoodQuery('fairlife')).toBeNull()
  })
})
