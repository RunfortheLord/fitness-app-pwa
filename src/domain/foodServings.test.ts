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

  it('defaults common foods to household units while keeping grams available', () => {
    const cases = [
      ['Egg, whole, cooked', 'egg', '1 egg'],
      ['Banana, raw', 'medium-banana', '1 medium banana'],
      ['Waffles, plain', 'waffle', '1 waffle'],
      ['Bread, whole wheat', 'slice', '1 slice'],
      ['Tortilla, flour', 'tortilla', '1 tortilla'],
    ] as const

    for (const [name, key, label] of cases) {
      const options = servingOptionsForFood({
        ...baseFood,
        id: key,
        name,
        rawCookedStatus: 'unknown',
      })

      expect(options[0]).toMatchObject({ key, amount: 1, label })
      expect(options.find((option) => option.key === 'g')).toBeDefined()
      expect(options[0].toServingMultiplier(2)).toBeGreaterThan(0)
    }
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

  it('does not double the amount when the serving unit already includes it', () => {
    const food: Food = {
      ...baseFood,
      id: 'protein-bar',
      name: 'Protein bar',
      servingQuantity: 1,
      servingUnit: '36 g',
      servingDescription: '36 g',
      gramsPerServing: 36,
      ouncesPerServing: 1.27,
      providerDataType: 'Branded',
    }

    expect(servingOptionsForFood(food)[0].label).toBe('36 g')
    // Avoids both "1 36 g" and the redundant "36 g (36 g)".
    expect(formatFoodServingLabel(food)).toBe('36 g')
  })

  it('still shows the household amount for branded foods without a numeric unit', () => {
    const food: Food = {
      ...baseFood,
      id: 'crackers',
      name: 'Crackers',
      servingQuantity: 5,
      servingUnit: 'crackers',
      servingDescription: '5 crackers',
      gramsPerServing: 30,
      ouncesPerServing: 1.058,
      providerDataType: 'Branded',
    }

    expect(formatFoodServingLabel(food)).toBe('5 crackers (30 g)')
  })

  it('formats calories and macros for display', () => {
    expect(formatCalories(123.6)).toBe('124')
    expect(formatMacroGram(3)).toBe('3.0')
    expect(formatMacroGram(3.24)).toBe('3.2')
  })
})
