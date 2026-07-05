import { CopyPlus, Minus, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import {
  FormField,
  IconButton,
  NumericInput,
  PrimaryButton,
  SecondaryButton,
  ValidationMessage,
} from '@components/ui'
import type { LocalDateString } from '@domain/dates'
import {
  formatAmountValue,
  formatCalories,
  formatFoodServingLabel,
  formatGrams,
  formatMacroGram,
  formatQuantityChipLabel,
  nextSteppedAmount,
  quantityChipsForUnit,
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
  foodFormFromExternal,
  foodFormFromLocal,
  resultDisplay,
  servingOptionsForResult,
} from './foodDisplay'
import { parsePositiveNumber, type FoodFormState } from './nutritionForms'

export function SelectedFoodSheet({
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
  onSaved: (entry: FoodLogEntry, preference: FoodUnitPreference) => void
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
        const preference = await foodRepository.rememberFoodUnit({
          foodId: entry.foodId ?? foodId,
          unitKey: selectedOption.key,
          amount: parsedAmount,
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
                  {formatFoodServingLabel(alternate)}
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
