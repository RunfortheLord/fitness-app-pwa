import { useState } from 'react'

import {
  FormField,
  NumericInput,
  PrimaryButton,
  ValidationMessage,
} from '@components/ui'
import { foodRepository } from '@repositories/foodRepository'
import type { FoodLogEntry, MealType } from '@shared-types/app'

import { MealTypeField } from './MealTypeField'
import { Sheet } from './Sheet'
import { snapshotServingLabel } from './foodDisplay'
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
