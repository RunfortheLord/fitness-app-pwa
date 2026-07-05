import { describe, expect, it } from 'vitest'

import {
  amountStepForUnit,
  formatAmountValue,
  formatCalories,
  formatFoodServingLabel,
  formatGrams,
  formatMacroGram,
  formatQuantityChipLabel,
  nextSteppedAmount,
  quantityChipsForUnit,
  servingOptionsForFood,
} from './foodServings'
import {
  normalizeFoodText,
  type NormalizedFoodPortion,
  type NormalizedFoodResult,
} from './foodProviderModels'
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

  it('defaults plain meat cuts to ounces', () => {
    const cases = [
      'Chicken thigh, cooked',
      'Beef, ground, cooked',
      'Pork chop, grilled',
      'Salmon, baked',
      'Turkey breast, roasted',
    ]
    for (const name of cases) {
      const options = servingOptionsForFood({ ...baseFood, id: name, name })
      expect(options[0]).toMatchObject({ key: 'oz', amount: 4, label: '4 oz' })
    }
  })

  it('defaults meat cuts to ounces even for branded products with a label serving', () => {
    const options = servingOptionsForFood({
      ...baseFood,
      id: 'branded-beef',
      name: 'Ground Beef 80/20',
      servingQuantity: 1,
      servingUnit: 'serving',
      servingDescription: '1 serving',
      providerDataType: 'Branded',
    })
    expect(options[0]).toMatchObject({ key: 'oz', amount: 4 })
  })

  it('keeps prepared meat dishes on their household serving rather than ounces', () => {
    const options = servingOptionsForFood({
      ...baseFood,
      id: 'soup',
      name: 'Chicken noodle soup',
      servingQuantity: 1,
      servingUnit: 'cup',
      servingDescription: '1 cup',
      rawCookedStatus: 'cooked',
    })
    expect(options[0].key).not.toBe('oz')
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

  it('exposes provider household portions as units with their gram weights', () => {
    const food = providerFood('Yogurt, Greek, plain', 245, [
      { amount: 1, unit: 'cup', description: '', gramWeight: 245 },
      { amount: 1, unit: 'container', description: '', gramWeight: 170 },
      { amount: 1, unit: 'oz', description: '', gramWeight: 28.35 },
      { amount: 1, unit: 'undetermined', description: '', gramWeight: 200 },
    ])

    const options = servingOptionsForFood(food)
    const keys = options.map((option) => option.key)

    // Both meaningful household portions are selectable.
    expect(keys).toContain('cup')
    expect(keys).toContain('container')
    // Mass-only and meaningless portion units are not duplicated as portions.
    expect(keys.filter((key) => key === 'oz')).toHaveLength(1)
    expect(keys).not.toContain('undetermined')

    const container = options.find((option) => option.key === 'container')!
    expect(container.label).toBe('1 container (170 g)')
    // 2 containers = 340 g; the food's serving is 245 g, so 340/245 servings.
    expect(container.toServingMultiplier(2)).toBeCloseTo(340 / 245, 5)
  })

  it('caps portion variants to the most common few and drops same-weight duplicates', () => {
    const food = providerFood('Granola', 100, [
      { amount: 1, unit: 'cup', description: '', gramWeight: 240 },
      { amount: 1, unit: 'bowl', description: '', gramWeight: 300 },
      { amount: 1, unit: 'scoop', description: '', gramWeight: 120 },
      { amount: 1, unit: 'handful', description: '', gramWeight: 60 },
      { amount: 1, unit: 'fistful', description: '', gramWeight: 60 }, // dup grams
      { amount: 1, unit: 'ladle', description: '', gramWeight: 400 },
      { amount: 1, unit: 'spoon', description: '', gramWeight: 15 },
    ])

    const keys = servingOptionsForFood(food).map((option) => option.key)
    // Most-common portions are kept...
    expect(keys).toEqual(
      expect.arrayContaining(['cup', 'bowl', 'scoop', 'handful']),
    )
    // ...the same-weight duplicate and the overflow beyond the cap are dropped.
    expect(keys).not.toContain('fistful')
    expect(keys).not.toContain('ladle')
    expect(keys).not.toContain('spoon')
  })

  it('orders portions before the weight units', () => {
    const food = providerFood('Bagel, plain', 105, [
      { amount: 1, unit: 'bagel', description: '', gramWeight: 105 },
    ])

    const keys = servingOptionsForFood(food).map((option) => option.key)
    expect(keys.indexOf('bagel')).toBeLessThan(keys.indexOf('oz'))
    expect(keys.indexOf('oz')).toBeLessThan(keys.indexOf('g'))
    expect(keys.indexOf('g')).toBeLessThan(keys.indexOf('100g'))
  })

  it('formats calories and macros for display', () => {
    expect(formatCalories(123.6)).toBe('124')
    expect(formatMacroGram(3)).toBe('3.0')
    expect(formatMacroGram(3.24)).toBe('3.2')
  })
})

describe('quick-amount helpers', () => {
  it('offers cooking fractions for serving/portion units', () => {
    expect(quantityChipsForUnit('serving')).toEqual([
      0.25,
      1 / 3,
      0.5,
      0.75,
      1,
      1.5,
      2,
    ])
    expect(quantityChipsForUnit('egg')).toContain(1)
  })

  it('offers weight steps for mass units instead of fractions', () => {
    expect(quantityChipsForUnit('oz')).toEqual([1, 2, 3, 4, 6, 8])
    expect(quantityChipsForUnit('g')).toEqual([25, 50, 100, 150, 200])
    expect(quantityChipsForUnit('100g')).toEqual([25, 50, 100, 150, 200])
  })

  it('labels common fractions with glyphs', () => {
    expect(formatQuantityChipLabel(0.25)).toBe('¼')
    expect(formatQuantityChipLabel(1 / 3)).toBe('⅓')
    expect(formatQuantityChipLabel(0.5)).toBe('½')
    expect(formatQuantityChipLabel(0.75)).toBe('¾')
    expect(formatQuantityChipLabel(1.5)).toBe('1½')
    expect(formatQuantityChipLabel(2)).toBe('2')
    expect(formatQuantityChipLabel(150)).toBe('150')
  })

  it('uses unit-appropriate stepper increments', () => {
    expect(amountStepForUnit('serving')).toBe(0.5)
    expect(amountStepForUnit('oz')).toBe(1)
    expect(amountStepForUnit('g')).toBe(10)
    expect(amountStepForUnit('100g')).toBe(10)
  })

  it('steps amounts and blocks decrements past zero', () => {
    expect(nextSteppedAmount(1, 'serving', 1)).toBe(1.5)
    expect(nextSteppedAmount(1, 'serving', -1)).toBe(0.5)
    expect(nextSteppedAmount(0.5, 'serving', -1)).toBeNull()
    expect(nextSteppedAmount(0.25, 'serving', -1)).toBeNull()
    expect(nextSteppedAmount(100, 'g', -1)).toBe(90)
  })

  it('stringifies amounts without long-decimal noise', () => {
    expect(formatAmountValue(1)).toBe('1')
    expect(formatAmountValue(1 / 3)).toBe('0.333')
    expect(formatAmountValue(0.5)).toBe('0.5')
  })

  it('formats resulting grams readably', () => {
    expect(formatGrams(168)).toBe('168 g')
    expect(formatGrams(167.6)).toBe('168 g')
    expect(formatGrams(4.27)).toBe('4.3 g')
  })
})

function providerFood(
  name: string,
  gramsPerServing: number,
  sourcePortions: NormalizedFoodPortion[],
): NormalizedFoodResult {
  return {
    id: `usda:${name}`,
    source: {
      provider: 'usda',
      providerRecordId: name,
      providerDataType: 'Survey (FNDDS)',
      sourceName: 'test',
      sourceUrl: null,
      barcode: null,
      sourceUpdatedAt: null,
      ingestedAt: '2026-06-26T00:00:00.000Z',
    },
    name,
    brandName: null,
    foodCategory: null,
    descriptionQualifiers: [],
    rawCookedStatus: 'unknown',
    rawCookedBasis: null,
    serving: {
      quantity: 1,
      unit: 'serving',
      description: '',
      gramsPerServing,
      ouncesPerServing: gramsPerServing / 28.349523125,
      conversionReliable: true,
      conversionSource: 'provider_serving_weight',
      sourcePortions,
    },
    macrosPerServing: {
      calories: 150,
      proteinGrams: 12,
      carbohydrateGrams: 10,
      fatGrams: 6,
    },
    macrosPer100Grams: {
      calories: 150,
      proteinGrams: 12,
      carbohydrateGrams: 10,
      fatGrams: 6,
    },
    macroBasis: 'both',
    sourcePrecision: {},
    normalizedSearchName: normalizeFoodText(name),
    normalizedBrand: null,
    providerPriority: 1,
    relevanceScore: 0,
    duplicateGroupId: `usda:${name}`,
    alternateResultIds: [],
    groupingReasons: [],
    normalizerVersion: 1,
  }
}
