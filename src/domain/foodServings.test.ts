import { describe, expect, it } from 'vitest'

import {
  formatCalories,
  formatFoodServingLabel,
  formatMacroGram,
  servingOptionsForFood,
} from './foodServings'
import type { Food } from '@shared-types/app'

const baseFood: Food = {
  id: 'food-1',
  name: 'Chicken breast, cooked',
  servingQuantity: 100,
  servingUnit: 'g',
  servingDescription: '100 g',
  gramsPerServing: 100,
  ouncesPerServing: 3.5274,
  servingConversionReliable: true,
  servingConversionSource: 'per_100g',
  caloriesPerServing: 165,
  proteinGramsPerServing: 31,
  carbohydrateGramsPerServing: 0,
  fatGramsPerServing: 3.6,
  sourceType: 'provider',
  provider: 'usda',
  providerDataType: 'Foundation',
  notes: '',
  status: 'active',
  rawCookedStatus: 'cooked',
  macroBasis: 'per_100g',
  createdAt: '2026-06-21T00:00:00.000Z',
  updatedAt: '2026-06-21T00:00:00.000Z',
}

describe('food serving helpers', () => {
  it('defaults cooked chicken breast to 4 oz while keeping grams secondary', () => {
    const options = servingOptionsForFood(baseFood)

    expect(options[0]).toMatchObject({
      key: 'oz',
      amount: 4,
      label: '4 oz cooked',
      group: 'primary',
    })
    expect(options.find((option) => option.key === '100g')).toMatchObject({
      group: 'more',
    })
    expect(options[0].toServingMultiplier(4)).toBeCloseTo(1.13398, 4)
  })

  it('labels raw chicken breast explicitly as raw', () => {
    const options = servingOptionsForFood({
      ...baseFood,
      name: 'Chicken breast, raw',
      rawCookedStatus: 'raw',
    })

    expect(options[0].label).toBe('4 oz raw')
  })

  it('defaults cooked rice to one cup', () => {
    const options = servingOptionsForFood({
      ...baseFood,
      id: 'rice',
      name: 'Rice, white, cooked',
      rawCookedStatus: 'cooked',
      caloriesPerServing: 130,
      proteinGramsPerServing: 2.7,
      carbohydrateGramsPerServing: 28,
      fatGramsPerServing: 0.3,
    })

    expect(options[0]).toMatchObject({ key: 'cup', amount: 1, label: '1 cup' })
  })

  it('uses branded label servings and displays two-cookie serving weights', () => {
    const food: Food = {
      ...baseFood,
      id: 'cookies',
      name: 'Chocolate cookies',
      servingQuantity: 2,
      servingUnit: 'cookies',
      servingDescription: '2 cookies',
      gramsPerServing: 30,
      ouncesPerServing: 1.058,
      providerDataType: 'Branded',
    }

    expect(formatFoodServingLabel(food)).toBe('2 cookies (30 g)')
  })

  it('formats calories and macros for display', () => {
    expect(formatCalories(123.6)).toBe('124')
    expect(formatMacroGram(3)).toBe('3.0')
    expect(formatMacroGram(3.24)).toBe('3.2')
  })
})
