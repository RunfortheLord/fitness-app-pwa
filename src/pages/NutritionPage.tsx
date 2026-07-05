import { Plus } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import {
  Card,
  DateSelector,
  IconButton,
  LoadingState,
  ModalConfirmationDialog,
  PageContainer,
  PrimaryButton,
  SectionHeader,
  SegmentedControl,
  StatusMessage,
  Toast,
} from '@components/ui'
import { useLanguage } from '@components/languageContextValue'
import { useSubpageBackGesture } from '@hooks/useSubpageBackGesture'
import {
  addLocalDays,
  formatLocalDate,
  formatSelectedDateLabel,
} from '@domain/dates'
import { normalizeProviderQuery } from '@domain/foodProviderModels'
import {
  createSearchSections,
  type FoodResult,
  type FoodSearchResult,
} from '@domain/foodSearchSections'
import { mealTypeForDate } from '@domain/meals'
import { snapshotFood } from '@domain/snapshots'
import {
  createRecipeDraftFromGemini,
  type GeminiMealAnalysis,
} from '@domain/geminiMealAnalysis'
import { servingOptionsForFood } from '@domain/foodServings'
import { BarcodeScannerSheet } from '@features/nutrition/BarcodeScannerSheet'
import { EditFoodLogSheet } from '@features/nutrition/EditFoodLogSheet'
import { FoodFormSheet } from '@features/nutrition/FoodFormSheet'
import { FoodSearchSubpage } from '@features/nutrition/FoodSearchSubpage'
import { GoalProgressCard } from '@features/nutrition/GoalProgressCard'
import { QuickAddSheet } from '@features/nutrition/QuickAddSheet'
import { RecipeIngredientSheet } from '@features/nutrition/RecipeIngredientSheet'
import { SelectedFoodSheet } from '@features/nutrition/SelectedFoodSheet'
import { SetGoalSubpage } from '@features/nutrition/SetGoalSubpage'
import { TargetsCard } from '@features/nutrition/TargetsCard'
import {
  resultDisplay,
  servingOptionsForResult,
  servingSelectionForFood,
} from '@features/nutrition/foodDisplay'
import {
  DailyTotalsCard,
  FoodSearchTrigger,
  FoodShortcutCard,
  LoggedFoodsCard,
  NutritionActionCard,
  SavedMealsCard,
} from '@features/nutrition/nutritionCards'
import {
  emptyFoodForm,
  targetKey,
  type FoodFormState,
} from '@features/nutrition/nutritionForms'
import type {
  AddedItem,
  ProviderSearchState,
  RecipeDraft,
} from '@features/nutrition/types'
import { useDashboardContext } from '@hooks/useDashboardContext'
import { foodRepository } from '@repositories/foodRepository'
import { bodyweightRepository } from '@repositories/bodyweightRepository'
import { settingsRepository } from '@repositories/settingsRepository'
import {
  FoodProviderClientError,
  searchProviderFoods,
} from '@services/foodProviderClient'
import {
  nutritionSummaryService,
  type DailyNutritionSummary,
} from '@services/nutritionSummaryService'
import { AiMealCameraSubpage } from '@pages/AiMealCameraSubpage'
import type {
  BodyweightEntry,
  Food,
  FoodLogEntry,
  FoodUnitPreference,
  IntegrationConnectionStatus,
  NutritionGoal,
  SavedMeal,
} from '@shared-types/app'

type NutritionMode = 'day' | 'foods' | 'targets'

type SheetState =
  | { type: 'food'; food: Food | null; initialForm?: FoodFormState }
  | { type: 'select'; result: FoodResult }
  | { type: 'recipeComponent'; index: number }
  | { type: 'entry'; entry: FoodLogEntry }
  | { type: 'quickAdd' }
  | { type: 'scanner' }
  | null

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
  foodUnitPreferences: Record<string, FoodUnitPreference>
  savedMeals: SavedMeal[]
  summary: DailyNutritionSummary | null
  status: 'loading' | 'ready' | 'error'
}

function isNutritionMode(value: string | null): value is NutritionMode {
  return value === 'day' || value === 'foods' || value === 'targets'
}

export function NutritionPage() {
  const { language, t } = useLanguage()
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
  const [submittedProviderQuery, setSubmittedProviderQuery] = useState('')
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
    foodUnitPreferences: {},
    savedMeals: [],
    summary: null,
    status: 'loading',
  })
  const [savedMealToDelete, setSavedMealToDelete] = useState<SavedMeal | null>(
    null,
  )
  const [revision, setRevision] = useState(0)
  const [libraryRevision, setLibraryRevision] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [targetsView, setTargetsView] = useState<'main' | 'setGoal'>('main')
  const [searchOpen, setSearchOpen] = useState(false)
  const [addedItems, setAddedItems] = useState<AddedItem[]>([])
  const addedItemIdRef = useRef(0)
  const [recipeDraft, setRecipeDraft] = useState<RecipeDraft | null>(null)
  const [recipeError, setRecipeError] = useState<string | null>(null)
  const [recipeSaving, setRecipeSaving] = useState(false)
  const [saveAiRecipe, setSaveAiRecipe] = useState(false)
  const [aiCameraOpen, setAiCameraOpen] = useState(false)
  const [aiCameraReturnToSearch, setAiCameraReturnToSearch] = useState(false)
  const [geminiApiKey, setGeminiApiKey] = useState<string | null>(null)
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
  const closeAiCamera = useCallback(() => {
    setAiCameraOpen(false)
    if (aiCameraReturnToSearch) {
      setSearchOpen(true)
    }
  }, [aiCameraReturnToSearch])

  useSubpageBackGesture(aiCameraOpen, closeAiCamera)

  const openSearch = useCallback(() => {
    setQuery('')
    setSubmittedProviderQuery('')
    setAddedItems([])
    setRecipeDraft(null)
    setSearchOpen(true)
  }, [])

  // Start a new recipe in the shared search subpage. Same search experience as
  // logging food, but selections go into the recipe (see SelectedFoodSheet's
  // recipe mode) rather than the day's log.
  const startRecipe = useCallback(() => {
    setQuery('')
    setSubmittedProviderQuery('')
    setAddedItems([])
    setRecipeError(null)
    setRecipeDraft({
      editingId: null,
      name: '',
      notes: '',
      components: [],
      source: 'manual',
    })
    setSearchOpen(true)
  }, [])

  // Edit an existing saved recipe in the same subpage, prefilled with its name
  // and components.
  const startEditRecipe = useCallback((meal: SavedMeal) => {
    setQuery('')
    setSubmittedProviderQuery('')
    setAddedItems([])
    setRecipeError(null)
    setRecipeDraft({
      editingId: meal.id,
      name: meal.name,
      notes: meal.notes,
      components: meal.components.map((component) => ({
        foodId: component.foodId,
        foodSnapshot: component.foodSnapshot,
        servingMultiplier: component.servingMultiplier,
      })),
      source: 'manual',
    })
    setSearchOpen(true)
  }, [])

  const closeSearch = useCallback(() => {
    setSearchOpen(false)
    setRecipeDraft(null)
    setRecipeError(null)
    // Food logging intentionally keeps the open result set stable. Refresh the
    // recent-food ranking only after the user leaves the search flow.
    setLibraryRevision((value) => value + 1)
  }, [])

  const openAiCamera = useCallback(() => {
    setAiCameraReturnToSearch(searchOpen)
    setSearchOpen(false)
    setRecipeError(null)
    setAiCameraOpen(true)
  }, [searchOpen])

  const useGeminiRecipeDraft = useCallback((analysis: GeminiMealAnalysis) => {
    const generated = createRecipeDraftFromGemini(analysis)
    setRecipeDraft({
      editingId: null,
      name: generated.name,
      notes: generated.notes,
      components: generated.components,
      source: 'gemini',
    })
    setRecipeError(null)
    setSaveAiRecipe(false)
    setAiCameraOpen(false)
    setSearchOpen(true)
  }, [])

  // The food search is a focused full-screen mode. Hide the bottom nav while it
  // is open so the keyboard never floats it up over the results (iOS Safari).
  useEffect(() => {
    document.body.classList.toggle(
      'food-search-open',
      searchOpen || aiCameraOpen,
    )
    return () => {
      document.body.classList.remove('food-search-open')
    }
  }, [aiCameraOpen, searchOpen])

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

  const updateRecipeComponent = useCallback(
    (index: number, servingMultiplier: number) => {
      setRecipeDraft((current) =>
        current
          ? {
              ...current,
              components: current.components.map((component, componentIndex) =>
                componentIndex === index
                  ? { ...component, servingMultiplier }
                  : component,
              ),
            }
          : current,
      )
    },
    [],
  )

  const appendAddedItem = useCallback(
    (result: FoodResult, entry: FoodLogEntry) => {
      const display = resultDisplay(result)
      const iconCategory =
        result.type === 'external' ? result.food.foodCategory : null
      setAddedItems((current) => [
        ...current,
        {
          id: ++addedItemIdRef.current,
          entryId: entry.id,
          name: display.name,
          iconName: result.food.name,
          iconCategory,
        },
      ])
    },
    [],
  )

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
    const tab = searchParams.get('tab')
    if (!isNutritionMode(tab)) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setMode(tab)
      const next = new URLSearchParams(searchParams)
      next.delete('tab')
      setSearchParams(next, { replace: true })
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [searchParams, setSearchParams])

  useEffect(() => {
    let isCurrent = true

    void Promise.all([
      foodRepository.listFoodLogsByDate(selectedDate),
      nutritionSummaryService.getDailySummary(selectedDate),
    ])
      .then(([logs, summary]) => {
        if (!isCurrent) {
          return
        }

        setLoadState((current) => ({
          ...current,
          logs,
          summary,
          status: 'ready',
        }))
      })
      .catch(() => {
        if (!isCurrent) {
          return
        }

        setLoadState((current) => ({ ...current, status: 'error' }))
      })

    return () => {
      isCurrent = false
    }
  }, [revision, selectedDate])

  useEffect(() => {
    let isCurrent = true

    void foodRepository
      .searchFoods(query)
      .then((foods) => {
        if (isCurrent) {
          setLoadState((current) => ({ ...current, foods }))
        }
      })
      .catch(() => {
        if (isCurrent) {
          setLoadState((current) => ({ ...current, status: 'error' }))
        }
      })

    return () => {
      isCurrent = false
    }
  }, [libraryRevision, query])

  useEffect(() => {
    let isCurrent = true

    void Promise.all([
      foodRepository.listRecentFoods(50),
      foodRepository.listFavoriteFoods(),
      foodRepository.listSavedMeals(),
      foodRepository.listRememberedFoodUnits(),
    ])
      .then(([recentFoods, favoriteFoods, savedMeals, foodUnitPreferences]) => {
        if (!isCurrent) {
          return
        }
        setLoadState((current) => ({
          ...current,
          recentFoods,
          favoriteFoods,
          foodUnitPreferences: Object.fromEntries(
            foodUnitPreferences.map((preference) => [
              preference.foodId,
              preference,
            ]),
          ),
          savedMeals,
        }))
      })
      .catch(() => {
        if (isCurrent) {
          setLoadState((current) => ({ ...current, status: 'error' }))
        }
      })

    return () => {
      isCurrent = false
    }
  }, [libraryRevision])

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
    void settingsRepository.getGeminiApiKeySettings().then((settings) => {
      if (isCurrent) {
        setGeminiApiKey(settings?.apiKey ?? null)
      }
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

  const remoteProviderQuery = language === 'es' ? submittedProviderQuery : query

  useEffect(() => {
    const normalizedQuery = normalizeProviderQuery(remoteProviderQuery)
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
        provider: language === 'es' ? 'open_food_facts' : 'usda',
        allowFallback: false,
        language,
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
  }, [language, providerSearchNonce, remoteProviderQuery, usdaKey])

  const daySearchResults = createSearchSections({
    localFoods: loadState.foods,
    includeRecentFoods: true,
    providerResults: providerSearch.results,
    query,
    recentFoods: loadState.recentFoods,
    savedMeals: loadState.savedMeals,
  })
  const summary = loadState.summary
  const reload = (options: { refreshLibrary?: boolean } = {}) => {
    setRevision((value) => value + 1)
    if (options.refreshLibrary) {
      setLibraryRevision((value) => value + 1)
    }
    refreshDashboard()
  }

  const reloadAfterFoodLog = () => {
    reload({ refreshLibrary: !searchOpen })
  }

  const toggleFavorite = (food: Food) => {
    void foodRepository.setFoodFavorite(food.id, !food.isFavorite).then(() => {
      setMessage(food.isFavorite ? 'Removed favorite.' : 'Added favorite.')
      reload({ refreshLibrary: true })
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
        reloadAfterFoodLog()
      })
      .catch(() => setMessage('Could not log that food.'))
  }

  // Trailing "+" on a search row: log the food immediately at its displayed
  // serving, including a remembered unit+amount when present. Tapping the row
  // banner still opens the sheet for adjusting serving size.
  const quickAddResult = (result: FoodSearchResult) => {
    if (result.type === 'savedMeal') {
      logSavedMeal(result.meal)
      return
    }
    const preference =
      result.type === 'local'
        ? loadState.foodUnitPreferences[result.food.id]
        : undefined
    const rememberedSelection =
      result.type === 'local' && preference
        ? servingSelectionForFood(result.food, preference)
        : null
    const option = servingOptionsForResult(result, null)[0]
    const defaultAmount = option?.amount ?? 1
    const defaultMultiplier = option?.toServingMultiplier(defaultAmount) ?? 1
    const servingMultiplier =
      rememberedSelection?.servingMultiplier ??
      (defaultMultiplier > 0 ? defaultMultiplier : 1)
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
      .then((entry) => {
        // Mirror the sheet's behaviour: keep the search subpage open and record
        // the item in the "added" tray so several foods can be added in a pass.
        if (searchOpen) {
          appendAddedItem(result, entry)
        }
        setMessage('Food logged.')
        reloadAfterFoodLog()
      })
      .catch(() => setMessage('Could not log that food.'))
  }

  const logSavedMeal = (meal: SavedMeal) => {
    void foodRepository
      .logSavedMeal({ savedMealId: meal.id, localDate: selectedDate })
      .then((entries) => {
        setMessage(`Logged ${meal.name} (${entries.length} items).`)
        reloadAfterFoodLog()
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
          notes: recipeDraft.notes,
          components,
        })
      : foodRepository.createSavedMeal({
          name: recipeDraft.name.trim(),
          notes: recipeDraft.notes,
          components,
        })
    void action
      .then(() => {
        setRecipeSaving(false)
        setSearchOpen(false)
        setRecipeDraft(null)
        setRecipeError(null)
        setMessage(editingId ? 'Recipe updated.' : 'Recipe saved.')
        reload({ refreshLibrary: true })
      })
      .catch((caught: unknown) => {
        setRecipeSaving(false)
        setRecipeError(
          caught instanceof Error ? caught.message : 'Recipe could not save.',
        )
      })
  }

  const logAiRecipe = () => {
    if (!recipeDraft || recipeDraft.source !== 'gemini') {
      return
    }
    if (saveAiRecipe && !recipeDraft.name.trim()) {
      setRecipeError('Give the recipe a name or turn off Save as recipe.')
      return
    }
    if (recipeDraft.components.length === 0) {
      setRecipeError('Add at least one food to the recipe.')
      return
    }
    const shouldSaveRecipe = saveAiRecipe
    setRecipeSaving(true)
    void foodRepository
      .logMealDraft({
        name: recipeDraft.name,
        components: recipeDraft.components,
        localDate: selectedDate,
        notes: recipeDraft.notes,
        saveAsRecipe: shouldSaveRecipe,
      })
      .then(({ entries }) => {
        setRecipeSaving(false)
        setSearchOpen(false)
        setRecipeDraft(null)
        setRecipeError(null)
        setSaveAiRecipe(false)
        setMessage(
          shouldSaveRecipe
            ? `Logged ${entries.length} ingredients and saved the recipe.`
            : `Logged ${entries.length} ingredients.`,
        )
        reload({ refreshLibrary: shouldSaveRecipe })
      })
      .catch((caught: unknown) => {
        setRecipeSaving(false)
        setRecipeError(
          caught instanceof Error
            ? caught.message
            : 'Food could not be logged.',
        )
      })
  }

  return (
    <PageContainer>
      <Toast message={message} onDismiss={() => setMessage(null)} />
      {aiCameraOpen ? (
        <AiMealCameraSubpage
          apiKey={geminiApiKey}
          onAnalyzed={useGeminiRecipeDraft}
          onBack={closeAiCamera}
        />
      ) : searchOpen ? (
        <FoodSearchSubpage
          providerSearch={providerSearch}
          results={daySearchResults}
          foodUnitPreferences={loadState.foodUnitPreferences}
          addedItems={addedItems}
          recipeDraft={recipeDraft}
          recipeError={recipeError}
          recipeSaving={recipeSaving}
          saveAiRecipe={saveAiRecipe}
          onRecipeNameChange={(name) =>
            setRecipeDraft((current) =>
              current ? { ...current, name } : current,
            )
          }
          onRemoveRecipeComponent={removeRecipeComponent}
          onOpenRecipeComponent={(index) =>
            setSheet({ type: 'recipeComponent', index })
          }
          onLogAiRecipe={logAiRecipe}
          onSaveRecipe={saveRecipe}
          onToggleSaveAiRecipe={() => setSaveAiRecipe((current) => !current)}
          onBack={closeSearch}
          onEditFood={(food) => setSheet({ type: 'food', food })}
          onOpenRecipe={startRecipe}
          onOpenAddedItem={(entryId) => {
            void foodRepository
              .getFoodLogEntry(entryId)
              .then((entry) => {
                if (entry) {
                  setSheet({ type: 'entry', entry })
                }
              })
              .catch(() => setMessage('Could not open that food log.'))
          }}
          onOpenQuickAdd={() => setSheet({ type: 'quickAdd' })}
          onOpenAiCamera={openAiCamera}
          onOpenScanner={() => setSheet({ type: 'scanner' })}
          onSelectResult={(result) => {
            if (result.type === 'savedMeal') {
              logSavedMeal(result.meal)
              return
            }
            setSheet({ type: 'select', result })
          }}
          onAddResult={quickAddResult}
          onSearch={() => {
            if (language === 'es') {
              setSubmittedProviderQuery(normalizeProviderQuery(query))
            }
            setProviderSearchNonce((current) => current + 1)
          }}
          query={query}
          setQuery={setQuery}
        />
      ) : (
        <>
          <DateSelector
            dateLabel={formatSelectedDateLabel(selectedDate, language)}
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
                onOpenAiCamera={openAiCamera}
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
                onOpenAiCamera={openAiCamera}
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
                  foodUnitPreferences={loadState.foodUnitPreferences}
                  emptyTitle="No favorites"
                  emptyMessage="Star a food to pin it here for one-tap logging."
                  onSelect={(food) =>
                    setSheet({
                      type: 'select',
                      result: { type: 'local', food, section: 'recent' },
                    })
                  }
                  onAdd={(food) =>
                    quickAddResult({ type: 'local', food, section: 'recent' })
                  }
                  onQuickLog={quickLog}
                  onToggleFavorite={toggleFavorite}
                />
              ) : null}
              <FoodShortcutCard
                title="Recent foods"
                foods={loadState.recentFoods}
                foodUnitPreferences={loadState.foodUnitPreferences}
                emptyTitle="No recent foods"
                emptyMessage="Logged reusable foods appear here for repeat entries."
                onSelect={(food) =>
                  setSheet({
                    type: 'select',
                    result: { type: 'local', food, section: 'recent' },
                  })
                }
                onAdd={(food) =>
                  quickAddResult({ type: 'local', food, section: 'recent' })
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
                <Card className="custom-goal-card" title="Custom goal">
                  <p className="muted">
                    {t(
                      'Build calorie and macro targets from your bodyweight, height, activity, and goal weight.',
                    )}
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
            reload({ refreshLibrary: true })
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
          onSaved={(entry, preference) => {
            // Logging from the search subpage keeps the subpage open so several
            // foods can be added in one pass; record the item in the tray.
            if (searchOpen && sheet.type === 'select') {
              appendAddedItem(sheet.result, entry)
            }
            setLoadState((current) => ({
              ...current,
              foodUnitPreferences: {
                ...current.foodUnitPreferences,
                [preference.foodId]: preference,
              },
            }))
            setMessage('Food logged.')
            setSheet(null)
            reloadAfterFoodLog()
          }}
        />
      ) : null}

      {sheet?.type === 'recipeComponent' &&
      recipeDraft?.components[sheet.index] ? (
        <RecipeIngredientSheet
          component={recipeDraft.components[sheet.index]}
          isOpen
          onClose={() => setSheet(null)}
          onSaved={(servingMultiplier) => {
            updateRecipeComponent(sheet.index, servingMultiplier)
            setSheet(null)
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
              reload({ refreshLibrary: true })
            })
        }}
        title="Delete saved meal?"
      >
        <p>
          {t('The saved meal will be removed. Entries already logged stay.')}{' '}
          &ldquo;{savedMealToDelete?.name ?? ''}&rdquo;
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
        <p>
          {t('This removes the logged food from {date}.', {
            date: selectedDate,
          })}
        </p>
      </ModalConfirmationDialog>
    </PageContainer>
  )
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
