import { describe, expect, it } from 'vitest'

import {
  amountStepForUnit,
  findServingOption,
  formatAmountValue,
  formatCalories,
  formatFoodServingLabel,
  formatGrams,
  formatMacroGram,
  formatQuantityChipLabel,
  nextSteppedAmount,
  portionChipsForUnit,
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
      unitLabel: 'oz cooked',
      group: 'primary',
    })
    expect(options.find((option) => option.key === '100g')).toBeUndefined()
    expect(options[0].toServingMultiplier(4)).toBeCloseTo(1.13398, 4)
    expect(options[0].fromServingMultiplier(1.13398)).toBeCloseTo(4, 4)
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

  it('defaults restaurant foods generically to the provider-listed full serving', () => {
    const steak = {
      ...providerFood('Oak Street Grill sirloin steak', 255, [
        {
          amount: 1,
          unit: 'steak',
          description: '1 steak',
          gramWeight: 255,
        },
      ]),
      brandName: 'Oak Street Grill',
      foodCategory: 'Restaurant Foods',
      macrosPerServing: {
        calories: 540,
        proteinGrams: 52,
        carbohydrateGrams: 4,
        fatGrams: 34,
      },
    }
    const platter = {
      ...providerFood('River Road Smokehouse beef brisket', 310, [
        {
          amount: 1,
          unit: 'platter',
          description: '1 platter',
          gramWeight: 310,
        },
      ]),
      brandName: 'River Road Smokehouse',
      foodCategory: 'Fast Foods',
      macrosPerServing: {
        calories: 680,
        proteinGrams: 48,
        carbohydrateGrams: 38,
        fatGrams: 36,
      },
    }

    const steakServing = servingOptionsForFood(steak)[0]
    const platterServing = servingOptionsForFood(platter)[0]
    expect(steakServing).toMatchObject({
      key: 'steak',
      amount: 1,
      label: '1 steak',
    })
    expect(platterServing).toMatchObject({
      key: 'platter',
      amount: 1,
      label: '1 platter',
    })
    expect(
      steak.macrosPerServing.calories *
        (steakServing.toServingMultiplier(steakServing.amount) ?? 0),
    ).toBe(540)
    expect(
      platter.macrosPerServing.calories *
        (platterServing.toServingMultiplier(platterServing.amount) ?? 0),
    ).toBe(680)
  })

  it('recognizes localized restaurant categories from the Spanish provider', () => {
    const platter = {
      ...providerFood('Casa Norte chicken breast', 240, [
        {
          amount: 1,
          unit: 'platter',
          description: '1 platter',
          gramWeight: 240,
        },
      ]),
      brandName: 'Casa Norte',
      foodCategory: 'Comida rápida',
    }

    expect(servingOptionsForFood(platter)[0]).toMatchObject({
      key: 'platter',
      amount: 1,
      label: '1 platter',
    })
  })

  it('applies listed restaurant calories once for a sandwich or item count', () => {
    const grilledSandwich = {
      ...providerFood('Chick-fil-A grilled chicken sandwich', 220, [
        {
          amount: 1,
          unit: 'sandwich',
          description: '1 sandwich',
          gramWeight: 220,
        },
      ]),
      brandName: 'Chick-fil-A',
      foodCategory: 'Restaurant Foods',
      macrosPerServing: {
        calories: 390,
        proteinGrams: 28,
        carbohydrateGrams: 45,
        fatGrams: 11,
      },
    }
    const sixNuggets = {
      ...providerFood("McDonald's Chicken McNuggets", 95, [
        {
          amount: 6,
          unit: 'pieces',
          description: '6 pieces',
          gramWeight: 95,
        },
      ]),
      brandName: "McDonald's",
      foodCategory: 'Fast Foods',
      macrosPerServing: {
        calories: 250,
        proteinGrams: 14,
        carbohydrateGrams: 15,
        fatGrams: 15,
      },
    }

    const sandwichServing = servingOptionsForFood(grilledSandwich)[0]
    const nuggetServing = servingOptionsForFood(sixNuggets)[0]
    expect(sandwichServing).toMatchObject({
      amount: 1,
      label: '1 sandwich',
    })
    expect(nuggetServing).toMatchObject({ amount: 6, label: '6 pieces' })
    expect(
      grilledSandwich.macrosPerServing.calories *
        (sandwichServing.toServingMultiplier(sandwichServing.amount) ?? 0),
    ).toBe(390)
    expect(
      sixNuggets.macrosPerServing.calories *
        (nuggetServing.toServingMultiplier(nuggetServing.amount) ?? 0),
    ).toBe(250)
  })

  it('keeps restaurant-listed servings after provider foods are saved locally', () => {
    const steak: Food = {
      ...baseFood,
      id: 'saved-restaurant-steak',
      name: 'Oak Street Grill sirloin steak',
      brandName: 'Oak Street Grill',
      foodCategory: 'Restaurant Foods',
      servingQuantity: 9,
      servingUnit: 'oz',
      servingDescription: '1 steak',
      gramsPerServing: 9 * 28.349523125,
      ouncesPerServing: 9,
      providerDataType: 'Survey (FNDDS)',
      caloriesPerServing: 540,
    }
    const platter: Food = {
      ...baseFood,
      id: 'saved-fast-food-platter',
      name: 'River Road Smokehouse beef brisket',
      brandName: 'River Road Smokehouse',
      foodCategory: 'Fast Foods',
      servingQuantity: 310,
      servingUnit: 'g',
      servingDescription: '1 platter',
      gramsPerServing: 310,
      ouncesPerServing: 310 / 28.349523125,
      providerDataType: 'Survey (FNDDS)',
      caloriesPerServing: 680,
    }

    const steakServing = servingOptionsForFood(steak)[0]
    const platterServing = servingOptionsForFood(platter)[0]
    expect(steakServing).toMatchObject({
      key: 'steak',
      amount: 1,
      label: '1 steak',
    })
    expect(platterServing).toMatchObject({
      key: 'platter',
      amount: 1,
      label: '1 platter',
    })
    expect(
      steak.caloriesPerServing *
        (steakServing.toServingMultiplier(steakServing.amount) ?? 0),
    ).toBe(540)
    expect(
      platter.caloriesPerServing *
        (platterServing.toServingMultiplier(platterServing.amount) ?? 0),
    ).toBe(680)
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
    expect(options[0].grams).toBe(158)
    expect(options[0].toServingMultiplier(1)).toBeCloseTo(1.58)
  })

  it('keeps an explicit persisted provider household serving ahead of name heuristics', () => {
    const options = servingOptionsForFood({
      ...baseFood,
      id: 'persisted-rice',
      name: 'Rice, white, cooked',
      servingQuantity: 1,
      servingUnit: 'cup',
      servingDescription: '1 cup',
      gramsPerServing: 195,
      ouncesPerServing: 6.8784,
      providerDataType: 'Foundation',
      sourceType: 'provider',
      rawCookedStatus: 'cooked',
    })

    expect(options[0]).toMatchObject({
      key: 'serving',
      amount: 1,
      label: '1 cup',
      grams: 195,
      unitLabel: 'cup',
    })
    expect(options[0].toServingMultiplier(1)).toBe(1)
  })

  it('defaults common foods to household units while keeping grams available', () => {
    const cases = [
      ['Egg, whole, cooked', 'egg', '1 egg', 50],
      ['Banana, raw', 'medium-banana', '1 medium banana', 118],
      ['Waffles, plain', 'waffle', '1 waffle', 40],
      ['Bread, whole wheat', 'slice', '1 slice', 28],
      ['Tortilla, flour', 'tortilla', '1 tortilla', 45],
    ] as const

    for (const [name, key, label, grams] of cases) {
      const options = servingOptionsForFood({
        ...baseFood,
        id: key,
        name,
        rawCookedStatus: 'unknown',
      })

      expect(options[0]).toMatchObject({ key, amount: 1, label })
      expect(options[0].grams).toBe(grams)
      expect(options[0].toServingMultiplier(1)).toBeCloseTo(grams / 100)
      expect(options.find((option) => option.controlUnit === 'g')).toBeDefined()
    }
  })

  it('defaults a plain bagel to the provider regular size instead of miniature', () => {
    const bagel = providerFood('Bagel', 26, [
      {
        amount: 1,
        unit: 'miniature',
        description: 'miniature',
        gramWeight: 26,
      },
      {
        amount: 1,
        unit: 'regular',
        description: 'regular',
        gramWeight: 105,
      },
    ])

    expect(servingOptionsForFood(bagel)[0]).toMatchObject({
      key: 'bagel',
      amount: 1,
      label: '1 bagel',
      grams: 105,
    })
  })

  it('defaults raw strawberries to a cup while keeping grams available', () => {
    const strawberries = providerFood('Strawberries, raw', 18, [
      {
        amount: 1,
        unit: 'fruit',
        description: 'fruit',
        gramWeight: 18,
      },
      {
        amount: 1,
        unit: 'cup',
        description: 'cup',
        gramWeight: 150,
      },
    ])
    const options = servingOptionsForFood(strawberries)

    expect(options[0]).toMatchObject({
      key: 'cup',
      amount: 1,
      label: '1 cup',
      grams: 150,
    })
    expect(options.find((option) => option.controlUnit === 'g')).toBeDefined()
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
    expect(container.unitLabel).toBe('container')
    // 2 containers = 340 g; the food's serving is 245 g, so 340/245 servings.
    expect(container.toServingMultiplier(2)).toBeCloseTo(340 / 245, 5)
    expect(container.fromServingMultiplier(340 / 245)).toBeCloseTo(2, 5)
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
    expect(keys).not.toContain('100g')
  })

  it('turns provider serving descriptions into real household units', () => {
    const popcorn = {
      ...baseFood,
      id: 'popcorn',
      name: 'Popcorn',
      servingQuantity: 11,
      servingUnit: 'g',
      servingDescription: '1 cup',
      gramsPerServing: 11,
      ouncesPerServing: 11 / 28.349523125,
      caloriesPerServing: 45,
    }

    const options = servingOptionsForFood(popcorn)

    expect(options[0]).toMatchObject({
      key: 'cup',
      amount: 1,
      label: '1 cup',
    })
    expect(options[0].toServingMultiplier(6)).toBe(6)
    expect(options.find((option) => option.key === 'serving')).toBeDefined()
  })

  it('prefers tablespoons over cups for oils and dressings', () => {
    const oil = providerFood('Olive oil', 224, [
      { amount: 1, unit: 'cup', description: '', gramWeight: 224 },
      { amount: 1, unit: 'tablespoon', description: '', gramWeight: 14 },
    ])

    const options = servingOptionsForFood(oil)

    expect(options[0]).toMatchObject({
      key: 'tablespoon',
      amount: 1,
      label: '1 tablespoon',
    })
    expect(options[0].toServingMultiplier(1)).toBeCloseTo(14 / 224, 5)
    expect(options.find((option) => option.key === 'cup')).toBeDefined()
  })

  it('keeps one gram option and the base serving when household portions are primary', () => {
    const food = providerFood('Vegetable oil', 14, [
      { amount: 1, unit: 'cup', description: '', gramWeight: 224 },
    ])

    const keys = servingOptionsForFood(food).map((option) => option.key)
    expect(keys).toContain('serving')
    expect(keys).toContain('cup')
    expect(keys).toContain('g')
    expect(keys).not.toContain('100g')
  })

  it('does not expose grams without a reliable conversion', () => {
    const options = servingOptionsForFood({
      ...baseFood,
      id: 'unreliable-cup',
      name: 'Homemade soup',
      servingQuantity: 1,
      servingUnit: 'cup',
      servingDescription: '1 cup',
      gramsPerServing: undefined,
      ouncesPerServing: undefined,
      servingConversionReliable: false,
      servingConversionSource: undefined,
    })

    expect(options.map((option) => option.key)).toEqual(['serving'])
    expect(options[0]).toMatchObject({
      amount: 1,
      label: '1 cup',
      unitLabel: 'cup',
    })
  })

  it('resolves legacy mass-unit preferences to concise base controls', () => {
    const gramOptions = servingOptionsForFood(baseFood)
    expect(gramOptions.map((option) => option.key)).not.toContain('g')
    expect(findServingOption(gramOptions, 'g')).toMatchObject({
      key: 'serving',
      controlUnit: 'g',
    })
    expect(findServingOption(gramOptions, '100g')).toMatchObject({
      key: 'serving',
      controlUnit: 'g',
    })

    const ounceOptions = servingOptionsForFood({
      ...baseFood,
      id: 'ounce-serving',
      name: 'Measured food',
      servingQuantity: 4,
      servingUnit: 'oz',
      servingDescription: '4 oz',
      gramsPerServing: 4 * 28.3495,
      ouncesPerServing: 4,
    })
    expect(findServingOption(ounceOptions, 'oz')).toMatchObject({
      key: 'serving',
      controlUnit: 'oz',
    })
  })

  it('scales popcorn serving amounts from the selected unit base', () => {
    const food = {
      ...providerFood('Popcorn by Snappy Popcorn Co.', 23, [
        { amount: 1, unit: 'cup', description: '', gramWeight: 23 },
      ]),
      macrosPerServing: {
        calories: 100,
        proteinGrams: 2,
        carbohydrateGrams: 18,
        fatGrams: 2,
      },
    }

    const gramOption = servingOptionsForFood(food).find(
      (option) => option.key === 'g',
    )
    expect(gramOption?.toServingMultiplier(90)).toBeCloseTo(90 / 23, 5)
    expect(100 * (gramOption?.toServingMultiplier(90) ?? 0)).toBeCloseTo(
      391.3,
      1,
    )
  })

  it('formats calories and macros for display', () => {
    expect(formatCalories(123.6)).toBe('124')
    expect(formatMacroGram(3)).toBe('3.0')
    expect(formatMacroGram(3.24)).toBe('3.2')
  })
})

describe('quick-amount helpers', () => {
  it('offers cooking fractions for recipe serving/portion units', () => {
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

  it('offers weight steps for recipe mass units instead of fractions', () => {
    expect(quantityChipsForUnit('oz')).toEqual([1, 2, 3, 4, 6, 8])
    expect(quantityChipsForUnit('g')).toEqual([25, 50, 100, 150, 200])
    expect(quantityChipsForUnit('100g')).toEqual([25, 50, 100, 150, 200])
  })

  it('keeps the primary serving sheet to four practical quick portions', () => {
    expect(portionChipsForUnit('portion')).toEqual([0.5, 1, 1.5, 2])
    expect(portionChipsForUnit('oz')).toEqual([2, 4, 6, 8])
    expect(portionChipsForUnit('g')).toEqual([50, 100, 150, 200])
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
