import type { DailyNutritionSummary } from '@services/nutritionSummaryService'
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
