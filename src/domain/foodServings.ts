import {
  GRAMS_PER_OUNCE,
  normalizeFoodText,
  type NormalizedFoodResult,
} from '@domain/foodProviderModels'
import type { Food } from '@shared-types/app'

export type FoodServingSource = Food | NormalizedFoodResult

export type FoodServingOption = {
  amount: number
  key: string
  label: string
  group: 'primary' | 'more'
  grams: number | null
  toServingMultiplier: (amount: number) => number | null
}

type ServingParts = {
  name: string
  unit: string
  description: string
  quantity: number
  gramsPerServing: number | null
  ouncesPerServing: number | null
  reliable: boolean
  sourcePortions: {
    amount: number
    unit: string
    description: string
    gramWeight: number | null
  }[]
  providerDataType: string | null
  rawCookedStatus: string | null
}

export function servingOptionsForFood(
  food: FoodServingSource,
  rememberedUnitKey?: string | null,
): FoodServingOption[] {
  const parts = servingParts(food)
  const primary = choosePrimaryServing(parts)
  // Expose every real provider household portion (e.g. "1 breast", "1 cup")
  // with its true gram weight, ordered after the default and before the
  // weight units. Duplicates of the default collapse in dedupeOptions.
  const options: FoodServingOption[] = [
    primary,
    ...(primary.key === 'serving' ? [] : [baseServingOption(parts)]),
    ...householdPortionOptions(parts),
  ]

  if (parts.reliable && parts.gramsPerServing) {
    if (parts.ouncesPerServing) {
      options.push({
        amount: parts.ouncesPerServing,
        key: 'oz',
        label: 'oz',
        group: 'primary',
        grams: GRAMS_PER_OUNCE,
        toServingMultiplier: (amount) =>
          (amount * GRAMS_PER_OUNCE) / parts.gramsPerServing!,
      })
    }
    options.push({
      amount: parts.gramsPerServing,
      key: 'g',
      label: 'g',
      group: 'more',
      grams: 1,
      toServingMultiplier: (amount) => amount / parts.gramsPerServing!,
    })
    options.push({
      amount: 100,
      key: '100g',
      label: '100 g',
      group: 'more',
      grams: 100,
      toServingMultiplier: (amount) => amount / parts.gramsPerServing!,
    })
  } else if (!options.some((option) => option.key === 'g')) {
    options.push({
      amount: 1,
      key: 'g',
      label: 'g',
      group: 'more',
      grams: null,
      toServingMultiplier: () => null,
    })
  }

  const deduped = dedupeOptions(options)
  if (rememberedUnitKey) {
    const remembered = deduped.find(
      (option) => option.key === rememberedUnitKey,
    )
    if (remembered) {
      return [remembered, ...deduped.filter((option) => option !== remembered)]
    }
  }
  return deduped
}

export function formatFoodServingLabel(food: FoodServingSource) {
  const parts = servingParts(food)
  const primary = choosePrimaryServing(parts)
  if (primary.key === 'serving' && parts.gramsPerServing) {
    const gramsText = `${round(parts.gramsPerServing)} g`
    // Avoid redundant labels like "36 g (36 g)" when the serving label already
    // expresses the same gram weight.
    if (primary.label.includes(gramsText)) {
      return primary.label
    }
    return `${primary.label} (${gramsText})`
  }
  return primary.label
}

export function formatCalories(value: number | undefined | null) {
  return String(Math.round(value ?? 0))
}

const ONE_THIRD = 1 / 3

// Quick-amount chips offered for the chosen unit. Serving/portion units get the
// common cooking fractions and small multiples; weight units get sensible
// gram/ounce steps instead, since "¼ g" is meaningless.
export function quantityChipsForUnit(unitKey: string): number[] {
  if (unitKey === 'oz') {
    return [1, 2, 3, 4, 6, 8]
  }
  if (unitKey === 'g' || unitKey === '100g') {
    return [25, 50, 100, 150, 200]
  }
  return [0.25, ONE_THIRD, 0.5, 0.75, 1, 1.5, 2]
}

const FRACTION_CHIP_LABELS: Array<[number, string]> = [
  [0.25, '¼'],
  [ONE_THIRD, '⅓'],
  [0.5, '½'],
  [0.75, '¾'],
  [1.5, '1½'],
]

export function formatQuantityChipLabel(value: number): string {
  const fraction = FRACTION_CHIP_LABELS.find(
    ([candidate]) => Math.abs(candidate - value) < 1e-6,
  )
  return fraction ? fraction[1] : formatAmountValue(value)
}

// Step size for the −/+ stepper, matched to how each unit is usually adjusted.
export function amountStepForUnit(unitKey: string): number {
  if (unitKey === 'g' || unitKey === '100g') {
    return 10
  }
  if (unitKey === 'oz') {
    return 1
  }
  return 0.5
}

// Next amount after a stepper tap, or null when a decrement would reach a
// non-positive amount (so the − button can be disabled at the bottom).
export function nextSteppedAmount(
  current: number,
  unitKey: string,
  direction: 1 | -1,
): number | null {
  const step = amountStepForUnit(unitKey)
  const next = Math.round((current + direction * step) * 1000) / 1000
  return next > 0 ? next : null
}

// Stringifies a chip/stepper amount for the text input without trailing-zero or
// long-decimal noise (e.g. ⅓ → "0.333", 1 → "1").
export function formatAmountValue(value: number): string {
  return String(Math.round(value * 1000) / 1000)
}

// Resulting weight for the chosen amount, shown next to the live macros so the
// logged gram weight is never ambiguous.
export function formatGrams(value: number): string {
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10
  return `${rounded} g`
}

export function formatMacroGram(value: number | undefined | null) {
  return (Math.round((value ?? 0) * 10) / 10).toFixed(1)
}

function choosePrimaryServing(parts: ServingParts): FoodServingOption {
  const text = normalizeFoodText(
    `${parts.name} ${parts.description} ${parts.unit}`,
  )

  const withGrams = (
    amount: number,
    key: string,
    label: string,
    grams: number,
  ): FoodServingOption => ({
    amount,
    key,
    label,
    group: 'primary',
    grams,
    toServingMultiplier: (entered) =>
      parts.gramsPerServing
        ? ((entered / amount) * grams) / parts.gramsPerServing
        : null,
  })

  // Meat is conventionally logged by weight, so default a plain cut to ounces —
  // even ahead of a household portion or branded serving label.
  if (parts.reliable && text.includes('chicken breast')) {
    return withGrams(
      4,
      'oz',
      parts.rawCookedStatus === 'raw' ? '4 oz raw' : '4 oz cooked',
      4 * GRAMS_PER_OUNCE,
    )
  }
  if (parts.reliable && isMeatCut(text)) {
    return withGrams(4, 'oz', '4 oz', 4 * GRAMS_PER_OUNCE)
  }

  const sourcePortion = sourceHouseholdPortion(parts)
  if (sourcePortion) {
    return sourcePortion
  }

  const describedPortion = describedHouseholdPortion(parts)
  if (describedPortion) {
    return describedPortion
  }

  if (
    parts.reliable &&
    text.includes('rice') &&
    parts.rawCookedStatus !== 'raw'
  ) {
    return withGrams(1, 'cup', '1 cup', parts.gramsPerServing ?? 158)
  }
  if (parts.reliable && /\beggs?\b/u.test(text)) {
    return withGrams(1, 'egg', '1 egg', parts.gramsPerServing ?? 50)
  }
  if (parts.reliable && /\bbanana\b/u.test(text)) {
    return withGrams(1, 'medium-banana', '1 medium banana', 118)
  }
  if (parts.reliable && /\bwaffles?\b/u.test(text)) {
    return withGrams(1, 'waffle', '1 waffle', parts.gramsPerServing ?? 40)
  }
  if (parts.reliable && /\bbread\b/u.test(text)) {
    return withGrams(1, 'slice', '1 slice', parts.gramsPerServing ?? 28)
  }
  if (parts.reliable && /\btortillas?\b/u.test(text)) {
    return withGrams(1, 'tortilla', '1 tortilla', parts.gramsPerServing ?? 45)
  }

  const label = servingDescription(parts)
  return {
    amount: parts.quantity,
    key: 'serving',
    label,
    group: 'primary',
    grams: parts.gramsPerServing,
    toServingMultiplier: (amount) => amount / parts.quantity,
  }
}

function baseServingOption(parts: ServingParts): FoodServingOption {
  return {
    amount: parts.quantity,
    key: 'serving',
    label: servingDescription(parts),
    group: 'primary',
    grams: parts.gramsPerServing,
    toServingMultiplier: (amount) => amount / parts.quantity,
  }
}

// True for a recognizable cut of meat/fish/poultry, but not for prepared dishes
// that merely contain meat (a sandwich, soup, nugget, etc.), which keep their
// own household or label serving.
function isMeatCut(text: string): boolean {
  const meat =
    /\b(chicken|beef|pork|turkey|fish|salmon|tuna|shrimp|steak|lamb|bacon|ham|sausage|veal|bison|venison|cod|tilapia|halibut|meat)\b/u
  const preparedDish =
    /\b(sandwich|nugget|nuggets|tender|tenders|wing|wings|soup|salad|wrap|burrito|taco|pizza|bake|casserole|stew|pie|roll|pasta|noodle|rice|curry|bowl|sub|patty|jerky|sauce|gravy|broth|spread|dip|popper|poppers|finger|fingers|stick|sticks|ball|balls|cake|loaf|dog|dumpling|ravioli|lasagna|quesadilla|enchilada|nacho|nachos|chowder|bisque)\b/u
  return meat.test(text) && !preparedDish.test(text)
}

// Skipped portion units that carry no useful household meaning.
const UNUSABLE_PORTION_UNITS = new Set([
  '',
  'serving',
  'undetermined',
  'quantity not specified',
  'portion',
])

const SPOON_UNITS = new Set(['tablespoon', 'teaspoon'])

// Detailed USDA foods can list a dozen portion variants; keep the dropdown
// usable by showing only the few most common (the provider already ranks them)
// and dropping near-identical ones that share a gram weight.
const MAX_PORTION_OPTIONS = 4

// Turns provider household portions into selectable serving options with their
// true gram weights. Requires a reliable per-serving gram weight to convert a
// portion back into a serving multiplier.
function householdPortionOptions(parts: ServingParts): FoodServingOption[] {
  const gramsPerServing = parts.gramsPerServing
  if (!gramsPerServing || gramsPerServing <= 0) {
    return []
  }
  const options: FoodServingOption[] = []
  const seenGrams = new Set<number>()
  for (const portion of parts.sourcePortions) {
    if (options.length >= MAX_PORTION_OPTIONS) {
      break
    }
    if (
      portion.gramWeight === null ||
      portion.gramWeight <= 0 ||
      !portion.unit ||
      isMassOrMachineUnit(portion.unit) ||
      UNUSABLE_PORTION_UNITS.has(canonicalServingKey(portion.unit))
    ) {
      continue
    }
    const grams = portion.gramWeight
    const gramsKey = Math.round(grams)
    if (seenGrams.has(gramsKey)) {
      continue
    }
    seenGrams.add(gramsKey)
    const amount = portion.amount > 0 ? portion.amount : 1
    const key = canonicalServingKey(portion.unit)
    options.push({
      amount,
      key,
      label: `${round(amount)} ${portion.unit.trim()} (${round(grams)} g)`,
      group: 'primary',
      grams,
      toServingMultiplier: (entered: number) =>
        ((entered / amount) * grams) / gramsPerServing,
    })
  }
  return options
}

function sourceHouseholdPortion(parts: ServingParts): FoodServingOption | null {
  const branded =
    parts.providerDataType === 'Branded' || parts.providerDataType === 'product'
  if (branded && parts.unit && !isMassOrMachineUnit(parts.unit)) {
    return {
      amount: parts.quantity,
      key: 'serving',
      label: servingDescription(parts),
      group: 'primary',
      grams: parts.gramsPerServing,
      toServingMultiplier: (amount) => amount / parts.quantity,
    }
  }
  const portions = parts.sourcePortions.filter(
    (candidate) =>
      candidate.gramWeight &&
      candidate.gramWeight > 0 &&
      candidate.unit &&
      !isMassOrMachineUnit(candidate.unit) &&
      !UNUSABLE_PORTION_UNITS.has(canonicalServingKey(candidate.unit)),
  )
  const portion = preferredSourcePortion(parts, portions)
  if (!portion) {
    return null
  }
  const key = canonicalServingKey(portion.unit)
  return {
    amount: portion.amount,
    key,
    label: `${round(portion.amount)} ${portion.unit}`,
    group: 'primary',
    grams: portion.gramWeight,
    toServingMultiplier: (amount) =>
      parts.gramsPerServing
        ? ((amount / portion.amount) * portion.gramWeight!) /
          parts.gramsPerServing
        : null,
  }
}

function preferredSourcePortion(
  parts: ServingParts,
  portions: ServingParts['sourcePortions'],
) {
  if (portions.length <= 1) {
    return portions[0] ?? null
  }

  const text = normalizeFoodText(`${parts.name} ${parts.description}`)
  const preferSpoon =
    /\b(oil|dressing|sauce|syrup|honey|butter|mayo|mayonnaise|spread|dip)\b/u.test(
      text,
    )
  if (!preferSpoon) {
    return portions[0] ?? null
  }

  return (
    portions.find((portion) =>
      SPOON_UNITS.has(canonicalServingKey(portion.unit)),
    ) ??
    portions[0] ??
    null
  )
}

function describedHouseholdPortion(
  parts: ServingParts,
): FoodServingOption | null {
  if (!parts.reliable || !parts.gramsPerServing) {
    return null
  }
  if (!isMassOrMachineUnit(parts.unit) && normalizeFoodText(parts.unit)) {
    return null
  }
  const parsed = parseServingText(parts.description)
  if (
    !parsed ||
    isMassOrMachineUnit(parsed.unit) ||
    UNUSABLE_PORTION_UNITS.has(parsed.key)
  ) {
    return null
  }
  return {
    amount: parsed.amount,
    key: parsed.key,
    label: `${round(parsed.amount)} ${parsed.unit}`,
    group: 'primary',
    grams: parts.gramsPerServing,
    toServingMultiplier: (amount) => amount / parsed.amount,
  }
}

function parseServingText(
  value: string,
): { amount: number; key: string; unit: string } | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  const match = trimmed.match(/^(\d+(?:\.\d+)?|\d+\/\d+)\s+(.+)$/u)
  if (!match) {
    return null
  }
  const amount = parseAmount(match[1])
  const unit = match[2].replace(/,?\s*nfs$/iu, '').trim()
  const key = canonicalServingKey(unit)
  if (!Number.isFinite(amount) || amount <= 0 || !unit || !key) {
    return null
  }
  return { amount, key, unit }
}

function parseAmount(value: string) {
  if (!value.includes('/')) {
    return Number(value)
  }
  const [numerator, denominator] = value.split('/').map(Number)
  return denominator ? numerator / denominator : Number.NaN
}

function servingDescription(parts: ServingParts) {
  const unitText = (parts.unit || parts.description || 'serving').trim()
  // Some providers (e.g. Open Food Facts) store the serving size as a full
  // string such as "36 g" that already includes the amount. Prefixing the
  // quantity then produced confusing labels like "1 36 g", so when the unit
  // already begins with a number for a single serving, show it as-is.
  const base =
    parts.quantity === 1 && /^\d/.test(unitText)
      ? unitText
      : `${round(parts.quantity)} ${unitText}`
  if (parts.description && parts.description !== parts.unit) {
    return parts.description.includes(base)
      ? parts.description
      : `${base} ${parts.description}`
  }
  return base
}

function servingParts(food: FoodServingSource): ServingParts {
  if ('serving' in food) {
    return {
      name: food.name,
      unit: food.serving.unit,
      description: food.serving.description,
      quantity: food.serving.quantity,
      gramsPerServing: food.serving.gramsPerServing,
      ouncesPerServing: food.serving.ouncesPerServing,
      reliable: food.serving.conversionReliable,
      sourcePortions: food.serving.sourcePortions,
      providerDataType: food.source.providerDataType,
      rawCookedStatus: food.rawCookedStatus,
    }
  }
  return {
    name: food.name,
    unit: food.servingUnit,
    description: food.servingDescription,
    quantity: food.servingQuantity,
    gramsPerServing: food.gramsPerServing ?? null,
    ouncesPerServing: food.ouncesPerServing ?? null,
    reliable: food.servingConversionReliable ?? false,
    sourcePortions: [],
    providerDataType: food.providerDataType ?? null,
    rawCookedStatus: food.rawCookedStatus ?? null,
  }
}

function isMassOrMachineUnit(unit: string) {
  const normalized = normalizeFoodText(unit)
  return [
    'g',
    'gram',
    'grams',
    'grm',
    'oz',
    'onz',
    'ounce',
    'ounces',
    'ml',
    'milliliter',
    'milliliters',
    '100g',
  ].includes(normalized)
}

function canonicalServingKey(unit: string) {
  const normalized = normalizeFoodText(unit)
  if (['tbsp', 'tbs', 'tablespoons'].includes(normalized)) {
    return 'tablespoon'
  }
  if (['tsp', 'teaspoons'].includes(normalized)) {
    return 'teaspoon'
  }
  if (['onz', 'ounce', 'ounces'].includes(normalized)) {
    return 'oz'
  }
  if (['grm', 'gram', 'grams'].includes(normalized)) {
    return 'g'
  }
  return normalized
}

function dedupeOptions(options: FoodServingOption[]) {
  const seen = new Set<string>()
  return options.filter((option) => {
    if (seen.has(option.key)) {
      return false
    }
    seen.add(option.key)
    return true
  })
}

function round(value: number) {
  return Math.round(value * 10) / 10
}
