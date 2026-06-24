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

// Corporate suffixes dropped when matching a brand against the start of a name,
// so "Quest Nutrition, Inc." still matches a name beginning "QUEST NUTRITION,".
const COMPANY_SUFFIX_TOKENS = new Set([
  'inc',
  'llc',
  'co',
  'corp',
  'corporation',
  'company',
  'ltd',
  'gmbh',
  'sa',
  'plc',
])

/**
 * Splits a readable food name from its brand/restaurant for display.
 *
 * - When a brand field is present and the name leads with it (e.g.
 *   "QUEST, Protein Bar" with brand "Quest"), the brand prefix is removed from
 *   the name. Matching tolerates trailing corporate suffixes ("Inc.", "LLC").
 * - When there is no brand field but the food is a restaurant/fast-food item
 *   formatted "RESTAURANT, item" (e.g. "CHICK-FIL-A, chicken sandwich"), the
 *   leading segment is treated as the brand so it no longer clutters the name.
 *
 * The transformation never returns an empty name.
 */
export function splitBrandFromName(
  name: string,
  brandName?: string | null,
  foodCategory?: string | null,
): { name: string; brand: string | null } {
  const displayName = name.trim()
  const explicitBrand = brandName && brandName.trim() ? brandName.trim() : null

  if (explicitBrand) {
    const stripped = stripLeadingBrand(displayName, explicitBrand)
    return { name: stripped ?? displayName, brand: explicitBrand }
  }

  const restaurant = extractRestaurantBrand(displayName, foodCategory)
  if (restaurant) {
    return restaurant
  }

  return { name: displayName, brand: null }
}

/** Convenience wrapper that returns only the cleaned display name. */
export function formatFoodDisplayName(
  name: string,
  brandName?: string | null,
): string {
  return splitBrandFromName(name, brandName).name
}

function stripLeadingBrand(displayName: string, brand: string): string | null {
  const normalizedName = normalizeFoodText(displayName)
  for (const candidate of brandPrefixCandidates(brand)) {
    if (
      normalizedName === candidate ||
      normalizedName.startsWith(`${candidate} `)
    ) {
      const pattern = candidate
        .split(' ')
        .map(escapeRegExp)
        .join('[^A-Za-z0-9]+')
      const stripped = displayName
        .replace(new RegExp(`^[^A-Za-z0-9]*${pattern}[^A-Za-z0-9]*`, 'iu'), '')
        .trim()
      if (stripped.length > 0) {
        return stripped
      }
    }
  }
  return null
}

function brandPrefixCandidates(brand: string): string[] {
  const normalizedBrand = normalizeFoodText(brand)
  if (!normalizedBrand) {
    return []
  }
  const core = normalizedBrand
    .split(' ')
    .filter((token) => !COMPANY_SUFFIX_TOKENS.has(token))
    .join(' ')
  return [...new Set([normalizedBrand, core].filter(Boolean))].sort(
    (left, right) => right.length - left.length,
  )
}

function extractRestaurantBrand(
  displayName: string,
  foodCategory?: string | null,
): { name: string; brand: string } | null {
  if (!/fast food|restaurant/iu.test(foodCategory ?? '')) {
    return null
  }
  const match = displayName.match(/^(.+?),\s+(.+)$/u)
  if (!match) {
    return null
  }
  const lead = match[1].trim()
  const rest = match[2].trim()
  if (!lead || !rest) {
    return null
  }
  return { name: rest, brand: lead }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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
  const ranked = foods
    .filter((food) => shouldShowFoodForQuery(food, normalizedQuery))
    .map((food) => ({
      ...food,
      relevanceScore:
        textRelevance(food.normalizedSearchName, normalizedQuery) +
        completeRestaurantItemBonus(food, normalizedQuery) +
        brandedCategoryBonus(food, normalizedQuery) +
        cookedMeatBonus(food) +
        broadGenericBonus(food, normalizedQuery) +
        providerTypeBonus(food, normalizedQuery) +
        usefulPortionBonus(food),
    }))
    .sort(
      (left, right) =>
        right.relevanceScore - left.relevanceScore ||
        right.providerPriority - left.providerPriority ||
        left.name.localeCompare(right.name) ||
        left.id.localeCompare(right.id),
    )
  return diversifyTopFoodResults(ranked)
}

function shouldShowFoodForQuery(food: NormalizedFoodResult, query: string) {
  if (!isBroadGenericQuery(query)) {
    return true
  }
  const uncommon = uncommonPartWords().find((word) =>
    food.normalizedSearchName.includes(word),
  )
  if (!uncommon) {
    return true
  }
  return query.includes(uncommon)
}

function broadGenericBonus(food: NormalizedFoodResult, query: string) {
  if (!isBroadGenericQuery(query)) {
    return 0
  }
  const name = food.normalizedSearchName
  let score = 0
  if (name.includes(query)) {
    score += 2
  }
  const commonCuts = [
    'breast',
    'thigh',
    'drumstick',
    'wing',
    'tender',
    'strip',
    'whole',
    'rotisserie',
    'ground',
    'steak',
    'loin',
    'fillet',
    'filet',
    'cup',
    'slice',
    'egg',
  ]
  if (commonCuts.some((word) => name.includes(word))) {
    score += 1
  }
  if (food.rawCookedStatus === 'cooked') {
    score += 0.7
  }
  if (food.rawCookedStatus === 'raw') {
    score -= 0.2
  }
  return score
}

function providerTypeBonus(food: NormalizedFoodResult, query: string) {
  if (!isBroadGenericQuery(query)) {
    return 0
  }
  const type = food.source.providerDataType
  if (
    type === 'Foundation' ||
    type === 'Survey (FNDDS)' ||
    type === 'SR Legacy'
  ) {
    return 1
  }
  if (type === 'Branded' || type === 'product') {
    const category = normalizeFoodText(food.foodCategory ?? '')
    if (category.includes('restaurant') || category.includes('fast food')) {
      return -1
    }
    return -0.35
  }
  return 0
}

function usefulPortionBonus(food: NormalizedFoodResult) {
  return food.serving.conversionReliable &&
    food.serving.unit &&
    !['g', 'gram', 'grams'].includes(normalizeFoodText(food.serving.unit))
    ? 0.25
    : 0
}

function isBroadGenericQuery(query: string) {
  return [
    'chicken',
    'beef',
    'pork',
    'fish',
    'rice',
    'bread',
    'pasta',
    'potato',
    'milk',
    'cheese',
    'eggs',
    'egg',
    'turkey',
  ].includes(query)
}

function uncommonPartWords() {
  return [
    'feet',
    'foot',
    'liver',
    'gizzard',
    'gizzards',
    'neck',
    'backs',
    'heart',
    'kidney',
    'tripe',
    'tail',
    'tongue',
  ]
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

function completeRestaurantItemBonus(
  food: NormalizedFoodResult,
  query: string,
) {
  if (!query || !isBrandedProviderType(food.source.providerDataType)) {
    return 0
  }
  const categoryText = normalizeFoodText(food.foodCategory ?? '')
  const brand = food.normalizedBrand ?? ''
  // Match a squished brand too, so spaceless variants such as "chickfila"
  // still register brand intent against a brand stored as "chick fil a".
  const brandSquished = brand.replace(/ /g, '')
  const queryTokens = query.split(' ').filter(Boolean)
  const hasBrandToken = queryTokens.some(
    (token) =>
      brand.includes(token) ||
      (token.length >= 4 && brandSquished.includes(token)),
  )
  const restaurantLike =
    brand.includes(query) ||
    hasBrandToken ||
    categoryText.includes('restaurant') ||
    categoryText.includes('fast food')
  if (!restaurantLike) {
    return 0
  }
  const completeItems =
    /\b(bake|bakes|bowl|burrito|taco|tacos|salad|sandwich|wrap|meal|plate|entree|burger|pizza|combo)\b/u
  const isolatedIngredients =
    /\b(chicken|beef|pork|rice|beans|cheese|salsa|lettuce|tortilla|sauce|dressing)\b/u
  if (completeItems.test(food.normalizedSearchName)) {
    return 1.25
  }
  return isolatedIngredients.test(food.normalizedSearchName) ? -0.35 : 0
}

function brandedCategoryBonus(food: NormalizedFoodResult, query: string) {
  if (!query || !isBrandedProviderType(food.source.providerDataType)) {
    return 0
  }
  const brand = food.normalizedBrand ?? ''
  if (!brand.includes(query)) {
    return 0
  }
  const categoryWords =
    /\b(bar|bars|granola|cereal|protein|snack|cracker|cookie|yogurt|drink|shake|chips)\b/u
  return categoryWords.test(food.normalizedSearchName) ? 0.35 : 0
}

function isBrandedProviderType(providerDataType: string) {
  return normalizeFoodText(providerDataType) === 'branded'
}

function diversifyTopFoodResults<T extends NormalizedFoodResult>(foods: T[]) {
  const firstFive: T[] = []
  const remainder = [...foods]
  const usedConcepts = new Set<string>()

  for (let index = 0; index < remainder.length && firstFive.length < 5; ) {
    const candidate = remainder[index]
    const concept = foodConceptKey(candidate)
    if (!usedConcepts.has(concept)) {
      firstFive.push(candidate)
      usedConcepts.add(concept)
      remainder.splice(index, 1)
      continue
    }
    index += 1
  }

  while (firstFive.length < 5 && remainder.length) {
    firstFive.push(remainder.shift()!)
  }

  return [...firstFive, ...remainder]
}

function foodConceptKey(food: NormalizedFoodResult) {
  const tokens = new Set(food.normalizedSearchName.split(' '))
  const category = normalizeFoodText(food.foodCategory ?? '')
  const concepts = [
    ['breast', ['breast']],
    ['leg-thigh', ['leg', 'thigh', 'drumstick']],
    ['tender', ['tender', 'tenders', 'finger', 'fingers', 'nugget']],
    ['whole-roasted', ['whole', 'roasted', 'rotisserie']],
    ['soup-stew', ['soup', 'stew', 'broth']],
    ['ground', ['ground', 'minced']],
    ['steak-chop', ['steak', 'chop', 'cutlet']],
    ['rib', ['rib', 'ribs']],
    ['loin', ['loin', 'tenderloin']],
    ['fillet', ['fillet', 'filet']],
    ['white-rice', ['white']],
    ['brown-rice', ['brown']],
    ['bread-loaf', ['bread', 'loaf']],
    ['pasta-noodle', ['pasta', 'spaghetti', 'noodle', 'macaroni']],
    ['egg-whole', ['egg', 'eggs']],
    ['cheese-sliced', ['slice', 'sliced']],
    ['cereal-granola', ['cereal', 'granola']],
    ['bean-whole', ['bean', 'beans']],
    ['fruit-whole', ['fruit', 'apple', 'banana', 'berry', 'orange']],
    ['vegetable', ['vegetable', 'broccoli', 'carrot', 'spinach']],
    ['bar', ['bar', 'bars']],
    ['bowl', ['bowl']],
    ['burrito', ['burrito']],
    ['taco', ['taco', 'tacos']],
    ['salad', ['salad']],
    ['sandwich-wrap', ['sandwich', 'wrap']],
  ] as const

  const matched = concepts.find(([, words]) =>
    words.some((word) => tokens.has(word)),
  )
  const rawCooked =
    food.rawCookedStatus === 'unknown' ? '' : food.rawCookedStatus
  return [
    matched?.[0] ?? [...tokens].slice(0, 2).join('-'),
    rawCooked,
    food.source.providerDataType,
    category.split(' ').slice(0, 2).join('-'),
  ].join('|')
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
