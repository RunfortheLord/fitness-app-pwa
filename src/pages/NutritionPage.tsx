import {
  Archive,
  ArrowLeft,
  BookmarkPlus,
  Camera,
  CopyPlus,
  Edit2,
  Flame,
  Minus,
  Plus,
  ReceiptText,
  RotateCcw,
  Search,
  Star,
  Trash2,
  Utensils,
} from 'lucide-react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { format } from 'date-fns'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import {
  Card,
  BottomSheet,
  DateSelector,
  EmptyState,
  FormField,
  IconButton,
  LoadingState,
  ModalConfirmationDialog,
  NumericInput,
  PageContainer,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  SegmentedControl,
  StatusMessage,
  Toast,
  ValidationMessage,
} from '@components/ui'
import { useSubpageBackGesture } from '@hooks/useSubpageBackGesture'
import { FoodIcon } from '@components/FoodIcon'
import {
  addLocalDays,
  formatLocalDate,
  formatSelectedDateLabel,
  type LocalDateString,
} from '@domain/dates'
import { latestBodyweight } from '@domain/bodyweightProgress'
import { currentTrendWeight } from '@domain/bodyweightTrend'
import {
  GOAL_FORMULA_VERSION,
  computeGoalPlan,
  estimateGoalDate,
  type GoalActivityLevel,
  type GoalPlanInput,
  type GoalSex,
} from '@domain/goalMacros'
import { evaluateCalorieUpdate } from '@domain/calorieAdjustment'
import {
  formatAmountValue,
  formatCalories,
  formatFoodServingLabel,
  formatGrams,
  formatMacroGram,
  formatQuantityChipLabel,
  nextSteppedAmount,
  quantityChipsForUnit,
  servingOptionsForFood,
  type FoodServingOption,
} from '@domain/foodServings'
import {
  normalizeProviderQuery,
  splitBrandFromName,
  type GroupedFoodResult,
  type NormalizedFoodResult,
} from '@domain/foodProviderModels'
import {
  createSearchSections,
  type FoodResult,
  type FoodSearchResult,
} from '@domain/foodSearchSections'
import {
  MEAL_LABELS,
  MEAL_TYPES,
  groupEntriesByMeal,
  mealTypeForDate,
} from '@domain/meals'
import { snapshotFood } from '@domain/snapshots'
import { useDashboardContext } from '@hooks/useDashboardContext'
import {
  foodRepository,
  type CreateFoodInput,
} from '@repositories/foodRepository'
import { bodyweightRepository } from '@repositories/bodyweightRepository'
import {
  settingsRepository,
  type NutritionGoalInput,
} from '@repositories/settingsRepository'
import {
  FoodProviderClientError,
  lookupBarcodeProduct,
  searchProviderFoods,
  type FoodProviderClientErrorCode,
} from '@services/foodProviderClient'
import {
  nutritionSummaryService,
  type DailyNutritionSummary,
} from '@services/nutritionSummaryService'
import type {
  BodyweightEntry,
  Food,
  FoodLogEntry,
  FoodSnapshot,
  IntegrationConnectionStatus,
  MealType,
  NutritionGoal,
  NutritionTargetValues,
  SavedMeal,
} from '@shared-types/app'

type NutritionMode = 'day' | 'foods' | 'targets'

// A food logged from within the search subpage during the current session. The
// subpage shows these as a running tray so several items can be added before
// returning to the day view.
type AddedItem = {
  id: number
  name: string
  iconName: string
  iconCategory: string | null
}

type SheetState =
  | { type: 'food'; food: Food | null; initialForm?: FoodFormState }
  | { type: 'select'; result: FoodResult }
  | { type: 'entry'; entry: FoodLogEntry }
  | { type: 'quickAdd' }
  | { type: 'scanner' }
  | null

// A recipe component while editing in the subpage. Uses the same shape as a
// persisted SavedMealComponent so saved recipes load and re-save directly.
type RecipeComponentDraft = {
  foodId: string | null
  foodSnapshot: FoodSnapshot
  servingMultiplier: number
}

// An in-progress recipe built from the shared food-search subpage. While this is
// non-null the subpage is in "recipe mode": selecting a food adds it to the
// recipe instead of logging it to the day.
type RecipeDraft = {
  // The saved-meal id when editing an existing recipe; null when creating one.
  editingId: string | null
  name: string
  components: RecipeComponentDraft[]
}

type FoodFormState = {
  name: string
  brandName: string
  servingQuantity: string
  servingUnit: string
  caloriesPerServing: string
  proteinGramsPerServing: string
  carbohydrateGramsPerServing: string
  fatGramsPerServing: string
  notes: string
  barcode: string
}

type ProviderSearchState = {
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

type UsdaKeyState = {
  configured: boolean
  apiKey: string | null
  status: IntegrationConnectionStatus
}

type LoadState = {
  foods: Food[]
  logs: FoodLogEntry[]
  recentFoods: Food[]
  favoriteFoods: Food[]
  savedMeals: SavedMeal[]
  summary: DailyNutritionSummary | null
  status: 'loading' | 'ready' | 'error'
}

const emptyFoodForm: FoodFormState = {
  name: '',
  brandName: '',
  servingQuantity: '',
  servingUnit: '',
  caloriesPerServing: '',
  proteinGramsPerServing: '',
  carbohydrateGramsPerServing: '',
  fatGramsPerServing: '',
  notes: '',
  barcode: '',
}

const emptyTargets = {
  calories: '',
  proteinGrams: '',
  carbohydrateGrams: '',
  fatGrams: '',
}

const emptyQuickAddForm = {
  name: '',
  calories: '',
  proteinGrams: '',
  carbohydrateGrams: '',
  fatGrams: '',
}

export function NutritionPage() {
  const { refreshDashboard, selectedDate, setSelectedDate } =
    useDashboardContext()
  const today = formatLocalDate(new Date())
  const [mode, setMode] = useState<NutritionMode>('day')
  const [query, setQuery] = useState('')
  const [sheet, setSheet] = useState<SheetState>(null)
  const [deleteEntry, setDeleteEntry] = useState<FoodLogEntry | null>(null)
  const [providerSearch, setProviderSearch] = useState<ProviderSearchState>({
    status: 'idle',
    results: [],
    query: '',
  })
  const [providerSearchNonce, setProviderSearchNonce] = useState(0)
  const [usdaKey, setUsdaKey] = useState<UsdaKeyState>({
    configured: false,
    apiKey: null,
    status: 'not_configured',
  })
  const [loadState, setLoadState] = useState<LoadState>({
    foods: [],
    logs: [],
    recentFoods: [],
    favoriteFoods: [],
    savedMeals: [],
    summary: null,
    status: 'loading',
  })
  const [savedMealToDelete, setSavedMealToDelete] = useState<SavedMeal | null>(
    null,
  )
  const [revision, setRevision] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [targetsView, setTargetsView] = useState<'main' | 'setGoal'>('main')
  const [searchOpen, setSearchOpen] = useState(false)
  const [addedItems, setAddedItems] = useState<AddedItem[]>([])
  const addedItemIdRef = useRef(0)
  const [recipeDraft, setRecipeDraft] = useState<RecipeDraft | null>(null)
  const [recipeError, setRecipeError] = useState<string | null>(null)
  const [recipeSaving, setRecipeSaving] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const [goalData, setGoalData] = useState<{
    goal: NutritionGoal | null
    entries: BodyweightEntry[]
  }>({ goal: null, entries: [] })

  useSubpageBackGesture(targetsView === 'setGoal', () => setTargetsView('main'))
  useSubpageBackGesture(searchOpen, () => {
    setSearchOpen(false)
    setRecipeDraft(null)
  })

  const openSearch = useCallback(() => {
    setQuery('')
    setAddedItems([])
    setRecipeDraft(null)
    setSearchOpen(true)
  }, [])

  // Start a new recipe in the shared search subpage. Same search experience as
  // logging food, but selections go into the recipe (see SelectedFoodSheet's
  // recipe mode) rather than the day's log.
  const startRecipe = useCallback(() => {
    setQuery('')
    setAddedItems([])
    setRecipeError(null)
    setRecipeDraft({ editingId: null, name: '', components: [] })
    setSearchOpen(true)
  }, [])

  // Edit an existing saved recipe in the same subpage, prefilled with its name
  // and components.
  const startEditRecipe = useCallback((meal: SavedMeal) => {
    setQuery('')
    setAddedItems([])
    setRecipeError(null)
    setRecipeDraft({
      editingId: meal.id,
      name: meal.name,
      components: meal.components.map((component) => ({
        foodId: component.foodId,
        foodSnapshot: component.foodSnapshot,
        servingMultiplier: component.servingMultiplier,
      })),
    })
    setSearchOpen(true)
  }, [])

  const closeSearch = useCallback(() => {
    setSearchOpen(false)
    setRecipeDraft(null)
    setRecipeError(null)
  }, [])

  // The food search is a focused full-screen mode. Hide the bottom nav while it
  // is open so the keyboard never floats it up over the results (iOS Safari).
  useEffect(() => {
    document.body.classList.toggle('food-search-open', searchOpen)
    return () => {
      document.body.classList.remove('food-search-open')
    }
  }, [searchOpen])

  const addRecipeComponent = useCallback(
    (food: Food, servingMultiplier: number) => {
      setRecipeDraft((current) => {
        if (!current) {
          return current
        }
        if (current.components.some((item) => item.foodId === food.id)) {
          return current
        }
        return {
          ...current,
          components: [
            ...current.components,
            {
              foodId: food.id,
              foodSnapshot: snapshotFood(food),
              servingMultiplier,
            },
          ],
        }
      })
    },
    [],
  )

  const removeRecipeComponent = useCallback((index: number) => {
    setRecipeDraft((current) =>
      current
        ? {
            ...current,
            components: current.components.filter((_, i) => i !== index),
          }
        : current,
    )
  }, [])

  const appendAddedItem = useCallback((result: FoodResult) => {
    const display = resultDisplay(result)
    const iconCategory =
      result.type === 'external' ? result.food.foodCategory : null
    setAddedItems((current) => [
      ...current,
      {
        id: ++addedItemIdRef.current,
        name: display.name,
        iconName: result.food.name,
        iconCategory,
      },
    ])
  }, [])

  // The quick-action "Log food" entry point navigates here with ?logFood=1;
  // open the search subpage and drop the param so a refresh does not reopen it.
  useEffect(() => {
    if (searchParams.get('logFood') !== '1') {
      return
    }
    const timeoutId = window.setTimeout(() => {
      openSearch()
      const next = new URLSearchParams(searchParams)
      next.delete('logFood')
      setSearchParams(next, { replace: true })
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [openSearch, searchParams, setSearchParams])

  useEffect(() => {
    let isCurrent = true

    void Promise.all([
      foodRepository.searchFoods(query),
      foodRepository.listFoodLogsByDate(selectedDate),
      foodRepository.listRecentFoods(50),
      foodRepository.listFavoriteFoods(),
      foodRepository.listSavedMeals(),
      nutritionSummaryService.getDailySummary(selectedDate),
    ])
      .then(
        ([foods, logs, recentFoods, favoriteFoods, savedMeals, summary]) => {
          if (!isCurrent) {
            return
          }

          setLoadState({
            foods,
            logs,
            recentFoods,
            favoriteFoods,
            savedMeals,
            summary,
            status: 'ready',
          })
        },
      )
      .catch(() => {
        if (!isCurrent) {
          return
        }

        setLoadState((current) => ({ ...current, status: 'error' }))
      })

    return () => {
      isCurrent = false
    }
  }, [query, revision, selectedDate])

  useEffect(() => {
    let isCurrent = true
    void settingsRepository.getUsdaApiKeySettings().then((settings) => {
      if (!isCurrent) {
        return
      }
      setUsdaKey({
        configured: Boolean(settings?.apiKey),
        apiKey: settings?.apiKey ?? null,
        status: settings?.status ?? 'not_configured',
      })
    })
    return () => {
      isCurrent = false
    }
  }, [revision])

  useEffect(() => {
    let isCurrent = true
    void Promise.all([
      settingsRepository.getNutritionGoal(),
      bodyweightRepository.listBodyweightEntries(),
    ])
      .then(([goal, entries]) => {
        if (!isCurrent) {
          return
        }
        setGoalData({ goal, entries })
      })
      .catch(() => {
        // Goal/bodyweight data is non-critical; ignore load failures (e.g. the
        // database closing during teardown) and keep the page usable.
      })
    return () => {
      isCurrent = false
    }
  }, [revision])

  useEffect(() => {
    const normalizedQuery = normalizeProviderQuery(query)
    if (!normalizedQuery) {
      const timeoutId = window.setTimeout(() => {
        setProviderSearch({ status: 'idle', results: [], query: '' })
      }, 0)
      return () => window.clearTimeout(timeoutId)
    }
    if (normalizedQuery.length < 3) {
      const timeoutId = window.setTimeout(() => {
        setProviderSearch({
          status: 'below-threshold',
          results: [],
          query: normalizedQuery,
        })
      }, 0)
      return () => window.clearTimeout(timeoutId)
    }
    if (!navigator.onLine) {
      const timeoutId = window.setTimeout(() => {
        setProviderSearch({
          status: 'offline',
          results: [],
          query: normalizedQuery,
        })
      }, 0)
      return () => window.clearTimeout(timeoutId)
    }

    // A user-entered key is optional: when absent we send an empty key and let
    // the server fall back to its configured USDA key. If neither exists, the
    // server returns missing_api_key and the existing error UX is shown.
    const apiKey = usdaKey.apiKey ?? ''
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => {
      setProviderSearch((current) => ({
        ...current,
        status: 'loading',
        query: normalizedQuery,
      }))
      void searchProviderFoods({
        query: normalizedQuery,
        apiKey,
        provider: 'usda',
        allowFallback: false,
        pageSize: 20,
        signal: controller.signal,
      })
        .then((response) => {
          setProviderSearch({
            status: 'ready',
            results: response.results,
            query: response.query,
          })
        })
        .catch((caught: unknown) => {
          if (controller.signal.aborted) {
            return
          }
          const status =
            caught instanceof FoodProviderClientError
              ? caught.code
              : 'unexpected_server_error'
          setProviderSearch({
            status,
            results: [],
            query: normalizedQuery,
          })
        })
    }, 500)

    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [providerSearchNonce, query, usdaKey])

  const daySearchResults = createSearchSections({
    localFoods: loadState.foods,
    includeRecentFoods: true,
    providerResults: providerSearch.results,
    query,
    recentFoods: loadState.recentFoods,
    savedMeals: loadState.savedMeals,
  })
  const summary = loadState.summary
  const reload = () => {
    setRevision((value) => value + 1)
    refreshDashboard()
  }

  const toggleFavorite = (food: Food) => {
    void foodRepository.setFoodFavorite(food.id, !food.isFavorite).then(() => {
      setMessage(food.isFavorite ? 'Removed favorite.' : 'Added favorite.')
      reload()
    })
  }

  // One-tap re-log: reuse the food's remembered unit+amount (falling back to its
  // representative portion) and file it under the current time-of-day meal, with
  // no sheet to confirm.
  const quickLog = (food: Food) => {
    void foodRepository
      .getRememberedFoodUnit(food.id)
      .then((preference) => {
        const options = servingOptionsForFood(food, preference?.unitKey ?? null)
        const option =
          options.find((candidate) => candidate.key === preference?.unitKey) ??
          options[0]
        const amount = preference?.amount ?? option?.amount ?? 1
        const servingMultiplier = option?.toServingMultiplier(amount) ?? 1
        return foodRepository.logFood({
          foodId: food.id,
          localDate: selectedDate,
          servingMultiplier: servingMultiplier > 0 ? servingMultiplier : 1,
          mealType: mealTypeForDate(new Date()),
        })
      })
      .then(() => {
        setMessage('Logged again.')
        reload()
      })
      .catch(() => setMessage('Could not log that food.'))
  }

  // Trailing "+" on a search row: log the food immediately at its displayed
  // serving (the representative portion shown on the row), no sheet. Tapping the
  // row banner still opens the sheet for adjusting serving size.
  const quickAddResult = (result: FoodSearchResult) => {
    if (result.type === 'savedMeal') {
      logSavedMeal(result.meal)
      return
    }
    const option = servingOptionsForResult(result, null)[0]
    const amount = option?.amount ?? 1
    const multiplier = option?.toServingMultiplier(amount) ?? 1
    const servingMultiplier = multiplier > 0 ? multiplier : 1
    const mealType = mealTypeForDate(new Date())
    const action =
      result.type === 'external'
        ? foodRepository.logExternalFood({
            food: result.food,
            localDate: selectedDate,
            servingMultiplier,
            mealType,
          })
        : foodRepository.logFood({
            foodId: result.food.id,
            localDate: selectedDate,
            servingMultiplier,
            mealType,
          })
    void action
      .then(() => {
        // Mirror the sheet's behaviour: keep the search subpage open and record
        // the item in the "added" tray so several foods can be added in a pass.
        if (searchOpen) {
          appendAddedItem(result)
        }
        setMessage('Food logged.')
        reload()
      })
      .catch(() => setMessage('Could not log that food.'))
  }

  const logSavedMeal = (meal: SavedMeal) => {
    void foodRepository
      .logSavedMeal({ savedMealId: meal.id, localDate: selectedDate })
      .then((entries) => {
        setMessage(`Logged ${meal.name} (${entries.length} items).`)
        reload()
      })
      .catch(() => setMessage('Could not log that meal.'))
  }

  const saveRecipe = () => {
    if (!recipeDraft) {
      return
    }
    if (!recipeDraft.name.trim()) {
      setRecipeError('Give the recipe a name.')
      return
    }
    if (recipeDraft.components.length === 0) {
      setRecipeError('Add at least one food to the recipe.')
      return
    }
    setRecipeSaving(true)
    const { editingId } = recipeDraft
    const components = recipeDraft.components.map((component) => ({
      foodId: component.foodId,
      foodSnapshot: component.foodSnapshot,
      servingMultiplier: component.servingMultiplier,
    }))
    const action = editingId
      ? foodRepository.updateSavedMeal(editingId, {
          name: recipeDraft.name.trim(),
          components,
        })
      : foodRepository.createSavedMeal({
          name: recipeDraft.name.trim(),
          components,
        })
    void action
      .then(() => {
        setRecipeSaving(false)
        setSearchOpen(false)
        setRecipeDraft(null)
        setRecipeError(null)
        setMessage(editingId ? 'Recipe updated.' : 'Recipe saved.')
        reload()
      })
      .catch((caught: unknown) => {
        setRecipeSaving(false)
        setRecipeError(
          caught instanceof Error ? caught.message : 'Recipe could not save.',
        )
      })
  }

  return (
    <PageContainer>
      <Toast message={message} onDismiss={() => setMessage(null)} />
      {searchOpen ? (
        <FoodSearchSubpage
          providerSearch={providerSearch}
          results={daySearchResults}
          addedItems={addedItems}
          recipeDraft={recipeDraft}
          recipeError={recipeError}
          recipeSaving={recipeSaving}
          onRecipeNameChange={(name) =>
            setRecipeDraft((current) =>
              current ? { ...current, name } : current,
            )
          }
          onRemoveRecipeComponent={removeRecipeComponent}
          onSaveRecipe={saveRecipe}
          onBack={closeSearch}
          onEditFood={(food) => setSheet({ type: 'food', food })}
          onOpenRecipe={startRecipe}
          onOpenQuickAdd={() => setSheet({ type: 'quickAdd' })}
          onOpenScanner={() => setSheet({ type: 'scanner' })}
          onSelectResult={(result) => {
            if (result.type === 'savedMeal') {
              logSavedMeal(result.meal)
              return
            }
            setSheet({ type: 'select', result })
          }}
          onAddResult={quickAddResult}
          onSearch={() => setProviderSearchNonce((current) => current + 1)}
          query={query}
          setQuery={setQuery}
        />
      ) : (
        <>
          <DateSelector
            dateLabel={formatSelectedDateLabel(selectedDate)}
            onNext={() => setSelectedDate(addLocalDays(selectedDate, 1))}
            onPrevious={() => setSelectedDate(addLocalDays(selectedDate, -1))}
            onToday={() => setSelectedDate(today)}
          />

          <SegmentedControl
            label="Nutrition mode"
            onChange={(value) => setMode(value as NutritionMode)}
            options={[
              { label: 'Day', value: 'day' },
              { label: 'Foods', value: 'foods' },
              { label: 'Targets', value: 'targets' },
            ]}
            value={mode}
          />

          {loadState.status === 'loading' ? (
            <LoadingState label="Loading nutrition" />
          ) : null}
          {loadState.status === 'error' ? (
            <StatusMessage tone="warning">
              Nutrition data could not load.
            </StatusMessage>
          ) : null}
          {usdaKey.configured ? (
            <span className="visually-hidden">
              {usdaStatusLabel(usdaKey.status)}
            </span>
          ) : null}

          {mode === 'day' ? (
            <>
              <DailyTotalsCard summary={summary} />
              <FoodSearchTrigger
                onOpen={openSearch}
                onOpenQuickAdd={() => setSheet({ type: 'quickAdd' })}
                onOpenScanner={() => setSheet({ type: 'scanner' })}
                onOpenRecipe={startRecipe}
              />
              <NutritionActionCard
                onCreateFood={() => setSheet({ type: 'food', food: null })}
              />
              <LoggedFoodsCard
                entries={loadState.logs}
                onDelete={setDeleteEntry}
                onEdit={(entry) => setSheet({ type: 'entry', entry })}
              />
            </>
          ) : null}

          {mode === 'foods' ? (
            <>
              <SectionHeader
                title="Food library"
                action={
                  <IconButton
                    aria-label="Create food"
                    onClick={() => setSheet({ type: 'food', food: null })}
                  >
                    <Plus aria-hidden="true" size={20} />
                  </IconButton>
                }
              />
              <FoodSearchTrigger
                onOpen={openSearch}
                onOpenQuickAdd={() => setSheet({ type: 'quickAdd' })}
                onOpenScanner={() => setSheet({ type: 'scanner' })}
                onOpenRecipe={startRecipe}
              />
              {loadState.savedMeals.length ? (
                <SavedMealsCard
                  meals={loadState.savedMeals}
                  onLog={logSavedMeal}
                  onEdit={startEditRecipe}
                  onDelete={setSavedMealToDelete}
                />
              ) : null}
              {loadState.favoriteFoods.length ? (
                <FoodShortcutCard
                  title="Favorites"
                  foods={loadState.favoriteFoods}
                  emptyTitle="No favorites"
                  emptyMessage="Star a food to pin it here for one-tap logging."
                  onSelect={(food) =>
                    setSheet({
                      type: 'select',
                      result: { type: 'local', food, section: 'recent' },
                    })
                  }
                  onQuickLog={quickLog}
                  onToggleFavorite={toggleFavorite}
                />
              ) : null}
              <FoodShortcutCard
                title="Recent foods"
                foods={loadState.recentFoods}
                emptyTitle="No recent foods"
                emptyMessage="Logged reusable foods appear here for repeat entries."
                onSelect={(food) =>
                  setSheet({
                    type: 'select',
                    result: { type: 'local', food, section: 'recent' },
                  })
                }
                onQuickLog={quickLog}
                onToggleFavorite={toggleFavorite}
              />
            </>
          ) : null}

          {mode === 'targets' ? (
            targetsView === 'setGoal' ? (
              <SetGoalSubpage
                entries={goalData.entries}
                existingGoal={goalData.goal}
                onBack={() => setTargetsView('main')}
                onCalculated={() => {
                  setMessage('Macros calculated and targets saved.')
                  setTargetsView('main')
                  reload()
                }}
              />
            ) : (
              <>
                <TargetsCard
                  key={targetKey(summary?.targets ?? null)}
                  currentTargets={summary?.targets ?? null}
                  onSaved={() => {
                    setMessage('Nutrition targets saved.')
                    reload()
                  }}
                />
                {goalData.goal ? (
                  <GoalProgressCard
                    entries={goalData.entries}
                    goal={goalData.goal}
                    onUpdated={(label) => {
                      setMessage(label)
                      reload()
                    }}
                  />
                ) : null}
                <Card title="Custom goal">
                  <p className="muted">
                    Build calorie and macro targets from your bodyweight,
                    height, activity, and goal weight.
                  </p>
                  <PrimaryButton
                    type="button"
                    onClick={() => setTargetsView('setGoal')}
                  >
                    Set Goal
                  </PrimaryButton>
                </Card>
              </>
            )
          ) : null}
        </>
      )}

      {sheet?.type === 'food' ? (
        <FoodFormSheet
          food={sheet.food}
          initialForm={sheet.initialForm}
          isOpen
          onClose={() => setSheet(null)}
          onSaved={() => {
            setMessage(sheet.food ? 'Food updated.' : 'Food created.')
            setSheet(null)
            reload()
          }}
        />
      ) : null}

      {sheet?.type === 'select' ? (
        <SelectedFoodSheet
          key={sheet.result.food.id}
          result={sheet.result}
          isOpen
          localDate={selectedDate}
          onCreateCopy={(initialForm) =>
            setSheet({ type: 'food', food: null, initialForm })
          }
          onSelectAlternate={(food) =>
            setSheet({
              type: 'select',
              result: {
                type: 'external',
                food: { ...food, alternates: [] },
              },
            })
          }
          onClose={() => setSheet(null)}
          onAddToRecipe={
            recipeDraft
              ? (food, servingMultiplier) => {
                  addRecipeComponent(food, servingMultiplier)
                  setSheet(null)
                  // Recipes are built from several different ingredients, so reset
                  // the search after each add to give a fresh field for the next
                  // one (unlike logging, which keeps the query to add repeats).
                  setQuery('')
                }
              : undefined
          }
          onSaved={() => {
            // Logging from the search subpage keeps the subpage open so several
            // foods can be added in one pass; record the item in the tray.
            if (searchOpen && sheet.type === 'select') {
              appendAddedItem(sheet.result)
            }
            setMessage('Food logged.')
            setSheet(null)
            reload()
          }}
        />
      ) : null}

      {sheet?.type === 'entry' ? (
        <EditFoodLogSheet
          entry={sheet.entry}
          isOpen
          onClose={() => setSheet(null)}
          onSaved={() => {
            setMessage('Food log updated.')
            setSheet(null)
            reload()
          }}
        />
      ) : null}

      {sheet?.type === 'quickAdd' ? (
        <QuickAddSheet
          isOpen
          localDate={selectedDate}
          onClose={() => setSheet(null)}
          onSaved={() => {
            setMessage('Quick add logged.')
            setSheet(null)
            reload()
          }}
        />
      ) : null}

      {sheet?.type === 'scanner' ? (
        <BarcodeScannerSheet
          apiKey={usdaKey.apiKey}
          isOpen
          localDate={selectedDate}
          onClose={() => setSheet(null)}
          onCreateCustom={(barcode) =>
            setSheet({
              type: 'food',
              food: null,
              initialForm: { ...emptyFoodForm, barcode },
            })
          }
          onFound={(result) => setSheet({ type: 'select', result })}
        />
      ) : null}

      <ModalConfirmationDialog
        confirmLabel="Delete"
        isOpen={savedMealToDelete !== null}
        onCancel={() => setSavedMealToDelete(null)}
        onConfirm={() => {
          if (!savedMealToDelete) {
            return
          }
          void foodRepository
            .archiveSavedMeal(savedMealToDelete.id)
            .then(() => {
              setSavedMealToDelete(null)
              setMessage('Saved meal deleted.')
              reload()
            })
        }}
        title="Delete saved meal?"
      >
        <p>
          &ldquo;{savedMealToDelete?.name ?? ''}&rdquo; will be removed. Entries
          you already logged from it stay.
        </p>
      </ModalConfirmationDialog>

      <ModalConfirmationDialog
        confirmLabel="Delete"
        isOpen={deleteEntry !== null}
        onCancel={() => setDeleteEntry(null)}
        onConfirm={() => {
          if (!deleteEntry) {
            return
          }
          void foodRepository.deleteFoodLogEntry(deleteEntry.id).then(() => {
            setDeleteEntry(null)
            setMessage('Food log deleted.')
            reload()
          })
        }}
        title="Delete food log?"
      >
        <p>This removes the logged food from {selectedDate}.</p>
      </ModalConfirmationDialog>
    </PageContainer>
  )
}

function DailyTotalsCard({
  summary,
}: {
  summary: DailyNutritionSummary | null
}) {
  const totals = summary?.totals
  const targets = summary?.targets

  return (
    <Card title="Daily nutrition totals">
      <p className="metric-value">{Math.round(totals?.calories ?? 0)} kcal</p>
      <p className="muted">
        {Math.round(summary?.remainingCalories ?? 0)} kcal remaining
      </p>
      <div className="macro-row nutrition-row">
        <span>
          Protein {roundMacro(totals?.proteinGrams)} /{' '}
          {roundMacro(targets?.proteinGrams)} g
        </span>
        <span>
          Carbs {roundMacro(totals?.carbohydrateGrams)} /{' '}
          {roundMacro(targets?.carbohydrateGrams)} g
        </span>
        <span>
          Fat {roundMacro(totals?.fatGrams)} / {roundMacro(targets?.fatGrams)} g
        </span>
      </div>
      {!targets?.calories ? (
        <p className="muted">Set manual targets when you are ready.</p>
      ) : null}
    </Card>
  )
}

// Day/Foods tabs show this compact card; tapping it opens the full search
// subpage. Quick add and barcode scan stay reachable here without a detour.
function FoodSearchTrigger({
  onOpen,
  onOpenQuickAdd,
  onOpenScanner,
  onOpenRecipe,
}: {
  onOpen: () => void
  onOpenQuickAdd: () => void
  onOpenScanner: () => void
  onOpenRecipe: () => void
}) {
  return (
    <Card>
      <div className="food-search-heading">
        <h2>Food search</h2>
        <div className="row-actions">
          <IconButton aria-label="Quick add nutrition" onClick={onOpenQuickAdd}>
            <Flame aria-hidden="true" size={20} />
          </IconButton>
          <IconButton aria-label="New recipe" onClick={onOpenRecipe}>
            <BookmarkPlus aria-hidden="true" size={20} />
          </IconButton>
          <IconButton aria-label="Scan barcode" onClick={onOpenScanner}>
            <Camera aria-hidden="true" size={20} />
          </IconButton>
        </div>
      </div>
      <button className="food-search-trigger" type="button" onClick={onOpen}>
        <Search aria-hidden="true" size={18} />
        <span>Search foods</span>
      </button>
    </Card>
  )
}

function FoodSearchSubpage({
  providerSearch,
  results,
  addedItems,
  recipeDraft,
  recipeError,
  recipeSaving,
  onRecipeNameChange,
  onRemoveRecipeComponent,
  onSaveRecipe,
  onBack,
  onEditFood,
  onOpenQuickAdd,
  onOpenScanner,
  onOpenRecipe,
  onSelectResult,
  onAddResult,
  onSearch,
  query,
  setQuery,
}: {
  providerSearch: ProviderSearchState
  results: Array<{ title: string; items: FoodSearchResult[] }>
  addedItems: AddedItem[]
  recipeDraft: RecipeDraft | null
  recipeError: string | null
  recipeSaving: boolean
  onRecipeNameChange: (name: string) => void
  onRemoveRecipeComponent: (index: number) => void
  onSaveRecipe: () => void
  onBack: () => void
  onEditFood: (food: Food) => void
  onOpenQuickAdd: () => void
  onOpenScanner: () => void
  onOpenRecipe: () => void
  onSelectResult: (result: FoodSearchResult) => void
  onAddResult: (result: FoodSearchResult) => void
  onSearch: () => void
  query: string
  setQuery: (query: string) => void
}) {
  const hasResults = results.some((section) => section.items.length > 0)
  const normalizedQuery = normalizeProviderQuery(query)
  const recipeMode = recipeDraft !== null

  return (
    <div className="food-search-subpage">
      <div className="food-search-sticky">
        <div className="food-search-subpage-bar">
          <IconButton aria-label="Back to nutrition" onClick={onBack}>
            <ArrowLeft aria-hidden="true" size={20} />
          </IconButton>
          <div className="food-search-subpage-input">
            <Search aria-hidden="true" size={18} />
            <input
              aria-label="Search foods"
              autoFocus
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  onSearch()
                }
              }}
              placeholder="Search foods"
              type="search"
              value={query}
            />
          </div>
          <div className="row-actions">
            {recipeMode ? (
              <span
                className="recipe-mode-badge"
                aria-label="Building a recipe"
              >
                <BookmarkPlus aria-hidden="true" size={20} />
              </span>
            ) : (
              <>
                <IconButton
                  aria-label="Quick add nutrition"
                  onClick={onOpenQuickAdd}
                >
                  <Flame aria-hidden="true" size={20} />
                </IconButton>
                <IconButton aria-label="New recipe" onClick={onOpenRecipe}>
                  <BookmarkPlus aria-hidden="true" size={20} />
                </IconButton>
              </>
            )}
            <IconButton aria-label="Scan barcode" onClick={onOpenScanner}>
              <Camera aria-hidden="true" size={20} />
            </IconButton>
          </div>
        </div>
        {recipeMode && recipeDraft ? (
          <div className="recipe-build-bar" aria-label="Recipe builder">
            <div className="food-search-subpage-input">
              <BookmarkPlus aria-hidden="true" size={18} />
              <input
                aria-label="Recipe name"
                onChange={(event) => onRecipeNameChange(event.target.value)}
                placeholder="Recipe name"
                type="text"
                value={recipeDraft.name}
              />
            </div>
            {recipeDraft.components.length ? (
              <div className="recipe-build-components">
                {recipeDraft.components.map((component, index) => (
                  <span
                    className="recipe-build-chip"
                    key={`${component.foodId ?? component.foodSnapshot.foodName}-${index}`}
                    title={component.foodSnapshot.foodName}
                  >
                    <FoodIcon
                      name={component.foodSnapshot.foodName}
                      size={16}
                    />
                    <span className="recipe-build-chip-name">
                      {component.foodSnapshot.foodName}
                    </span>
                    <button
                      aria-label={`Remove ${component.foodSnapshot.foodName}`}
                      onClick={() => onRemoveRecipeComponent(index)}
                      type="button"
                    >
                      <Trash2 aria-hidden="true" size={14} />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="muted recipe-build-hint">
                Search foods below and add them to this recipe.
              </p>
            )}
            {recipeDraft.components.length ? (
              <p className="muted recipe-build-total">
                Total:{' '}
                {roundMacro(
                  recipeDraft.components.reduce(
                    (total, component) =>
                      total +
                      component.foodSnapshot.caloriesPerServing *
                        component.servingMultiplier,
                    0,
                  ),
                )}{' '}
                kcal
              </p>
            ) : null}
            {recipeError ? <ValidationMessage message={recipeError} /> : null}
            <PrimaryButton
              disabled={recipeSaving}
              onClick={onSaveRecipe}
              type="button"
            >
              {recipeSaving
                ? 'Saving…'
                : `${recipeDraft.editingId ? 'Update' : 'Save'} recipe${
                    recipeDraft.components.length
                      ? ` (${recipeDraft.components.length})`
                      : ''
                  }`}
            </PrimaryButton>
          </div>
        ) : addedItems.length ? (
          <div className="added-items-tray" aria-label="Items added">
            <div className="added-items-row">
              {addedItems.map((item) => (
                <span
                  className="added-item-chip"
                  key={item.id}
                  title={item.name}
                >
                  <FoodIcon
                    name={item.iconName}
                    category={item.iconCategory}
                    size={18}
                  />
                </span>
              ))}
            </div>
            <button className="added-items-done" type="button" onClick={onBack}>
              {addedItems.length} added · Done
            </button>
          </div>
        ) : null}
      </div>

      <div className="food-search-subpage-body">
        <ProviderSearchStatus
          state={providerSearch}
          query={normalizedQuery}
          onRetry={onSearch}
        />

        {hasResults ? (
          <div className="nutrition-search-sections">
            {results.map((section) =>
              section.items.length ? (
                <section
                  aria-label={section.title}
                  className="nutrition-result-section"
                  key={section.title}
                >
                  <h3>{section.title}</h3>
                  <div className="nutrition-list">
                    {section.items.map((result) => (
                      <FoodLibraryRow
                        key={resultKey(result)}
                        result={result}
                        onEdit={
                          result.type === 'local' &&
                          result.food.sourceType !== 'provider'
                            ? () => onEditFood(result.food)
                            : null
                        }
                        onSelect={() => onSelectResult(result)}
                        onAdd={() => onAddResult(result)}
                      />
                    ))}
                  </div>
                </section>
              ) : null,
            )}
          </div>
        ) : (
          <EmptyState
            title={normalizedQuery ? 'No acceptable results' : 'Search foods'}
            message={
              normalizedQuery
                ? 'No local or provider foods with calories, protein, total carbohydrates, and fat matched.'
                : 'Search local foods and USDA provider foods by name, brand, or restaurant.'
            }
          />
        )}
      </div>
    </div>
  )
}

function NutritionActionCard({ onCreateFood }: { onCreateFood: () => void }) {
  return (
    <Card>
      <button
        className="nutrition-action-row"
        type="button"
        onClick={onCreateFood}
      >
        <span className="quick-action-icon">
          <ReceiptText aria-hidden="true" size={18} />
        </span>
        <span>
          <strong>Create custom food</strong>
          <small>Save a reusable food with calories and macros.</small>
        </span>
      </button>
    </Card>
  )
}

function ProviderSearchStatus({
  onRetry,
  query,
  state,
}: {
  onRetry: () => void
  query: string
  state: ProviderSearchState
}) {
  if (!query) {
    return null
  }
  if (state.status === 'below-threshold') {
    return (
      <p className="muted" role="status">
        Type at least 3 characters to search remote foods. Local foods still
        appear when they match.
      </p>
    )
  }
  if (state.status === 'loading') {
    return <LoadingState label="Searching food providers" />
  }
  if (state.status === 'ready') {
    return null
  }

  const message = providerStatusMessage(state.status)
  return message ? (
    <StatusMessage tone="warning">
      <div className="status-message-content">
        <span>{message}</span>
        <SecondaryButton type="button" onClick={onRetry}>
          Retry
        </SecondaryButton>
      </div>
    </StatusMessage>
  ) : null
}

function providerStatusMessage(status: ProviderSearchState['status']) {
  switch (status) {
    case 'offline':
      return 'Remote food search needs a connection. Recent, custom, and previously used foods are still available.'
    case 'missing_api_key':
      return 'API key missing. Add a USDA API key in Settings to enable remote search.'
    case 'invalid_api_key':
      return 'API key invalid. Manage the USDA key in Settings.'
    case 'provider_timeout':
      return 'Food provider search timed out. Local foods and history are still available.'
    case 'provider_unavailable':
      return 'Food providers are unavailable right now. Local foods and history are still available.'
    case 'provider_rate_limited':
      return 'Food providers are rate limited right now. Try again later.'
    case 'server_missing_configuration':
      return 'USDA search is not configured.'
    case 'api_route_misconfigured':
      return 'Food provider API routing is misconfigured on this deployment.'
    case 'normalization_failure':
      return 'Food provider results could not be normalized.'
    case 'unexpected_server_error':
      return 'Food provider search failed unexpectedly.'
    case 'invalid_request':
    case 'query_too_short':
    case 'no_acceptable_results':
    case 'idle':
    case 'below-threshold':
    case 'loading':
    case 'ready':
      return null
  }
}

function BarcodeScannerSheet({
  apiKey,
  isOpen,
  onClose,
  onCreateCustom,
  onFound,
}: {
  apiKey: string | null
  isOpen: boolean
  localDate: LocalDateString
  onClose: () => void
  onCreateCustom: (barcode: string) => void
  onFound: (result: FoodResult) => void
}) {
  const videoRef = useState<HTMLVideoElement | null>(null)
  const [video, setVideo] = videoRef
  const [status, setStatus] = useState(
    'Camera access is needed to scan a barcode.',
  )
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const processedRef = useRef(new Set<string>())

  const handleBarcode = useCallback(
    async (barcode: string) => {
      setStatus(`Looking up ${barcode}.`)
      const cached = await foodRepository.getFoodByBarcode(barcode)
      if (cached) {
        onFound({ type: 'local', food: cached.food, section: 'used' })
        return
      }
      if (!navigator.onLine) {
        onCreateCustom(barcode)
        return
      }
      try {
        const response = await lookupBarcodeProduct({
          barcode,
          apiKey: apiKey ?? '',
        })
        const food = await foodRepository.upsertProviderFood(response.result)
        await foodRepository.cacheBarcodeProduct({
          barcode,
          foodId: food.id,
          sourceProvider: response.result.source.provider,
          sourceName: response.result.source.sourceName,
        })
        onFound({
          type: 'external',
          food: { ...response.result, alternates: [] },
        })
      } catch {
        onCreateCustom(barcode)
      }
    },
    [apiKey, onCreateCustom, onFound],
  )

  // Reuse a previously granted camera permission: when the browser reports the
  // camera as already granted, start scanning immediately instead of waiting for
  // another tap on "Request camera access". The Permissions API is not available
  // everywhere (e.g. some iOS Safari versions), so any failure falls back to the
  // manual button, and getUserMedia still gates an actual prompt when needed.
  useEffect(() => {
    if (!isOpen || scanning) {
      return
    }
    const permissions = navigator.permissions
    if (!permissions?.query) {
      return
    }
    let cancelled = false
    void permissions
      .query({ name: 'camera' as PermissionName })
      .then((permissionStatus) => {
        if (!cancelled && permissionStatus.state === 'granted') {
          setStatus('Point the camera at the product barcode.')
          setScanning(true)
        }
      })
      .catch(() => {
        // Permissions API unsupported for "camera"; keep the manual button.
      })
    return () => {
      cancelled = true
    }
  }, [isOpen, scanning])

  useEffect(() => {
    if (!isOpen || !scanning || !video) {
      return
    }
    const reader = new BrowserMultiFormatReader()
    let controls: { stop: () => void } | null = null
    let stopped = false
    void reader
      .decodeFromVideoDevice(undefined, video, (result) => {
        const barcode = result?.getText()
        if (!barcode || processedRef.current.has(barcode) || stopped) {
          return
        }
        processedRef.current.add(barcode)
        stopped = true
        controls?.stop()
        void handleBarcode(barcode)
      })
      .then((nextControls) => {
        controls = nextControls
      })
      .catch((caught: unknown) => {
        setScanning(false)
        setError(
          caught instanceof Error
            ? permissionMessage(caught)
            : 'Camera scanning is not supported in this browser.',
        )
      })
    return () => {
      stopped = true
      controls?.stop()
      stopVideo(video)
    }
  }, [handleBarcode, isOpen, scanning, video])

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Scan barcode">
      <p className="muted">{status}</p>
      <div className="scanner-frame">
        <video
          ref={setVideo}
          aria-label="Barcode scanner camera preview"
          muted
          playsInline
        />
      </div>
      {error ? <ValidationMessage message={error} /> : null}
      <div className="button-row">
        <PrimaryButton
          type="button"
          onClick={() => {
            processedRef.current = new Set<string>()
            setError(null)
            setStatus('Point the camera at the product barcode.')
            setScanning(true)
          }}
        >
          Request camera access
        </PrimaryButton>
        <SecondaryButton
          type="button"
          onClick={() => {
            setScanning(false)
            if (video) {
              stopVideo(video)
            }
            onClose()
          }}
        >
          Cancel
        </SecondaryButton>
      </div>
    </Sheet>
  )
}

function QuickAddSheet({
  isOpen,
  localDate,
  onClose,
  onSaved,
}: {
  isOpen: boolean
  localDate: LocalDateString
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState(emptyQuickAddForm)
  const [mealType, setMealType] = useState<MealType>(() =>
    mealTypeForDate(new Date()),
  )
  const [error, setError] = useState<string | null>(null)
  const parsed = parseQuickAddForm(form)

  function update(field: keyof typeof emptyQuickAddForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function saveQuickAdd() {
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }

    return foodRepository
      .logQuickAddEntry({
        localDate,
        name: parsed.value.name || undefined,
        calories: parsed.value.calories,
        proteinGrams: parsed.value.proteinGrams,
        carbohydrateGrams: parsed.value.carbohydrateGrams,
        fatGrams: parsed.value.fatGrams,
        mealType,
      })
      .then(onSaved)
      .catch((caught: unknown) => {
        setError(
          caught instanceof Error
            ? caught.message
            : 'Quick add could not save.',
        )
      })
  }

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Quick add nutrition">
      <FormField id="quick-add-name" label="Name">
        <input
          id="quick-add-name"
          onChange={(event) => update('name', event.target.value)}
          placeholder="Quick add"
          value={form.name}
        />
      </FormField>
      <FormField id="quick-add-calories" label="Calories">
        <NumericInput
          id="quick-add-calories"
          onChange={(event) => update('calories', event.target.value)}
          value={form.calories}
        />
      </FormField>
      <div className="macro-row">
        <FormField id="quick-add-protein" label="Protein">
          <NumericInput
            id="quick-add-protein"
            onChange={(event) => update('proteinGrams', event.target.value)}
            value={form.proteinGrams}
          />
        </FormField>
        <FormField id="quick-add-carbs" label="Carbs">
          <NumericInput
            id="quick-add-carbs"
            onChange={(event) =>
              update('carbohydrateGrams', event.target.value)
            }
            value={form.carbohydrateGrams}
          />
        </FormField>
        <FormField id="quick-add-fat" label="Fat">
          <NumericInput
            id="quick-add-fat"
            onChange={(event) => update('fatGrams', event.target.value)}
            value={form.fatGrams}
          />
        </FormField>
      </div>
      <MealTypeField value={mealType} onChange={setMealType} />
      <p className="muted">Macros are optional. Blank macros log as 0 g.</p>
      {error ? <ValidationMessage message={error} /> : null}
      <PrimaryButton disabled={!parsed.ok} type="button" onClick={saveQuickAdd}>
        Log quick add
      </PrimaryButton>
    </Sheet>
  )
}

function permissionMessage(error: Error) {
  if (error.name === 'NotAllowedError') {
    return 'Camera permission was denied. Allow camera access in browser settings and retry.'
  }
  if (error.name === 'NotFoundError') {
    return 'No camera was found on this device.'
  }
  return 'Camera scanning is unavailable. Try again from a supported mobile browser.'
}

function stopVideo(video: HTMLVideoElement) {
  for (const track of video.srcObject instanceof MediaStream
    ? video.srcObject.getTracks()
    : []) {
    track.stop()
  }
  video.srcObject = null
}

function usdaStatusLabel(status: IntegrationConnectionStatus) {
  switch (status) {
    case 'not_configured':
      return 'Not configured'
    case 'testing':
      return 'Testing'
    case 'connected':
      return 'Connected'
    case 'invalid_key':
      return 'Invalid key'
    case 'rate_limited':
      return 'Rate limited'
    case 'network_unavailable':
      return 'Network unavailable'
    case 'service_unavailable':
      return 'Service unavailable'
  }
}

function FoodLibraryRow({
  result,
  onEdit,
  onSelect,
  onAdd,
  isFavorite,
  onToggleFavorite,
  onQuickLog,
}: {
  result: FoodSearchResult
  onEdit: (() => void) | null
  onSelect: () => void
  // When provided, the trailing "+" logs the food at its displayed serving
  // instead of opening the serving sheet (which the row banner still does).
  onAdd?: (() => void) | null
  isFavorite?: boolean
  onToggleFavorite?: (() => void) | null
  onQuickLog?: (() => void) | null
}) {
  const display = resultDisplay(result)
  const iconCategory =
    result.type === 'external' ? result.food.foodCategory : null
  const iconName =
    result.type === 'savedMeal' ? result.meal.name : result.food.name

  return (
    <div className="nutrition-item">
      <span className="quick-action-icon">
        {result.type === 'savedMeal' ? (
          <Utensils aria-hidden="true" size={18} />
        ) : (
          <FoodIcon name={iconName} category={iconCategory} size={18} />
        )}
      </span>
      <button
        aria-label={`Select ${display.name}`}
        className="nutrition-result-button"
        type="button"
        onClick={onSelect}
      >
        <span className="food-result-main">
          <strong>{display.name}</strong>
          {display.brand ? (
            <span className="brand-badge">{display.brand}</span>
          ) : null}
          <small>{display.serving}</small>
        </span>
        <span className="food-result-calories">
          {roundMacro(display.calories)} kcal
        </span>
      </button>
      <div className="row-actions">
        {onToggleFavorite ? (
          <IconButton
            aria-label={
              isFavorite
                ? `Unfavorite ${display.name}`
                : `Favorite ${display.name}`
            }
            aria-pressed={isFavorite}
            className={isFavorite ? 'is-favorite' : ''}
            onClick={onToggleFavorite}
          >
            <Star
              aria-hidden="true"
              size={18}
              fill={isFavorite ? 'currentColor' : 'none'}
            />
          </IconButton>
        ) : null}
        {onEdit ? (
          <IconButton aria-label={`Edit ${display.name}`} onClick={onEdit}>
            <Edit2 aria-hidden="true" size={18} />
          </IconButton>
        ) : null}
        {onQuickLog ? (
          <IconButton
            aria-label={`Log ${display.name} again`}
            onClick={onQuickLog}
          >
            <RotateCcw aria-hidden="true" size={18} />
          </IconButton>
        ) : null}
        <IconButton
          aria-label={onAdd ? `Add ${display.name}` : `Open ${display.name}`}
          onClick={onAdd ?? onSelect}
        >
          <Plus aria-hidden="true" size={18} />
        </IconButton>
      </div>
    </div>
  )
}

function resultDisplay(result: FoodSearchResult) {
  if (result.type === 'savedMeal') {
    return {
      name: result.meal.name,
      brand: null,
      serving: `${result.meal.components.length} ${
        result.meal.components.length === 1 ? 'item' : 'items'
      }`,
      calories: savedMealCalories(result.meal),
    }
  }

  if (result.type === 'local') {
    const split = splitBrandFromName(result.food.name, result.food.brandName)
    return {
      name: split.name,
      brand: split.brand,
      serving: formatFoodServingLabel(result.food),
      calories: result.food.caloriesPerServing,
    }
  }

  const macros = result.food.macrosPerServing ?? result.food.macrosPer100Grams
  const split = splitBrandFromName(
    result.food.name,
    result.food.brandName,
    result.food.foodCategory,
  )
  return {
    name: split.name,
    brand: split.brand,
    serving: formatFoodServingLabel(result.food),
    calories: macros?.calories ?? 0,
  }
}

// Cap the recent foods list so the section stays a short, scannable shortcut.
const RECENT_FOODS_DISPLAY_CAP = 7

function FoodShortcutCard({
  title,
  foods,
  emptyTitle,
  emptyMessage,
  onSelect,
  onQuickLog,
  onToggleFavorite,
}: {
  title: string
  foods: Food[]
  emptyTitle: string
  emptyMessage: string
  onSelect: (food: Food) => void
  onQuickLog: (food: Food) => void
  onToggleFavorite: (food: Food) => void
}) {
  const visibleFoods = foods.slice(0, RECENT_FOODS_DISPLAY_CAP)
  return (
    <Card title={title}>
      {visibleFoods.length ? (
        <div className="nutrition-list">
          {visibleFoods.map((food) => (
            <FoodLibraryRow
              key={food.id}
              result={{
                type: 'local',
                food,
                section: food.sourceType === 'provider' ? 'used' : 'recent',
              }}
              onEdit={null}
              onSelect={() => onSelect(food)}
              isFavorite={Boolean(food.isFavorite)}
              onToggleFavorite={() => onToggleFavorite(food)}
              onQuickLog={() => onQuickLog(food)}
            />
          ))}
        </div>
      ) : (
        <EmptyState title={emptyTitle} message={emptyMessage} />
      )}
    </Card>
  )
}

function savedMealCalories(meal: SavedMeal) {
  return meal.components.reduce(
    (total, component) =>
      total +
      component.foodSnapshot.caloriesPerServing * component.servingMultiplier,
    0,
  )
}

function SavedMealsCard({
  meals,
  onLog,
  onEdit,
  onDelete,
}: {
  meals: SavedMeal[]
  onLog: (meal: SavedMeal) => void
  onEdit: (meal: SavedMeal) => void
  onDelete: (meal: SavedMeal) => void
}) {
  return (
    <Card title="Saved meals">
      <div className="nutrition-list">
        {meals.map((meal) => (
          <div className="nutrition-item" key={meal.id}>
            <span className="quick-action-icon">
              <Utensils aria-hidden="true" size={18} />
            </span>
            <div>
              <strong>{meal.name}</strong>
              <small>
                {meal.components.length}{' '}
                {meal.components.length === 1 ? 'item' : 'items'} -{' '}
                {roundMacro(savedMealCalories(meal))} kcal
              </small>
            </div>
            <div className="row-actions">
              <IconButton
                aria-label={`Edit saved meal ${meal.name}`}
                onClick={() => onEdit(meal)}
              >
                <Edit2 aria-hidden="true" size={18} />
              </IconButton>
              <IconButton
                aria-label={`Delete saved meal ${meal.name}`}
                onClick={() => onDelete(meal)}
              >
                <Trash2 aria-hidden="true" size={18} />
              </IconButton>
              <IconButton
                aria-label={`Log saved meal ${meal.name}`}
                onClick={() => onLog(meal)}
              >
                <Plus aria-hidden="true" size={18} />
              </IconButton>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

function resultKey(result: FoodSearchResult) {
  if (result.type === 'savedMeal') {
    return `recipe-${result.meal.id}`
  }
  return result.type === 'local' ? `local-${result.food.id}` : result.food.id
}

function providerServingLabel(food: NormalizedFoodResult) {
  return formatFoodServingLabel(food)
}

function MealTypeField({
  value,
  onChange,
}: {
  value: MealType
  onChange: (value: MealType) => void
}) {
  return (
    <div className="form-field meal-field">
      <span className="meal-field-label">Meal</span>
      <SegmentedControl
        label="Meal"
        options={MEAL_TYPES.map((meal) => ({
          value: meal,
          label: MEAL_LABELS[meal],
        }))}
        value={value}
        onChange={(next) => onChange(next as MealType)}
      />
    </div>
  )
}

function LoggedFoodsCard({
  entries,
  onDelete,
  onEdit,
}: {
  entries: FoodLogEntry[]
  onDelete: (entry: FoodLogEntry) => void
  onEdit: (entry: FoodLogEntry) => void
}) {
  const mealGroups = groupEntriesByMeal(entries)
  return (
    <Card title="Logged foods">
      {mealGroups.length ? (
        <div className="meal-groups">
          {mealGroups.map((group) => (
            <section className="meal-group" key={group.mealType}>
              <header className="meal-group-header">
                <h3>{group.label}</h3>
                <span className="muted">
                  {roundMacro(group.calories)} kcal - P{' '}
                  {roundMacro(group.proteinGrams)} C{' '}
                  {roundMacro(group.carbohydrateGrams)} F{' '}
                  {roundMacro(group.fatGrams)}
                </span>
              </header>
              <div className="nutrition-list">
                {group.entries.map((entry) => (
                  <div className="nutrition-item" key={entry.id}>
                    <span className="quick-action-icon">
                      <Utensils aria-hidden="true" size={18} />
                    </span>
                    <div>
                      <strong>{entry.foodSnapshot.foodName}</strong>
                      <small>
                        {formatLoggedAmount(entry)} -{' '}
                        {roundMacro(entry.computedCalories)} kcal - P{' '}
                        {roundMacro(entry.computedProteinGrams)} C{' '}
                        {roundMacro(entry.computedCarbohydrateGrams)} F{' '}
                        {roundMacro(entry.computedFatGrams)}
                      </small>
                    </div>
                    <div className="row-actions">
                      <IconButton
                        aria-label={`Edit ${entry.foodSnapshot.foodName} log`}
                        onClick={() => onEdit(entry)}
                        onPointerDown={() => onEdit(entry)}
                      >
                        <Edit2 aria-hidden="true" size={18} />
                      </IconButton>
                      <IconButton
                        aria-label={`Delete ${entry.foodSnapshot.foodName} log`}
                        onClick={() => onDelete(entry)}
                      >
                        <Trash2 aria-hidden="true" size={18} />
                      </IconButton>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No foods logged"
          message="Search or create a food, then log a serving multiplier for this date."
        />
      )}
    </Card>
  )
}

function FoodFormSheet({
  food,
  initialForm,
  isOpen,
  onClose,
  onSaved,
}: {
  food: Food | null
  initialForm?: FoodFormState
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState(() =>
    food
      ? {
          name: food.name,
          brandName: food.brandName ?? '',
          servingQuantity: String(food.servingQuantity),
          servingUnit: food.servingUnit,
          caloriesPerServing: String(food.caloriesPerServing),
          proteinGramsPerServing: String(food.proteinGramsPerServing),
          carbohydrateGramsPerServing: String(food.carbohydrateGramsPerServing),
          fatGramsPerServing: String(food.fatGramsPerServing),
          notes: food.notes,
          barcode: food.barcode ?? '',
        }
      : (initialForm ?? emptyFoodForm),
  )
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const parsed = useMemo(() => parseFoodForm(form), [form])
  const fieldErrors =
    submitAttempted || error ? validateFoodFormFields(form) : {}

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function saveFood() {
    setSubmitAttempted(true)
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }

    const action = food
      ? foodRepository.updateFood(food.id, parsed.value)
      : foodRepository.createFood(parsed.value)

    return action
      .then(async (savedFood) => {
        if (parsed.value.barcode) {
          await foodRepository.cacheBarcodeProduct({
            barcode: parsed.value.barcode,
            foodId: savedFood.id,
            sourceProvider: 'custom',
            sourceName: 'Custom food',
          })
        }
        onSaved()
      })
      .catch((caught: unknown) => {
        setError(
          caught instanceof Error ? caught.message : 'Food could not save.',
        )
      })
  }

  function archiveFood() {
    if (!food) {
      return
    }

    void foodRepository.archiveFood(food.id).then(onSaved)
  }

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={food ? 'Edit food' : 'Create food'}
      variant="page"
    >
      <div className="button-row">
        <PrimaryButton type="button" onClick={saveFood}>
          Save food
        </PrimaryButton>
        {food ? (
          <SecondaryButton
            className="button-danger"
            type="button"
            onClick={archiveFood}
          >
            <Archive aria-hidden="true" size={18} />
            Archive
          </SecondaryButton>
        ) : null}
      </div>
      {error ? <ValidationMessage message={error} /> : null}
      {Object.keys(fieldErrors).length ? (
        <StatusMessage tone="warning">
          Fix the highlighted food fields and save again.
        </StatusMessage>
      ) : null}
      <FoodFormFields form={form} update={update} />
    </Sheet>
  )
}

function FoodFormFields({
  form,
  update,
}: {
  form: typeof emptyFoodForm
  update: (field: keyof typeof emptyFoodForm, value: string) => void
}) {
  return (
    <>
      <FormField
        id="food-name"
        label="Name"
        error={validateFoodFormFields(form).name}
      >
        <input
          aria-invalid={Boolean(validateFoodFormFields(form).name)}
          id="food-name"
          onChange={(event) => update('name', event.target.value)}
          value={form.name}
        />
      </FormField>
      <FormField
        id="serving-quantity"
        label="Serving amount"
        error={validateFoodFormFields(form).servingQuantity}
      >
        <NumericInput
          aria-invalid={Boolean(validateFoodFormFields(form).servingQuantity)}
          id="serving-quantity"
          onChange={(event) => update('servingQuantity', event.target.value)}
          placeholder="1"
          value={form.servingQuantity}
        />
      </FormField>
      <FormField
        id="serving-unit"
        label="Serving unit"
        helpText="Use any unit, such as bake, slice, container, oz, or g."
        error={validateFoodFormFields(form).servingUnit}
      >
        <input
          aria-invalid={Boolean(validateFoodFormFields(form).servingUnit)}
          id="serving-unit"
          onChange={(event) => update('servingUnit', event.target.value)}
          placeholder="bake"
          value={form.servingUnit}
        />
      </FormField>
      <MacroInputs form={form} update={update} />
      <FoodCalorieEquation form={form} />
    </>
  )
}

function MacroInputs({
  form,
  update,
}: {
  form: typeof emptyFoodForm
  update: (field: keyof typeof emptyFoodForm, value: string) => void
}) {
  return (
    <>
      <FormField
        id="food-calories"
        label="Calories per serving"
        error={validateFoodFormFields(form).caloriesPerServing}
      >
        <NumericInput
          aria-invalid={Boolean(
            validateFoodFormFields(form).caloriesPerServing,
          )}
          id="food-calories"
          onChange={(event) => update('caloriesPerServing', event.target.value)}
          value={form.caloriesPerServing}
        />
      </FormField>
      <FormField
        id="food-protein"
        label="Protein per serving"
        error={validateFoodFormFields(form).proteinGramsPerServing}
      >
        <NumericInput
          aria-invalid={Boolean(
            validateFoodFormFields(form).proteinGramsPerServing,
          )}
          id="food-protein"
          onChange={(event) =>
            update('proteinGramsPerServing', event.target.value)
          }
          value={form.proteinGramsPerServing}
        />
      </FormField>
      <FormField
        id="food-carbs"
        label="Carbohydrates per serving"
        error={validateFoodFormFields(form).carbohydrateGramsPerServing}
      >
        <NumericInput
          aria-invalid={Boolean(
            validateFoodFormFields(form).carbohydrateGramsPerServing,
          )}
          id="food-carbs"
          onChange={(event) =>
            update('carbohydrateGramsPerServing', event.target.value)
          }
          value={form.carbohydrateGramsPerServing}
        />
      </FormField>
      <FormField
        id="food-fat"
        label="Fat per serving"
        error={validateFoodFormFields(form).fatGramsPerServing}
      >
        <NumericInput
          aria-invalid={Boolean(
            validateFoodFormFields(form).fatGramsPerServing,
          )}
          id="food-fat"
          onChange={(event) => update('fatGramsPerServing', event.target.value)}
          value={form.fatGramsPerServing}
        />
      </FormField>
    </>
  )
}

function FoodCalorieEquation({ form }: { form: typeof emptyFoodForm }) {
  const proteinGrams = parseNonNegativeNumber(form.proteinGramsPerServing) ?? 0
  const carbohydrateGrams =
    parseNonNegativeNumber(form.carbohydrateGramsPerServing) ?? 0
  const fatGrams = parseNonNegativeNumber(form.fatGramsPerServing) ?? 0
  const calories = macroCaloriesFromGrams({
    proteinGrams,
    carbohydrateGrams,
    fatGrams,
  })
  return (
    <p className="macro-calorie-equation">
      P {proteinGrams}g x 4 + C {carbohydrateGrams}g x 4 + F {fatGrams}g x 9 ={' '}
      {calories} kcal
    </p>
  )
}

function SelectedFoodSheet({
  result,
  isOpen,
  localDate,
  onCreateCopy,
  onSelectAlternate,
  onClose,
  onSaved,
  onAddToRecipe,
}: {
  result: FoodResult
  isOpen: boolean
  localDate: LocalDateString
  onCreateCopy: (initialForm: FoodFormState) => void
  onSelectAlternate: (food: NormalizedFoodResult) => void
  onClose: () => void
  onSaved: () => void
  // When present the sheet adds the chosen food (at the chosen serving) to a
  // recipe instead of logging it to the day.
  onAddToRecipe?: (food: Food, servingMultiplier: number) => void
}) {
  // The parent gives this sheet a key of the food id, so it remounts per food
  // and these initializers run fresh — defaulting to the food's most
  // representative portion (label serving / first USDA portion).
  const foodId = result.food.id
  const defaultOptions = servingOptionsForResult(result, null)
  const [rememberedUnit, setRememberedUnit] = useState<string | null>(null)
  const [amount, setAmount] = useState(() =>
    formatAmountValue(defaultOptions[0]?.amount ?? 1),
  )
  const [unit, setUnit] = useState(() => defaultOptions[0]?.key ?? 'serving')
  // A user edit before the (fast, local) preference lookup resolves wins over
  // the remembered default.
  const editedRef = useRef(false)
  useEffect(() => {
    let isCurrent = true
    void foodRepository.getRememberedFoodUnit(foodId).then((preference) => {
      if (!isCurrent || editedRef.current || !preference) {
        return
      }
      const remembered = servingOptionsForResult(
        result,
        preference.unitKey,
      ).find((option) => option.key === preference.unitKey)
      if (remembered) {
        setRememberedUnit(preference.unitKey)
        setUnit(preference.unitKey)
        setAmount(formatAmountValue(preference.amount))
      }
    })
    return () => {
      isCurrent = false
    }
  }, [foodId, result])
  const options = servingOptionsForResult(result, rememberedUnit)
  const [error, setError] = useState<string | null>(null)
  const [mealType, setMealType] = useState<MealType>(() =>
    mealTypeForDate(new Date()),
  )
  const selectedOption =
    options.find((option) => option.key === unit) ?? options[0]
  const unitKey = selectedOption?.key ?? unit
  const parsedAmount = parsePositiveNumber(amount)
  const servingMultiplier =
    parsedAmount && selectedOption
      ? selectedOption.toServingMultiplier(parsedAmount)
      : null
  const base = baseMacrosForResult(result)
  const baseGrams = baseGramsForResult(result)
  const preview =
    servingMultiplier && base
      ? {
          calories: base.calories * servingMultiplier,
          protein: base.protein * servingMultiplier,
          carbs: base.carbs * servingMultiplier,
          fat: base.fat * servingMultiplier,
          grams: baseGrams != null ? servingMultiplier * baseGrams : null,
        }
      : null
  const quantityChips = quantityChipsForUnit(unitKey)

  function applyAmount(next: string) {
    editedRef.current = true
    setAmount(next)
  }

  function stepAmount(direction: 1 | -1) {
    const current = parsedAmount ?? selectedOption?.amount ?? 1
    const next = nextSteppedAmount(current, unitKey, direction)
    if (next != null) {
      applyAmount(formatAmountValue(next))
    }
  }

  const decrementDisabled =
    nextSteppedAmount(parsedAmount ?? 0, unitKey, -1) == null
  const display = resultDisplay(result)
  const isImported =
    result.type === 'external' ||
    (result.type === 'local' && result.food.sourceType === 'provider')

  function saveLog() {
    if (!parsedAmount || !servingMultiplier) {
      setError('Serving amount must be greater than zero.')
      return
    }

    if (onAddToRecipe) {
      // Persist a provider food locally first so the recipe can reference it by
      // id (and snapshot it), matching how logging an external food works.
      const resolveFood =
        result.type === 'external'
          ? foodRepository.upsertProviderFood(result.food)
          : Promise.resolve(result.food)
      return resolveFood
        .then((food) => {
          onAddToRecipe(food, servingMultiplier)
        })
        .catch((caught: unknown) => {
          setError(
            caught instanceof Error
              ? caught.message
              : 'Food could not be added to the recipe.',
          )
        })
    }

    const action =
      result.type === 'external'
        ? foodRepository.logExternalFood({
            food: result.food,
            localDate,
            servingMultiplier,
            mealType,
          })
        : foodRepository.logFood({
            foodId: result.food.id,
            localDate,
            servingMultiplier,
            mealType,
          })

    return action
      .then(async (entry) => {
        await foodRepository.rememberFoodUnit({
          foodId: entry.foodId ?? foodId,
          unitKey: selectedOption.key,
          amount: parsedAmount,
        })
        onSaved()
      })
      .catch((caught: unknown) => {
        setError(
          caught instanceof Error ? caught.message : 'Food could not log.',
        )
      })
  }

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={onAddToRecipe ? 'Add to recipe' : 'Food details'}
    >
      <p className="sheet-context">
        <strong>{display.name}</strong>
        <br />
        {display.brand ? <span className="muted">{display.brand}</span> : null}
        <br />
        <span className="muted">{display.serving} source serving</span>
      </p>
      <p className="metric-value metric-value-small">
        {formatCalories(base?.calories)} kcal
      </p>
      <div className="macro-row nutrition-row">
        <span>Protein {formatMacroGram(base?.protein)} g</span>
        <span>Carbs {formatMacroGram(base?.carbs)} g</span>
        <span>Fat {formatMacroGram(base?.fat)} g</span>
      </div>
      <FormField id="serving-amount" label="Serving amount">
        <div className="amount-stepper">
          <IconButton
            type="button"
            aria-label="Decrease amount"
            disabled={decrementDisabled}
            onClick={() => stepAmount(-1)}
          >
            <Minus aria-hidden="true" size={18} />
          </IconButton>
          <NumericInput
            id="serving-amount"
            autoFocus
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => applyAmount(event.target.value)}
            value={amount}
          />
          <IconButton
            type="button"
            aria-label="Increase amount"
            onClick={() => stepAmount(1)}
          >
            <Plus aria-hidden="true" size={18} />
          </IconButton>
        </div>
      </FormField>
      <div className="quantity-chips" role="group" aria-label="Quick amounts">
        {quantityChips.map((value) => {
          const isActive =
            parsedAmount != null && Math.abs(parsedAmount - value) < 0.01
          return (
            <button
              key={value}
              type="button"
              className={`quantity-chip${isActive ? ' is-active' : ''}`}
              aria-pressed={isActive}
              onClick={() => applyAmount(formatAmountValue(value))}
            >
              {formatQuantityChipLabel(value)}
            </button>
          )
        })}
      </div>
      <FormField id="serving-unit-select" label="Serving unit">
        <select
          id="serving-unit-select"
          onChange={(event) => {
            const next = options.find(
              (option) => option.key === event.target.value,
            )
            editedRef.current = true
            setUnit(event.target.value)
            if (next) {
              setAmount(formatAmountValue(next.amount))
            }
          }}
          value={unit}
        >
          {options.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </FormField>
      {onAddToRecipe ? null : (
        <MealTypeField value={mealType} onChange={setMealType} />
      )}
      {preview ? (
        <p className="muted">
          Preview: {formatCalories(preview.calories)} kcal - P{' '}
          {formatMacroGram(preview.protein)} C {formatMacroGram(preview.carbs)}{' '}
          F {formatMacroGram(preview.fat)}
          {preview.grams != null ? ` = ${formatGrams(preview.grams)}` : ''}
        </p>
      ) : null}
      {result.type === 'external' && result.food.alternates.length > 0 ? (
        <details className="more-results">
          <summary>More results ({result.food.alternates.length})</summary>
          <div className="nutrition-list">
            {result.food.alternates.map((alternate) => (
              <button
                className="alternate-result-row"
                key={alternate.id}
                type="button"
                onClick={() => onSelectAlternate(alternate)}
              >
                <strong>{alternate.name}</strong>
                <small>
                  {alternate.brandName ? `${alternate.brandName} - ` : ''}
                  {providerServingLabel(alternate)}
                </small>
              </button>
            ))}
          </div>
        </details>
      ) : null}
      {error ? <ValidationMessage message={error} /> : null}
      <div className="button-row">
        <PrimaryButton disabled={!preview} type="button" onClick={saveLog}>
          {onAddToRecipe ? 'Add to recipe' : 'Log food'}
        </PrimaryButton>
        {isImported ? (
          <SecondaryButton
            type="button"
            onClick={() =>
              onCreateCopy(
                result.type === 'external'
                  ? foodFormFromExternal(result.food, result.food.name)
                  : foodFormFromLocal(result.food),
              )
            }
          >
            <CopyPlus aria-hidden="true" size={18} />
            Custom copy
          </SecondaryButton>
        ) : null}
      </div>
    </Sheet>
  )
}

function servingOptionsForResult(
  result: FoodResult,
  rememberedUnitKey: string | null,
): FoodServingOption[] {
  if (result.type === 'local') {
    return servingOptionsForFood(result.food, rememberedUnitKey)
  }
  return servingOptionsForFood(result.food, rememberedUnitKey)
}

function baseMacrosForResult(result: FoodResult) {
  if (result.type === 'local') {
    return {
      calories: result.food.caloriesPerServing,
      protein: result.food.proteinGramsPerServing,
      carbs: result.food.carbohydrateGramsPerServing,
      fat: result.food.fatGramsPerServing,
    }
  }

  const macros = result.food.macrosPerServing ?? result.food.macrosPer100Grams
  return macros
    ? {
        calories: macros.calories,
        protein: macros.proteinGrams,
        carbs: macros.carbohydrateGrams,
        fat: macros.fatGrams,
      }
    : null
}

// Grams in one base serving, used to translate the chosen amount into a
// resulting weight. Null when the food has no reliable gram conversion.
function baseGramsForResult(result: FoodResult): number | null {
  if (result.type === 'local') {
    return result.food.gramsPerServing ?? null
  }
  return result.food.serving.gramsPerServing ?? null
}

function foodFormFromExternal(
  food: NormalizedFoodResult,
  name: string,
): FoodFormState {
  const macros = food.macrosPerServing ?? food.macrosPer100Grams
  return {
    name,
    brandName: food.brandName ?? '',
    servingQuantity: String(food.serving.quantity),
    servingUnit: food.serving.unit,
    caloriesPerServing: String(macros?.calories ?? ''),
    proteinGramsPerServing: String(macros?.proteinGrams ?? ''),
    carbohydrateGramsPerServing: String(macros?.carbohydrateGrams ?? ''),
    fatGramsPerServing: String(macros?.fatGrams ?? ''),
    notes: '',
    barcode: food.source.barcode ?? '',
  }
}

function foodFormFromLocal(food: Food): FoodFormState {
  return {
    name: food.name,
    brandName: food.brandName ?? '',
    servingQuantity: String(food.servingQuantity),
    servingUnit: food.servingUnit,
    caloriesPerServing: String(food.caloriesPerServing),
    proteinGramsPerServing: String(food.proteinGramsPerServing),
    carbohydrateGramsPerServing: String(food.carbohydrateGramsPerServing),
    fatGramsPerServing: String(food.fatGramsPerServing),
    notes: '',
    barcode: food.barcode ?? '',
  }
}

function EditFoodLogSheet({
  entry,
  isOpen,
  onClose,
  onSaved,
}: {
  entry: FoodLogEntry
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [multiplier, setMultiplier] = useState(String(entry.servingMultiplier))
  const [mealType, setMealType] = useState<MealType>(entry.mealType)
  const [error, setError] = useState<string | null>(null)
  const parsedMultiplier = parsePositiveNumber(multiplier)
  const preview = parsedMultiplier
    ? {
        calories: entry.foodSnapshot.caloriesPerServing * parsedMultiplier,
        protein: entry.foodSnapshot.proteinGramsPerServing * parsedMultiplier,
        carbs:
          entry.foodSnapshot.carbohydrateGramsPerServing * parsedMultiplier,
        fat: entry.foodSnapshot.fatGramsPerServing * parsedMultiplier,
      }
    : null

  function saveLog() {
    if (!parsedMultiplier) {
      setError('Serving multiplier must be greater than zero.')
      return
    }

    return foodRepository
      .updateFoodLogEntry(entry.id, {
        servingMultiplier: parsedMultiplier,
        mealType,
      })
      .then(onSaved)
      .catch((caught: unknown) => {
        setError(
          caught instanceof Error ? caught.message : 'Food log could not save.',
        )
      })
  }

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Edit food log">
      <p className="sheet-context">
        <strong>{entry.foodSnapshot.foodName}</strong>
        <br />
        <span className="muted">{snapshotServingLabel(entry)}</span>
      </p>
      <FormField id="edit-serving-multiplier" label="Serving multiplier">
        <NumericInput
          id="edit-serving-multiplier"
          autoFocus
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => setMultiplier(event.target.value)}
          value={multiplier}
        />
      </FormField>
      <MealTypeField value={mealType} onChange={setMealType} />
      {preview ? (
        <p className="muted">
          Preview: {roundMacro(preview.calories)} kcal - P{' '}
          {roundMacro(preview.protein)} C {roundMacro(preview.carbs)} F{' '}
          {roundMacro(preview.fat)}
        </p>
      ) : null}
      {error ? <ValidationMessage message={error} /> : null}
      <PrimaryButton disabled={!preview} type="button" onClick={saveLog}>
        Save log
      </PrimaryButton>
    </Sheet>
  )
}

const ACTIVITY_OPTIONS: { value: GoalActivityLevel; label: string }[] = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'lightly_active', label: 'Lightly active' },
  { value: 'moderately_active', label: 'Moderately active' },
  { value: 'heavily_active', label: 'Heavily active' },
]

type GoalFormState = {
  bodyweight: string
  heightFeet: string
  heightInches: string
  activityLevel: GoalActivityLevel
  goalWeight: string
  age: string
  sex: GoalSex
}

function SetGoalSubpage({
  entries,
  existingGoal,
  onBack,
  onCalculated,
}: {
  entries: BodyweightEntry[]
  existingGoal: NutritionGoal | null
  onBack: () => void
  onCalculated: () => void
}) {
  const [form, setForm] = useState<GoalFormState>(() => {
    const prefillWeight = goalCurrentWeight(entries)
    return {
      bodyweight: existingGoal
        ? String(existingGoal.calculationWeightLb)
        : prefillWeight !== null
          ? String(prefillWeight)
          : '',
      heightFeet: existingGoal
        ? String(Math.floor(existingGoal.heightInches / 12))
        : '',
      heightInches: existingGoal ? String(existingGoal.heightInches % 12) : '',
      activityLevel: existingGoal?.activityLevel ?? 'moderately_active',
      goalWeight: existingGoal ? String(existingGoal.goalWeightLb) : '',
      age: existingGoal ? String(existingGoal.ageYears) : '',
      sex: existingGoal?.sex ?? 'male',
    }
  })
  const [error, setError] = useState<string | null>(null)
  const parsed = parseGoalForm(form)

  function update<Field extends keyof GoalFormState>(
    field: Field,
    value: GoalFormState[Field],
  ) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function calculate() {
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }
    const input = parsed.value
    const plan = computeGoalPlan(input)
    const finish = estimateGoalDate({
      currentWeightLb: input.bodyweightLb,
      goalWeightLb: input.goalWeightLb,
      weeklyRateLb: plan.weeklyRateLb,
      from: new Date(),
    })
    const goal: NutritionGoalInput = {
      goalWeightLb: input.goalWeightLb,
      calculationWeightLb: input.bodyweightLb,
      heightInches: input.heightFeet * 12 + input.heightInches,
      ageYears: input.ageYears,
      sex: input.sex,
      activityLevel: input.activityLevel,
      direction: plan.direction,
      weeklyRateLb: plan.weeklyRateLb,
      maintenanceCalories: plan.maintenanceCalories,
      targets: plan.targets,
      estimatedFinishDate: finish ? formatLocalDate(finish) : null,
      formulaVersion: GOAL_FORMULA_VERSION,
      lastCalorieUpdate: null,
    }

    return (async () => {
      try {
        await settingsRepository.saveNutritionTargets(plan.targets)
        await settingsRepository.saveNutritionGoal(goal)
        onCalculated()
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : 'Goal could not be saved.',
        )
      }
    })()
  }

  return (
    <Card>
      <div className="set-goal-header">
        <IconButton aria-label="Back to targets" onClick={onBack}>
          <ArrowLeft aria-hidden="true" size={20} />
        </IconButton>
        <h2 className="set-goal-title">Set goal</h2>
      </div>
      <PrimaryButton disabled={!parsed.ok} type="button" onClick={calculate}>
        Calculate Macros
      </PrimaryButton>
      {error ? <ValidationMessage message={error} /> : null}
      <FormField id="goal-bodyweight" label="Current body weight (lb)">
        <NumericInput
          id="goal-bodyweight"
          onChange={(event) => update('bodyweight', event.target.value)}
          value={form.bodyweight}
        />
      </FormField>
      <FormField id="goal-height-feet" label="Height (feet)">
        <NumericInput
          id="goal-height-feet"
          onChange={(event) => update('heightFeet', event.target.value)}
          value={form.heightFeet}
        />
      </FormField>
      <FormField id="goal-height-inches" label="Height (inches)">
        <NumericInput
          id="goal-height-inches"
          onChange={(event) => update('heightInches', event.target.value)}
          value={form.heightInches}
        />
      </FormField>
      <FormField id="goal-activity" label="Activity level">
        <select
          className="select-input"
          id="goal-activity"
          onChange={(event) =>
            update('activityLevel', event.target.value as GoalActivityLevel)
          }
          value={form.activityLevel}
        >
          {ACTIVITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormField>
      <FormField id="goal-target-weight" label="Goal weight (lb)">
        <NumericInput
          id="goal-target-weight"
          onChange={(event) => update('goalWeight', event.target.value)}
          value={form.goalWeight}
        />
      </FormField>
      <FormField id="goal-age" label="Age">
        <NumericInput
          id="goal-age"
          onChange={(event) => update('age', event.target.value)}
          value={form.age}
        />
      </FormField>
      <FormField id="goal-sex" label="Sex">
        <select
          className="select-input"
          id="goal-sex"
          onChange={(event) => update('sex', event.target.value as GoalSex)}
          value={form.sex}
        >
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
      </FormField>
    </Card>
  )
}

function GoalProgressCard({
  entries,
  goal,
  onUpdated,
}: {
  entries: BodyweightEntry[]
  goal: NutritionGoal
  onUpdated: (label: string) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const currentWeight = goalCurrentWeight(entries) ?? goal.calculationWeightLb
  const finish = estimateGoalDate({
    currentWeightLb: currentWeight,
    goalWeightLb: goal.goalWeightLb,
    weeklyRateLb: goal.weeklyRateLb,
    from: new Date(),
  })
  const reached = Math.abs(currentWeight - goal.goalWeightLb) < 0.5
  const finishLabel = reached
    ? "You've reached your goal weight."
    : finish
      ? `Estimated finish: ${format(finish, 'MMM d, yyyy')}`
      : 'Add more weigh-ins to estimate a finish date.'

  function updateCalories() {
    setUpdating(true)
    setError(null)
    const today = formatLocalDate(new Date())
    const evaluation = evaluateCalorieUpdate({ goal, entries, asOf: today })
    const refreshedFinish = (trendWeightLb: number) =>
      estimateGoalDate({
        currentWeightLb: trendWeightLb,
        goalWeightLb: goal.goalWeightLb,
        weeklyRateLb: goal.weeklyRateLb,
        from: new Date(),
      })

    void (async () => {
      try {
        if (evaluation.status === 'insufficient_data') {
          onUpdated(
            'More body-weight data is needed before calories can be updated.',
          )
          return
        }
        if (evaluation.status === 'already_applied') {
          onUpdated('Calories are already up to date for the latest trend.')
          return
        }

        const finishDate = refreshedFinish(evaluation.trendWeightLb)
        const estimatedFinishDate = finishDate
          ? formatLocalDate(finishDate)
          : null

        if (evaluation.status === 'no_change') {
          await settingsRepository.saveNutritionGoal({
            ...goal,
            estimatedFinishDate,
            lastCalorieUpdate: {
              appliedAt: new Date().toISOString(),
              deltaKcal: 0,
              trendWeightLb: evaluation.trendWeightLb,
              observedWeeklyChangeLb: evaluation.observedWeeklyChangeLb,
              signature: evaluation.signature,
            },
          })
          onUpdated('No calorie change recommended.')
          return
        }

        await settingsRepository.saveNutritionTargets(evaluation.newTargets)
        await settingsRepository.saveNutritionGoal({
          ...goal,
          targets: evaluation.newTargets,
          estimatedFinishDate,
          lastCalorieUpdate: {
            appliedAt: new Date().toISOString(),
            deltaKcal: evaluation.deltaKcal,
            trendWeightLb: evaluation.trendWeightLb,
            observedWeeklyChangeLb: evaluation.observedWeeklyChangeLb,
            signature: evaluation.signature,
          },
        })
        onUpdated(
          evaluation.deltaKcal > 0
            ? `Calories increased by ${evaluation.deltaKcal}.`
            : `Calories decreased by ${Math.abs(evaluation.deltaKcal)}.`,
        )
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : 'Calories could not update.',
        )
      } finally {
        setUpdating(false)
      }
    })()
  }

  return (
    <Card title="Goal progress">
      <p className="goal-finish-date">{finishLabel}</p>
      {error ? <ValidationMessage message={error} /> : null}
      <SecondaryButton
        disabled={updating}
        type="button"
        onClick={updateCalories}
      >
        Update Calories
      </SecondaryButton>
    </Card>
  )
}

function TargetsCard({
  currentTargets,
  onSaved,
}: {
  currentTargets: NutritionTargetValues | null
  onSaved: () => void
}) {
  const [form, setForm] = useState(() =>
    currentTargets
      ? {
          calories: String(currentTargets.calories),
          proteinGrams: String(currentTargets.proteinGrams),
          carbohydrateGrams: String(currentTargets.carbohydrateGrams),
          fatGrams: String(currentTargets.fatGrams),
        }
      : emptyTargets,
  )
  const [error, setError] = useState<string | null>(null)
  const parsed = parseTargetForm(form)
  const macroCalories = calculateMacroCalories(form)

  function update(field: keyof typeof emptyTargets, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function saveTargets() {
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }

    return settingsRepository
      .saveNutritionTargets(parsed.value)
      .then(onSaved)
      .catch((caught: unknown) => {
        setError(
          caught instanceof Error ? caught.message : 'Targets could not save.',
        )
      })
  }

  return (
    <Card title="Nutrition targets">
      <FormField id="target-calories" label="Calories">
        <NumericInput
          id="target-calories"
          onChange={(event) => update('calories', event.target.value)}
          value={form.calories}
        />
      </FormField>
      <FormField id="target-protein" label="Protein target">
        <NumericInput
          id="target-protein"
          onChange={(event) => update('proteinGrams', event.target.value)}
          value={form.proteinGrams}
        />
      </FormField>
      <FormField id="target-carbs" label="Carbohydrate target">
        <NumericInput
          id="target-carbs"
          onChange={(event) => update('carbohydrateGrams', event.target.value)}
          value={form.carbohydrateGrams}
        />
      </FormField>
      <FormField id="target-fat" label="Fat target">
        <NumericInput
          id="target-fat"
          onChange={(event) => update('fatGrams', event.target.value)}
          value={form.fatGrams}
        />
      </FormField>
      <p className="macro-calorie-equation macro-calorie-equation--targets">
        P {macroCalories.proteinGrams}g x 4 + C{' '}
        {macroCalories.carbohydrateGrams}g x 4 + F {macroCalories.fatGrams}g x 9
        = {macroCalories.calories} kcal
      </p>
      {error ? <ValidationMessage message={error} /> : null}
      <PrimaryButton disabled={!parsed.ok} type="button" onClick={saveTargets}>
        Save targets
      </PrimaryButton>
    </Card>
  )
}

function Sheet({
  children,
  isOpen,
  onClose,
  title,
  variant = 'sheet',
}: {
  children: React.ReactNode
  isOpen: boolean
  onClose: () => void
  title: string
  variant?: 'sheet' | 'page'
}) {
  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      variant={variant}
    >
      {children}
    </BottomSheet>
  )
}

function parseFoodForm(
  form: typeof emptyFoodForm,
): { ok: true; value: CreateFoodInput } | { ok: false; error: string } {
  const name = form.name.trim()
  const servingQuantity = parsePositiveNumber(form.servingQuantity)
  const caloriesPerServing = parseNonNegativeNumber(form.caloriesPerServing)
  const proteinGramsPerServing = parseOptionalMacro(form.proteinGramsPerServing)
  const carbohydrateGramsPerServing = parseOptionalMacro(
    form.carbohydrateGramsPerServing,
  )
  const fatGramsPerServing = parseOptionalMacro(form.fatGramsPerServing)

  if (!name) {
    return { ok: false, error: 'Food name is required.' }
  }

  if (!servingQuantity) {
    return { ok: false, error: 'Serving quantity must be greater than zero.' }
  }

  if (!form.servingUnit.trim()) {
    return { ok: false, error: 'Serving unit is required.' }
  }

  if (caloriesPerServing === null) {
    return { ok: false, error: 'Calories must be zero or greater.' }
  }

  if (
    proteinGramsPerServing === null ||
    carbohydrateGramsPerServing === null ||
    fatGramsPerServing === null
  ) {
    return {
      ok: false,
      error: 'Optional macros must be blank or zero or greater.',
    }
  }

  return {
    ok: true,
    value: {
      name,
      brandName: null,
      servingQuantity,
      servingUnit: form.servingUnit.trim(),
      servingDescription: '',
      caloriesPerServing,
      proteinGramsPerServing,
      carbohydrateGramsPerServing,
      fatGramsPerServing,
      notes: '',
      barcode: form.barcode.trim() || null,
      barcodeSource: form.barcode.trim() ? 'custom' : null,
    },
  }
}

function parseQuickAddForm(form: typeof emptyQuickAddForm):
  | {
      ok: true
      value: {
        calories: number
        carbohydrateGrams: number
        fatGrams: number
        name: string
        proteinGrams: number
      }
    }
  | { ok: false; error: string } {
  const calories = parseNonNegativeNumber(form.calories)
  const proteinGrams = parseOptionalMacro(form.proteinGrams)
  const carbohydrateGrams = parseOptionalMacro(form.carbohydrateGrams)
  const fatGrams = parseOptionalMacro(form.fatGrams)

  if (calories === null) {
    return {
      ok: false,
      error: 'Calories are required and must be zero or greater.',
    }
  }
  if (
    proteinGrams === null ||
    carbohydrateGrams === null ||
    fatGrams === null
  ) {
    return {
      ok: false,
      error: 'Macros must be blank or zero or greater.',
    }
  }

  return {
    ok: true,
    value: {
      name: form.name.trim(),
      calories,
      proteinGrams,
      carbohydrateGrams,
      fatGrams,
    },
  }
}

function validateFoodFormFields(form: typeof emptyFoodForm) {
  const errors: Partial<Record<keyof typeof emptyFoodForm, string>> = {}
  if (!form.name.trim()) {
    errors.name = 'Food name is required.'
  }
  if (!parsePositiveNumber(form.servingQuantity)) {
    errors.servingQuantity = 'Serving amount must be greater than zero.'
  }
  if (!form.servingUnit.trim()) {
    errors.servingUnit = 'Serving unit is required.'
  }
  if (parseNonNegativeNumber(form.caloriesPerServing) === null) {
    errors.caloriesPerServing =
      'Calories are required and must be zero or greater.'
  }
  if (parseOptionalMacro(form.proteinGramsPerServing) === null) {
    errors.proteinGramsPerServing = 'Protein must be blank or zero or greater.'
  }
  if (parseOptionalMacro(form.carbohydrateGramsPerServing) === null) {
    errors.carbohydrateGramsPerServing =
      'Carbohydrates must be blank or zero or greater.'
  }
  if (parseOptionalMacro(form.fatGramsPerServing) === null) {
    errors.fatGramsPerServing = 'Fat must be blank or zero or greater.'
  }
  return errors
}

function parseTargetForm(
  form: typeof emptyTargets,
): { ok: true; value: NutritionTargetValues } | { ok: false; error: string } {
  const calories = parseNonNegativeNumber(form.calories)
  const proteinGrams = parseNonNegativeNumber(form.proteinGrams)
  const carbohydrateGrams = parseNonNegativeNumber(form.carbohydrateGrams)
  const fatGrams = parseNonNegativeNumber(form.fatGrams)

  if (
    calories === null ||
    proteinGrams === null ||
    carbohydrateGrams === null ||
    fatGrams === null
  ) {
    return { ok: false, error: 'Targets must be zero or greater.' }
  }

  return {
    ok: true,
    value: { calories, proteinGrams, carbohydrateGrams, fatGrams },
  }
}

function goalCurrentWeight(entries: BodyweightEntry[]): number | null {
  const trend = currentTrendWeight(entries)
  if (trend !== null) {
    return trend
  }
  const latest = latestBodyweight(entries)
  return latest ? latest.weight : null
}

function parseGoalForm(
  form: GoalFormState,
): { ok: true; value: GoalPlanInput } | { ok: false; error: string } {
  const bodyweightLb = parsePositiveNumber(form.bodyweight)
  const heightFeet = parseNonNegativeNumber(form.heightFeet)
  const heightInches = parseNonNegativeNumber(form.heightInches)
  const goalWeightLb = parsePositiveNumber(form.goalWeight)
  const ageYears = parsePositiveNumber(form.age)

  if (bodyweightLb === null || bodyweightLb > 1500) {
    return { ok: false, error: 'Enter a realistic current body weight.' }
  }
  if (heightFeet === null || heightInches === null) {
    return { ok: false, error: 'Enter your height in feet and inches.' }
  }
  if (heightInches >= 12) {
    return { ok: false, error: 'Height inches must be between 0 and 11.' }
  }
  const totalInches = heightFeet * 12 + heightInches
  if (totalInches <= 0 || totalInches > 96) {
    return { ok: false, error: 'Enter a realistic height.' }
  }
  if (ageYears === null || ageYears < 13 || ageYears > 120) {
    return { ok: false, error: 'Enter an age between 13 and 120.' }
  }
  if (goalWeightLb === null || goalWeightLb > 1500) {
    return { ok: false, error: 'Enter a realistic goal weight.' }
  }

  return {
    ok: true,
    value: {
      sex: form.sex,
      bodyweightLb,
      heightFeet,
      heightInches,
      ageYears,
      activityLevel: form.activityLevel,
      goalWeightLb,
    },
  }
}

function calculateMacroCalories(form: typeof emptyTargets) {
  const proteinGrams = parseNonNegativeNumber(form.proteinGrams) ?? 0
  const carbohydrateGrams = parseNonNegativeNumber(form.carbohydrateGrams) ?? 0
  const fatGrams = parseNonNegativeNumber(form.fatGrams) ?? 0
  return {
    calories: macroCaloriesFromGrams({
      proteinGrams,
      carbohydrateGrams,
      fatGrams,
    }),
    carbohydrateGrams,
    fatGrams,
    proteinGrams,
  }
}

function macroCaloriesFromGrams(input: {
  proteinGrams: number
  carbohydrateGrams: number
  fatGrams: number
}) {
  return Math.round(
    input.proteinGrams * 4 + input.carbohydrateGrams * 4 + input.fatGrams * 9,
  )
}

function parsePositiveNumber(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function parseNonNegativeNumber(value: string) {
  if (!value.trim()) {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function parseOptionalMacro(value: string) {
  return value.trim() ? parseNonNegativeNumber(value) : 0
}

function roundMacro(value: number | undefined) {
  return Math.round((value ?? 0) * 10) / 10
}

function snapshotServingLabel(entry: FoodLogEntry) {
  return `${roundMacro(entry.foodSnapshot.servingQuantity)} ${
    entry.foodSnapshot.servingUnit || entry.foodSnapshot.servingDescription
  }`
}

// The actual logged portion in the food's own unit (multiplier applied), so the
// list reads "1.25 cup, cooked" instead of an ugly raw "1.744…x" multiplier.
// Rounded to 2 decimals so quarter/third servings (¼, ⅓, ¾) stay faithful.
function formatLoggedAmount(entry: FoodLogEntry) {
  const snapshot = entry.foodSnapshot
  const amount =
    Math.round(entry.servingMultiplier * snapshot.servingQuantity * 100) / 100
  const unit = snapshot.servingUnit || snapshot.servingDescription
  return unit ? `${amount} ${unit}` : `${amount}`
}

function targetKey(targets: NutritionTargetValues | null) {
  return targets
    ? `${targets.calories}-${targets.proteinGrams}-${targets.carbohydrateGrams}-${targets.fatGrams}`
    : 'loading-targets'
}
