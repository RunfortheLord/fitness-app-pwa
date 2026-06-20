import type {
  FoodConversionSource,
  FoodMacroBasis,
  FoodProviderId,
  IsoTimestamp,
  RawCookedStatus,
} from '../types/app.js'

export const FOOD_NORMALIZER_VERSION = 1
export const GRAMS_PER_OUNCE = 28.349523125

export type MacroKey = 'calories' | 'protein' | 'carbohydrate' | 'fat'
export type MacroCompletenessStatus =
  | 'missing'
  | 'invalid'
  | 'present_zero'
  | 'present_positive'

export type MacroValidationResult = {
  key: MacroKey
  status: MacroCompletenessStatus
  value: number | null
}

export type NormalizedFoodMacros = {
  calories: number
  proteinGrams: number
  carbohydrateGrams: number
  fatGrams: number
}

export type NormalizedFoodServing = {
  quantity: number
  unit: string
  description: string
  gramsPerServing: number | null
  ouncesPerServing: number | null
  conversionReliable: boolean
  conversionSource: FoodConversionSource
  sourcePortions: NormalizedFoodPortion[]
}

export type NormalizedFoodPortion = {
  amount: number
  unit: string
  description: string
  gramWeight: number | null
}

export type NormalizedFoodSource = {
  provider: FoodProviderId
  providerRecordId: string
  providerDataType: string
  sourceName: string
  sourceUrl: string | null
  barcode: string | null
  sourceUpdatedAt: IsoTimestamp | null
  ingestedAt: IsoTimestamp
}

export type NormalizedFoodResult = {
  id: string
  source: NormalizedFoodSource
  name: string
  brandName: string | null
  foodCategory: string | null
  descriptionQualifiers: string[]
  rawCookedStatus: RawCookedStatus
  rawCookedBasis: string | null
  serving: NormalizedFoodServing
  macrosPerServing: NormalizedFoodMacros | null
  macrosPer100Grams: NormalizedFoodMacros | null
  macroBasis: FoodMacroBasis
  sourcePrecision: Partial<Record<MacroKey, number>>
  normalizedSearchName: string
  normalizedBrand: string | null
  providerPriority: number
  relevanceScore: number
  duplicateGroupId: string
  alternateResultIds: string[]
  groupingReasons: string[]
  normalizerVersion: number
}

export type GroupedFoodResult = NormalizedFoodResult & {
  alternates: NormalizedFoodResult[]
}

export function normalizeFoodText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9%]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function normalizeProviderQuery(query: string) {
  return query.trim().replace(/\s+/g, ' ')
}

export function validateRequiredMacros(input: {
  calories: unknown
  protein: unknown
  carbohydrate: unknown
  fat: unknown
}) {
  const results: MacroValidationResult[] = [
    validateMacroValue('calories', input.calories),
    validateMacroValue('protein', input.protein),
    validateMacroValue('carbohydrate', input.carbohydrate),
    validateMacroValue('fat', input.fat),
  ]

  return {
    ok: results.every(
      (result) =>
        result.status === 'present_positive' ||
        result.status === 'present_zero',
    ),
    results,
    macros: Object.fromEntries(
      results.map((result) => [result.key, result.value]),
    ) as Record<MacroKey, number | null>,
  }
}

export function validateMacroValue(
  key: MacroKey,
  value: unknown,
): MacroValidationResult {
  if (value === null || value === undefined || value === '') {
    return { key, status: 'missing', value: null }
  }

  const numericValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value.trim())
        : Number.NaN

  if (
    !Number.isFinite(numericValue) ||
    numericValue < 0 ||
    numericValue > upperBoundForMacro(key)
  ) {
    return { key, status: 'invalid', value: null }
  }

  return {
    key,
    status: numericValue === 0 ? 'present_zero' : 'present_positive',
    value: numericValue,
  }
}

export function gramsToOunces(grams: number) {
  return grams / GRAMS_PER_OUNCE
}

export function ouncesToGrams(ounces: number) {
  return ounces * GRAMS_PER_OUNCE
}

export function createServing(input: {
  quantity: number
  unit: string
  description?: string
  gramsPerServing?: number | null
  conversionSource: FoodConversionSource
  sourcePortions?: NormalizedFoodPortion[]
}): NormalizedFoodServing {
  const reliableGrams =
    input.gramsPerServing !== null &&
    input.gramsPerServing !== undefined &&
    Number.isFinite(input.gramsPerServing) &&
    input.gramsPerServing > 0
      ? input.gramsPerServing
      : null

  return {
    quantity: input.quantity,
    unit: input.unit,
    description: input.description ?? '',
    gramsPerServing: reliableGrams,
    ouncesPerServing:
      reliableGrams === null ? null : gramsToOunces(reliableGrams),
    conversionReliable: reliableGrams !== null,
    conversionSource: reliableGrams === null ? 'none' : input.conversionSource,
    sourcePortions: input.sourcePortions ?? [],
  }
}

export function derivePerServingMacros(
  per100Grams: NormalizedFoodMacros,
  gramsPerServing: number | null,
): NormalizedFoodMacros | null {
  if (gramsPerServing === null || gramsPerServing <= 0) {
    return null
  }
  const factor = gramsPerServing / 100
  return scaleMacros(per100Grams, factor)
}

export function derivePer100GramMacros(
  perServing: NormalizedFoodMacros,
  gramsPerServing: number | null,
): NormalizedFoodMacros | null {
  if (gramsPerServing === null || gramsPerServing <= 0) {
    return null
  }
  return scaleMacros(perServing, 100 / gramsPerServing)
}

export function classifyRawCooked(
  values: string[],
): Pick<NormalizedFoodResult, 'rawCookedStatus' | 'rawCookedBasis'> {
  const text = ` ${values.map(normalizeFoodText).join(' ')} `
  const cookedMarkers = [
    'cooked',
    'roasted',
    'grilled',
    'baked',
    'boiled',
    'fried',
    'broiled',
    'steamed',
  ]
  const rawMarkers = ['raw', 'uncooked']

  for (const marker of cookedMarkers) {
    if (text.includes(` ${marker} `)) {
      return { rawCookedStatus: 'cooked', rawCookedBasis: marker }
    }
  }
  for (const marker of rawMarkers) {
    if (text.includes(` ${marker} `)) {
      return { rawCookedStatus: 'raw', rawCookedBasis: marker }
    }
  }
  return { rawCookedStatus: 'unknown', rawCookedBasis: null }
}

export function rankFoods(
  foods: NormalizedFoodResult[],
  query: string,
): NormalizedFoodResult[] {
  const normalizedQuery = normalizeFoodText(query)
  return foods
    .map((food) => ({
      ...food,
      relevanceScore:
        textRelevance(food.normalizedSearchName, normalizedQuery) +
        cookedMeatBonus(food),
    }))
    .sort(
      (left, right) =>
        right.relevanceScore - left.relevanceScore ||
        right.providerPriority - left.providerPriority ||
        left.name.localeCompare(right.name) ||
        left.id.localeCompare(right.id),
    )
}

export function groupDuplicateFoods(
  foods: NormalizedFoodResult[],
): GroupedFoodResult[] {
  const groups = new Map<string, NormalizedFoodResult[]>()
  for (const food of foods) {
    const key = duplicateComparisonKey(food)
    const group = groups.get(key) ?? []
    group.push(food)
    groups.set(key, group)
  }

  return [...groups.entries()]
    .map(([key, group]) => {
      const sorted = [...group].sort(
        (left, right) =>
          right.providerPriority - left.providerPriority ||
          right.relevanceScore - left.relevanceScore ||
          left.id.localeCompare(right.id),
      )
      const [primary, ...alternates] = sorted
      const duplicateGroupId = stableProviderId('duplicate', key)
      return {
        ...primary,
        duplicateGroupId,
        alternateResultIds: alternates.map((alternate) => alternate.id),
        alternates,
        groupingReasons:
          alternates.length > 0
            ? [
                'same normalized name, brand, serving, macro values, status, and data type',
              ]
            : [],
      }
    })
    .sort(
      (left, right) =>
        right.relevanceScore - left.relevanceScore ||
        right.providerPriority - left.providerPriority ||
        left.name.localeCompare(right.name),
    )
}

export function stableProviderId(...parts: string[]) {
  return parts
    .map((part) => encodeURIComponent(part.toLocaleLowerCase()))
    .join(':')
}

function duplicateComparisonKey(food: NormalizedFoodResult) {
  const grams =
    food.serving.gramsPerServing === null
      ? food.serving.gramsPerServing
      : Math.round(food.serving.gramsPerServing * 1000) / 1000
  return [
    food.normalizedSearchName,
    food.normalizedBrand ?? '',
    food.serving.quantity,
    normalizeFoodText(food.serving.unit),
    grams ?? 'no-grams',
    macroFingerprint(food.macrosPerServing ?? food.macrosPer100Grams),
    food.rawCookedStatus,
    food.source.providerDataType,
  ].join('|')
}

function macroFingerprint(macros: NormalizedFoodMacros | null) {
  if (!macros) {
    return 'no-macros'
  }
  return [
    macros.calories,
    macros.proteinGrams,
    macros.carbohydrateGrams,
    macros.fatGrams,
  ]
    .map((value) => Math.round(value * 100) / 100)
    .join(':')
}

function cookedMeatBonus(food: NormalizedFoodResult) {
  const meatWords =
    /\b(beef|chicken|pork|turkey|lamb|meat|steak|fish|salmon)\b/u
  if (
    food.rawCookedStatus === 'cooked' &&
    meatWords.test(food.normalizedSearchName)
  ) {
    return 0.05
  }
  return 0
}

function textRelevance(name: string, query: string) {
  if (!query) {
    return 0
  }
  if (name === query) {
    return 4
  }
  if (name.startsWith(query)) {
    return 3
  }
  if (name.includes(query)) {
    return 2
  }
  return 0
}

function scaleMacros(
  macros: NormalizedFoodMacros,
  factor: number,
): NormalizedFoodMacros {
  return {
    calories: macros.calories * factor,
    proteinGrams: macros.proteinGrams * factor,
    carbohydrateGrams: macros.carbohydrateGrams * factor,
    fatGrams: macros.fatGrams * factor,
  }
}

function upperBoundForMacro(key: MacroKey) {
  return key === 'calories' ? 10000 : 1000
}
