import {
  Archive,
  CopyPlus,
  Edit2,
  Plus,
  Search,
  Trash2,
  Utensils,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

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
  ValidationMessage,
} from '@components/ui'
import {
  addLocalDays,
  formatLocalDate,
  formatSelectedDateLabel,
  type LocalDateString,
} from '@domain/dates'
import {
  normalizeProviderQuery,
  type GroupedFoodResult,
  type NormalizedFoodResult,
} from '@domain/foodProviderModels'
import { useDashboardContext } from '@hooks/useDashboardContext'
import {
  foodRepository,
  type CreateFoodInput,
} from '@repositories/foodRepository'
import { settingsRepository } from '@repositories/settingsRepository'
import {
  FoodProviderClientError,
  searchProviderFoods,
  type FoodProviderClientErrorCode,
} from '@services/foodProviderClient'
import {
  nutritionSummaryService,
  type DailyNutritionSummary,
} from '@services/nutritionSummaryService'
import type {
  Food,
  FoodLogEntry,
  NutritionTargetValues,
} from '@shared-types/app'

type NutritionMode = 'day' | 'foods' | 'targets'
type SheetState =
  | { type: 'food'; food: Food | null; initialForm?: FoodFormState }
  | { type: 'select'; result: FoodSearchResult }
  | { type: 'entry'; entry: FoodLogEntry }
  | null

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
}

type FoodSearchResult =
  | { type: 'local'; food: Food; section: 'recent' | 'custom' | 'used' }
  | { type: 'external'; food: GroupedFoodResult }

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

type LoadState = {
  foods: Food[]
  logs: FoodLogEntry[]
  recentFoods: Food[]
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
}

const emptyTargets = {
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
  const [loadState, setLoadState] = useState<LoadState>({
    foods: [],
    logs: [],
    recentFoods: [],
    summary: null,
    status: 'loading',
  })
  const [revision, setRevision] = useState(0)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let isCurrent = true

    void Promise.all([
      foodRepository.searchFoods(query),
      foodRepository.listFoodLogsByDate(selectedDate),
      foodRepository.listRecentFoods(5),
      nutritionSummaryService.getDailySummary(selectedDate),
    ])
      .then(([foods, logs, recentFoods, summary]) => {
        if (!isCurrent) {
          return
        }

        setLoadState({
          foods,
          logs,
          recentFoods,
          summary,
          status: 'ready',
        })
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
  }, [query, revision, selectedDate])

  useEffect(() => {
    const normalizedQuery = normalizeProviderQuery(query)
    if (!normalizedQuery) {
      const timeoutId = window.setTimeout(() => {
        setProviderSearch({ status: 'idle', results: [], query: '' })
      }, 0)
      return () => window.clearTimeout(timeoutId)
    }
    if (normalizedQuery.length < 2) {
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

    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => {
      setProviderSearch((current) => ({
        ...current,
        status: 'loading',
        query: normalizedQuery,
      }))
      void searchProviderFoods({
        query: normalizedQuery,
        provider: 'usda',
        allowFallback: true,
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
    }, 350)

    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [providerSearchNonce, query])

  const displayedResults = createSearchSections({
    localFoods: loadState.foods,
    providerResults: providerSearch.results,
    query,
    recentFoods: loadState.recentFoods,
  })
  const summary = loadState.summary
  const reload = () => {
    setRevision((value) => value + 1)
    refreshDashboard()
  }

  return (
    <PageContainer>
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
      {message ? <StatusMessage tone="success">{message}</StatusMessage> : null}

      {mode === 'day' ? (
        <>
          <DailyTotalsCard summary={summary} />
          <FoodSearchCard
            providerSearch={providerSearch}
            results={displayedResults}
            onCreateFood={() => setSheet({ type: 'food', food: null })}
            onEditFood={(food) => setSheet({ type: 'food', food })}
            onSelectResult={(result) => setSheet({ type: 'select', result })}
            onSearch={() => setProviderSearchNonce((current) => current + 1)}
            query={query}
            setQuery={setQuery}
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
          <FoodSearchCard
            providerSearch={providerSearch}
            results={displayedResults}
            onCreateFood={() => setSheet({ type: 'food', food: null })}
            onEditFood={(food) => setSheet({ type: 'food', food })}
            onSelectResult={(result) => setSheet({ type: 'select', result })}
            onSearch={() => setProviderSearchNonce((current) => current + 1)}
            query={query}
            setQuery={setQuery}
          />
        </>
      ) : null}

      {mode === 'targets' ? (
        <TargetsCard
          key={targetKey(summary?.targets ?? null)}
          currentTargets={summary?.targets ?? null}
          onSaved={() => {
            setMessage('Nutrition targets saved.')
            reload()
          }}
        />
      ) : null}

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
          onSaved={() => {
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

function FoodSearchCard({
  providerSearch,
  results,
  onCreateFood,
  onEditFood,
  onSelectResult,
  onSearch,
  query,
  setQuery,
}: {
  providerSearch: ProviderSearchState
  results: Array<{ title: string; items: FoodSearchResult[] }>
  onCreateFood: () => void
  onEditFood: (food: Food) => void
  onSelectResult: (result: FoodSearchResult) => void
  onSearch: () => void
  query: string
  setQuery: (query: string) => void
}) {
  const hasResults = results.some((section) => section.items.length > 0)
  const normalizedQuery = normalizeProviderQuery(query)

  return (
    <Card title={normalizedQuery ? 'Food search' : 'Recent foods'}>
      <FormField id="food-search" label="Search foods">
        <div className="input-icon-row">
          <Search aria-hidden="true" size={18} />
          <input
            id="food-search"
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
          <SecondaryButton type="button" onClick={onSearch}>
            Search
          </SecondaryButton>
        </div>
      </FormField>

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
                    />
                  ))}
                </div>
              </section>
            ) : null,
          )}
        </div>
      ) : (
        <EmptyState
          title={normalizedQuery ? 'No acceptable results' : 'No recent foods'}
          message={
            normalizedQuery
              ? 'No local or provider foods with calories, protein, total carbohydrates, and fat matched.'
              : 'Logged foods appear here for faster repeat entries.'
          }
          action={
            normalizedQuery ? (
              <SecondaryButton type="button" onClick={onCreateFood}>
                Create custom food
              </SecondaryButton>
            ) : (
              <SecondaryButton type="button" onClick={onCreateFood}>
                Create food
              </SecondaryButton>
            )
          }
        />
      )}
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
        Type at least 2 characters to search remote foods. Local foods still
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
    case 'provider_timeout':
      return 'Food provider search timed out. Local foods and history are still available.'
    case 'provider_unavailable':
      return 'Food providers are unavailable right now. Local foods and history are still available.'
    case 'provider_rate_limited':
      return 'Food providers are rate limited right now. Try again later.'
    case 'server_missing_configuration':
      return 'Food provider search is not configured on this deployment.'
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

function FoodLibraryRow({
  result,
  onEdit,
  onSelect,
}: {
  result: FoodSearchResult
  onEdit: (() => void) | null
  onSelect: () => void
}) {
  const display = resultDisplay(result)

  return (
    <div className="nutrition-item">
      <span className="quick-action-icon">
        <Utensils aria-hidden="true" size={18} />
      </span>
      <button
        className="nutrition-result-button"
        type="button"
        onClick={onSelect}
      >
        <strong>{display.name}</strong>
        {display.brand ? <small>{display.brand}</small> : null}
        <small>
          {display.serving} - {roundMacro(display.calories)} kcal
        </small>
      </button>
      <div className="row-actions">
        {onEdit ? (
          <IconButton aria-label={`Edit ${display.name}`} onClick={onEdit}>
            <Edit2 aria-hidden="true" size={18} />
          </IconButton>
        ) : null}
        <IconButton aria-label={`Select ${display.name}`} onClick={onSelect}>
          <Plus aria-hidden="true" size={18} />
        </IconButton>
      </div>
    </div>
  )
}

function resultDisplay(result: FoodSearchResult) {
  if (result.type === 'local') {
    return {
      name: result.food.name,
      brand: result.food.brandName ?? null,
      serving: servingLabel(result.food),
      calories: result.food.caloriesPerServing,
    }
  }

  const macros = result.food.macrosPerServing ?? result.food.macrosPer100Grams
  return {
    name: result.food.name,
    brand: result.food.brandName,
    serving: providerServingLabel(result.food),
    calories: macros?.calories ?? 0,
  }
}

function createSearchSections({
  localFoods,
  providerResults,
  query,
  recentFoods,
}: {
  localFoods: Food[]
  providerResults: GroupedFoodResult[]
  query: string
  recentFoods: Food[]
}): Array<{ title: string; items: FoodSearchResult[] }> {
  const normalizedQuery = normalizeProviderQuery(query)
  if (!normalizedQuery) {
    return [
      {
        title: 'Recent and previously used',
        items: recentFoods.map((food) => ({
          type: 'local',
          food,
          section: food.sourceType === 'provider' ? 'used' : 'recent',
        })),
      },
    ]
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
    {
      title: 'Recent and previously used',
      items: matchingRecent.map((food) => ({
        type: 'local',
        food,
        section: food.sourceType === 'provider' ? 'used' : 'recent',
      })),
    },
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
      title: 'Provider results',
      items: providerResults.map((food) => ({ type: 'external', food })),
    },
  ]
}

function resultKey(result: FoodSearchResult) {
  return result.type === 'local' ? `local-${result.food.id}` : result.food.id
}

function providerServingLabel(food: NormalizedFoodResult) {
  return `${roundMacro(food.serving.quantity)} ${
    food.serving.unit || food.serving.description || 'serving'
  }`
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
  return (
    <Card title="Logged foods">
      {entries.length ? (
        <div className="nutrition-list">
          {entries.map((entry) => (
            <div className="nutrition-item" key={entry.id}>
              <span className="quick-action-icon">
                <Utensils aria-hidden="true" size={18} />
              </span>
              <div>
                <strong>{entry.foodSnapshot.foodName}</strong>
                <small>
                  {entry.servingMultiplier}x {snapshotServingLabel(entry)} -{' '}
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

    void action.then(onSaved).catch((caught: unknown) => {
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
    >
      <FoodFormFields form={form} update={update} />
      {error ? <ValidationMessage message={error} /> : null}
      {Object.keys(fieldErrors).length ? (
        <StatusMessage tone="warning">
          Fix the highlighted food fields and save again.
        </StatusMessage>
      ) : null}
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
      <FormField id="food-brand" label="Brand or restaurant">
        <input
          id="food-brand"
          onChange={(event) => update('brandName', event.target.value)}
          value={form.brandName}
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
      <FormField id="food-notes" label="Notes">
        <textarea
          id="food-notes"
          onChange={(event) => update('notes', event.target.value)}
          value={form.notes}
        />
      </FormField>
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

function SelectedFoodSheet({
  result,
  isOpen,
  localDate,
  onCreateCopy,
  onSelectAlternate,
  onClose,
  onSaved,
}: {
  result: FoodSearchResult
  isOpen: boolean
  localDate: LocalDateString
  onCreateCopy: (initialForm: FoodFormState) => void
  onSelectAlternate: (food: NormalizedFoodResult) => void
  onClose: () => void
  onSaved: () => void
}) {
  const options = servingOptionsForResult(result)
  const [amount, setAmount] = useState(() => String(options[0]?.amount ?? 1))
  const [unit, setUnit] = useState(() => options[0]?.key ?? 'serving')
  const [error, setError] = useState<string | null>(null)
  const selectedOption =
    options.find((option) => option.key === unit) ?? options[0]
  const parsedAmount = parsePositiveNumber(amount)
  const servingMultiplier =
    parsedAmount && selectedOption
      ? selectedOption.toServingMultiplier(parsedAmount)
      : null
  const base = baseMacrosForResult(result)
  const preview =
    servingMultiplier && base
      ? {
          calories: base.calories * servingMultiplier,
          protein: base.protein * servingMultiplier,
          carbs: base.carbs * servingMultiplier,
          fat: base.fat * servingMultiplier,
        }
      : null
  const display = resultDisplay(result)
  const isImported =
    result.type === 'external' ||
    (result.type === 'local' && result.food.sourceType === 'provider')

  function saveLog() {
    if (!servingMultiplier) {
      setError('Serving amount must be greater than zero.')
      return
    }

    const action =
      result.type === 'external'
        ? foodRepository.logExternalFood({
            food: result.food,
            localDate,
            servingMultiplier,
          })
        : foodRepository.logFood({
            foodId: result.food.id,
            localDate,
            servingMultiplier,
          })

    void action.then(onSaved).catch((caught: unknown) => {
      setError(caught instanceof Error ? caught.message : 'Food could not log.')
    })
  }

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Food details">
      <p className="sheet-context">
        <strong>{display.name}</strong>
        <br />
        {display.brand ? <span className="muted">{display.brand}</span> : null}
        <br />
        <span className="muted">{display.serving} source serving</span>
      </p>
      <div className="macro-row nutrition-row">
        <span>Calories {roundMacro(base?.calories)} kcal</span>
        <span>Protein {roundMacro(base?.protein)} g</span>
        <span>Carbs {roundMacro(base?.carbs)} g</span>
        <span>Fat {roundMacro(base?.fat)} g</span>
      </div>
      <FormField id="serving-amount" label="Serving amount">
        <NumericInput
          id="serving-amount"
          onChange={(event) => setAmount(event.target.value)}
          value={amount}
        />
      </FormField>
      <FormField id="serving-unit-select" label="Serving unit">
        <select
          id="serving-unit-select"
          onChange={(event) => {
            const next = options.find(
              (option) => option.key === event.target.value,
            )
            setUnit(event.target.value)
            if (next) {
              setAmount(String(next.amount))
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
      {preview ? (
        <p className="muted">
          Preview: {roundMacro(preview.calories)} kcal - P{' '}
          {roundMacro(preview.protein)} C {roundMacro(preview.carbs)} F{' '}
          {roundMacro(preview.fat)}
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
          Log food
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

type ServingOption = {
  amount: number
  key: string
  label: string
  toServingMultiplier: (amount: number) => number | null
}

function servingOptionsForResult(result: FoodSearchResult): ServingOption[] {
  if (result.type === 'local') {
    const options: ServingOption[] = [
      {
        amount: result.food.servingQuantity,
        key: 'serving',
        label: result.food.servingUnit || result.food.servingDescription,
        toServingMultiplier: (amount) => amount / result.food.servingQuantity,
      },
    ]
    if (
      result.food.servingConversionReliable &&
      result.food.gramsPerServing &&
      result.food.ouncesPerServing
    ) {
      const gramsPerServing = result.food.gramsPerServing
      const ouncesPerServing = result.food.ouncesPerServing
      options.push(
        {
          amount: gramsPerServing,
          key: 'g',
          label: 'g',
          toServingMultiplier: (amount) => amount / gramsPerServing,
        },
        {
          amount: ouncesPerServing,
          key: 'oz',
          label: 'oz',
          toServingMultiplier: (amount) => amount / ouncesPerServing,
        },
      )
    }
    return options
  }

  const options: ServingOption[] = [
    {
      amount: result.food.serving.quantity,
      key: 'serving',
      label: result.food.serving.unit || result.food.serving.description,
      toServingMultiplier: (amount) => amount / result.food.serving.quantity,
    },
  ]

  if (
    result.food.serving.conversionReliable &&
    result.food.serving.gramsPerServing &&
    result.food.serving.ouncesPerServing
  ) {
    const gramsPerServing = result.food.serving.gramsPerServing
    const ouncesPerServing = result.food.serving.ouncesPerServing
    options.push(
      {
        amount: gramsPerServing,
        key: 'g',
        label: 'g',
        toServingMultiplier: (amount) => amount / gramsPerServing,
      },
      {
        amount: ouncesPerServing,
        key: 'oz',
        label: 'oz',
        toServingMultiplier: (amount) => amount / ouncesPerServing,
      },
    )
  }

  return options
}

function baseMacrosForResult(result: FoodSearchResult) {
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

    void foodRepository
      .updateFoodLogEntry(entry.id, { servingMultiplier: parsedMultiplier })
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
          onChange={(event) => setMultiplier(event.target.value)}
          value={multiplier}
        />
      </FormField>
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

  function update(field: keyof typeof emptyTargets, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function saveTargets() {
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }

    void settingsRepository
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
      <p className="muted">
        Each save creates target history so older dates can keep the target that
        was current for that date.
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
}: {
  children: React.ReactNode
  isOpen: boolean
  onClose: () => void
  title: string
}) {
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={title}>
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
      brandName: form.brandName.trim() || null,
      servingQuantity,
      servingUnit: form.servingUnit.trim(),
      servingDescription: '',
      caloriesPerServing,
      proteinGramsPerServing,
      carbohydrateGramsPerServing,
      fatGramsPerServing,
      notes: form.notes.trim(),
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

function servingLabel(food: Food) {
  return `${roundMacro(food.servingQuantity)} ${
    food.servingUnit || food.servingDescription
  }`
}

function snapshotServingLabel(entry: FoodLogEntry) {
  return `${roundMacro(entry.foodSnapshot.servingQuantity)} ${
    entry.foodSnapshot.servingUnit || entry.foodSnapshot.servingDescription
  }`
}

function targetKey(targets: NutritionTargetValues | null) {
  return targets
    ? `${targets.calories}-${targets.proteinGrams}-${targets.carbohydrateGrams}-${targets.fatGrams}`
    : 'loading-targets'
}
