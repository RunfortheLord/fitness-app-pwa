import { describe, expect, it } from 'vitest'

import { createSearchSections } from '@domain/foodSearchSections'
import {
  normalizeFoodText,
  type GroupedFoodResult,
} from '@domain/foodProviderModels'
import type { Food } from '@shared-types/app'

function makeProvider(
  id: string,
  name: string,
  providerDataType: string,
  relevanceScore: number,
  brandName: string | null = null,
): GroupedFoodResult {
  return {
    id,
    source: {
      provider: 'usda',
      providerRecordId: id,
      providerDataType,
      sourceName: 'test',
      sourceUrl: null,
      barcode: null,
      sourceUpdatedAt: null,
      ingestedAt: '2026-06-19T00:00:00.000Z',
    },
    name,
    brandName,
    foodCategory: null,
    descriptionQualifiers: [],
    rawCookedStatus: 'unknown',
    rawCookedBasis: null,
    serving: {
      quantity: 1,
      unit: 'serving',
      description: '',
      gramsPerServing: 100,
      ouncesPerServing: 3.5,
      conversionReliable: true,
      conversionSource: 'provider_serving_weight',
      sourcePortions: [],
    },
    macrosPerServing: {
      calories: 66,
      proteinGrams: 5,
      carbohydrateGrams: 7,
      fatGrams: 3,
    },
    macrosPer100Grams: {
      calories: 66,
      proteinGrams: 5,
      carbohydrateGrams: 7,
      fatGrams: 3,
    },
    macroBasis: 'both',
    sourcePrecision: {},
    normalizedSearchName: normalizeFoodText(name),
    normalizedBrand: brandName ? normalizeFoodText(brandName) : null,
    providerPriority: 1,
    relevanceScore,
    duplicateGroupId: id,
    alternateResultIds: [],
    groupingReasons: [],
    normalizerVersion: 1,
    alternates: [],
  }
}

function makeRecentFood(id: string, name: string): Food {
  return {
    id,
    name,
    servingQuantity: 1,
    servingUnit: 'serving',
    servingDescription: '',
    caloriesPerServing: 200,
    proteinGramsPerServing: 20,
    carbohydrateGramsPerServing: 10,
    fatGramsPerServing: 5,
    sourceType: 'local',
    notes: '',
    status: 'active',
    createdAt: '2026-06-19T00:00:00.000Z',
    updatedAt: '2026-06-19T00:00:00.000Z',
  }
}

function section(
  sections: ReturnType<typeof createSearchSections>,
  title: string,
) {
  return sections.find((entry) => entry.title === title)
}

describe('createSearchSections', () => {
  it('drops repeated provider items so each food appears once', () => {
    const sections = createSearchSections({
      includeRecentFoods: false,
      localFoods: [],
      providerResults: [
        makeProvider('a', 'Infant formula, organic', 'Foundation', 10),
        makeProvider('b', 'Infant formula, organic', 'Foundation', 9),
        makeProvider('c', 'Greek yogurt', 'Foundation', 8),
      ],
      query: 'infant',
      recentFoods: [],
    })

    const common = section(sections, 'Common')!
    const names = common.items.map((item) =>
      item.type === 'external' ? item.food.name : item.food.name,
    )
    expect(names).toEqual(['Infant formula, organic', 'Greek yogurt'])
  })

  it('adds an Other section after Branded with up to five more by relevance', () => {
    const providerResults = Array.from({ length: 9 }, (_, index) =>
      makeProvider(`c${index}`, `Chicken ${index}`, 'Foundation', 100 - index),
    )
    const sections = createSearchSections({
      includeRecentFoods: false,
      localFoods: [],
      providerResults,
      query: 'chicken',
      recentFoods: [],
    })

    const common = section(sections, 'Common')!
    const other = section(sections, 'Other')!
    expect(common.items).toHaveLength(5)
    expect(other.items).toHaveLength(4)
    // Other continues in relevance order after the common cap.
    const otherNames = other.items.map((item) =>
      item.type === 'external' ? item.food.name : item.food.name,
    )
    expect(otherNames[0]).toBe('Chicken 5')
  })

  it('shows at most three matching recent foods and omits non-matches', () => {
    const sections = createSearchSections({
      includeRecentFoods: true,
      localFoods: [],
      providerResults: [],
      query: 'protein',
      recentFoods: [
        makeRecentFood('r1', 'Protein bar'),
        makeRecentFood('r2', 'Protein shake'),
        makeRecentFood('r3', 'Protein cookie'),
        makeRecentFood('r4', 'Protein wrap'),
        makeRecentFood('r5', 'Banana'),
      ],
    })

    const recent = section(sections, 'Recently added')!
    expect(recent.items).toHaveLength(3)
    const names = recent.items.map((item) => item.food.name)
    expect(names).not.toContain('Banana')
  })

  it('omits recent foods entirely when the query matches none', () => {
    const sections = createSearchSections({
      includeRecentFoods: true,
      localFoods: [],
      providerResults: [],
      query: 'kirkland',
      recentFoods: [makeRecentFood('r1', 'Protein bar')],
    })

    const recent = section(sections, 'Recently added')!
    expect(recent.items).toHaveLength(0)
  })
})
