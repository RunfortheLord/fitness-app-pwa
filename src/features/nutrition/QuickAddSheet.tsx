import { useState } from 'react'

import {
  FormField,
  NumericInput,
  PrimaryButton,
  ValidationMessage,
} from '@components/ui'
import type { LocalDateString } from '@domain/dates'
import { mealTypeForDate } from '@domain/meals'
import { foodRepository } from '@repositories/foodRepository'
import type { FoodLogEntry, MealType } from '@shared-types/app'

import { MealTypeField } from './MealTypeField'
import { Sheet } from './Sheet'
import { emptyQuickAddForm, parseQuickAddForm } from './nutritionForms'

export function QuickAddSheet({
  isOpen,
  localDate,
  onClose,
  onSaved,
}: {
  isOpen: boolean
  localDate: LocalDateString
  onClose: () => void
  onSaved: (entry: FoodLogEntry) => void
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
      <div className="food-log-actions">
        <PrimaryButton
          disabled={!parsed.ok}
          type="button"
          onClick={saveQuickAdd}
        >
          Log quick add
        </PrimaryButton>
      </div>
    </Sheet>
  )
}
