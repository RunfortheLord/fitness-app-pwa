import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
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
import { snapshotFood } from '@domain/snapshots'
import { HomePage } from '@pages/HomePage'
import { createSearchSections } from '@domain/foodSearchSections'
import { NutritionPage } from '@pages/NutritionPage'
import { createFoodRepository } from '@repositories/foodRepository'
import { settingsRepository } from '@repositories/settingsRepository'
import { initializeAppData } from '@services/appInitializationService'
import {
  FoodProviderClientError,
  searchProviderFoods,
} from '@services/foodProviderClient'
import { analyzeMealPhoto } from '@services/geminiMealAnalysisClient'

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

vi.mock('@services/geminiMealAnalysisClient', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@services/geminiMealAnalysisClient')>()
  return {
    ...actual,
    analyzeMealPhoto: vi.fn(),
  }
})

const mockSearchProviderFoods = vi.mocked(searchProviderFoods)
const mockAnalyzeMealPhoto = vi.mocked(analyzeMealPhoto)

beforeEach(async () => {
  mockSearchProviderFoods.mockReset()
  mockSearchProviderFoods.mockResolvedValue({
    provider: 'usda',
    query: '',
    results: [],
    fallbackUsed: false,
  })
  mockAnalyzeMealPhoto.mockReset()
  await db.delete()
  await db.open()
  await initializeAppData()
})

afterEach(async () => {
  cleanup()
  await db.delete()
})

describe('NutritionPage', () => {
  it('keeps camera options open through scrolling and resets on navigation', async () => {
    const user = userEvent.setup()
    renderNutrition()

    await user.click(
      await screen.findByRole('button', { name: 'Open camera options' }),
    )
    expect(
      screen.getByRole('menu', { name: 'Camera options' }),
    ).toBeInTheDocument()

    fireEvent.scroll(window)
    fireEvent.pointerDown(document.body)
    expect(
      screen.getByRole('menu', { name: 'Camera options' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Home' }))
    await user.click(screen.getByRole('link', { name: 'Nutrition' }))
    expect(
      screen.queryByRole('menu', { name: 'Camera options' }),
    ).not.toBeInTheDocument()
  })

  it('opens barcode and AI choices below the food camera action', async () => {
    const user = userEvent.setup()
    renderNutrition()

    await user.click(
      await screen.findByRole('button', { name: 'Open camera options' }),
    )

    const menu = screen.getByRole('menu', { name: 'Camera options' })
    expect(
      within(menu).getByRole('menuitem', { name: 'Scan barcode' }),
    ).toBeInTheDocument()
    await user.click(
      within(menu).getByRole('menuitem', { name: 'Analyze meal photo' }),
    )

    expect(
      await screen.findByRole('heading', { name: 'AI meal camera' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Add your Gemini API key in Settings/),
    ).toBeInTheDocument()
    await expect(db.savedMeals.count()).resolves.toBe(0)
  })

  it('returns to food search when the AI camera was launched there', async () => {
    const user = userEvent.setup()
    renderNutrition()

    await openFoodSearch(user)
    await user.click(
      screen.getByRole('button', { name: 'Open camera options' }),
    )
    await user.click(
      screen.getByRole('menuitem', { name: 'Analyze meal photo' }),
    )
    await user.click(
      await screen.findByRole('button', { name: 'Back to nutrition' }),
    )

    expect(
      screen.getByRole('searchbox', { name: 'Search foods' }),
    ).toBeInTheDocument()
  })

  it('logs a captured meal and only saves the recipe when selected', async () => {
    const user = userEvent.setup()
    await settingsRepository.saveGeminiApiKey('gemini-test-key', 'connected')
    mockAnalyzeMealPhoto.mockResolvedValue({
      recipeName: 'Photo chicken bowl',
      confidence: 'medium',
      assumptions: ['One cup of cooked rice'],
      ingredients: [
        {
          name: 'Grilled chicken',
          servingQuantity: 5,
          servingUnit: 'oz',
          calories: 240,
          proteinGrams: 45,
          carbohydrateGrams: 0,
          fatGrams: 5,
        },
        {
          name: 'Cooked rice',
          servingQuantity: 1,
          servingUnit: 'cup',
          calories: 205,
          proteinGrams: 4,
          carbohydrateGrams: 45,
          fatGrams: 0.4,
        },
      ],
    })

    const stop = vi.fn()
    const originalMediaDevices = navigator.mediaDevices
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop }],
        }),
      },
    })
    const play = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockResolvedValue()
    const videoWidth = vi
      .spyOn(HTMLVideoElement.prototype, 'videoWidth', 'get')
      .mockReturnValue(1200)
    const videoHeight = vi
      .spyOn(HTMLVideoElement.prototype, 'videoHeight', 'get')
      .mockReturnValue(900)
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({
        drawImage: vi.fn(),
      } as unknown as CanvasRenderingContext2D)
    const toDataUrl = vi
      .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
      .mockReturnValue('data:image/jpeg;base64,photo-bytes')

    try {
      renderNutrition()
      await user.click(
        await screen.findByRole('button', { name: 'Open camera options' }),
      )
      await user.click(
        screen.getByRole('menuitem', { name: 'Analyze meal photo' }),
      )
      await user.click(
        await screen.findByRole('button', { name: 'Take meal photo' }),
      )

      expect(
        await screen.findByDisplayValue('Photo chicken bowl'),
      ).toBeInTheDocument()
      expect(screen.getByText('Grilled chicken')).toBeInTheDocument()
      expect(screen.getByText('Cooked rice')).toBeInTheDocument()
      expect(
        screen.getByLabelText('Estimated total calories'),
      ).toHaveTextContent('Calories: 445')
      expect(
        screen.queryByText(/AI-estimated nutrition/),
      ).not.toBeInTheDocument()
      const saveRecipe = screen.getByRole('checkbox', {
        name: 'Save as recipe',
      })
      expect(saveRecipe).toHaveAttribute('aria-checked', 'false')
      await expect(db.savedMeals.count()).resolves.toBe(0)

      await user.click(
        screen.getByRole('button', {
          name: 'Edit Grilled chicken ingredient',
        }),
      )
      expect(
        screen.getByRole('dialog', { name: 'Ingredient details' }),
      ).toBeInTheDocument()
      const servingAmount = screen.getByRole('textbox', {
        name: 'Serving amount',
      })
      expect(servingAmount).toHaveValue('5')
      await user.clear(servingAmount)
      await user.type(servingAmount, '10')
      expect(screen.getByText(/Preview: 480 kcal/)).toBeInTheDocument()
      await user.click(
        screen.getByRole('button', { name: 'Update ingredient' }),
      )
      expect(
        screen.getByLabelText('Estimated total calories'),
      ).toHaveTextContent('Calories: 685')
      expect(screen.getByText('10 oz')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Log food (2)' }))
      await waitFor(async () => expect(await db.foodLogEntries.count()).toBe(2))
      await expect(db.savedMeals.count()).resolves.toBe(0)
      await expect(db.foodLogEntries.toArray()).resolves.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            computedCalories: 480,
            foodSnapshot: expect.objectContaining({
              foodName: 'Grilled chicken',
            }),
          }),
        ]),
      )
      expect(
        await screen.findByText('Logged 2 ingredients.'),
      ).toBeInTheDocument()

      await user.click(
        screen.getByRole('button', { name: 'Open camera options' }),
      )
      await user.click(
        screen.getByRole('menuitem', { name: 'Analyze meal photo' }),
      )
      await user.click(
        await screen.findByRole('button', { name: 'Take meal photo' }),
      )
      const saveRecipeOnSecondScan = await screen.findByRole('checkbox', {
        name: 'Save as recipe',
      })
      await user.click(saveRecipeOnSecondScan)
      expect(saveRecipeOnSecondScan).toHaveAttribute('aria-checked', 'true')
      await user.click(screen.getByRole('button', { name: 'Log food (2)' }))

      await waitFor(async () => expect(await db.savedMeals.count()).toBe(1))
      await expect(db.foodLogEntries.count()).resolves.toBe(4)
      await expect(db.savedMeals.toArray()).resolves.toMatchObject([
        {
          name: 'Photo chicken bowl',
          components: [
            { foodId: null, foodSnapshot: { foodName: 'Grilled chicken' } },
            { foodId: null, foodSnapshot: { foodName: 'Cooked rice' } },
          ],
        },
      ])
    } finally {
      play.mockRestore()
      videoWidth.mockRestore()
      videoHeight.mockRestore()
      getContext.mockRestore()
      toDataUrl.mockRestore()
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: originalMediaDevices,
      })
    }
  })

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

    await user.type(await openFoodSearch(user), 'rice')
    await user.click(await screen.findByRole('button', { name: 'Select Rice' }))
    await user.clear(screen.getByRole('textbox', { name: 'Serving amount' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Serving amount' }),
      '1.5',
    )
    expect(screen.getByText(/Preview: 300 kcal/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Log food' }))

    // The added item appears in the subpage tray; return to the day view to see
    // the logged totals.
    expect(await screen.findByText('1 added · Done')).toBeInTheDocument()
    await closeFoodSearch(user)

    expect(await screen.findByText('300 kcal')).toBeInTheDocument()
    await expect(screen.findByText(/1.5 cup/)).resolves.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Foods' }))
    await user.type(await openFoodSearch(user), 'rice')
    await user.click(await screen.findByRole('button', { name: 'Edit Rice' }))
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

    await closeFoodSearch(user)
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

  it('quick-adds a food at its displayed serving from the search "+" without opening the sheet', async () => {
    const user = userEvent.setup()
    renderNutrition()

    await user.click(screen.getByRole('button', { name: /Create custom food/ }))
    await expectSaveFoodAvailable()
    await fillFoodForm(user, {
      name: 'Oats',
      calories: '150',
      protein: '5',
      carbs: '27',
      fat: '3',
    })
    await user.click(screen.getByRole('button', { name: 'Save food' }))
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Create food' }),
      ).not.toBeInTheDocument(),
    )

    await user.type(await openFoodSearch(user), 'oats')
    // The "+" logs immediately at the displayed serving — no serving sheet opens.
    await user.click(await screen.findByRole('button', { name: 'Add Oats' }))
    expect(
      screen.queryByRole('button', { name: 'Log food' }),
    ).not.toBeInTheDocument()
    expect(await screen.findByText('1 added · Done')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Edit Oats serving' }))
    const editDialog = await screen.findByRole('dialog', {
      name: 'Edit food log',
    })
    const multiplier = within(editDialog).getByLabelText('Serving multiplier')
    await user.clear(multiplier)
    await user.type(multiplier, '2')
    await user.click(
      within(editDialog).getByRole('button', { name: 'Save log' }),
    )

    await waitFor(async () => {
      const [entry] = await db.foodLogEntries.toArray()
      expect(entry).toMatchObject({
        computedCalories: 300,
        foodSnapshot: { foodName: 'Oats', caloriesPerServing: 150 },
      })
    })

    await closeFoodSearch(user)
    expect(await screen.findByText('300 kcal')).toBeInTheDocument()
  })

  it('shows and quick-adds local foods using their remembered serving calories', async () => {
    const user = userEvent.setup()
    const repository = createFoodRepository(db)
    const food = await repository.createFood({
      name: 'Gummi worms',
      servingQuantity: 40,
      servingUnit: 'g',
      servingDescription: '',
      caloriesPerServing: 300,
      proteinGramsPerServing: 5,
      carbohydrateGramsPerServing: 72.5,
      fatGramsPerServing: 0,
      notes: '',
    })
    await repository.logFood({
      foodId: food.id,
      localDate: '2026-07-01',
      servingMultiplier: 27 / 40,
    })
    await repository.rememberFoodUnit({
      foodId: food.id,
      unitKey: 'serving',
      amount: 27,
    })

    renderNutrition()
    await user.type(await openFoodSearch(user), 'gummi')

    const selectFood = await screen.findByRole('button', {
      name: 'Select Gummi worms',
    })
    expect(within(selectFood).getByText('203 kcal')).toBeInTheDocument()

    await user.click(selectFood)
    expect(
      await screen.findByRole('textbox', { name: 'Serving amount' }),
    ).toHaveValue('27')
    expect(screen.getByText(/Preview: 203 kcal/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Close food details' }))
    await user.click(
      await screen.findByRole('button', { name: 'Add Gummi worms' }),
    )

    await waitFor(async () => {
      const entries = await db.foodLogEntries.orderBy('createdAt').toArray()
      expect(entries).toHaveLength(2)
      expect(entries[1]?.computedCalories).toBeCloseTo(202.5)
    })
  })

  it('keeps the active food result sections stable while several foods are logged', async () => {
    const user = userEvent.setup()
    const repository = createFoodRepository(db)
    for (const name of ['Oats', 'Oat cereal']) {
      await repository.createFood({
        name,
        servingQuantity: 1,
        servingUnit: 'serving',
        servingDescription: '',
        caloriesPerServing: 150,
        proteinGramsPerServing: 5,
        carbohydrateGramsPerServing: 27,
        fatGramsPerServing: 3,
        notes: '',
      })
    }
    renderNutrition()

    const search = await openFoodSearch(user)
    expect(search.closest('.subpage-enter')).not.toBeNull()
    await user.type(search, 'oat')
    const customFoods = await screen.findByRole('region', {
      name: 'Custom foods',
    })
    expect(within(customFoods).getByText('Oats')).toBeInTheDocument()
    expect(within(customFoods).getByText('Oat cereal')).toBeInTheDocument()

    await user.click(
      within(customFoods).getByRole('button', { name: 'Add Oats' }),
    )

    expect(await screen.findByText('1 added · Done')).toBeInTheDocument()
    expect(
      screen.queryByRole('region', { name: 'Recently added' }),
    ).not.toBeInTheDocument()
    expect(within(customFoods).getByText('Oats')).toBeInTheDocument()
    expect(within(customFoods).getByText('Oat cereal')).toBeInTheDocument()

    await closeFoodSearch(user)
    await user.type(await openFoodSearch(user), 'oat')
    expect(
      await screen.findByRole('region', { name: 'Recently added' }),
    ).toBeInTheDocument()
  })

  it('opens the requested nutrition tab from the route parameter', async () => {
    renderNutrition('/nutrition?tab=foods')

    expect(await screen.findByText('Food library')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Foods' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    cleanup()
    renderNutrition('/nutrition?tab=day')

    expect(await screen.findByRole('button', { name: 'Day' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(
      await screen.findByText('Daily nutrition totals'),
    ).toBeInTheDocument()
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
    expect(
      await screen.findByRole('img', {
        name: 'Daily calories logged and target graph',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText(/calories logged, 1800 target/)).toBeInTheDocument()
  })

  it('calculates a custom goal, returns to Targets, and offers manual updates', async () => {
    const user = userEvent.setup()
    renderNutrition()

    await user.click(screen.getByRole('button', { name: 'Targets' }))

    // Open the Set Goal subpage and confirm the back arrow escapes it.
    await user.click(screen.getByRole('button', { name: 'Set Goal' }))
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Continue' }).closest('section'),
    ).toHaveClass('subpage-enter')
    expect(
      screen.getByRole('option', { name: 'Heavily active' }),
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
      screen.getByLabelText('How active are you outside of exercise?'),
      'moderately_active',
    )
    await user.type(screen.getByLabelText('Goal weight (lb)'), '170')
    await user.type(screen.getByLabelText('Age'), '30')
    await user.selectOptions(screen.getByLabelText('Sex'), 'male')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(
      screen.getByRole('heading', { name: 'Goal Type: Cutting' }),
    ).toBeInTheDocument()
    expect(
      screen
        .getByRole('heading', { name: 'Goal Type: Cutting' })
        .closest('section'),
    ).toHaveClass('subpage-enter')
    const rateSlider = screen.getByRole('slider', {
      name: 'Weekly loss rate',
    })
    expect(rateSlider).toHaveValue('0.5')
    expect(screen.getByText('Recommended')).toBeInTheDocument()
    expect(screen.getByText(/0.9 lb\/week \(0.50%\)/)).toBeInTheDocument()
    expect(screen.getByText('2313 kcal')).toBeInTheDocument()
    expect(screen.getByText(/2026$/)).toBeInTheDocument()

    fireEvent.input(rateSlider, { target: { value: '0.75' } })
    expect(screen.getByText(/1.35 lb\/week \(0.75%\)/)).toBeInTheDocument()
    expect(screen.getByText('2088 kcal')).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Back to basic goal information' }),
    )
    expect(
      (screen.getByLabelText('Goal weight (lb)') as HTMLInputElement).value,
    ).toBe('170')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    fireEvent.input(screen.getByRole('slider', { name: 'Weekly loss rate' }), {
      target: { value: '0.75' },
    })
    await user.click(screen.getByRole('button', { name: 'Done' }))

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
    expect(settings?.nutritionGoal?.weeklyRateLb).toBeCloseTo(-1.35)
    expect(settings?.nutritionTargets.calories).toBe(2088)

    // With no body-weight history a manual update reports insufficient data and
    // does not change calories.
    await user.click(screen.getByRole('button', { name: 'Update Calories' }))
    expect(
      await screen.findByText(
        'More body-weight data is needed before calories can be updated.',
      ),
    ).toBeInTheDocument()
    const after = await db.userSettings.get('settings')
    expect(after?.nutritionTargets.calories).toBe(2088)
  })

  it('closes the Set Goal sub-page with the Escape key', async () => {
    const user = userEvent.setup()
    renderNutrition()

    await user.click(screen.getByRole('button', { name: 'Targets' }))
    await user.click(screen.getByRole('button', { name: 'Set Goal' }))
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(
      await screen.findByRole('button', { name: 'Save targets' }),
    ).toBeInTheDocument()
  })

  it('shows maintenance without a rate slider when goal weight matches current weight', async () => {
    const user = userEvent.setup()
    renderNutrition()

    await user.click(screen.getByRole('button', { name: 'Targets' }))
    await user.click(screen.getByRole('button', { name: 'Set Goal' }))
    await user.type(screen.getByLabelText('Current body weight (lb)'), '180')
    await user.type(screen.getByLabelText('Height (feet)'), '5')
    await user.type(screen.getByLabelText('Height (inches)'), '10')
    await user.type(screen.getByLabelText('Goal weight (lb)'), '180')
    await user.type(screen.getByLabelText('Age'), '30')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(
      screen.getByRole('heading', { name: 'Goal Type: Maintenance' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('slider')).not.toBeInTheDocument()
    expect(screen.getByText('Ongoing maintenance')).toBeInTheDocument()
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
    expect(
      within(dialog).getByRole('button', { name: 'Back from create food' }),
    ).toBeInTheDocument()
    expect(
      within(dialog).queryByRole('textbox', { name: 'Brand or restaurant' }),
    ).not.toBeInTheDocument()
    expect(
      within(dialog).queryByRole('textbox', { name: 'Notes' }),
    ).not.toBeInTheDocument()

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

    await user.type(await openFoodSearch(user), 'rice')

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

    await user.type(await openFoodSearch(user), 'r')
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

  it('uses Spanish Open Food Facts search when the app language is Spanish', async () => {
    const user = userEvent.setup()
    await settingsRepository.saveLanguage('es')
    mockSearchProviderFoods.mockResolvedValue({
      provider: 'open_food_facts',
      query: 'arroz',
      results: [],
      fallbackUsed: false,
    })
    renderNutrition()

    await user.click(
      await screen.findByRole('button', { name: 'Buscar alimentos' }),
    )
    await user.type(
      screen.getByRole('searchbox', { name: 'Buscar alimentos' }),
      'arroz',
    )
    expect(mockSearchProviderFoods).not.toHaveBeenCalled()
    await user.click(
      screen.getByRole('button', { name: 'Buscar alimentos en español' }),
    )

    await waitFor(() =>
      expect(mockSearchProviderFoods).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'arroz',
          provider: 'open_food_facts',
          language: 'es',
          allowFallback: false,
        }),
      ),
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

    await user.type(await openFoodSearch(user), 'zzz')

    expect(
      await screen.findByText(/Food providers are unavailable/),
    ).toBeInTheDocument()
    expect(screen.queryByText('No acceptable results')).not.toBeInTheDocument()
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

    await user.type(await openFoodSearch(user), 'chicken')
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

    await user.type(await openFoodSearch(user), 'chicken')
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
    expect(saved?.brandName).toBeNull()
    expect(saved?.notes).toBe('')
  })

  it('surfaces strict matching saved recipes first in food search', async () => {
    const user = userEvent.setup()
    await seedSavedRecipe()
    renderNutrition()

    await user.type(await openFoodSearch(user), 'chicken rice')

    const recipes = await screen.findByRole('region', { name: 'Recipes' })
    expect(
      within(recipes).getByRole('button', { name: 'Select Chicken and Rice' }),
    ).toBeInTheDocument()

    await user.click(
      within(recipes).getByRole('button', { name: 'Select Chicken and Rice' }),
    )

    expect(
      await screen.findByText('Logged Chicken and Rice (1 items).'),
    ).toBeInTheDocument()
    await expect(db.foodLogEntries.count()).resolves.toBe(1)
  })

  it('does not create a recipe search section for one-character-off queries', async () => {
    const user = userEvent.setup()
    await seedSavedRecipe()
    renderNutrition()

    await user.type(await openFoodSearch(user), 'chicken ric')

    await waitFor(() =>
      expect(
        screen.queryByRole('region', { name: 'Recipes' }),
      ).not.toBeInTheDocument(),
    )
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
      screen.findByText(/1 entry - 250 kcal - P 20 C 0 F 0/),
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
      await user.type(await openFoodSearch(user), name)
      await user.click(
        await screen.findByRole('button', { name: `Select ${name}` }),
      )
      await user.click(screen.getByRole('button', { name: 'Log food' }))
      await closeFoodSearch(user)
      await new Promise((resolve) => setTimeout(resolve, 2))
    }

    await user.type(await openFoodSearch(user), 'Recent four')
    // Recently added foods now surface first in the day-tab search when they
    // match the query.
    expect(
      await screen.findByRole('button', { name: 'Select Recent four' }),
    ).toBeInTheDocument()
    await closeFoodSearch(user)
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

function renderNutrition(initialEntry = '/nutrition') {
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
    { initialEntries: [initialEntry] },
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

    expect(sections[0].title).toBe('Recently added')
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

async function seedSavedRecipe() {
  const repository = createFoodRepository(db)
  const food = await repository.createFood({
    name: 'Chicken',
    servingQuantity: 1,
    servingUnit: 'serving',
    servingDescription: '',
    caloriesPerServing: 200,
    proteinGramsPerServing: 20,
    carbohydrateGramsPerServing: 10,
    fatGramsPerServing: 5,
    notes: '',
  })
  await repository.createSavedMeal({
    name: 'Chicken and Rice',
    components: [
      {
        foodId: food.id,
        foodSnapshot: snapshotFood(food),
        servingMultiplier: 1,
      },
    ],
  })
}

// Food search now lives in a subpage opened from the day/foods tabs. Tests that
// drive the search field open it first via this helper.
async function openFoodSearch(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Search foods' }))
  return screen.getByRole('searchbox', { name: 'Search foods' })
}

// Returns to the day view from the search subpage.
async function closeFoodSearch(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Back to nutrition' }))
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
