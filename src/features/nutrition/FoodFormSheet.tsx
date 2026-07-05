import { Archive } from 'lucide-react'
import { useMemo, useState } from 'react'

import {
  FormField,
  NumericInput,
  PrimaryButton,
  SecondaryButton,
  StatusMessage,
  ValidationMessage,
} from '@components/ui'
import { foodRepository } from '@repositories/foodRepository'
import type { Food } from '@shared-types/app'

import { Sheet } from './Sheet'
import {
  emptyFoodForm,
  macroCaloriesFromGrams,
  parseFoodForm,
  parseNonNegativeNumber,
  validateFoodFormFields,
  type FoodFormState,
} from './nutritionForms'

export function FoodFormSheet({
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
          barcode: food.barcode ?? '',
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

    return action
      .then(async (savedFood) => {
        if (parsed.value.barcode) {
          await foodRepository.cacheBarcodeProduct({
            barcode: parsed.value.barcode,
            foodId: savedFood.id,
            sourceProvider: 'custom',
            sourceName: 'Custom food',
          })
        }
        onSaved()
      })
      .catch((caught: unknown) => {
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
      variant="page"
    >
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
      {error ? <ValidationMessage message={error} /> : null}
      {Object.keys(fieldErrors).length ? (
        <StatusMessage tone="warning">
          Fix the highlighted food fields and save again.
        </StatusMessage>
      ) : null}
      <FoodFormFields form={form} update={update} />
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
      <FoodCalorieEquation form={form} />
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

function FoodCalorieEquation({ form }: { form: typeof emptyFoodForm }) {
  const proteinGrams = parseNonNegativeNumber(form.proteinGramsPerServing) ?? 0
  const carbohydrateGrams =
    parseNonNegativeNumber(form.carbohydrateGramsPerServing) ?? 0
  const fatGrams = parseNonNegativeNumber(form.fatGramsPerServing) ?? 0
  const calories = macroCaloriesFromGrams({
    proteinGrams,
    carbohydrateGrams,
    fatGrams,
  })
  return (
    <p className="macro-calorie-equation">
      P {proteinGrams}g x 4 + C {carbohydrateGrams}g x 4 + F {fatGrams}g x 9 ={' '}
      {calories} kcal
    </p>
  )
}
