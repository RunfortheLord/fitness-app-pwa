import { useEffect, useState } from 'react'

import {
  Card,
  FormField,
  ModalConfirmationDialog,
  NumericInput,
  PageContainer,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  StatusMessage,
  ValidationMessage,
} from '@components/ui'
import { useDashboardContext } from '@hooks/useDashboardContext'
import { settingsRepository } from '@repositories/settingsRepository'

const emptyTargets = {
  calories: '',
  proteinGrams: '',
  carbohydrateGrams: '',
  fatGrams: '',
}

export function SettingsPage() {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [targetForm, setTargetForm] = useState(emptyTargets)
  const [targetError, setTargetError] = useState<string | null>(null)
  const [targetMessage, setTargetMessage] = useState<string | null>(null)
  const { refreshDashboard } = useDashboardContext()
  const parsedTargets = parseTargetForm(targetForm)

  useEffect(() => {
    let isCurrent = true

    void settingsRepository.ensureSettings().then((settings) => {
      if (!isCurrent) {
        return
      }

      setTargetForm({
        calories: String(settings.nutritionTargets.calories),
        proteinGrams: String(settings.nutritionTargets.proteinGrams),
        carbohydrateGrams: String(settings.nutritionTargets.carbohydrateGrams),
        fatGrams: String(settings.nutritionTargets.fatGrams),
      })
    })

    return () => {
      isCurrent = false
    }
  }, [])

  function updateTarget(field: keyof typeof emptyTargets, value: string) {
    setTargetForm((current) => ({ ...current, [field]: value }))
  }

  function saveTargets() {
    if (!parsedTargets.ok) {
      setTargetError(parsedTargets.error)
      return
    }

    void settingsRepository
      .saveNutritionTargets(parsedTargets.value)
      .then(() => {
        setTargetError(null)
        setTargetMessage('Nutrition targets saved.')
        refreshDashboard()
      })
      .catch((caught: unknown) => {
        setTargetError(
          caught instanceof Error ? caught.message : 'Targets could not save.',
        )
      })
  }

  return (
    <PageContainer>
      <SectionHeader title="Nutrition targets" />
      <Card>
        {targetMessage ? (
          <StatusMessage tone="success">{targetMessage}</StatusMessage>
        ) : null}
        <FormField id="target-calories" label="Calories">
          <NumericInput
            id="target-calories"
            onChange={(event) => updateTarget('calories', event.target.value)}
            placeholder="0"
            value={targetForm.calories}
          />
        </FormField>
        <FormField id="target-protein" label="Protein target">
          <NumericInput
            id="target-protein"
            onChange={(event) =>
              updateTarget('proteinGrams', event.target.value)
            }
            placeholder="0"
            value={targetForm.proteinGrams}
          />
        </FormField>
        <FormField id="target-carbs" label="Carbohydrate target">
          <NumericInput
            id="target-carbs"
            onChange={(event) =>
              updateTarget('carbohydrateGrams', event.target.value)
            }
            placeholder="0"
            value={targetForm.carbohydrateGrams}
          />
        </FormField>
        <FormField id="target-fat" label="Fat target">
          <NumericInput
            id="target-fat"
            onChange={(event) => updateTarget('fatGrams', event.target.value)}
            placeholder="0"
            value={targetForm.fatGrams}
          />
        </FormField>
        {targetError ? <ValidationMessage message={targetError} /> : null}
        <PrimaryButton
          disabled={!parsedTargets.ok}
          type="button"
          onClick={saveTargets}
        >
          Save targets
        </PrimaryButton>
      </Card>

      <SectionHeader title="Local data" />
      <Card>
        <div className="button-row">
          <SecondaryButton type="button">Export backup</SecondaryButton>
          <SecondaryButton type="button">Restore</SecondaryButton>
        </div>
        <SecondaryButton type="button" onClick={() => setIsConfirmOpen(true)}>
          Clear all data
        </SecondaryButton>
      </Card>

      <ModalConfirmationDialog
        confirmLabel="Keep data"
        isOpen={isConfirmOpen}
        onCancel={() => setIsConfirmOpen(false)}
        onConfirm={() => setIsConfirmOpen(false)}
        title="Clear all data?"
      >
        <p>
          Destructive settings actions will require confirmation before they are
          implemented.
        </p>
      </ModalConfirmationDialog>
    </PageContainer>
  )
}

function parseTargetForm(form: typeof emptyTargets):
  | {
      ok: true
      value: {
        calories: number
        proteinGrams: number
        carbohydrateGrams: number
        fatGrams: number
      }
    }
  | { ok: false; error: string } {
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

function parseNonNegativeNumber(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}
