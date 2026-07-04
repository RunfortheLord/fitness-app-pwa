import type { GroupedFoodResult } from '@domain/foodProviderModels'
import type { FoodProviderClientErrorCode } from '@services/foodProviderClient'
import type { FoodSnapshot } from '@shared-types/app'

// A food logged from within the search subpage during the current session. The
// subpage shows these as a running tray so several items can be added before
// returning to the day view.
export type AddedItem = {
  id: number
  entryId: string
  name: string
  iconName: string
  iconCategory: string | null
}

// A recipe component while editing in the subpage. Uses the same shape as a
// persisted SavedMealComponent so saved recipes load and re-save directly.
export type RecipeComponentDraft = {
  foodId: string | null
  foodSnapshot: FoodSnapshot
  servingMultiplier: number
}

// An in-progress recipe built from the shared food-search subpage. While this is
// non-null the subpage is in "recipe mode": selecting a food adds it to the
// recipe instead of logging it to the day.
export type RecipeDraft = {
  // The saved-meal id when editing an existing recipe; null when creating one.
  editingId: string | null
  name: string
  notes: string
  components: RecipeComponentDraft[]
  source: 'manual' | 'gemini'
}

export type ProviderSearchState = {
  status:
    | 'idle'
    | 'below-threshold'
    | 'loading'
    | 'ready'
    | 'offline'
    | FoodProviderClientErrorCode
  results: GroupedFoodResult[]
  query: string
}
