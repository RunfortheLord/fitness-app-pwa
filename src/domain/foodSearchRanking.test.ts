import { describe, expect, it } from 'vitest'

import {
  boundedEditDistance,
  gramsToOunces,
  matchesQuery,
  normalizeFoodText,
  queryRelevanceScore,
  rankFoods,
  type NormalizedFoodResult,
} from './foodProviderModels'

// Flexible fixture builder. Tests assert ranking relationships and
// presence/absence (per the acceptance-test contract), not whole result arrays,
// and never embed the reference app's data as a fixed database.
function food(options: {
  id: string
  name: string
  brand?: string | null
  type?: string
  status?: NormalizedFoodResult['rawCookedStatus']
  category?: string | null
  priority?: number
}): NormalizedFoodResult {
  const {
    id,
    name,
    brand = null,
    type = 'Foundation',
    status = 'unknown',
    category = null,
    priority = 1,
  } = options
  return {
    id,
    source: {
      provider: id.startsWith('off') ? 'open_food_facts' : 'usda',
      providerRecordId: id,
      providerDataType: type,
      sourceName: 'test',
      sourceUrl: null,
      barcode: null,
      sourceUpdatedAt: null,
      ingestedAt: '2026-06-19T00:00:00.000Z',
    },
    name,
    brandName: brand,
    foodCategory: category,
    descriptionQualifiers: [],
    rawCookedStatus: status,
    rawCookedBasis: status === 'unknown' ? null : status,
    serving: {
      quantity: 1,
      unit: 'serving',
      description: '',
      gramsPerServing: 100,
      ouncesPerServing: gramsToOunces(100),
      conversionReliable: true,
      conversionSource: 'provider_serving_weight',
      sourcePortions: [],
    },
    macrosPerServing: {
      calories: 120,
      proteinGrams: 8,
      carbohydrateGrams: 14,
      fatGrams: 4,
    },
    macrosPer100Grams: {
      calories: 120,
      proteinGrams: 8,
      carbohydrateGrams: 14,
      fatGrams: 4,
    },
    macroBasis: 'both',
    sourcePrecision: {},
    normalizedSearchName: normalizeFoodText(name),
    normalizedBrand: brand ? normalizeFoodText(brand) : null,
    providerPriority: priority,
    relevanceScore: 0,
    duplicateGroupId: id,
    alternateResultIds: [],
    groupingReasons: [],
    normalizerVersion: 1,
  }
}

function names(ranked: NormalizedFoodResult[]) {
  return ranked.map((entry) => entry.name)
}

function rankOf(ranked: NormalizedFoodResult[], name: string) {
  return names(ranked).indexOf(name)
}

function scoreOf(ranked: NormalizedFoodResult[], name: string) {
  return ranked.find((entry) => entry.name === name)?.relevanceScore ?? 0
}

describe('boundedEditDistance', () => {
  it('reports small distances and early-rejects clearly distant tokens', () => {
    expect(boundedEditDistance('chiken', 'chicken', 2)).toBe(1)
    expect(boundedEditDistance('brocoli', 'broccoli', 2)).toBe(1)
    expect(boundedEditDistance('apple', 'orange', 2)).toBe(3)
  })
})

describe('nutrition search ranking (reference acceptance cases)', () => {
  it('chicken breast: canonical cooked outranks weak incidental branded matches', () => {
    const ranked = rankFoods(
      [
        food({
          id: 'soup',
          name: 'Cream Of Chicken Condensed Soup',
          brand: 'Pantry',
          type: 'Branded',
        }),
        food({
          id: 'raw',
          name: 'Chicken Breast Boneless Skinless Raw',
          status: 'raw',
        }),
        food({
          id: 'grilled',
          name: 'Chicken Breast Grilled Boneless Skinless',
          status: 'cooked',
        }),
      ],
      'chicken breast',
    )

    expect(names(ranked)).toContain('Chicken Breast Grilled Boneless Skinless')
    expect(names(ranked)).toContain('Chicken Breast Boneless Skinless Raw')
    expect(
      rankOf(ranked, 'Chicken Breast Grilled Boneless Skinless'),
    ).toBeLessThan(rankOf(ranked, 'Cream Of Chicken Condensed Soup'))
  })

  it('white rice: canonical white rice ranks before a flavored restaurant variant', () => {
    const ranked = rankFoods(
      [
        food({
          id: 'fried',
          name: 'Fried Rice',
          brand: 'Panda Express',
          type: 'Branded',
          category: 'Restaurant Foods',
        }),
        food({
          id: 'cooked',
          name: 'Rice White Cooked Without Salt',
          status: 'cooked',
        }),
        food({ id: 'plain', name: 'White Rice' }),
      ],
      'white rice',
    )

    expect(names(ranked)).toContain('Rice White Cooked Without Salt')
    expect(names(ranked)).toContain('White Rice')
    expect(rankOf(ranked, 'Rice White Cooked Without Salt')).toBeLessThan(
      rankOf(ranked, 'Fried Rice'),
    )
  })

  it('Chobani: an exact brand match outranks a food that only shares a token', () => {
    const ranked = rankFoods(
      [
        food({
          id: 'pretzel',
          name: 'Yogurt Covered Pretzels',
          brand: 'Snack Co',
          type: 'Branded',
        }),
        food({
          id: 'chobani',
          name: 'Greek Yogurt Plain',
          brand: 'Chobani',
          type: 'Branded',
        }),
      ],
      'Chobani',
    )

    expect(ranked[0].id).toBe('chobani')
    expect(ranked[0].brandName).toBe('Chobani')
  })

  it.each(["Trader Joe's", 'Trader Joes', 'trader joe’s'])(
    'Trader Joe\'s: apostrophe variant "%s" matches the brand',
    (query) => {
      const ranked = rankFoods(
        [
          food({ id: 'oats', name: 'Rolled Oats' }),
          food({
            id: 'tj',
            name: 'Mandarin Orange Chicken',
            brand: "Trader Joe's",
            type: 'Branded',
          }),
        ],
        query,
      )

      expect(ranked[0].id).toBe('tj')
    },
  )

  it.each([
    'Chick fil a sandwich',
    'Chick-fil-A sandwich',
    'chick fil-a sandwich',
  ])(
    'Chick-fil-A: "%s" surfaces the chain sandwiches above a generic chicken cut',
    (query) => {
      const ranked = rankFoods(
        [
          food({
            id: 'generic',
            name: 'Grilled Chicken Breast',
            status: 'cooked',
          }),
          food({
            id: 'cfa',
            name: 'Chicken Sandwich',
            brand: 'Chick-fil-A',
            type: 'Branded',
            category: 'Fast Foods',
          }),
          food({
            id: 'cfa-spicy',
            name: 'Spicy Chicken Sandwich',
            brand: 'Chick-fil-A',
            type: 'Branded',
            category: 'Fast Foods',
          }),
        ],
        query,
      )

      // Both chain sandwiches outscore the generic cut. (The flat list is then
      // diversified by concept, and the UI splits them into Branded vs Common
      // sections, so we assert on the ranking score rather than the final index.)
      const generic = scoreOf(ranked, 'Grilled Chicken Breast')
      expect(scoreOf(ranked, 'Chicken Sandwich')).toBeGreaterThan(generic)
      expect(scoreOf(ranked, 'Spicy Chicken Sandwich')).toBeGreaterThan(generic)
    },
  )

  it.each(['In n out', 'In-N-Out', 'innout'])(
    'In-N-Out: punctuation variant "%s" matches the brand',
    (query) => {
      const ranked = rankFoods(
        [
          food({
            id: 'other',
            name: 'Veggie Burger',
            type: 'Branded',
            brand: 'Generic',
          }),
          food({
            id: 'ino',
            name: 'Double Double Burger',
            brand: 'In-N-Out',
            type: 'Branded',
            category: 'Fast Foods',
          }),
        ],
        query,
      )

      expect(ranked[0].id).toBe('ino')
    },
  )

  it('Dominos pizza: apostrophe-free query matches the Domino’s brand', () => {
    const ranked = rankFoods(
      [
        food({
          id: 'frozen',
          name: 'Frozen Cheese Pizza',
          brand: 'Generic',
          type: 'Branded',
        }),
        food({
          id: 'dom',
          name: 'Pepperoni Pizza',
          brand: "Domino's",
          type: 'Branded',
          category: 'Fast Foods',
        }),
      ],
      'Dominos pizza',
    )

    expect(ranked[0].id).toBe('dom')
    expect(ranked[0].brandName).toContain('Domino')
  })

  it('Quest bar: Quest products lead an unrelated use of "bar"', () => {
    const ranked = rankFoods(
      [
        food({
          id: 'candy',
          name: 'Candy Bar Milk Chocolate',
          brand: 'Hershey',
          type: 'Branded',
        }),
        food({
          id: 'quest',
          name: 'Protein Bar Chocolate Chip',
          brand: 'Quest',
          type: 'Branded',
        }),
      ],
      'Quest bar',
    )

    expect(ranked[0].id).toBe('quest')
    expect(rankOf(ranked, 'Protein Bar Chocolate Chip')).toBeLessThan(
      rankOf(ranked, 'Candy Bar Milk Chocolate'),
    )
  })

  it('Mac: macaroni and mac & cheese outrank mackerel and macadamia', () => {
    const ranked = rankFoods(
      [
        food({
          id: 'mackerel',
          name: 'Mackerel Atlantic Raw',
          status: 'raw',
          priority: 3,
        }),
        food({ id: 'macadamia', name: 'Macadamia Nuts', priority: 2 }),
        food({ id: 'macncheese', name: 'Mac & Cheese', priority: 5 }),
        food({ id: 'macaroni', name: 'Macaroni And Cheese', priority: 4 }),
      ],
      'Mac',
    )

    expect(names(ranked)).toContain('Mac & Cheese')
    expect(names(ranked)).toContain('Macaroni And Cheese')
    for (const weaker of ['Mackerel Atlantic Raw', 'Macadamia Nuts']) {
      expect(rankOf(ranked, 'Mac & Cheese')).toBeLessThan(
        rankOf(ranked, weaker),
      )
      expect(rankOf(ranked, 'Macaroni And Cheese')).toBeLessThan(
        rankOf(ranked, weaker),
      )
    }
  })

  it('Roll: exact "roll" tokens lead a higher-priority rolled/compound match', () => {
    const ranked = rankFoods(
      [
        // Higher provider priority, but only a prefix ("rolled") match.
        food({ id: 'oats', name: 'Rolled Oats', priority: 9 }),
        food({ id: 'dinner', name: 'Dinner Roll', priority: 4 }),
        food({ id: 'sourdough', name: 'Sourdough Roll', priority: 3 }),
      ],
      'Roll',
    )

    expect(rankOf(ranked, 'Dinner Roll')).toBeLessThan(
      rankOf(ranked, 'Rolled Oats'),
    )
    expect(rankOf(ranked, 'Sourdough Roll')).toBeLessThan(
      rankOf(ranked, 'Rolled Oats'),
    )
  })

  it('Chiken: a one-edit typo retrieves canonical chicken above an unrelated food', () => {
    const ranked = rankFoods(
      [
        food({ id: 'kiwi', name: 'Kiwi Fruit' }),
        food({
          id: 'chicken',
          name: 'Chicken Breast Grilled Boneless Skinless',
          status: 'cooked',
        }),
      ],
      'Chiken',
    )

    expect(ranked[0].name).toBe('Chicken Breast Grilled Boneless Skinless')
  })

  it('Brocoli: typo tolerance retrieves correctly spelled canonical broccoli rows', () => {
    const ranked = rankFoods(
      [
        food({ id: 'raw', name: 'Broccoli, Raw', status: 'raw' }),
        food({ id: 'florets', name: 'Broccoli Florets Raw', status: 'raw' }),
        food({
          id: 'misspelled',
          name: 'Brocoli Bites',
          brand: 'Store',
          type: 'Branded',
        }),
      ],
      'Brocoli',
    )

    expect(names(ranked)).toContain('Broccoli, Raw')
    expect(names(ranked)).toContain('Broccoli Florets Raw')
  })

  it('Slice of pizza: literal token matching favors names with both tokens', () => {
    const ranked = rankFoods(
      [
        food({
          id: 'rolls',
          name: 'Pizza Rolls',
          brand: 'Generic',
          type: 'Branded',
        }),
        food({
          id: 'slice',
          name: 'Pizza Slice Cheese',
          brand: 'Generic',
          type: 'Branded',
        }),
      ],
      'Slice of pizza',
    )

    expect(rankOf(ranked, 'Pizza Slice Cheese')).toBeLessThan(
      rankOf(ranked, 'Pizza Rolls'),
    )
  })

  it('Handful of almonds: a branded title can match the literal phrase', () => {
    const ranked = rankFoods(
      [
        food({ id: 'butter', name: 'Almond Butter' }),
        food({
          id: 'tj',
          name: 'Just A Handful Of Raw Unsalted Almonds',
          brand: "Trader Joe's",
          type: 'Branded',
        }),
      ],
      'Handful of almonds',
    )

    expect(ranked[0].id).toBe('tj')
  })

  it('Large banana: favors names containing both tokens over a single-token banana', () => {
    const ranked = rankFoods(
      [
        food({ id: 'plain', name: 'Banana Raw', status: 'raw' }),
        food({ id: 'large', name: 'Banana Extra Large' }),
      ],
      'Large banana',
    )

    expect(rankOf(ranked, 'Banana Extra Large')).toBeLessThan(
      rankOf(ranked, 'Banana Raw'),
    )
  })

  it('milk: the canonical whole milk leads a branded confection sharing the token', () => {
    const ranked = rankFoods(
      [
        food({
          id: 'choc',
          name: 'Milk Chocolate Bar',
          brand: 'Generic',
          type: 'Branded',
        }),
        food({ id: 'whole', name: 'Milk, Whole', type: 'Foundation' }),
      ],
      'milk',
    )

    expect(ranked[0].name).toBe('Milk, Whole')
  })

  it('strawberry: the raw fruit outranks flavored and processed derivatives', () => {
    const ranked = rankFoods(
      [
        food({ id: 'syrup', name: 'Strawberry drink syrup' }),
        food({ id: 'ice-cream', name: 'Strawberry ice cream' }),
        food({ id: 'milk-nfs', name: 'Strawberry milk, NFS' }),
        food({ id: 'milk-whole', name: 'Strawberry milk, whole' }),
        food({
          id: 'raw',
          name: 'Strawberries, raw',
          status: 'raw',
          type: 'Foundation',
        }),
        food({ id: 'canned', name: 'Strawberries, canned' }),
      ],
      'strawberry',
    )

    expect(ranked[0].name).toBe('Strawberries, raw')
    expect(rankOf(ranked, 'Strawberries, raw')).toBeLessThan(
      rankOf(ranked, 'Strawberry ice cream'),
    )
  })

  it('fish: plain fish options outrank sauces, curries, and sandwiches', () => {
    const ranked = rankFoods(
      [
        food({ id: 'sauce', name: 'Fish sauce' }),
        food({ id: 'curry', name: 'Fish curry' }),
        food({ id: 'sandwich', name: 'Fish sandwich, grilled' }),
        food({ id: 'white', name: 'Fish, white, mixed species, grilled' }),
        food({ id: 'plain', name: 'Fish, NFS' }),
      ],
      'fish',
    )

    expect(names(ranked).slice(0, 2)).toEqual([
      'Fish, NFS',
      'Fish, white, mixed species, grilled',
    ])
  })

  it.each([
    {
      query: 'milk',
      expected: 'Milk, whole',
      alternatives: [
        'Milk, dry, reconstituted, whole',
        'Milk, evaporated, whole',
        'Milk, lactose free, whole',
      ],
    },
    {
      query: 'potato',
      expected: 'Potato, NFS',
      alternatives: ['Potato skins, NFS', 'Potato tots, NFS'],
    },
    {
      query: 'broccoli',
      expected: 'Broccoli, raw',
      alternatives: [
        'Broccoli raab, raw',
        'Broccoli, chinese, raw',
        'Broccoli, fresh, cooked with oil',
      ],
    },
    {
      query: 'bread',
      expected: 'Bread, white',
      alternatives: ['Bread, egg', 'Bread, cheese'],
    },
    {
      query: 'oatmeal',
      expected: 'Oatmeal, NFS',
      alternatives: ['Oatmeal, fast food, plain', 'Oatmeal, multigrain'],
    },
  ])(
    '$query: a broad search prefers the least-specific common form',
    ({ alternatives, expected, query }) => {
      const ranked = rankFoods(
        [
          food({ id: 'expected', name: expected }),
          ...alternatives.map((name, index) =>
            food({ id: `alternative-${index}`, name }),
          ),
        ],
        query,
      )

      expect(ranked[0].name).toBe(expected)
    },
  )

  it('does not penalize a subtype the user explicitly includes in the query', () => {
    const ranked = rankFoods(
      [
        food({ id: 'plain', name: 'Potato, NFS' }),
        food({ id: 'skins', name: 'Potato skins, NFS' }),
      ],
      'potato skins',
    )

    expect(ranked[0].name).toBe('Potato skins, NFS')
  })

  it('does not fabricate entries for natural-language quantity queries', () => {
    const inputs = [
      food({ id: 'apple', name: 'Apple Raw', status: 'raw' }),
      food({ id: 'rice', name: 'White Rice' }),
    ]
    const inputIds = new Set(inputs.map((entry) => entry.id))

    for (const query of ['1 cup of rice', 'A dozen wings']) {
      const ranked = rankFoods(inputs, query)
      // No synthesized food is ever introduced; output is a subset of inputs.
      expect(ranked.every((entry) => inputIds.has(entry.id))).toBe(true)
    }
  })
})

describe('queryRelevanceScore / matchesQuery', () => {
  it('scores exact and prefix matches above conservative typo matches', () => {
    const exact = queryRelevanceScore('Chicken Breast', null, 'chicken breast')
    const typo = queryRelevanceScore('Chicken Breast', null, 'chiken breast')
    expect(exact).toBeGreaterThan(typo)
    expect(typo).toBeGreaterThan(0)
  })

  it('counts a brand-only match even when the name omits the query', () => {
    expect(
      queryRelevanceScore('Greek Yogurt', 'Chobani', 'chobani'),
    ).toBeGreaterThan(
      queryRelevanceScore('Greek Yogurt', 'Chobani', 'kirkland'),
    )
  })

  it('requires a minimum relevance before a row counts as a match', () => {
    expect(matchesQuery('Chicken Thigh', null, 'chiken')).toBe(true)
    expect(matchesQuery('Oatmeal', null, 'chiken')).toBe(false)
  })
})
