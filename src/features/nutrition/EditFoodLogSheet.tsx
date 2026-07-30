import { Minus, Plus } from 'lucide-react'
import { useState } from 'react'

import {
  FormField,
  IconButton,
  NumericInput,
  PrimaryButton,
  ValidationMessage,
} from '@components/ui'
import { useLanguage } from '@components/languageContextValue'
import {
  formatAmountValue,
  formatQuantityChipLabel,
  nextSteppedAmount,
  portionChipsForUnit,
} from '@domain/foodServings'
import { foodRepository } from '@repositories/foodRepository'
import type { FoodLogEntry, MealType } from '@shared-types/app'

import { MealTypeField } from './MealTypeField'
import { Sheet } from './Sheet'
import { foodSnapshotPortionBasis, snapshotServingLabel } from './foodDisplay'
import { parsePositiveNumber, roundMacro } from './nutritionForms'

export function EditFoodLogSheet({
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
  const { t } = useLanguage()
  const snapshot = entry.foodSnapshot
  const servingBasis = foodSnapshotPortionBasis(snapshot)
  const servingUnit = servingBasis.unit
  const controlUnit = controlUnitForServingUnit(servingUnit)
  const initialAmount = servingBasis.amount * entry.servingMultiplier
  const [amount, setAmount] = useState(() => formatAmountValue(initialAmount))
  const [mealType, setMealType] = useState<MealType>(entry.mealType)
  const [error, setError] = useState<string | null>(null)
  const parsedAmount = parsePositiveNumber(amount)
  const servingMultiplier =
    parsedAmount && servingBasis.amount > 0
      ? parsedAmount / servingBasis.amount
      : null
  const preview = servingMultiplier
    ? {
        calories: snapshot.caloriesPerServing * servingMultiplier,
        protein: snapshot.proteinGramsPerServing * servingMultiplier,
        carbs: snapshot.carbohydrateGramsPerServing * servingMultiplier,
        fat: snapshot.fatGramsPerServing * servingMultiplier,
      }
    : null
  const amountError =
    amount.trim() && !parsedAmount
      ? 'Serving amount must be greater than zero.'
      : undefined
  const quickPortions = portionChipsForUnit(controlUnit)

  function applyAmount(next: string) {
    setError(null)
    setAmount(next)
  }

  function stepAmount(direction: 1 | -1) {
    const next = nextSteppedAmount(
      parsedAmount ?? initialAmount,
      controlUnit,
      direction,
    )
    if (next != null) {
      applyAmount(formatAmountValue(next))
    }
  }

  function saveLog() {
    if (!servingMultiplier) {
      setError('Serving amount must be greater than zero.')
      return
    }

    return foodRepository
      .updateFoodLogEntry(entry.id, {
        servingMultiplier,
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
        <span className="muted">
          {t('Serving size: {serving}', {
            serving: snapshotServingLabel(entry),
          })}
        </span>
      </p>
      <section className="portion-editor" aria-label={t('Your portion')}>
        <div className="food-serving-controls">
          <FormField
            id="edit-serving-amount"
            label="Serving amount"
            error={amountError}
          >
            <div className="amount-stepper">
              <IconButton
                aria-label="Decrease portion"
                disabled={
                  nextSteppedAmount(parsedAmount ?? 0, controlUnit, -1) == null
                }
                onClick={() => stepAmount(-1)}
              >
                <Minus aria-hidden="true" size={18} />
              </IconButton>
              <NumericInput
                aria-describedby={
                  amountError ? 'edit-serving-amount-error' : undefined
                }
                aria-invalid={Boolean(amountError)}
                id="edit-serving-amount"
                onFocus={(event) => event.currentTarget.select()}
                onChange={(event) => applyAmount(event.target.value)}
                value={amount}
              />
              <IconButton
                aria-label="Increase portion"
                onClick={() => stepAmount(1)}
              >
                <Plus aria-hidden="true" size={18} />
              </IconButton>
            </div>
          </FormField>
          <FormField id="edit-serving-unit" label="Serving unit">
            <input
              aria-readonly="true"
              id="edit-serving-unit"
              readOnly
              value={servingUnit}
            />
          </FormField>
        </div>
        <div
          className="quantity-chips portion-quick-chips"
          role="group"
          aria-label={t('Quick portions')}
        >
          {quickPortions.map((value) => (
            <button
              aria-label={t('Set portion to {amount} {unit}', {
                amount: formatAmountValue(value),
                unit: servingUnit,
              }).trim()}
              aria-pressed={
                parsedAmount != null && Math.abs(parsedAmount - value) < 0.01
              }
              className={`quantity-chip${
                parsedAmount != null && Math.abs(parsedAmount - value) < 0.01
                  ? ' is-active'
                  : ''
              }`}
              key={value}
              onClick={() => applyAmount(formatAmountValue(value))}
              type="button"
            >
              {formatQuantityChipLabel(value)}
            </button>
          ))}
        </div>
      </section>
      <MealTypeField value={mealType} onChange={setMealType} />
      {preview ? (
        <p className="muted">
          Preview: {roundMacro(preview.calories)} kcal - P{' '}
          {roundMacro(preview.protein)} C {roundMacro(preview.carbs)} F{' '}
          {roundMacro(preview.fat)}
        </p>
      ) : null}
      {error ? <ValidationMessage message={error} /> : null}
      <div className="food-log-actions">
        <PrimaryButton disabled={!preview} type="button" onClick={saveLog}>
          Save log
        </PrimaryButton>
      </div>
    </Sheet>
  )
}

function controlUnitForServingUnit(unit: string): 'g' | 'oz' | 'portion' {
  const normalized = unit.trim().toLocaleLowerCase()
  if (/^(g|gram|grams)$/u.test(normalized)) {
    return 'g'
  }
  if (/^(oz|ounce|ounces)(\b|\s)/u.test(normalized)) {
    return 'oz'
  }
  return 'portion'
}
