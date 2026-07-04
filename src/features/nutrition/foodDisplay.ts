import {
  formatFoodServingLabel,
  servingOptionsForFood,
  type FoodServingOption,
} from '@domain/foodServings'
import { splitBrandFromName } from '@domain/foodProviderModels'
import type { NormalizedFoodResult } from '@domain/foodProviderModels'
import type { FoodResult, FoodSearchResult } from '@domain/foodSearchSections'
import type {
  Food,
  FoodLogEntry,
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
    }
  }

  if (result.type === 'local') {
    const split = splitBrandFromName(result.food.name, result.food.brandName)
    const servingMultiplier = rememberedServing
      ? servingSelectionForFood(result.food, rememberedServing)
          ?.servingMultiplier
      : null
    return {
      name: split.name,
      brand: split.brand,
      serving: formatFoodServingLabel(result.food),
      calories:
        servingMultiplier == null
          ? result.food.caloriesPerServing
          : Math.round(result.food.caloriesPerServing * servingMultiplier),
    }
  }

  const macros = result.food.macrosPerServing ?? result.food.macrosPer100Grams
  const split = splitBrandFromName(
    result.food.name,
    result.food.brandName,
    result.food.foodCategory,
  )
  return {
    name: split.name,
    brand: split.brand,
    serving: formatFoodServingLabel(result.food),
    calories: macros?.calories ?? 0,
  }
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
  const option = servingOptionsForFood(food, preference.unitKey).find(
    (candidate) => candidate.key === preference.unitKey,
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
  return { option, servingMultiplier }
}

export function snapshotServingLabel(entry: FoodLogEntry) {
  return `${roundMacro(entry.foodSnapshot.servingQuantity)} ${
    entry.foodSnapshot.servingUnit || entry.foodSnapshot.servingDescription
  }`
}

// The actual logged portion in the food's own unit (multiplier applied), so the
// list reads "1.25 cup, cooked" instead of an ugly raw "1.744…x" multiplier.
// Rounded to 2 decimals so quarter/third servings (¼, ⅓, ¾) stay faithful.
export function formatLoggedAmount(entry: FoodLogEntry) {
  const snapshot = entry.foodSnapshot
  const amount =
    Math.round(entry.servingMultiplier * snapshot.servingQuantity * 100) / 100
  const unit = snapshot.servingUnit || snapshot.servingDescription
  return unit ? `${amount} ${unit}` : `${amount}`
}
