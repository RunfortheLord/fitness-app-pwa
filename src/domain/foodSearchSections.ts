import {
  matchesQuery,
  normalizeProviderQuery,
  queryRelevanceScore,
  type GroupedFoodResult,
} from '@domain/foodProviderModels'
import type { Food } from '@shared-types/app'

export type FoodSearchResult =
  | { type: 'local'; food: Food; section: 'recent' | 'custom' | 'used' }
  | { type: 'external'; food: GroupedFoodResult }

// Provider results arrive already ranked and diversified from the server, so
// showing all of them made the lists overwhelmingly long. Cap each section to a
// concise number of its most relevant entries.
const RECENT_SECTION_CAP = 3
const COMMON_SECTION_CAP = 5
const BRANDED_SECTION_CAP = 3
const OTHER_SECTION_CAP = 5
const LOCAL_SECTION_CAP = 10

// Provider rows below this relevance are incidental matches (a shared stopword,
// one matched token out of several, an unrelated brand). Hiding them keeps the
// sections meaningful and lets genuinely unmatched queries read as empty rather
// than padding the list with noise.
const SECTION_MIN_RELEVANCE = 1

function providerDedupeKey(food: GroupedFoodResult) {
  return `${food.normalizedSearchName}|${food.normalizedBrand ?? ''}`
}

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
  // History is boosted only after a minimum textual relevance, and uses the same
  // typo-tolerant matcher as ranking so a misspelled query still surfaces a
  // previously logged food. Most relevant history first.
  const matchingRecent = recentFoods
    .filter((food) =>
      matchesQuery(food.name, food.brandName ?? null, normalizedQuery),
    )
    .sort(
      (left, right) =>
        queryRelevanceScore(
          right.name,
          right.brandName ?? null,
          normalizedQuery,
        ) -
        queryRelevanceScore(left.name, left.brandName ?? null, normalizedQuery),
    )
  const customFoods = localFoods.filter(
    (food) => food.sourceType !== 'provider' && !recentIds.has(food.id),
  )
  const usedProviderFoods = localFoods.filter(
    (food) => food.sourceType === 'provider' && !recentIds.has(food.id),
  )

  // Provider results can contain near-identical repetitions (same food name and
  // brand from different records). Track which ones have already been placed so
  // each food appears in at most one section, in relevance order.
  const placedProviderKeys = new Set<string>()
  function takeProvider(
    predicate: (food: GroupedFoodResult) => boolean,
    cap: number,
  ): FoodSearchResult[] {
    const items: FoodSearchResult[] = []
    for (const food of providerResults) {
      if (items.length >= cap) {
        break
      }
      if (food.relevanceScore < SECTION_MIN_RELEVANCE) {
        continue
      }
      if (!predicate(food)) {
        continue
      }
      const key = providerDedupeKey(food)
      if (placedProviderKeys.has(key)) {
        continue
      }
      placedProviderKeys.add(key)
      items.push({ type: 'external', food })
    }
    return items
  }

  const commonItems = takeProvider(
    (food) => food.source.providerDataType !== 'Branded',
    COMMON_SECTION_CAP,
  )
  const brandedItems = takeProvider(
    (food) => food.source.providerDataType === 'Branded',
    BRANDED_SECTION_CAP,
  )
  // Whatever relevant provider results remain (either type), shown after the
  // branded section so the list still surfaces additional close matches sorted
  // by relevance.
  const otherItems = takeProvider(() => true, OTHER_SECTION_CAP)

  return [
    ...(includeRecentFoods
      ? [
          {
            title: 'Recently added',
            items: matchingRecent.slice(0, RECENT_SECTION_CAP).map((food) => ({
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
      items: commonItems,
    },
    {
      title: 'Branded',
      items: brandedItems,
    },
    {
      title: 'Other',
      items: otherItems,
    },
  ]
}
