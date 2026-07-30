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
import { useLanguage } from '@components/languageContextValue'
import { foodRepository } from '@repositories/foodRepository'
import type { Food } from '@shared-types/app'

import { Sheet } from './Sheet'
import {
  emptyFoodForm,
  macroCaloriesFromGrams,
  parseFoodForm,
  parseNonNegativeNumber,
  parsePositiveNumber,
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
  const fieldErrors = submitAttempted ? validateFoodFormFields(form) : {}

  function update(field: keyof typeof form, value: string) {
    setError(null)
    setForm((current) => ({ ...current, [field]: value }))
  }

  function saveFood() {
    setSubmitAttempted(true)
    if (!parsed.ok) {
      setError(null)
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
      <FoodFormFields errors={fieldErrors} form={form} update={update} />
    </Sheet>
  )
}

function FoodFormFields({
  errors,
  form,
  update,
}: {
  errors: Partial<Record<keyof typeof emptyFoodForm, string>>
  form: typeof emptyFoodForm
  update: (field: keyof typeof emptyFoodForm, value: string) => void
}) {
  const { t } = useLanguage()
  return (
    <>
      <FormField id="food-name" label="Name" error={errors.name}>
        <input
          aria-describedby={errors.name ? 'food-name-error' : undefined}
          aria-invalid={Boolean(errors.name)}
          id="food-name"
          onChange={(event) => update('name', event.target.value)}
          value={form.name}
        />
      </FormField>
      <fieldset className="food-form-section serving-size-section">
        <legend>{t('Serving size')}</legend>
        <p className="field-help">
          {t('Set the amount that the nutrition values below describe.')}
        </p>
        <div className="food-serving-controls">
          <FormField
            id="serving-quantity"
            label="Serving amount"
            error={errors.servingQuantity}
          >
            <NumericInput
              aria-describedby={
                errors.servingQuantity ? 'serving-quantity-error' : undefined
              }
              aria-invalid={Boolean(errors.servingQuantity)}
              id="serving-quantity"
              onChange={(event) =>
                update('servingQuantity', event.target.value)
              }
              placeholder="1"
              value={form.servingQuantity}
            />
          </FormField>
          <FormField
            id="serving-unit"
            label="Serving unit"
            helpText="Examples: g, oz, cup, slice, or container."
            error={errors.servingUnit}
          >
            <input
              aria-describedby={
                errors.servingUnit
                  ? 'serving-unit-help serving-unit-error'
                  : 'serving-unit-help'
              }
              aria-invalid={Boolean(errors.servingUnit)}
              id="serving-unit"
              onChange={(event) => update('servingUnit', event.target.value)}
              placeholder="cup"
              value={form.servingUnit}
            />
          </FormField>
        </div>
        <ServingSizeSummary form={form} />
      </fieldset>
      <fieldset className="food-form-section">
        <legend>{t('Nutrition for this serving')}</legend>
        <MacroInputs errors={errors} form={form} update={update} />
        <FoodCalorieEquation form={form} />
      </fieldset>
    </>
  )
}

function MacroInputs({
  errors,
  form,
  update,
}: {
  errors: Partial<Record<keyof typeof emptyFoodForm, string>>
  form: typeof emptyFoodForm
  update: (field: keyof typeof emptyFoodForm, value: string) => void
}) {
  return (
    <>
      <FormField
        id="food-calories"
        label="Calories per serving"
        error={errors.caloriesPerServing}
      >
        <NumericInput
          aria-describedby={
            errors.caloriesPerServing ? 'food-calories-error' : undefined
          }
          aria-invalid={Boolean(errors.caloriesPerServing)}
          id="food-calories"
          onChange={(event) => update('caloriesPerServing', event.target.value)}
          value={form.caloriesPerServing}
        />
      </FormField>
      <FormField
        id="food-protein"
        label="Protein per serving"
        error={errors.proteinGramsPerServing}
      >
        <NumericInput
          aria-describedby={
            errors.proteinGramsPerServing ? 'food-protein-error' : undefined
          }
          aria-invalid={Boolean(errors.proteinGramsPerServing)}
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
        error={errors.carbohydrateGramsPerServing}
      >
        <NumericInput
          aria-describedby={
            errors.carbohydrateGramsPerServing ? 'food-carbs-error' : undefined
          }
          aria-invalid={Boolean(errors.carbohydrateGramsPerServing)}
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
        error={errors.fatGramsPerServing}
      >
        <NumericInput
          aria-describedby={
            errors.fatGramsPerServing ? 'food-fat-error' : undefined
          }
          aria-invalid={Boolean(errors.fatGramsPerServing)}
          id="food-fat"
          onChange={(event) => update('fatGramsPerServing', event.target.value)}
          value={form.fatGramsPerServing}
        />
      </FormField>
    </>
  )
}

function ServingSizeSummary({ form }: { form: typeof emptyFoodForm }) {
  const { t } = useLanguage()
  const amount = parsePositiveNumber(form.servingQuantity)
  const unit = form.servingUnit.trim()
  return (
    <p className="serving-size-summary" aria-live="polite">
      {amount && unit
        ? t('Nutrition below is for {amount} {unit}.', { amount, unit })
        : t('Example: 170 g, 2 slices, or 1 container.')}
    </p>
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
