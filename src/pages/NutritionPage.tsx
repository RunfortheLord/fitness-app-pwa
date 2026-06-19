import { Archive, Edit2, Plus, Search, Trash2, Utensils } from 'lucide-react'
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
import { useDashboardContext } from '@hooks/useDashboardContext'
import {
  foodRepository,
  type CreateFoodInput,
} from '@repositories/foodRepository'
import { settingsRepository } from '@repositories/settingsRepository'
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
  | { type: 'food'; food: Food | null }
  | { type: 'log'; food: Food }
  | { type: 'entry'; entry: FoodLogEntry }
  | null

type LoadState = {
  foods: Food[]
  logs: FoodLogEntry[]
  recentFoods: Food[]
  summary: DailyNutritionSummary | null
  status: 'loading' | 'ready' | 'error'
}

const emptyFoodForm = {
  name: '',
  servingQuantity: '',
  servingUnit: '',
  servingDescription: '',
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

  const displayedFoods = query.trim() ? loadState.foods : loadState.recentFoods
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
            foods={displayedFoods}
            isRecent={!query.trim()}
            onCreateFood={() => setSheet({ type: 'food', food: null })}
            onEditFood={(food) => setSheet({ type: 'food', food })}
            onLogFood={(food) => setSheet({ type: 'log', food })}
            query={query}
            setQuery={setQuery}
          />
          <LoggedFoodsCard
            entries={loadState.logs}
            onDelete={setDeleteEntry}
            onEdit={(entry) => setSheet({ type: 'entry', entry })}
            selectedDate={selectedDate}
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
            foods={loadState.foods}
            isRecent={false}
            onCreateFood={() => setSheet({ type: 'food', food: null })}
            onEditFood={(food) => setSheet({ type: 'food', food })}
            onLogFood={(food) => setSheet({ type: 'log', food })}
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
          isOpen
          onClose={() => setSheet(null)}
          onSaved={() => {
            setMessage(sheet.food ? 'Food updated.' : 'Food created.')
            setSheet(null)
            reload()
          }}
        />
      ) : null}

      {sheet?.type === 'log' ? (
        <LogFoodSheet
          food={sheet.food}
          isOpen
          localDate={selectedDate}
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
  foods,
  isRecent,
  onCreateFood,
  onEditFood,
  onLogFood,
  query,
  setQuery,
}: {
  foods: Food[]
  isRecent: boolean
  onCreateFood: () => void
  onEditFood: (food: Food) => void
  onLogFood: (food: Food) => void
  query: string
  setQuery: (query: string) => void
}) {
  return (
    <Card title={isRecent ? 'Recent foods' : 'Food search'}>
      <FormField id="food-search" label="Search foods">
        <div className="input-icon-row">
          <Search aria-hidden="true" size={18} />
          <input
            id="food-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your foods"
            type="search"
            value={query}
          />
        </div>
      </FormField>
      {foods.length ? (
        <div className="nutrition-list">
          {foods.map((food) => (
            <FoodLibraryRow
              food={food}
              key={food.id}
              onEdit={() => onEditFood(food)}
              onLog={() => onLogFood(food)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title={isRecent ? 'No recent foods' : 'No foods found'}
          message={
            isRecent
              ? 'Logged foods appear here for faster repeat entries.'
              : 'Create a reusable food before logging it.'
          }
          action={
            <SecondaryButton type="button" onClick={onCreateFood}>
              Create food
            </SecondaryButton>
          }
        />
      )}
    </Card>
  )
}

function FoodLibraryRow({
  food,
  onEdit,
  onLog,
}: {
  food: Food
  onEdit: () => void
  onLog: () => void
}) {
  return (
    <div className="nutrition-item">
      <span className="quick-action-icon">
        <Utensils aria-hidden="true" size={18} />
      </span>
      <div>
        <strong>{food.name}</strong>
        <small>
          {servingLabel(food)} - {roundMacro(food.caloriesPerServing)} kcal - P{' '}
          {roundMacro(food.proteinGramsPerServing)} C{' '}
          {roundMacro(food.carbohydrateGramsPerServing)} F{' '}
          {roundMacro(food.fatGramsPerServing)}
        </small>
      </div>
      <div className="row-actions">
        <IconButton aria-label={`Edit ${food.name}`} onClick={onEdit}>
          <Edit2 aria-hidden="true" size={18} />
        </IconButton>
        <IconButton aria-label={`Log ${food.name}`} onClick={onLog}>
          <Plus aria-hidden="true" size={18} />
        </IconButton>
      </div>
    </div>
  )
}

function LoggedFoodsCard({
  entries,
  onDelete,
  onEdit,
  selectedDate,
}: {
  entries: FoodLogEntry[]
  onDelete: (entry: FoodLogEntry) => void
  onEdit: (entry: FoodLogEntry) => void
  selectedDate: LocalDateString
}) {
  return (
    <Card title={`Logged foods for ${selectedDate}`}>
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
  isOpen,
  onClose,
  onSaved,
}: {
  food: Food | null
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState(() =>
    food
      ? {
          name: food.name,
          servingQuantity: String(food.servingQuantity),
          servingUnit: food.servingUnit,
          servingDescription: food.servingDescription,
          caloriesPerServing: String(food.caloriesPerServing),
          proteinGramsPerServing: String(food.proteinGramsPerServing),
          carbohydrateGramsPerServing: String(food.carbohydrateGramsPerServing),
          fatGramsPerServing: String(food.fatGramsPerServing),
          notes: food.notes,
        }
      : emptyFoodForm,
  )
  const [error, setError] = useState<string | null>(null)
  const parsed = useMemo(() => parseFoodForm(form), [form])

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function saveFood() {
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
      <div className="button-row">
        <PrimaryButton disabled={!parsed.ok} type="button" onClick={saveFood}>
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
      <FormField id="food-name" label="Name">
        <input
          id="food-name"
          onChange={(event) => update('name', event.target.value)}
          value={form.name}
        />
      </FormField>
      <FormField id="serving-quantity" label="Serving quantity">
        <NumericInput
          id="serving-quantity"
          onChange={(event) => update('servingQuantity', event.target.value)}
          placeholder="1"
          value={form.servingQuantity}
        />
      </FormField>
      <FormField
        id="serving-unit"
        label="Serving unit"
        helpText="Use a unit or a serving description."
      >
        <input
          id="serving-unit"
          onChange={(event) => update('servingUnit', event.target.value)}
          placeholder="cup, scoop, g"
          value={form.servingUnit}
        />
      </FormField>
      <FormField id="serving-description" label="Serving description">
        <input
          id="serving-description"
          onChange={(event) => update('servingDescription', event.target.value)}
          placeholder="medium bowl"
          value={form.servingDescription}
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
      <FormField id="food-calories" label="Calories per serving">
        <NumericInput
          id="food-calories"
          onChange={(event) => update('caloriesPerServing', event.target.value)}
          value={form.caloriesPerServing}
        />
      </FormField>
      <FormField id="food-protein" label="Protein per serving">
        <NumericInput
          id="food-protein"
          onChange={(event) =>
            update('proteinGramsPerServing', event.target.value)
          }
          value={form.proteinGramsPerServing}
        />
      </FormField>
      <FormField id="food-carbs" label="Carbohydrates per serving">
        <NumericInput
          id="food-carbs"
          onChange={(event) =>
            update('carbohydrateGramsPerServing', event.target.value)
          }
          value={form.carbohydrateGramsPerServing}
        />
      </FormField>
      <FormField id="food-fat" label="Fat per serving">
        <NumericInput
          id="food-fat"
          onChange={(event) => update('fatGramsPerServing', event.target.value)}
          value={form.fatGramsPerServing}
        />
      </FormField>
    </>
  )
}

function LogFoodSheet({
  food,
  isOpen,
  localDate,
  onClose,
  onSaved,
}: {
  food: Food
  isOpen: boolean
  localDate: LocalDateString
  onClose: () => void
  onSaved: () => void
}) {
  const [multiplier, setMultiplier] = useState('1')
  const [error, setError] = useState<string | null>(null)
  const parsedMultiplier = parsePositiveNumber(multiplier)
  const preview = parsedMultiplier
    ? {
        calories: food.caloriesPerServing * parsedMultiplier,
        protein: food.proteinGramsPerServing * parsedMultiplier,
        carbs: food.carbohydrateGramsPerServing * parsedMultiplier,
        fat: food.fatGramsPerServing * parsedMultiplier,
      }
    : null

  function saveLog() {
    if (!parsedMultiplier) {
      setError('Serving multiplier must be greater than zero.')
      return
    }

    void foodRepository
      .logFood({
        foodId: food.id,
        localDate,
        servingMultiplier: parsedMultiplier,
      })
      .then(onSaved)
      .catch((caught: unknown) => {
        setError(
          caught instanceof Error ? caught.message : 'Food could not log.',
        )
      })
  }

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Log food">
      <p className="sheet-context">
        <strong>{food.name}</strong>
        <br />
        <span className="muted">
          {servingLabel(food)} for {localDate}
        </span>
      </p>
      <FormField id="serving-multiplier" label="Serving multiplier">
        <NumericInput
          id="serving-multiplier"
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
        Log food
      </PrimaryButton>
    </Sheet>
  )
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
  const proteinGramsPerServing = parseNonNegativeNumber(
    form.proteinGramsPerServing,
  )
  const carbohydrateGramsPerServing = parseNonNegativeNumber(
    form.carbohydrateGramsPerServing,
  )
  const fatGramsPerServing = parseNonNegativeNumber(form.fatGramsPerServing)

  if (!name) {
    return { ok: false, error: 'Food name is required.' }
  }

  if (!servingQuantity) {
    return { ok: false, error: 'Serving quantity must be greater than zero.' }
  }

  if (!form.servingUnit.trim() && !form.servingDescription.trim()) {
    return { ok: false, error: 'Serving unit or description is required.' }
  }

  if (
    caloriesPerServing === null ||
    proteinGramsPerServing === null ||
    carbohydrateGramsPerServing === null ||
    fatGramsPerServing === null
  ) {
    return { ok: false, error: 'Nutrition values must be zero or greater.' }
  }

  return {
    ok: true,
    value: {
      name,
      servingQuantity,
      servingUnit: form.servingUnit.trim(),
      servingDescription: form.servingDescription.trim(),
      caloriesPerServing,
      proteinGramsPerServing,
      carbohydrateGramsPerServing,
      fatGramsPerServing,
      notes: form.notes.trim(),
    },
  }
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
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
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
