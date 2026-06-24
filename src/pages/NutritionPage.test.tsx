import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { App } from '@app/App'
import { db } from '@db/database'
import {
  FOOD_NORMALIZER_VERSION,
  normalizeFoodText,
  type GroupedFoodResult,
  type NormalizedFoodResult,
} from '@domain/foodProviderModels'
import { HomePage } from '@pages/HomePage'
import { createSearchSections } from '@domain/foodSearchSections'
import { NutritionPage } from '@pages/NutritionPage'
import { settingsRepository } from '@repositories/settingsRepository'
import { initializeAppData } from '@services/appInitializationService'
import {
  FoodProviderClientError,
  searchProviderFoods,
} from '@services/foodProviderClient'

vi.mock('@services/foodProviderClient', () => {
  class MockFoodProviderClientError extends Error {
    readonly code: string

    constructor(code: string, message: string) {
      super(message)
      this.name = 'FoodProviderClientError'
      this.code = code
    }
  }

  return {
    FoodProviderClientError: MockFoodProviderClientError,
    searchProviderFoods: vi.fn(),
  }
})

const mockSearchProviderFoods = vi.mocked(searchProviderFoods)

beforeEach(async () => {
  mockSearchProviderFoods.mockReset()
  mockSearchProviderFoods.mockResolvedValue({
    provider: 'usda',
    query: '',
    results: [],
    fallbackUsed: false,
  })
  await db.delete()
  await db.open()
  await initializeAppData()
})

afterEach(async () => {
  await db.delete()
})

describe('NutritionPage', () => {
  it('creates, searches, logs, edits, deletes, and snapshots food logs', async () => {
    const user = userEvent.setup()
    await configureUsdaKey()
    renderNutrition()
    await screen.findByText('Connected')

    await user.click(screen.getByRole('button', { name: /Create custom food/ }))
    await expectSaveFoodAvailable()
    await fillFoodForm(user, {
      name: 'Rice',
      calories: '200',
      protein: '4',
      carbs: '45',
      fat: '1',
    })
    await user.click(screen.getByRole('button', { name: 'Save food' }))
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Create food' }),
      ).not.toBeInTheDocument(),
    )

    await user.type(
      screen.getByRole('searchbox', { name: 'Search foods' }),
      'rice',
    )
    await user.click(await screen.findByRole('button', { name: 'Select Rice' }))
    await user.clear(screen.getByRole('textbox', { name: 'Serving amount' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Serving amount' }),
      '1.5',
    )
    expect(screen.getByText(/Preview: 300 kcal/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Log food' }))

    expect(await screen.findByText('300 kcal')).toBeInTheDocument()
    await expect(screen.findByText(/1.5x 1 cup/)).resolves.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Foods' }))
    await user.click(screen.getByRole('button', { name: 'Edit Rice' }))
    await user.clear(
      screen.getByRole('textbox', { name: 'Calories per serving' }),
    )
    await user.type(
      screen.getByRole('textbox', { name: 'Calories per serving' }),
      '300',
    )
    await user.click(screen.getByRole('button', { name: 'Save food' }))

    const loggedRows = await db.foodLogEntries.toArray()
    expect(loggedRows[0]).toMatchObject({
      computedCalories: 300,
      foodSnapshot: { caloriesPerServing: 200, foodName: 'Rice' },
    })

    await user.click(screen.getByRole('button', { name: 'Day' }))
    await user.click(screen.getByRole('button', { name: 'Edit Rice log' }))
    const servingMultiplier = await screen.findByRole('textbox', {
      name: 'Serving multiplier',
    })
    await user.clear(servingMultiplier)
    await user.type(servingMultiplier, '2')
    await user.click(screen.getByRole('button', { name: 'Save log' }))
    await waitFor(async () => {
      const [entry] = await db.foodLogEntries.toArray()
      expect(entry.computedCalories).toBe(400)
    })

    await user.click(screen.getByRole('button', { name: 'Delete Rice log' }))
    await user.click(
      within(
        screen.getByRole('dialog', { name: 'Delete food log?' }),
      ).getByRole('button', { name: 'Delete' }),
    )
    await waitFor(() =>
      expect(screen.getByText('No foods logged')).toBeInTheDocument(),
    )
    await expect(db.foodLogEntries.toArray()).resolves.toEqual([])
  })

  it('saves manual targets and updates the home dashboard', async () => {
    const user = userEvent.setup()
    renderNutrition()

    await user.click(screen.getByRole('button', { name: 'Targets' }))
    await user.clear(screen.getByRole('textbox', { name: 'Calories' }))
    await user.type(screen.getByRole('textbox', { name: 'Calories' }), '1800')
    await user.clear(screen.getByRole('textbox', { name: 'Protein target' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Protein target' }),
      '160',
    )
    await user.clear(
      screen.getByRole('textbox', { name: 'Carbohydrate target' }),
    )
    await user.type(
      screen.getByRole('textbox', { name: 'Carbohydrate target' }),
      '180',
    )
    await user.clear(screen.getByRole('textbox', { name: 'Fat target' }))
    await user.type(screen.getByRole('textbox', { name: 'Fat target' }), '60')
    expect(
      screen.getByText('P 160g x 4 + C 180g x 4 + F 60g x 9 = 1900 kcal'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/Each save creates target history/),
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save targets' }))

    expect(
      await screen.findByText('Nutrition targets saved.'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Home' }))

    expect(await screen.findByText('1800 kcal target')).toBeInTheDocument()
    expect(await screen.findByText('0 g / 160 g')).toBeInTheDocument()
  })

  it('calculates a custom goal, returns to Targets, and offers manual updates', async () => {
    const user = userEvent.setup()
    renderNutrition()

    await user.click(screen.getByRole('button', { name: 'Targets' }))

    // Open the Set Goal subpage and confirm the back arrow escapes it.
    await user.click(screen.getByRole('button', { name: 'Set Goal' }))
    expect(
      screen.getByRole('button', { name: 'Calculate Macros' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back to targets' }))
    expect(
      screen.getByRole('button', { name: 'Save targets' }),
    ).toBeInTheDocument()

    // Fill the seven inputs and calculate.
    await user.click(screen.getByRole('button', { name: 'Set Goal' }))
    await user.type(screen.getByLabelText('Current body weight (lb)'), '180')
    await user.type(screen.getByLabelText('Height (feet)'), '5')
    await user.type(screen.getByLabelText('Height (inches)'), '10')
    await user.selectOptions(
      screen.getByLabelText('Activity level'),
      'moderately_active',
    )
    await user.type(screen.getByLabelText('Goal weight (lb)'), '170')
    await user.type(screen.getByLabelText('Age'), '30')
    await user.selectOptions(screen.getByLabelText('Sex'), 'male')
    await user.click(screen.getByRole('button', { name: 'Calculate Macros' }))

    expect(
      await screen.findByText('Macros calculated and targets saved.'),
    ).toBeInTheDocument()
    // Back on the Targets page with a goal-progress card (loads async).
    expect(await screen.findByText(/Estimated finish:/)).toBeInTheDocument()
    expect(
      await screen.findByRole('button', { name: 'Update Calories' }),
    ).toBeInTheDocument()

    const settings = await db.userSettings.get('settings')
    expect(settings?.nutritionGoal).toMatchObject({
      direction: 'cut',
      goalWeightLb: 170,
      calculationWeightLb: 180,
      formulaVersion: 1,
    })
    expect(settings?.nutritionTargets.calories).toBe(2313)

    // With no body-weight history a manual update reports insufficient data and
    // does not change calories.
    await user.click(screen.getByRole('button', { name: 'Update Calories' }))
    expect(
      await screen.findByText(
        'More body-weight data is needed before calories can be updated.',
      ),
    ).toBeInTheDocument()
    const after = await db.userSettings.get('settings')
    expect(after?.nutritionTargets.calories).toBe(2313)
  })

  it('shows the calorie equation and keeps Save food at the top of the form', async () => {
    const user = userEvent.setup()
    renderNutrition()

    await user.click(screen.getByRole('button', { name: /Create custom food/ }))
    await expectSaveFoodAvailable()

    const dialog = screen.getByRole('dialog', { name: 'Create food' })
    // Save food is rendered before the Name field in the DOM (i.e. at the top).
    const saveButton = within(dialog).getByRole('button', { name: 'Save food' })
    const nameField = within(dialog).getByRole('textbox', { name: 'Name' })
    expect(
      saveButton.compareDocumentPosition(nameField) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    await fillFoodForm(user, {
      name: 'Oats',
      calories: '200',
      protein: '5',
      carbs: '40',
      fat: '3',
    })

    // 5*4 + 40*4 + 3*9 = 207
    expect(
      screen.getByText('P 5g x 4 + C 40g x 4 + F 3g x 9 = 207 kcal'),
    ).toBeInTheDocument()
  })

  it('searches with the server key when no user key is configured and surfaces a server missing-key response', async () => {
    const user = userEvent.setup()
    mockSearchProviderFoods.mockRejectedValue(
      new FoodProviderClientError('missing_api_key', 'API key missing.'),
    )
    renderNutrition()

    await user.type(
      await screen.findByRole('searchbox', { name: 'Search foods' }),
      'rice',
    )

    // Without a stored user key the client still attempts the search so the
    // server-configured USDA key can be used. Only a server missing_api_key
    // response surfaces the "API key missing" message.
    await waitFor(() =>
      expect(mockSearchProviderFoods).toHaveBeenCalledTimes(1),
    )
    expect(mockSearchProviderFoods).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'rice', apiKey: '', provider: 'usda' }),
    )
    expect(await screen.findByText(/API key missing/)).toBeInTheDocument()
  })

  it('debounces provider search after the three-character threshold', async () => {
    const user = userEvent.setup()
    await configureUsdaKey()
    renderNutrition()
    await screen.findByText('Connected')

    await user.type(
      screen.getByRole('searchbox', { name: 'Search foods' }),
      'r',
    )
    await delay(550)
    expect(mockSearchProviderFoods).not.toHaveBeenCalled()

    await user.type(
      screen.getByRole('searchbox', { name: 'Search foods' }),
      'ice',
    )
    await waitFor(() =>
      expect(mockSearchProviderFoods).toHaveBeenCalledTimes(1),
    )
    expect(mockSearchProviderFoods).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'rice',
        apiKey: 'test-usda-key',
        provider: 'usda',
        allowFallback: false,
      }),
    )
  })

  it('shows provider failures separately from no acceptable results', async () => {
    const user = userEvent.setup()
    await configureUsdaKey()
    mockSearchProviderFoods.mockRejectedValue(
      new FoodProviderClientError(
        'provider_unavailable',
        'Provider unavailable.',
      ),
    )
    renderNutrition()
    await screen.findByText('Connected')

    await user.type(
      await screen.findByRole('searchbox', { name: 'Search foods' }),
      'zzz',
    )

    expect(
      await screen.findByText(/Food providers are unavailable/),
    ).toBeInTheDocument()
    expect(screen.getByText('No acceptable results')).toBeInTheDocument()
  })

  it('selects, converts, and logs external foods as immutable snapshots', async () => {
    const user = userEvent.setup()
    await configureUsdaKey()
    mockSearchProviderFoods.mockResolvedValue({
      provider: 'usda',
      query: 'chicken',
      results: [providerChicken()],
      fallbackUsed: false,
    })
    renderNutrition()
    await screen.findByText('Connected')

    await user.type(
      await screen.findByRole('searchbox', { name: 'Search foods' }),
      'chicken',
    )
    await user.click(
      await screen.findByRole('button', {
        name: 'Select Chicken breast cooked',
      }),
    )

    expect(
      screen.getByRole('dialog', { name: 'Food details' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Protein 37.2 g')).toBeInTheDocument()
    expect(screen.queryByText(/net/i)).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Serving unit'), 'g')
    await user.clear(screen.getByRole('textbox', { name: 'Serving amount' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Serving amount' }),
      '60',
    )
    expect(screen.getByText(/Preview: 99 kcal/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Log food' }))

    let entry = await db.foodLogEntries.toCollection().first()
    await waitFor(async () => {
      entry = await db.foodLogEntries.toCollection().first()
      expect(entry).toBeTruthy()
    })
    expect(entry).toMatchObject({
      computedCalories: 99,
      computedProteinGrams: 18.6,
      foodSnapshot: {
        foodName: 'Chicken breast cooked',
        brandName: 'USDA Test Kitchen',
        sourceType: 'provider',
        provider: 'usda',
        providerRecordId: '123',
        providerDataType: 'Foundation',
        servingConversionReliable: true,
        gramsPerServing: 120,
        rawCookedStatus: 'cooked',
        normalizerVersion: FOOD_NORMALIZER_VERSION,
      },
    })
  })

  it('supports More Results alternates and private corrected custom copies', async () => {
    const user = userEvent.setup()
    await configureUsdaKey()
    mockSearchProviderFoods.mockResolvedValue({
      provider: 'usda',
      query: 'chicken',
      results: [providerChicken()],
      fallbackUsed: false,
    })
    renderNutrition()
    await screen.findByText('Connected')

    await user.type(
      await screen.findByRole('searchbox', { name: 'Search foods' }),
      'chicken',
    )
    await user.click(
      await screen.findByRole('button', {
        name: 'Select Chicken breast cooked',
      }),
    )
    await user.click(screen.getByText('More results (1)'))
    await user.click(screen.getByRole('button', { name: /Chicken breast raw/ }))
    expect(screen.getByText('Chicken breast raw')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Custom copy' }))
    expect(
      screen.getByRole('dialog', { name: 'Create food' }),
    ).toBeInTheDocument()
    await user.clear(screen.getByRole('textbox', { name: 'Name' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Name' }),
      'Corrected chicken',
    )
    await user.click(screen.getByRole('button', { name: 'Save food' }))

    const saved = await db.foods
      .where('name')
      .equals('Corrected chicken')
      .first()
    expect(saved).toMatchObject({ name: 'Corrected chicken' })
    expect(saved?.sourceType).toBeUndefined()
  })

  it('allows legitimate zero macros for custom foods', async () => {
    const user = userEvent.setup()
    renderNutrition()

    await user.click(screen.getByRole('button', { name: /Create custom food/ }))
    await fillFoodForm(user, {
      name: 'Zero tea',
      calories: '0',
      protein: '0',
      carbs: '0',
      fat: '0',
    })
    await user.click(screen.getByRole('button', { name: 'Save food' }))

    await expect(
      db.foods.where('name').equals('Zero tea').first(),
    ).resolves.toMatchObject({
      caloriesPerServing: 0,
      proteinGramsPerServing: 0,
      carbohydrateGramsPerServing: 0,
      fatGramsPerServing: 0,
    })
  })

  it('quick adds calories with optional macros and shows all recent foods in the Foods tab', async () => {
    const user = userEvent.setup()
    renderNutrition()

    await user.click(
      await screen.findByRole('button', { name: 'Quick add nutrition' }),
    )
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Snack')
    await user.type(screen.getByRole('textbox', { name: 'Calories' }), '250')
    await user.type(screen.getByRole('textbox', { name: 'Protein' }), '20')
    await user.click(screen.getByRole('button', { name: 'Log quick add' }))

    expect(await screen.findByText('Quick add logged.')).toBeInTheDocument()
    await expect(
      screen.findByText(/1x 1 entry - 250 kcal - P 20 C 0 F 0/),
    ).resolves.toBeInTheDocument()
    // Quick Add must not pollute the reusable food library/search.
    await expect(db.foods.count()).resolves.toBe(0)
    const [quickAddLog] = await db.foodLogEntries.toArray()
    expect(quickAddLog.foodId).toBeNull()

    for (const name of [
      'Recent one',
      'Recent two',
      'Recent three',
      'Recent four',
    ]) {
      await user.click(
        screen.getByRole('button', { name: /Create custom food/ }),
      )
      await fillFoodForm(user, {
        name,
        calories: '100',
        protein: '1',
        carbs: '2',
        fat: '3',
      })
      await user.click(screen.getByRole('button', { name: 'Save food' }))
      await waitFor(() =>
        expect(
          screen.queryByRole('dialog', { name: 'Create food' }),
        ).not.toBeInTheDocument(),
      )
      await user.type(
        screen.getByRole('searchbox', { name: 'Search foods' }),
        name,
      )
      await user.click(
        await screen.findByRole('button', { name: `Select ${name}` }),
      )
      await user.click(screen.getByRole('button', { name: 'Log food' }))
      await user.clear(screen.getByRole('searchbox', { name: 'Search foods' }))
      await new Promise((resolve) => setTimeout(resolve, 2))
    }

    await user.type(
      screen.getByRole('searchbox', { name: 'Search foods' }),
      'Recent four',
    )
    expect(await screen.findByText('No acceptable results')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Select Recent four' }),
    ).not.toBeInTheDocument()
    await user.clear(screen.getByRole('searchbox', { name: 'Search foods' }))
    await user.click(screen.getByRole('button', { name: 'Foods' }))

    const recentCard = await screen.findByRole('region', {
      name: 'Recent foods',
    })
    expect(within(recentCard).getByText('Recent four')).toBeInTheDocument()
    expect(within(recentCard).getByText('Recent three')).toBeInTheDocument()
    expect(within(recentCard).getByText('Recent two')).toBeInTheDocument()
    expect(within(recentCard).getByText('Recent one')).toBeInTheDocument()
    // Quick Add entries log to the day only; they are not reusable recent foods.
    expect(within(recentCard).queryByText('Snack')).not.toBeInTheDocument()
  })
})

function renderNutrition() {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <App />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'nutrition', element: <NutritionPage /> },
        ],
      },
    ],
    { initialEntries: ['/nutrition'] },
  )

  render(<RouterProvider router={router} />)
}

describe('createSearchSections', () => {
  function generic(id: string, name: string): GroupedFoodResult {
    return {
      ...providerFood(id, name, 'cooked', 100, 10, 5, 2),
      alternates: [],
    }
  }
  function branded(id: string, name: string): GroupedFoodResult {
    const base = providerFood(id, name, 'cooked', 100, 10, 5, 2)
    return {
      ...base,
      alternates: [],
      source: { ...base.source, providerDataType: 'Branded' },
    }
  }

  it('caps the long generic section and lists recent results first', () => {
    const providerResults: GroupedFoodResult[] = [
      ...Array.from({ length: 12 }, (_, index) =>
        generic(`usda:${index}`, `Chicken item ${index}`),
      ),
      branded('off:1', 'Branded chicken'),
    ]

    const sections = createSearchSections({
      includeRecentFoods: true,
      localFoods: [],
      providerResults,
      query: 'chicken',
      recentFoods: [],
    })

    expect(sections[0].title).toBe('Recent and previously used')
    const common = sections.find((section) => section.title === 'Common')
    const brandedSection = sections.find(
      (section) => section.title === 'Branded',
    )
    // 12 generic results are capped to the 5 most relevant, in rank order, to
    // keep the Common grouping concise.
    expect(common?.items).toHaveLength(5)
    expect(common?.items[0]).toMatchObject({
      type: 'external',
      food: { id: 'usda:0' },
    })
    expect(brandedSection?.items).toHaveLength(1)
  })
})

function providerChicken(): GroupedFoodResult {
  const alternate = {
    ...providerFood('usda:124', 'Chicken breast raw', 'raw', 132, 27, 0, 2.5),
    alternates: [],
  }
  return {
    ...providerFood(
      'usda:123',
      'Chicken breast cooked',
      'cooked',
      198,
      37.2,
      0,
      4.32,
    ),
    alternates: [alternate],
    alternateResultIds: [alternate.id],
  }
}

function providerFood(
  id: string,
  name: string,
  rawCookedStatus: 'raw' | 'cooked',
  calories: number,
  proteinGrams: number,
  carbohydrateGrams: number,
  fatGrams: number,
) {
  return {
    id,
    source: {
      provider: 'usda',
      providerRecordId: id.split(':')[1],
      providerDataType: 'Foundation',
      sourceName: 'USDA FoodData Central',
      sourceUrl: null,
      barcode: null,
      sourceUpdatedAt: '2026-01-01T00:00:00.000Z',
      ingestedAt: '2026-06-19T00:00:00.000Z',
    },
    name,
    brandName: 'USDA Test Kitchen',
    foodCategory: 'Poultry',
    descriptionQualifiers: [],
    rawCookedStatus,
    rawCookedBasis: rawCookedStatus,
    serving: {
      quantity: 120,
      unit: 'g',
      description: '120 g',
      gramsPerServing: 120,
      ouncesPerServing: 4.232875,
      conversionReliable: true,
      conversionSource: 'provider_serving_weight',
      sourcePortions: [],
    },
    macrosPerServing: {
      calories,
      proteinGrams,
      carbohydrateGrams,
      fatGrams,
    },
    macrosPer100Grams: {
      calories: calories / 1.2,
      proteinGrams: proteinGrams / 1.2,
      carbohydrateGrams: carbohydrateGrams / 1.2,
      fatGrams: fatGrams / 1.2,
    },
    macroBasis: 'both',
    sourcePrecision: {},
    normalizedSearchName: normalizeFoodText(name),
    normalizedBrand: normalizeFoodText('USDA Test Kitchen'),
    providerPriority: 100,
    relevanceScore: 4,
    duplicateGroupId: id,
    alternateResultIds: [],
    groupingReasons: [],
    normalizerVersion: FOOD_NORMALIZER_VERSION,
  } satisfies NormalizedFoodResult
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

async function configureUsdaKey() {
  await settingsRepository.saveUsdaApiKey('test-usda-key', 'connected')
}

async function expectSaveFoodAvailable() {
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Save food' })).toBeEnabled(),
  )
}

async function fillFoodForm(
  user: ReturnType<typeof userEvent.setup>,
  values: {
    calories: string
    carbs: string
    fat: string
    name: string
    protein: string
  },
) {
  await user.type(screen.getByRole('textbox', { name: 'Name' }), values.name)
  await user.type(screen.getByRole('textbox', { name: 'Serving amount' }), '1')
  await user.type(screen.getByRole('textbox', { name: 'Serving unit' }), 'cup')
  await user.type(
    screen.getByRole('textbox', { name: 'Calories per serving' }),
    values.calories,
  )
  await user.type(
    screen.getByRole('textbox', { name: 'Protein per serving' }),
    values.protein,
  )
  await user.type(
    screen.getByRole('textbox', { name: 'Carbohydrates per serving' }),
    values.carbs,
  )
  await user.type(
    screen.getByRole('textbox', { name: 'Fat per serving' }),
    values.fat,
  )
}
