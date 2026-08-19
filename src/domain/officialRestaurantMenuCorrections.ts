import {
  createServing,
  normalizeFoodText,
  type NormalizedFoodMacros,
  type NormalizedFoodResult,
} from './foodProviderModels.js'

export type OfficialRestaurantMenuCorrection = {
  expectedName: string
  brandName: string
  sourceName: string
  sourceUrl: string
  checkedAt: string
  serving: {
    quantity: number
    unit: string
    description: string
  }
  macrosPerServing: NormalizedFoodMacros
}

// USDA includes useful restaurant records, but some are legacy reference foods
// whose recipes no longer match the restaurant's current U.S. menu. Keep this
// deliberately small and auditable: every entry must match a stable FDC ID and
// expected item name, and its values must come from the restaurant's own
// nutrition page. This is a correction layer, not a claim of universal menu
// coverage.
const USDA_OFFICIAL_MENU_CORRECTIONS: Readonly<
  Record<string, OfficialRestaurantMenuCorrection>
> = {
  '170790': {
    expectedName: 'CHICK-FIL-A, chicken sandwich',
    brandName: 'Chick-fil-A',
    sourceName: 'Chick-fil-A official U.S. menu',
    sourceUrl:
      'https://www.chick-fil-a.com/menu/entrees/chick-fil-a-chicken-sandwich',
    checkedAt: '2026-07-19T00:00:00.000Z',
    serving: {
      quantity: 1,
      unit: 'sandwich',
      description: 'sandwich',
    },
    macrosPerServing: {
      calories: 420,
      proteinGrams: 29,
      carbohydrateGrams: 41,
      fatGrams: 18,
    },
  },
  '173297': {
    expectedName: "McDONALD'S, Chicken McNUGGETS",
    brandName: "McDonald's",
    sourceName: "McDonald's official U.S. menu",
    sourceUrl:
      'https://www.mcdonalds.com/us/en-us/product/chicken-mcnuggets-6-piece.html',
    checkedAt: '2026-07-19T00:00:00.000Z',
    serving: {
      quantity: 6,
      unit: 'pieces',
      description: 'pieces',
    },
    macrosPerServing: {
      calories: 250,
      proteinGrams: 14,
      carbohydrateGrams: 15,
      fatGrams: 15,
    },
  },
}

export function officialRestaurantMenuCorrectionFor(input: {
  provider?: string | null
  providerRecordId?: string | null
  name: string
}): OfficialRestaurantMenuCorrection | null {
  if (input.provider !== 'usda' || !input.providerRecordId) {
    return null
  }

  const correction = USDA_OFFICIAL_MENU_CORRECTIONS[input.providerRecordId]
  return correction &&
    normalizeFoodText(input.name) === normalizeFoodText(correction.expectedName)
    ? correction
    : null
}

export function applyOfficialRestaurantMenuCorrection(
  food: NormalizedFoodResult,
): NormalizedFoodResult {
  const correction = officialRestaurantMenuCorrectionFor({
    provider: food.source.provider,
    providerRecordId: food.source.providerRecordId,
    name: food.name,
  })
  if (!correction) {
    return food
  }

  return {
    ...food,
    brandName: correction.brandName,
    foodCategory: 'Restaurant Foods',
    serving: createServing({
      ...correction.serving,
      gramsPerServing: null,
      conversionSource: 'none',
      sourcePortions: [],
    }),
    macrosPerServing: { ...correction.macrosPerServing },
    // The official pages publish the menu serving, not a reliable gram weight.
    // Do not combine that serving with USDA's older per-100-gram profile.
    macrosPer100Grams: null,
    macroBasis: 'per_serving',
    sourcePrecision: {
      calories: 0,
      protein: 0,
      carbohydrate: 0,
      fat: 0,
    },
    normalizedBrand: normalizeFoodText(correction.brandName),
    source: {
      ...food.source,
      providerDataType: 'Official restaurant menu correction',
      sourceName: correction.sourceName,
      sourceUrl: correction.sourceUrl,
      sourceUpdatedAt: correction.checkedAt,
    },
  }
}
