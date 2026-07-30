import {
  findServingOption,
  formatAmountValue,
  formatFoodServingLabel,
  rebaseProviderServingMultiplier,
  servingOptionsForFood,
  type FoodServingOption,
} from '@domain/foodServings'
import { splitBrandFromName } from '@domain/foodProviderModels'
import type { NormalizedFoodResult } from '@domain/foodProviderModels'
import type { FoodResult, FoodSearchResult } from '@domain/foodSearchSections'
import type {
  Food,
  FoodLogEntry,
  FoodSnapshot,
  FoodUnitPreference,
  SavedMeal,
} from '@shared-types/app'

import { roundMacro, type FoodFormState } from './nutritionForms'

export function resultDisplay(
  result: FoodSearchResult,
  rememberedServing?: FoodUnitPreference | null,
) {
  if (result.type === 'savedMeal') {
    return {
      name: result.meal.name,
      brand: null,
      serving: `${result.meal.components.length} ${
        result.meal.components.length === 1 ? 'item' : 'items'
      }`,
      calories: savedMealCalories(result.meal),
      servingContext: 'reference' as const,
    }
  }

  if (result.type === 'local') {
    const split = splitBrandFromName(result.food.name, result.food.brandName)
    const rememberedSelection = rememberedServing
      ? servingSelectionForFood(result.food, rememberedServing)
      : null
    const defaultMultiplier = defaultServingMultiplier(result.food)
    return {
      name: split.name,
      brand: split.brand,
      serving: rememberedSelection
        ? rememberedSelection.portionLabel
        : formatFoodServingLabel(result.food),
      calories:
        rememberedSelection == null
          ? Math.round(result.food.caloriesPerServing * defaultMultiplier)
          : Math.round(
              result.food.caloriesPerServing *
                rememberedSelection.servingMultiplier,
            ),
      servingContext: rememberedSelection
        ? ('last-used' as const)
        : ('reference' as const),
    }
  }

  const macros = result.food.macrosPerServing ?? result.food.macrosPer100Grams
  const defaultMultiplier = defaultServingMultiplier(result.food)
  const split = splitBrandFromName(
    result.food.name,
    result.food.brandName,
    result.food.foodCategory,
  )
  return {
    name: split.name,
    brand: split.brand,
    serving: formatFoodServingLabel(result.food),
    calories: (macros?.calories ?? 0) * defaultMultiplier,
    servingContext: 'reference' as const,
  }
}

function defaultServingMultiplier(food: Food | NormalizedFoodResult): number {
  const option = servingOptionsForFood(food)[0]
  const multiplier = option?.toServingMultiplier(option.amount)
  return multiplier && Number.isFinite(multiplier) && multiplier > 0
    ? multiplier
    : 1
}

export function savedMealCalories(meal: SavedMeal) {
  return meal.components.reduce(
    (total, component) =>
      total +
      component.foodSnapshot.caloriesPerServing * component.servingMultiplier,
    0,
  )
}

export function resultKey(result: FoodSearchResult) {
  if (result.type === 'savedMeal') {
    return `recipe-${result.meal.id}`
  }
  return result.type === 'local' ? `local-${result.food.id}` : result.food.id
}

export function servingOptionsForResult(
  result: FoodResult,
  rememberedUnitKey: string | null,
): FoodServingOption[] {
  if (result.type === 'local') {
    return servingOptionsForFood(result.food, rememberedUnitKey)
  }
  return servingOptionsForFood(result.food, rememberedUnitKey)
}

export function durableServingPreference(
  result: FoodResult,
  selectedOption: FoodServingOption,
  amount: number,
  servingMultiplier: number,
  persistedFood?: Food | null,
): Pick<FoodUnitPreference, 'unitKey' | 'amount'> {
  if (result.type === 'local') {
    return { unitKey: selectedOption.key, amount }
  }

  // Provider source portions are richer than the reusable Food record. Resolve
  // the choice against the options that remain after persistence; when an
  // alternate household unit will not survive, remember its exact gram
  // equivalent instead of silently falling back to a different portion.
  const persistedOptions = servingOptionsForFood(
    persistedFood ?? {
      ...result.food,
      serving: { ...result.food.serving, sourcePortions: [] },
    },
  )
  const persistedServingMultiplier = persistedFood
    ? rebaseProviderServingMultiplier(
        result.food,
        persistedFood,
        servingMultiplier,
      )
    : servingMultiplier
  const durableOption =
    findServingOption(persistedOptions, selectedOption.key) ??
    persistedOptions.find((option) => option.controlUnit === 'g') ??
    persistedOptions[0]
  const durableAmount = durableOption?.fromServingMultiplier(
    persistedServingMultiplier,
  )
  if (
    durableOption &&
    durableAmount != null &&
    Number.isFinite(durableAmount) &&
    durableAmount > 0
  ) {
    return { unitKey: durableOption.key, amount: durableAmount }
  }
  return { unitKey: selectedOption.key, amount }
}

export function baseMacrosForResult(result: FoodResult) {
  if (result.type === 'local') {
    return {
      calories: result.food.caloriesPerServing,
      protein: result.food.proteinGramsPerServing,
      carbs: result.food.carbohydrateGramsPerServing,
      fat: result.food.fatGramsPerServing,
    }
  }

  const macros = result.food.macrosPerServing ?? result.food.macrosPer100Grams
  return macros
    ? {
        calories: macros.calories,
        protein: macros.proteinGrams,
        carbs: macros.carbohydrateGrams,
        fat: macros.fatGrams,
      }
    : null
}

// Grams in one base serving, used to translate the chosen amount into a
// resulting weight. Null when the food has no reliable gram conversion.
export function baseGramsForResult(result: FoodResult): number | null {
  if (result.type === 'local') {
    return result.food.gramsPerServing ?? null
  }
  return result.food.serving.gramsPerServing ?? null
}

export function foodFormFromExternal(
  food: NormalizedFoodResult,
  name: string,
): FoodFormState {
  const macros = food.macrosPerServing ?? food.macrosPer100Grams
  return {
    name,
    brandName: food.brandName ?? '',
    servingQuantity: String(food.serving.quantity),
    servingUnit: food.serving.unit,
    caloriesPerServing: String(macros?.calories ?? ''),
    proteinGramsPerServing: String(macros?.proteinGrams ?? ''),
    carbohydrateGramsPerServing: String(macros?.carbohydrateGrams ?? ''),
    fatGramsPerServing: String(macros?.fatGrams ?? ''),
    notes: '',
    barcode: food.source.barcode ?? '',
  }
}

export function foodFormFromLocal(food: Food): FoodFormState {
  return {
    name: food.name,
    brandName: food.brandName ?? '',
    servingQuantity: String(food.servingQuantity),
    servingUnit: food.servingUnit,
    caloriesPerServing: String(food.caloriesPerServing),
    proteinGramsPerServing: String(food.proteinGramsPerServing),
    carbohydrateGramsPerServing: String(food.carbohydrateGramsPerServing),
    fatGramsPerServing: String(food.fatGramsPerServing),
    notes: '',
    barcode: food.barcode ?? '',
  }
}

export function servingSelectionForFood(
  food: Food,
  preference: FoodUnitPreference,
) {
  const option = findServingOption(
    servingOptionsForFood(food, preference.unitKey),
    preference.unitKey,
  )
  const servingMultiplier = option?.toServingMultiplier(preference.amount)
  if (
    !option ||
    servingMultiplier == null ||
    !Number.isFinite(servingMultiplier) ||
    servingMultiplier <= 0
  ) {
    return null
  }
  return {
    option,
    portionLabel: `${formatAmountValue(preference.amount)} ${option.unitLabel}`,
    servingMultiplier,
  }
}

export function snapshotServingLabel(entry: FoodLogEntry) {
  const basis = foodSnapshotPortionBasis(entry.foodSnapshot)
  return `${roundMacro(basis.amount)} ${basis.unit}`.trim()
}

// The actual logged portion in the food's own unit (multiplier applied), so the
// list reads "1.25 cup, cooked" instead of an ugly raw "1.744…x" multiplier.
// Rounded to 2 decimals so quarter/third servings (¼, ⅓, ¾) stay faithful.
export function formatLoggedAmount(entry: FoodLogEntry) {
  const basis = foodSnapshotPortionBasis(entry.foodSnapshot)
  const amount = Math.round(entry.servingMultiplier * basis.amount * 100) / 100
  return basis.unit ? `${amount} ${basis.unit}` : `${amount}`
}

export function foodSnapshotPortionBasis(snapshot: FoodSnapshot) {
  const rawUnit = (
    snapshot.servingUnit ||
    snapshot.servingDescription ||
    'serving'
  ).trim()
  if (snapshot.servingQuantity === 1) {
    const embedded = rawUnit.match(/^(\d+(?:\.\d+)?|\d+\/\d+)\s*([^\d\s].*)$/u)
    if (embedded) {
      const amount = embedded[1].includes('/')
        ? parseFraction(embedded[1])
        : Number(embedded[1])
      if (Number.isFinite(amount) && amount > 0) {
        return { amount, unit: embedded[2].trim() }
      }
    }
  }
  return { amount: snapshot.servingQuantity, unit: rawUnit }
}

function parseFraction(value: string) {
  const [numerator, denominator] = value.split('/').map(Number)
  return denominator ? numerator / denominator : Number.NaN
}
