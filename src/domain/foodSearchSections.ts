import {
  normalizeProviderQuery,
  type GroupedFoodResult,
} from '@domain/foodProviderModels'
import type { Food } from '@shared-types/app'

export type FoodSearchResult =
  | { type: 'local'; food: Food; section: 'recent' | 'custom' | 'used' }
  | { type: 'external'; food: GroupedFoodResult }

// Provider results arrive already ranked and diversified from the server, so
// showing all of them made the lists overwhelmingly long. Cap each section to a
// concise number of its most relevant entries.
const COMMON_SECTION_CAP = 5
const BRANDED_SECTION_CAP = 3
const LOCAL_SECTION_CAP = 10

export function createSearchSections({
  includeRecentFoods,
  localFoods,
  providerResults,
  query,
  recentFoods,
}: {
  includeRecentFoods: boolean
  localFoods: Food[]
  providerResults: GroupedFoodResult[]
  query: string
  recentFoods: Food[]
}): Array<{ title: string; items: FoodSearchResult[] }> {
  const normalizedQuery = normalizeProviderQuery(query)
  if (!normalizedQuery) {
    return []
  }

  const recentIds = new Set(recentFoods.map((food) => food.id))
  const matchingRecent = recentFoods.filter((food) =>
    food.name.toLocaleLowerCase().includes(normalizedQuery.toLocaleLowerCase()),
  )
  const customFoods = localFoods.filter(
    (food) => food.sourceType !== 'provider' && !recentIds.has(food.id),
  )
  const usedProviderFoods = localFoods.filter(
    (food) => food.sourceType === 'provider' && !recentIds.has(food.id),
  )

  return [
    ...(includeRecentFoods
      ? [
          {
            title: 'Recent and previously used',
            items: matchingRecent.slice(0, LOCAL_SECTION_CAP).map((food) => ({
              type: 'local' as const,
              food,
              section:
                food.sourceType === 'provider'
                  ? ('used' as const)
                  : ('recent' as const),
            })),
          },
        ]
      : []),
    {
      title: 'Custom foods',
      items: customFoods.slice(0, LOCAL_SECTION_CAP).map((food) => ({
        type: 'local',
        food,
        section: 'custom',
      })),
    },
    {
      title: 'Previously used provider foods',
      items: usedProviderFoods.slice(0, LOCAL_SECTION_CAP).map((food) => ({
        type: 'local',
        food,
        section: 'used',
      })),
    },
    {
      title: 'Common',
      items: providerResults
        .filter((food) => food.source.providerDataType !== 'Branded')
        .slice(0, COMMON_SECTION_CAP)
        .map((food) => ({ type: 'external', food })),
    },
    {
      title: 'Branded',
      items: providerResults
        .filter((food) => food.source.providerDataType === 'Branded')
        .slice(0, BRANDED_SECTION_CAP)
        .map((food) => ({ type: 'external', food })),
    },
  ]
}
