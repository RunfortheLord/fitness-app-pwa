import {
  normalizeProviderQuery,
  type GroupedFoodResult,
} from '@domain/foodProviderModels'
import type { Food } from '@shared-types/app'

export type FoodSearchResult =
  | { type: 'local'; food: Food; section: 'recent' | 'custom' | 'used' }
  | { type: 'external'; food: GroupedFoodResult }

// Provider results arrive already ranked and diversified from the server, so
// showing all of them made the generic ("Common") list overwhelmingly long and
// hard to scan. Cap each provider section to its most relevant entries.
const MAX_PROVIDER_SECTION_ITEMS = 8

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
            items: matchingRecent.map((food) => ({
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
      items: customFoods.map((food) => ({
        type: 'local',
        food,
        section: 'custom',
      })),
    },
    {
      title: 'Previously used provider foods',
      items: usedProviderFoods.map((food) => ({
        type: 'local',
        food,
        section: 'used',
      })),
    },
    {
      title: 'Common',
      items: providerResults
        .filter((food) => food.source.providerDataType !== 'Branded')
        .slice(0, MAX_PROVIDER_SECTION_ITEMS)
        .map((food) => ({ type: 'external', food })),
    },
    {
      title: 'Branded',
      items: providerResults
        .filter((food) => food.source.providerDataType === 'Branded')
        .slice(0, MAX_PROVIDER_SECTION_ITEMS)
        .map((food) => ({ type: 'external', food })),
    },
  ]
}
