import { describe, expect, it } from 'vitest'

import { translate } from '@domain/localization'

describe('translate', () => {
  it('returns Spanish translations and replaces variables', () => {
    expect(
      translate('es', 'Exercise {current} of {total}', {
        current: 2,
        total: 5,
      }),
    ).toBe('Ejercicio 2 de 5')
  })

  it('keeps English and unknown user-provided text unchanged', () => {
    expect(translate('en', 'Nutrition')).toBe('Nutrition')
    expect(translate('es', 'My custom program')).toBe('My custom program')
  })
})
