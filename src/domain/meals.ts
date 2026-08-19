import type { FoodLogEntry, MealType } from '@shared-types/app'

export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
}

// Entries with no (or invalid) meal fall here, e.g. records imported from a
// backup taken before meal grouping existed.
const DEFAULT_MEAL_TYPE: MealType = 'snack'

export function isMealType(value: unknown): value is MealType {
  return (
    value === 'breakfast' ||
    value === 'lunch' ||
    value === 'dinner' ||
    value === 'snack'
  )
}

// Maps a clock hour (0–23) to the meal it most likely belongs to. Used both to
// default the meal selector when logging and to backfill historical entries
// during the schema migration.
export function mealTypeForHour(hour: number): MealType {
  if (hour >= 4 && hour < 11) {
    return 'breakfast'
  }
  if (hour >= 11 && hour < 16) {
    return 'lunch'
  }
  if (hour >= 16 && hour < 22) {
    return 'dinner'
  }
  return 'snack'
}

export function mealTypeForDate(date: Date): MealType {
  return mealTypeForHour(date.getHours())
}

export function recommendationMealTypeForDate(
  date: Date,
): Exclude<MealType, 'snack'> {
  const mealType = mealTypeForDate(date)
  return mealType === 'snack' ? 'dinner' : mealType
}

export function entryMealType(entry: Pick<FoodLogEntry, 'mealType'>): MealType {
  return isMealType(entry.mealType) ? entry.mealType : DEFAULT_MEAL_TYPE
}

export type MealGroup = {
  mealType: MealType
  label: string
  entries: FoodLogEntry[]
  calories: number
  proteinGrams: number
  carbohydrateGrams: number
  fatGrams: number
}

// Splits a day's entries into meal sections in canonical order, with per-meal
// macro subtotals. Empty meals are omitted so the day stays compact.
export function groupEntriesByMeal(entries: FoodLogEntry[]): MealGroup[] {
  return MEAL_TYPES.map((mealType) => {
    const mealEntries = entries.filter(
      (entry) => entryMealType(entry) === mealType,
    )
    return {
      mealType,
      label: MEAL_LABELS[mealType],
      entries: mealEntries,
      calories: sumBy(mealEntries, (entry) => entry.computedCalories),
      proteinGrams: sumBy(mealEntries, (entry) => entry.computedProteinGrams),
      carbohydrateGrams: sumBy(
        mealEntries,
        (entry) => entry.computedCarbohydrateGrams,
      ),
      fatGrams: sumBy(mealEntries, (entry) => entry.computedFatGrams),
    }
  }).filter((group) => group.entries.length > 0)
}

function sumBy(
  entries: FoodLogEntry[],
  select: (entry: FoodLogEntry) => number,
) {
  return entries.reduce((total, entry) => total + select(entry), 0)
}
