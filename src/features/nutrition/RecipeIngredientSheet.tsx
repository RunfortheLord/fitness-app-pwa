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
  formatCalories,
  formatMacroGram,
  formatQuantityChipLabel,
  nextSteppedAmount,
  quantityChipsForUnit,
} from '@domain/foodServings'

import { Sheet } from './Sheet'
import { parsePositiveNumber } from './nutritionForms'
import type { RecipeComponentDraft } from './types'

export function RecipeIngredientSheet({
  component,
  isOpen,
  onClose,
  onSaved,
}: {
  component: RecipeComponentDraft
  isOpen: boolean
  onClose: () => void
  onSaved: (servingMultiplier: number) => void
}) {
  const { t } = useLanguage()
  const snapshot = component.foodSnapshot
  const unitKey = snapshot.servingUnit.trim().toLocaleLowerCase()
  const initialAmount = snapshot.servingQuantity * component.servingMultiplier
  const [amount, setAmount] = useState(() => formatAmountValue(initialAmount))
  const [error, setError] = useState<string | null>(null)
  const parsedAmount = parsePositiveNumber(amount)
  const servingMultiplier =
    parsedAmount && snapshot.servingQuantity > 0
      ? parsedAmount / snapshot.servingQuantity
      : null
  const preview = servingMultiplier
    ? {
        calories: snapshot.caloriesPerServing * servingMultiplier,
        protein: snapshot.proteinGramsPerServing * servingMultiplier,
        carbs: snapshot.carbohydrateGramsPerServing * servingMultiplier,
        fat: snapshot.fatGramsPerServing * servingMultiplier,
      }
    : null
  const quickAmounts = quantityChipsForUnit(unitKey)

  function stepAmount(direction: 1 | -1) {
    const next = nextSteppedAmount(
      parsedAmount ?? initialAmount,
      unitKey,
      direction,
    )
    if (next != null) {
      setAmount(formatAmountValue(next))
    }
  }

  function save() {
    if (!servingMultiplier) {
      setError('Serving amount must be greater than zero.')
      return
    }
    onSaved(servingMultiplier)
  }

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Ingredient details">
      <p className="sheet-context">
        <strong>{snapshot.foodName}</strong>
        <br />
        <span className="muted">
          {formatAmountValue(snapshot.servingQuantity)} {snapshot.servingUnit}{' '}
          {t('AI-estimated serving')}
        </span>
      </p>
      <p className="metric-value metric-value-small">
        {formatCalories(preview?.calories)} kcal
      </p>
      <div className="macro-row nutrition-row">
        <span>Protein {formatMacroGram(preview?.protein)} g</span>
        <span>Carbs {formatMacroGram(preview?.carbs)} g</span>
        <span>Fat {formatMacroGram(preview?.fat)} g</span>
      </div>
      <FormField id="recipe-serving-amount" label="Serving amount">
        <div className="amount-stepper">
          <IconButton
            aria-label="Decrease amount"
            disabled={nextSteppedAmount(parsedAmount ?? 0, unitKey, -1) == null}
            onClick={() => stepAmount(-1)}
            type="button"
          >
            <Minus aria-hidden="true" size={18} />
          </IconButton>
          <NumericInput
            autoFocus
            id="recipe-serving-amount"
            onChange={(event) => setAmount(event.target.value)}
            onFocus={(event) => event.currentTarget.select()}
            value={amount}
          />
          <IconButton
            aria-label="Increase amount"
            onClick={() => stepAmount(1)}
            type="button"
          >
            <Plus aria-hidden="true" size={18} />
          </IconButton>
        </div>
      </FormField>
      <div className="quantity-chips" role="group" aria-label="Quick amounts">
        {quickAmounts.map((value) => {
          const isActive =
            parsedAmount != null && Math.abs(parsedAmount - value) < 0.01
          return (
            <button
              aria-pressed={isActive}
              className={`quantity-chip${isActive ? ' is-active' : ''}`}
              key={value}
              onClick={() => setAmount(formatAmountValue(value))}
              type="button"
            >
              {formatQuantityChipLabel(value)}
            </button>
          )
        })}
      </div>
      <FormField id="recipe-serving-unit" label="Serving unit">
        <select disabled id="recipe-serving-unit" value={snapshot.servingUnit}>
          <option value={snapshot.servingUnit}>{snapshot.servingUnit}</option>
        </select>
      </FormField>
      {preview ? (
        <p className="muted">
          Preview: {formatCalories(preview.calories)} kcal - P{' '}
          {formatMacroGram(preview.protein)} C {formatMacroGram(preview.carbs)}{' '}
          F {formatMacroGram(preview.fat)}
        </p>
      ) : null}
      {error ? <ValidationMessage message={error} /> : null}
      <PrimaryButton onClick={save} type="button">
        {t('Update ingredient')}
      </PrimaryButton>
    </Sheet>
  )
}
