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
  const options: FoodServingOption[] = [primary]

  if (parts.reliable && parts.gramsPerServing && parts.ouncesPerServing) {
    options.push({
      amount: parts.ouncesPerServing,
      key: 'oz',
      label: 'oz',
      group: 'primary',
      grams: GRAMS_PER_OUNCE,
      toServingMultiplier: (amount) => amount / parts.ouncesPerServing!,
    })
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

export function formatMacroGram(value: number | undefined | null) {
  return (Math.round((value ?? 0) * 10) / 10).toFixed(1)
}

function choosePrimaryServing(parts: ServingParts): FoodServingOption {
  const text = normalizeFoodText(
    `${parts.name} ${parts.description} ${parts.unit}`,
  )
  const sourcePortion = sourceHouseholdPortion(parts)
  if (sourcePortion) {
    return sourcePortion
  }

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

  if (
    parts.reliable &&
    text.includes('chicken breast') &&
    parts.rawCookedStatus === 'raw'
  ) {
    return withGrams(4, 'oz', '4 oz raw', 4 * GRAMS_PER_OUNCE)
  }
  if (parts.reliable && text.includes('chicken breast')) {
    return withGrams(4, 'oz', '4 oz cooked', 4 * GRAMS_PER_OUNCE)
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
  if (
    parts.reliable &&
    /\b(beef|pork|fish|salmon|tuna|turkey|meat|steak)\b/u.test(text)
  ) {
    return withGrams(4, 'oz', '4 oz', 4 * GRAMS_PER_OUNCE)
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

function sourceHouseholdPortion(parts: ServingParts): FoodServingOption | null {
  const branded =
    parts.providerDataType === 'Branded' || parts.providerDataType === 'product'
  if (branded && parts.unit && !isMassOnly(parts.unit)) {
    return {
      amount: parts.quantity,
      key: 'serving',
      label: servingDescription(parts),
      group: 'primary',
      grams: parts.gramsPerServing,
      toServingMultiplier: (amount) => amount / parts.quantity,
    }
  }
  const portion = parts.sourcePortions.find(
    (candidate) =>
      candidate.gramWeight &&
      candidate.gramWeight > 0 &&
      candidate.unit &&
      !isMassOnly(candidate.unit),
  )
  if (!portion) {
    return null
  }
  return {
    amount: portion.amount,
    key: normalizeFoodText(portion.unit) || 'portion',
    label: `${round(portion.amount)} ${portion.unit}`,
    group: 'primary',
    grams: portion.gramWeight,
    toServingMultiplier: (amount) =>
      parts.gramsPerServing
        ? (amount * portion.gramWeight!) / parts.gramsPerServing
        : null,
  }
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

function isMassOnly(unit: string) {
  const normalized = normalizeFoodText(unit)
  return ['g', 'gram', 'grams', 'oz', 'ounce', 'ounces', '100g'].includes(
    normalized,
  )
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
