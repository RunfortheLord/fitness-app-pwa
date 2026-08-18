import { useState } from 'react'

import {
  Card,
  FormField,
  NumericInput,
  PrimaryButton,
  ValidationMessage,
} from '@components/ui'
import { settingsRepository } from '@repositories/settingsRepository'
import type { NutritionTargetValues } from '@shared-types/app'

import {
  calculateMacroCalories,
  emptyTargets,
  parseTargetForm,
} from './nutritionForms'

export function TargetsCard({
  currentTargets,
  estimatedMaintenanceCalories,
  onSaved,
}: {
  currentTargets: NutritionTargetValues | null
  estimatedMaintenanceCalories: number | null
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
      {estimatedMaintenanceCalories !== null &&
      Number.isFinite(estimatedMaintenanceCalories) &&
      estimatedMaintenanceCalories > 0 ? (
        <div className="nutrition-maintenance-summary">
          <span>Estimated maintenance</span>
          <strong>{Math.round(estimatedMaintenanceCalories)} kcal</strong>
        </div>
      ) : null}
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
