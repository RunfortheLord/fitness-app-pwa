import { CopyPlus, Minus, Plus } from 'lucide-react'
import { useState } from 'react'

import {
  FormField,
  IconButton,
  NumericInput,
  PrimaryButton,
  SecondaryButton,
  ValidationMessage,
} from '@components/ui'
import { useLanguage } from '@components/languageContextValue'
import type { LocalDateString } from '@domain/dates'
import {
  findServingOption,
  formatAmountValue,
  formatCalories,
  formatFoodServingLabel,
  formatGrams,
  formatMacroGram,
  formatQuantityChipLabel,
  nextSteppedAmount,
  portionChipsForUnit,
  rebaseProviderServingMultiplier,
} from '@domain/foodServings'
import type { NormalizedFoodResult } from '@domain/foodProviderModels'
import type { FoodResult } from '@domain/foodSearchSections'
import { mealTypeForDate } from '@domain/meals'
import { foodRepository } from '@repositories/foodRepository'
import type {
  Food,
  FoodLogEntry,
  FoodUnitPreference,
  MealType,
} from '@shared-types/app'

import { MealTypeField } from './MealTypeField'
import { Sheet } from './Sheet'
import {
  baseGramsForResult,
  baseMacrosForResult,
  durableServingPreference,
  foodFormFromExternal,
  foodFormFromLocal,
  resultDisplay,
  servingOptionsForResult,
} from './foodDisplay'
import { parsePositiveNumber, type FoodFormState } from './nutritionForms'

export function SelectedFoodSheet({
  result,
  rememberedServing,
  isOpen,
  localDate,
  onCreateCopy,
  onSelectAlternate,
  onClose,
  onSaved,
  onAddToRecipe,
}: {
  result: FoodResult
  rememberedServing?: FoodUnitPreference | null
  isOpen: boolean
  localDate: LocalDateString
  onCreateCopy: (initialForm: FoodFormState) => void
  onSelectAlternate: (food: NormalizedFoodResult) => void
  onClose: () => void
  onSaved: (entry: FoodLogEntry, preference: FoodUnitPreference) => void
  // When present the sheet adds the chosen food (at the chosen serving) to a
  // recipe instead of logging it to the day.
  onAddToRecipe?: (food: Food, servingMultiplier: number) => void
}) {
  const { t } = useLanguage()
  // The parent gives this sheet a key of the food id, so it remounts per food.
  // The already-loaded preference avoids a visible jump after the sheet opens.
  const foodId = result.food.id
  const options = servingOptionsForResult(result, null)
  const servingSizeOption = options[0]
  const rememberedOption = rememberedServing
    ? findServingOption(options, rememberedServing.unitKey)
    : undefined
  const initialOption = rememberedOption ?? servingSizeOption
  const [amount, setAmount] = useState(() =>
    formatAmountValue(
      rememberedOption && rememberedServing
        ? rememberedServing.amount
        : (initialOption?.amount ?? 1),
    ),
  )
  const [unit, setUnit] = useState(() => initialOption?.key ?? 'serving')
  const [portionSource, setPortionSource] = useState<
    'last-used' | 'serving-size' | 'custom'
  >(rememberedOption ? 'last-used' : 'serving-size')
  const [error, setError] = useState<string | null>(null)
  const [mealType, setMealType] = useState<MealType>(() =>
    mealTypeForDate(new Date()),
  )
  const selectedOption =
    options.find((option) => option.key === unit) ?? options[0]
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
  const amountError =
    amount.trim() && !parsedAmount
      ? 'Serving amount must be greater than zero.'
      : undefined
  const quickPortions = selectedOption
    ? portionChipsForUnit(selectedOption.controlUnit)
    : []
  const isServingSize = Boolean(
    servingSizeOption &&
    selectedOption?.key === servingSizeOption.key &&
    parsedAmount &&
    Math.abs(parsedAmount - servingSizeOption.amount) < 0.001,
  )

  function applyAmount(next: string) {
    setError(null)
    setPortionSource('custom')
    setAmount(next)
  }

  function stepAmount(direction: 1 | -1) {
    if (!selectedOption) {
      return
    }
    const next = nextSteppedAmount(
      parsedAmount ?? selectedOption.amount,
      selectedOption.controlUnit,
      direction,
    )
    if (next != null) {
      applyAmount(formatAmountValue(next))
    }
  }

  function useServingSize() {
    if (!servingSizeOption) {
      return
    }
    setError(null)
    setUnit(servingSizeOption.key)
    setAmount(formatAmountValue(servingSizeOption.amount))
    setPortionSource('serving-size')
  }

  const display = resultDisplay(result)
  const isImported =
    result.type === 'external' ||
    (result.type === 'local' && result.food.sourceType === 'provider')
  const alternates = result.type === 'external' ? result.food.alternates : []

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
          onAddToRecipe(
            food,
            result.type === 'external'
              ? rebaseProviderServingMultiplier(
                  result.food,
                  food,
                  servingMultiplier,
                )
              : servingMultiplier,
          )
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
        const persistedFood =
          result.type === 'external' && entry.foodId
            ? await foodRepository.getFood(entry.foodId)
            : null
        const durablePreference = durableServingPreference(
          result,
          selectedOption,
          parsedAmount,
          servingMultiplier,
          persistedFood,
        )
        const preference = await foodRepository.rememberFoodUnit({
          foodId: entry.foodId ?? foodId,
          ...durablePreference,
        })
        onSaved(entry, preference)
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
      <p className="sheet-context food-detail-heading">
        <strong>{display.name}</strong>
        {display.brand ? (
          <small className="muted">{display.brand}</small>
        ) : null}
      </p>
      <section
        className="portion-editor"
        aria-labelledby="portion-editor-title"
      >
        <div className="portion-editor-heading">
          <div>
            <h3 id="portion-editor-title">{t('Your portion')}</h3>
            <p className="muted">
              {t('Serving size: {serving}', {
                serving: servingSizeOption?.label ?? display.serving,
              })}
            </p>
          </div>
          {portionSource === 'last-used' ? (
            <span className="portion-source-badge">{t('Last used')}</span>
          ) : null}
          {!isServingSize ? (
            <SecondaryButton
              className="portion-reset-button"
              type="button"
              onClick={useServingSize}
            >
              Use serving size
            </SecondaryButton>
          ) : null}
        </div>
        <div className="food-serving-controls">
          <FormField
            id="serving-amount"
            label="Serving amount"
            error={amountError}
          >
            <div className="amount-stepper">
              <IconButton
                aria-label="Decrease portion"
                disabled={
                  !selectedOption ||
                  nextSteppedAmount(
                    parsedAmount ?? 0,
                    selectedOption.controlUnit,
                    -1,
                  ) == null
                }
                onClick={() => stepAmount(-1)}
                type="button"
              >
                <Minus aria-hidden="true" size={18} />
              </IconButton>
              <NumericInput
                aria-describedby={
                  amountError ? 'serving-amount-error' : undefined
                }
                aria-invalid={Boolean(amountError)}
                id="serving-amount"
                onFocus={(event) => event.currentTarget.select()}
                onChange={(event) => applyAmount(event.target.value)}
                value={amount}
              />
              <IconButton
                aria-label="Increase portion"
                disabled={!selectedOption}
                onClick={() => stepAmount(1)}
                type="button"
              >
                <Plus aria-hidden="true" size={18} />
              </IconButton>
            </div>
          </FormField>
          <FormField id="serving-unit-select" label="Serving unit">
            <select
              id="serving-unit-select"
              onChange={(event) => {
                const next = options.find(
                  (option) => option.key === event.target.value,
                )
                if (!next) {
                  return
                }
                const currentMultiplier =
                  parsedAmount && selectedOption
                    ? selectedOption.toServingMultiplier(parsedAmount)
                    : null
                const equivalentAmount = currentMultiplier
                  ? next.fromServingMultiplier(currentMultiplier)
                  : null
                setError(null)
                setPortionSource('custom')
                setUnit(next.key)
                setAmount(formatAmountValue(equivalentAmount ?? next.amount))
              }}
              value={unit}
            >
              {options.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.unitLabel}
                </option>
              ))}
            </select>
          </FormField>
        </div>
        <div
          className="quantity-chips portion-quick-chips"
          role="group"
          aria-label={t('Quick portions')}
        >
          {quickPortions.map((value) => {
            const isActive =
              parsedAmount != null && Math.abs(parsedAmount - value) < 0.01
            const unitLabel = selectedOption?.unitLabel ?? ''
            return (
              <button
                aria-label={t('Set portion to {amount} {unit}', {
                  amount: formatAmountValue(value),
                  unit: unitLabel,
                }).trim()}
                aria-pressed={isActive}
                className={`quantity-chip${isActive ? ' is-active' : ''}`}
                key={value}
                onClick={() => applyAmount(formatAmountValue(value))}
                type="button"
              >
                {formatQuantityChipLabel(value)}
              </button>
            )
          })}
        </div>
        {onAddToRecipe ? null : (
          <p className="portion-memory-note">
            {portionSource === 'last-used'
              ? t('Your last logged portion is preselected.')
              : t('This becomes your last-used portion for one-tap logging.')}
          </p>
        )}
      </section>
      {onAddToRecipe ? null : (
        <MealTypeField value={mealType} onChange={setMealType} />
      )}
      {preview ? (
        <section
          className="food-log-preview"
          aria-label="Nutrition preview"
          aria-live="polite"
        >
          <strong>{formatCalories(preview.calories)} kcal</strong>
          <div className="macro-row nutrition-row">
            <span>Protein {formatMacroGram(preview.protein)} g</span>
            <span>Carbs {formatMacroGram(preview.carbs)} g</span>
            <span>Fat {formatMacroGram(preview.fat)} g</span>
          </div>
          {preview.grams != null ? (
            <small className="muted">
              {t('Portion weight: {weight}', {
                weight: formatGrams(preview.grams),
              })}
            </small>
          ) : null}
        </section>
      ) : null}
      {isImported || alternates.length > 0 ? (
        <details className="more-results">
          <summary>More options</summary>
          {alternates.length > 0 ? (
            <div className="nutrition-list">
              {alternates.map((alternate) => (
                <button
                  className="alternate-result-row"
                  key={alternate.id}
                  type="button"
                  onClick={() => onSelectAlternate(alternate)}
                >
                  <strong>{alternate.name}</strong>
                  <small>
                    {alternate.brandName ? `${alternate.brandName} - ` : ''}
                    {formatFoodServingLabel(alternate)}
                  </small>
                </button>
              ))}
            </div>
          ) : null}
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
              Create corrected copy
            </SecondaryButton>
          ) : null}
        </details>
      ) : null}
      {error ? <ValidationMessage message={error} /> : null}
      <div className="food-log-actions">
        <PrimaryButton disabled={!preview} type="button" onClick={saveLog}>
          {onAddToRecipe ? 'Add to recipe' : 'Log food'}
        </PrimaryButton>
      </div>
    </Sheet>
  )
}
