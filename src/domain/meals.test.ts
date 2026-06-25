import { describe, expect, it } from 'vitest'

import {
  MEAL_TYPES,
  entryMealType,
  groupEntriesByMeal,
  mealTypeForHour,
  mealTypeForDate,
} from './meals'
import type { FoodLogEntry, MealType } from '@shared-types/app'

function entry(
  id: string,
  mealType: MealType | undefined,
  calories: number,
): FoodLogEntry {
  return {
    id,
    localDate: '2026-06-18',
    foodId: id,
    foodSnapshot: {
      foodName: id,
      servingQuantity: 1,
      servingUnit: 'serving',
      servingDescription: '',
      caloriesPerServing: calories,
      proteinGramsPerServing: 1,
      carbohydrateGramsPerServing: 2,
      fatGramsPerServing: 3,
      notes: '',
    },
    mealType: mealType as MealType,
    servingMultiplier: 1,
    computedCalories: calories,
    computedProteinGrams: 1,
    computedCarbohydrateGrams: 2,
    computedFatGrams: 3,
    notes: '',
    createdAt: '2026-06-18T08:00:00.000Z',
    updatedAt: '2026-06-18T08:00:00.000Z',
  }
}

describe('meal helpers', () => {
  it('maps clock hours to meals across the day boundaries', () => {
    expect(mealTypeForHour(4)).toBe('breakfast')
    expect(mealTypeForHour(10)).toBe('breakfast')
    expect(mealTypeForHour(11)).toBe('lunch')
    expect(mealTypeForHour(15)).toBe('lunch')
    expect(mealTypeForHour(16)).toBe('dinner')
    expect(mealTypeForHour(21)).toBe('dinner')
    expect(mealTypeForHour(22)).toBe('snack')
    expect(mealTypeForHour(3)).toBe('snack')
  })

  it('derives the default meal from a date', () => {
    const morning = new Date(2026, 5, 18, 8, 0, 0)
    expect(mealTypeForDate(morning)).toBe('breakfast')
  })

  it('defaults a missing or invalid meal to snack', () => {
    expect(entryMealType(entry('x', undefined, 100))).toBe('snack')
    expect(entryMealType({ mealType: 'brunch' as unknown as MealType })).toBe(
      'snack',
    )
    expect(entryMealType(entry('y', 'lunch', 100))).toBe('lunch')
  })

  it('groups entries by meal in canonical order with subtotals', () => {
    const groups = groupEntriesByMeal([
      entry('a', 'dinner', 300),
      entry('b', 'breakfast', 100),
      entry('c', 'breakfast', 50),
    ])

    expect(groups.map((group) => group.mealType)).toEqual([
      'breakfast',
      'dinner',
    ])
    expect(groups[0]).toMatchObject({
      label: 'Breakfast',
      calories: 150,
      proteinGrams: 2,
    })
    expect(groups[0].entries).toHaveLength(2)
    expect(groups[1]).toMatchObject({ label: 'Dinner', calories: 300 })
  })

  it('omits empty meals from the grouping', () => {
    const groups = groupEntriesByMeal([entry('a', 'lunch', 200)])
    expect(groups).toHaveLength(1)
    expect(groups[0].mealType).toBe('lunch')
  })

  it('exposes the four meals in order', () => {
    expect(MEAL_TYPES).toEqual(['breakfast', 'lunch', 'dinner', 'snack'])
  })
})
