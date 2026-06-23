import { describe, expect, it } from 'vitest'

import {
  createServing,
  derivePer100GramMacros,
  derivePerServingMacros,
  gramsToOunces,
  groupDuplicateFoods,
  normalizeFoodText,
  ouncesToGrams,
  rankFoods,
  stableProviderId,
  validateRequiredMacros,
  type NormalizedFoodResult,
} from './foodProviderModels'

describe('food provider model utilities', () => {
  it('distinguishes missing, invalid, zero, and positive required macros', () => {
    expect(
      validateRequiredMacros({
        calories: 0,
        protein: 12,
        carbohydrate: 0,
        fat: 3,
      }),
    ).toMatchObject({
      ok: true,
      results: [
        { status: 'present_zero' },
        { status: 'present_positive' },
        { status: 'present_zero' },
        { status: 'present_positive' },
      ],
    })

    expect(
      validateRequiredMacros({
        calories: 100,
        protein: '',
        carbohydrate: undefined,
        fat: Number.NaN,
      }),
    ).toMatchObject({
      ok: false,
      results: [
        { status: 'present_positive' },
        { status: 'missing' },
        { status: 'missing' },
        { status: 'invalid' },
      ],
    })

    expect(
      validateRequiredMacros({
        calories: 100,
        protein: 10,
        carbohydrate: null,
        fat: 1,
      }),
    ).toMatchObject({ ok: false })
  })

  it('converts grams and mass ounces without drifting through rounded display values', () => {
    const ounces = gramsToOunces(100)
    expect(ounces).toBeCloseTo(3.527396, 6)
    expect(ouncesToGrams(ounces)).toBeCloseTo(100, 10)
  })

  it('derives serving macros only when a reliable gram weight exists', () => {
    const per100 = {
      calories: 200,
      proteinGrams: 10,
      carbohydrateGrams: 20,
      fatGrams: 5,
    }
    expect(derivePerServingMacros(per100, 50)).toMatchObject({
      calories: 100,
      proteinGrams: 5,
    })
    expect(derivePerServingMacros(per100, null)).toBeNull()
    expect(
      derivePer100GramMacros(
        { calories: 100, proteinGrams: 5, carbohydrateGrams: 10, fatGrams: 2 },
        50,
      ),
    ).toMatchObject({ calories: 200 })
  })

  it('preserves provider serving units and does not infer mass for volume servings', () => {
    expect(
      createServing({
        quantity: 1,
        unit: 'fl oz',
        conversionSource: 'none',
      }),
    ).toMatchObject({
      unit: 'fl oz',
      gramsPerServing: null,
      ouncesPerServing: null,
      conversionReliable: false,
      conversionSource: 'none',
    })
  })

  it('ranks cooked meat ahead of raw while keeping raw searchable', () => {
    const raw = makeFood('usda:raw', 'Chicken breast raw', 'raw', 100)
    const cooked = makeFood(
      'usda:cooked',
      'Chicken breast cooked',
      'cooked',
      100,
    )
    const ranked = rankFoods([raw, cooked], 'chicken breast')

    expect(ranked[0].id).toBe('usda:cooked')
    expect(ranked.map((food) => food.rawCookedStatus)).toContain('raw')
  })

  it('uses whole-word normalization so incidental substrings do not classify food', () => {
    expect(normalizeFoodText('strawberry')).toBe('strawberry')
  })

  it('groups deterministic duplicates but does not merge different brands or raw and cooked records', () => {
    const first = makeFood('usda:1', 'Greek Yogurt', 'unknown', 100, 'Brand A')
    const duplicate = makeFood(
      'open_food_facts:1',
      'Greek Yogurt',
      'unknown',
      50,
      'Brand A',
    )
    const differentBrand = makeFood(
      'usda:2',
      'Greek Yogurt',
      'unknown',
      100,
      'Brand B',
    )
    const cooked = makeFood('usda:3', 'Greek Yogurt', 'cooked', 100, 'Brand A')

    const grouped = groupDuplicateFoods([
      first,
      duplicate,
      differentBrand,
      cooked,
    ])

    expect(grouped).toHaveLength(3)
    expect(grouped[0].alternateResultIds).toEqual(['open_food_facts:1'])
    expect(grouped.map((food) => food.duplicateGroupId)).toContain(
      stableProviderId(
        'duplicate',
        'greek yogurt|brand a|1|serving|100|100:10:12:2|unknown|branded',
      ),
    )
  })

  it('ranks common cooked chicken cuts before raw and branded broad results', () => {
    const ranked = rankFoods(
      [
        makeFood('usda:feet', 'Chicken feet, cooked', 'cooked', 100),
        makeFood('usda:raw', 'Chicken breast, raw', 'raw', 100),
        makeFood('usda:breast', 'Chicken breast, cooked', 'cooked', 100),
        makeFood('usda:thigh', 'Chicken thigh, cooked', 'cooked', 100),
        makeFood('brand:nugget', 'Chicken nuggets', 'unknown', 50, 'Store'),
      ],
      'chicken',
    )

    expect(ranked.map((food) => food.name)).toEqual([
      'Chicken breast, cooked',
      'Chicken thigh, cooked',
      'Chicken breast, raw',
      'Chicken nuggets',
    ])
  })

  it('allows uncommon animal parts when the query asks for them', () => {
    const ranked = rankFoods(
      [
        makeFood('usda:feet', 'Chicken feet, cooked', 'cooked', 100),
        makeFood('usda:breast', 'Chicken breast, cooked', 'cooked', 100),
      ],
      'chicken feet',
    )

    expect(ranked.map((food) => food.name)).toContain('Chicken feet, cooked')
  })

  it('ranks branded complete items for brand plus item queries', () => {
    const ranked = rankFoods(
      [
        makeFood('usda:ingredient', 'Chicken breast', 'cooked', 100),
        makeFood('usda:bake', 'Chicken Bake', 'unknown', 100, 'Costco'),
      ],
      'Costco chicken bake',
    )

    expect(ranked[0]).toMatchObject({
      name: 'Chicken Bake',
      brandName: 'Costco',
    })
  })
})

function makeFood(
  id: string,
  name: string,
  rawCookedStatus: NormalizedFoodResult['rawCookedStatus'],
  providerPriority: number,
  brandName: string | null = null,
): NormalizedFoodResult {
  return {
    id,
    source: {
      provider: id.startsWith('open') ? 'open_food_facts' : 'usda',
      providerRecordId: id,
      providerDataType: 'branded',
      sourceName: 'test',
      sourceUrl: null,
      barcode: null,
      sourceUpdatedAt: null,
      ingestedAt: '2026-06-19T00:00:00.000Z',
    },
    name,
    brandName,
    foodCategory: null,
    descriptionQualifiers: [],
    rawCookedStatus,
    rawCookedBasis: rawCookedStatus === 'unknown' ? null : rawCookedStatus,
    serving: {
      quantity: 1,
      unit: 'serving',
      description: '',
      gramsPerServing: 100,
      ouncesPerServing: gramsToOunces(100),
      conversionReliable: true,
      conversionSource: 'provider_serving_weight',
      sourcePortions: [],
    },
    macrosPerServing: {
      calories: 100,
      proteinGrams: 10,
      carbohydrateGrams: 12,
      fatGrams: 2,
    },
    macrosPer100Grams: {
      calories: 100,
      proteinGrams: 10,
      carbohydrateGrams: 12,
      fatGrams: 2,
    },
    macroBasis: 'both',
    sourcePrecision: {},
    normalizedSearchName: normalizeFoodText(name),
    normalizedBrand: brandName ? normalizeFoodText(brandName) : null,
    providerPriority,
    relevanceScore: 0,
    duplicateGroupId: id,
    alternateResultIds: [],
    groupingReasons: [],
    normalizerVersion: 1,
  }
}
