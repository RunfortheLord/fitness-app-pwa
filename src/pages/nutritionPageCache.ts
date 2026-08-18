import { foodRepository } from '@repositories/foodRepository'
import type { DailyNutritionSummary } from '@services/nutritionSummaryService'
import { nutritionSummaryService } from '@services/nutritionSummaryService'
import type { LocalDateString } from '@domain/dates'
import type {
  Food,
  FoodLogEntry,
  FoodUnitPreference,
  SavedMeal,
} from '@shared-types/app'

export type NutritionPageLoadState = {
  foods: Food[]
  logs: FoodLogEntry[]
  recentFoods: Food[]
  recommendedFoods: Food[]
  favoriteFoods: Food[]
  foodUnitPreferences: Record<string, FoodUnitPreference>
  savedMeals: SavedMeal[]
  summary: DailyNutritionSummary | null
  status: 'loading' | 'ready' | 'error'
}

type CachedNutritionPageData = {
  selectedDate: string
  loadState: NutritionPageLoadState
}

let cachedNutritionPageData: CachedNutritionPageData | undefined

export function getCachedNutritionPageData(selectedDate: string) {
  return cachedNutritionPageData?.selectedDate === selectedDate
    ? cachedNutritionPageData.loadState
    : undefined
}

export function setCachedNutritionPageData(
  selectedDate: string,
  loadState: NutritionPageLoadState,
) {
  cachedNutritionPageData = { selectedDate, loadState }
}

export function clearCachedNutritionPageData() {
  cachedNutritionPageData = undefined
}

export async function preloadNutritionPageData(selectedDate: LocalDateString) {
  const [
    logs,
    summary,
    foods,
    recentFoods,
    recommendedFoods,
    favoriteFoods,
    savedMeals,
    foodUnitPreferences,
  ] = await Promise.all([
    foodRepository.listFoodLogsByDate(selectedDate),
    nutritionSummaryService.getDailySummary(selectedDate),
    foodRepository.searchFoods(''),
    foodRepository.listRecentFoods(50),
    foodRepository.listFoodsLoggedNearTime({
      before: new Date(),
      limit: 8,
    }),
    foodRepository.listFavoriteFoods(),
    foodRepository.listSavedMeals(),
    foodRepository.listRememberedFoodUnits(),
  ])

  const loadState: NutritionPageLoadState = {
    foods,
    logs,
    recentFoods,
    recommendedFoods,
    favoriteFoods,
    foodUnitPreferences: Object.fromEntries(
      foodUnitPreferences.map((preference) => [preference.foodId, preference]),
    ),
    savedMeals,
    summary,
    status: 'ready',
  }
  setCachedNutritionPageData(selectedDate, loadState)
  return loadState
}
