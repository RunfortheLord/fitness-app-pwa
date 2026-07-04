import type { CreateFoodInput } from '@repositories/foodRepository'
import type { NutritionTargetValues } from '@shared-types/app'

export type FoodFormState = {
  name: string
  brandName: string
  servingQuantity: string
  servingUnit: string
  caloriesPerServing: string
  proteinGramsPerServing: string
  carbohydrateGramsPerServing: string
  fatGramsPerServing: string
  notes: string
  barcode: string
}

export const emptyFoodForm: FoodFormState = {
  name: '',
  brandName: '',
  servingQuantity: '',
  servingUnit: '',
  caloriesPerServing: '',
  proteinGramsPerServing: '',
  carbohydrateGramsPerServing: '',
  fatGramsPerServing: '',
  notes: '',
  barcode: '',
}

export const emptyTargets = {
  calories: '',
  proteinGrams: '',
  carbohydrateGrams: '',
  fatGrams: '',
}

export const emptyQuickAddForm = {
  name: '',
  calories: '',
  proteinGrams: '',
  carbohydrateGrams: '',
  fatGrams: '',
}

export function parseFoodForm(
  form: typeof emptyFoodForm,
): { ok: true; value: CreateFoodInput } | { ok: false; error: string } {
  const name = form.name.trim()
  const servingQuantity = parsePositiveNumber(form.servingQuantity)
  const caloriesPerServing = parseNonNegativeNumber(form.caloriesPerServing)
  const proteinGramsPerServing = parseOptionalMacro(form.proteinGramsPerServing)
  const carbohydrateGramsPerServing = parseOptionalMacro(
    form.carbohydrateGramsPerServing,
  )
  const fatGramsPerServing = parseOptionalMacro(form.fatGramsPerServing)

  if (!name) {
    return { ok: false, error: 'Food name is required.' }
  }

  if (!servingQuantity) {
    return { ok: false, error: 'Serving quantity must be greater than zero.' }
  }

  if (!form.servingUnit.trim()) {
    return { ok: false, error: 'Serving unit is required.' }
  }

  if (caloriesPerServing === null) {
    return { ok: false, error: 'Calories must be zero or greater.' }
  }

  if (
    proteinGramsPerServing === null ||
    carbohydrateGramsPerServing === null ||
    fatGramsPerServing === null
  ) {
    return {
      ok: false,
      error: 'Optional macros must be blank or zero or greater.',
    }
  }

  return {
    ok: true,
    value: {
      name,
      brandName: null,
      servingQuantity,
      servingUnit: form.servingUnit.trim(),
      servingDescription: '',
      caloriesPerServing,
      proteinGramsPerServing,
      carbohydrateGramsPerServing,
      fatGramsPerServing,
      notes: '',
      barcode: form.barcode.trim() || null,
      barcodeSource: form.barcode.trim() ? 'custom' : null,
    },
  }
}

export function parseQuickAddForm(form: typeof emptyQuickAddForm):
  | {
      ok: true
      value: {
        calories: number
        carbohydrateGrams: number
        fatGrams: number
        name: string
        proteinGrams: number
      }
    }
  | { ok: false; error: string } {
  const calories = parseNonNegativeNumber(form.calories)
  const proteinGrams = parseOptionalMacro(form.proteinGrams)
  const carbohydrateGrams = parseOptionalMacro(form.carbohydrateGrams)
  const fatGrams = parseOptionalMacro(form.fatGrams)

  if (calories === null) {
    return {
      ok: false,
      error: 'Calories are required and must be zero or greater.',
    }
  }
  if (
    proteinGrams === null ||
    carbohydrateGrams === null ||
    fatGrams === null
  ) {
    return {
      ok: false,
      error: 'Macros must be blank or zero or greater.',
    }
  }

  return {
    ok: true,
    value: {
      name: form.name.trim(),
      calories,
      proteinGrams,
      carbohydrateGrams,
      fatGrams,
    },
  }
}

export function validateFoodFormFields(form: typeof emptyFoodForm) {
  const errors: Partial<Record<keyof typeof emptyFoodForm, string>> = {}
  if (!form.name.trim()) {
    errors.name = 'Food name is required.'
  }
  if (!parsePositiveNumber(form.servingQuantity)) {
    errors.servingQuantity = 'Serving amount must be greater than zero.'
  }
  if (!form.servingUnit.trim()) {
    errors.servingUnit = 'Serving unit is required.'
  }
  if (parseNonNegativeNumber(form.caloriesPerServing) === null) {
    errors.caloriesPerServing =
      'Calories are required and must be zero or greater.'
  }
  if (parseOptionalMacro(form.proteinGramsPerServing) === null) {
    errors.proteinGramsPerServing = 'Protein must be blank or zero or greater.'
  }
  if (parseOptionalMacro(form.carbohydrateGramsPerServing) === null) {
    errors.carbohydrateGramsPerServing =
      'Carbohydrates must be blank or zero or greater.'
  }
  if (parseOptionalMacro(form.fatGramsPerServing) === null) {
    errors.fatGramsPerServing = 'Fat must be blank or zero or greater.'
  }
  return errors
}

export function parseTargetForm(
  form: typeof emptyTargets,
): { ok: true; value: NutritionTargetValues } | { ok: false; error: string } {
  const calories = parseNonNegativeNumber(form.calories)
  const proteinGrams = parseNonNegativeNumber(form.proteinGrams)
  const carbohydrateGrams = parseNonNegativeNumber(form.carbohydrateGrams)
  const fatGrams = parseNonNegativeNumber(form.fatGrams)

  if (
    calories === null ||
    proteinGrams === null ||
    carbohydrateGrams === null ||
    fatGrams === null
  ) {
    return { ok: false, error: 'Targets must be zero or greater.' }
  }

  return {
    ok: true,
    value: { calories, proteinGrams, carbohydrateGrams, fatGrams },
  }
}

export function calculateMacroCalories(form: typeof emptyTargets) {
  const proteinGrams = parseNonNegativeNumber(form.proteinGrams) ?? 0
  const carbohydrateGrams = parseNonNegativeNumber(form.carbohydrateGrams) ?? 0
  const fatGrams = parseNonNegativeNumber(form.fatGrams) ?? 0
  return {
    calories: macroCaloriesFromGrams({
      proteinGrams,
      carbohydrateGrams,
      fatGrams,
    }),
    carbohydrateGrams,
    fatGrams,
    proteinGrams,
  }
}

export function macroCaloriesFromGrams(input: {
  proteinGrams: number
  carbohydrateGrams: number
  fatGrams: number
}) {
  return Math.round(
    input.proteinGrams * 4 + input.carbohydrateGrams * 4 + input.fatGrams * 9,
  )
}

export function parsePositiveNumber(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function parseNonNegativeNumber(value: string) {
  if (!value.trim()) {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

export function parseOptionalMacro(value: string) {
  return value.trim() ? parseNonNegativeNumber(value) : 0
}

export function roundMacro(value: number | undefined) {
  return Math.round((value ?? 0) * 10) / 10
}

export function targetKey(targets: NutritionTargetValues | null) {
  return targets
    ? `${targets.calories}-${targets.proteinGrams}-${targets.carbohydrateGrams}-${targets.fatGrams}`
    : 'loading-targets'
}
