import { useEffect, useMemo, useState } from 'react'

import {
  BottomSheet,
  FormField,
  NumericInput,
  PrimaryButton,
  StatusMessage,
  ValidationMessage,
} from '@components/ui'
import { TRACKING_METHODS, getTrackingMethod } from '@domain/trackingMethods'
import { weightUnitSuffix } from '@domain/weightUnits'
import { useWeightUnit } from '@hooks/useWeightUnit'
import { exerciseRepository } from '@repositories/exerciseRepository'
import type { BodyweightLoadMode, Exercise } from '@shared-types/app'

import { formatTimestamp, parseTrackingMethodId } from './exerciseMetadata'
import { emptyExerciseForm, parseExerciseForm } from './programForms'

export function ExerciseFormSheet({
  exercise,
  isOpen,
  onClose,
  onSaved,
}: {
  exercise: Exercise | null
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState(() =>
    exercise
      ? {
          name: exercise.name,
          notes: exercise.notes,
          bodyweightLoadMode:
            exercise.bodyweightLoadMode ?? 'external_weight_only',
          bodyweightPercentage:
            exercise.bodyweightPercentage === null ||
            exercise.bodyweightPercentage === undefined
              ? ''
              : String(exercise.bodyweightPercentage),
          restMinutes: String(Math.floor(exercise.defaultRestSeconds / 60)),
          restSeconds: String(exercise.defaultRestSeconds % 60),
          trackingMethodId: exercise.trackingMethodId,
        }
      : emptyExerciseForm,
  )
  const [error, setError] = useState<string | null>(null)
  const [duplicates, setDuplicates] = useState<Exercise[]>([])
  const parsed = useMemo(() => parseExerciseForm(form), [form])
  const selectedTrackingMethod = getTrackingMethod(form.trackingMethodId)
  const weightUnit = useWeightUnit()

  useEffect(() => {
    let isCurrent = true

    void exerciseRepository
      .findSimilarExerciseNames(form.name, exercise?.id)
      .then((matches) => {
        if (isCurrent) {
          setDuplicates(matches)
        }
      })

    return () => {
      isCurrent = false
    }
  }, [exercise?.id, form.name])

  function update(field: keyof typeof emptyExerciseForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function normalizeRestDuration() {
    const restMinutes = Number(form.restMinutes)
    const restSeconds = Number(form.restSeconds)
    if (
      !Number.isInteger(restMinutes) ||
      restMinutes < 0 ||
      !Number.isInteger(restSeconds) ||
      restSeconds < 0
    ) {
      return
    }

    const totalSeconds = restMinutes * 60 + restSeconds
    setForm((current) => ({
      ...current,
      restMinutes: String(Math.floor(totalSeconds / 60)),
      restSeconds: String(totalSeconds % 60),
    }))
  }

  function saveExercise() {
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }

    const action = exercise
      ? exerciseRepository.updateExercise(exercise.id, parsed.value)
      : exerciseRepository.createExercise(parsed.value)

    void action.then(onSaved).catch((caught: unknown) => {
      setError(
        caught instanceof Error ? caught.message : 'Exercise could not save.',
      )
    })
  }

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={exercise ? 'Edit exercise' : 'Create exercise'}
    >
      <div className="sheet-top-actions">
        <PrimaryButton
          disabled={!parsed.ok}
          type="button"
          onClick={saveExercise}
        >
          Save exercise
        </PrimaryButton>
      </div>
      <FormField id="exercise-name" label="Name">
        <input
          id="exercise-name"
          onChange={(event) => update('name', event.target.value)}
          value={form.name}
        />
      </FormField>
      {duplicates.length ? (
        <StatusMessage tone="warning">
          Similar exercise name already exists. You can still save this exercise
          if it is intentional.
        </StatusMessage>
      ) : null}
      <div className="compact-field-grid">
        <FormField id="exercise-rest-minutes" label="Rest minutes">
          <NumericInput
            id="exercise-rest-minutes"
            onBlur={normalizeRestDuration}
            onChange={(event) => update('restMinutes', event.target.value)}
            pattern="[0-9]*"
            value={form.restMinutes}
          />
        </FormField>
        <FormField id="exercise-rest-seconds" label="Rest seconds">
          <NumericInput
            id="exercise-rest-seconds"
            onBlur={normalizeRestDuration}
            onChange={(event) => update('restSeconds', event.target.value)}
            pattern="[0-9]*"
            value={form.restSeconds}
          />
        </FormField>
      </div>
      <FormField id="tracking-method" label="Tracking preset">
        <select
          id="tracking-method"
          onChange={(event) => {
            const trackingMethodId = parseTrackingMethodId(event.target.value)
            if (trackingMethodId) {
              update('trackingMethodId', trackingMethodId)
            }
          }}
          value={form.trackingMethodId}
        >
          {TRACKING_METHODS.map((method) => (
            <option key={method.id} value={method.id}>
              {method.name}
            </option>
          ))}
        </select>
      </FormField>
      <FormField id="bodyweight-load-mode" label="Effective load">
        <select
          id="bodyweight-load-mode"
          onChange={(event) =>
            update(
              'bodyweightLoadMode',
              event.target.value as BodyweightLoadMode,
            )
          }
          value={form.bodyweightLoadMode}
        >
          <option value="external_weight_only">External weight only</option>
          <option value="bodyweight_plus_external">
            Bodyweight + external weight
          </option>
          <option value="bodyweight_percentage_plus_external">
            Bodyweight percentage + external weight
          </option>
        </select>
      </FormField>
      {form.bodyweightLoadMode === 'bodyweight_percentage_plus_external' ? (
        <FormField id="bodyweight-percentage" label="Bodyweight percentage">
          <NumericInput
            id="bodyweight-percentage"
            onChange={(event) =>
              update('bodyweightPercentage', event.target.value)
            }
            value={form.bodyweightPercentage}
          />
        </FormField>
      ) : null}
      {selectedTrackingMethod ? (
        <div className="tracking-method-panel">
          <p>{selectedTrackingMethod.explanation}</p>
          <div className="macro-row">
            {selectedTrackingMethod.metrics.map((metric) => (
              <span key={metric.key}>
                {metric.label}
                {metric.unit === 'lb'
                  ? ` (${weightUnitSuffix(weightUnit)})`
                  : metric.unit
                    ? ` (${metric.unit})`
                    : ''}
              </span>
            ))}
            <span>RIR</span>
            <span>Completed</span>
          </div>
        </div>
      ) : null}
      <FormField id="exercise-notes" label="Notes">
        <textarea
          id="exercise-notes"
          onChange={(event) => update('notes', event.target.value)}
          value={form.notes}
        />
      </FormField>
      {exercise ? (
        <p className="muted">
          Created {formatTimestamp(exercise.createdAt)} - Updated{' '}
          {formatTimestamp(exercise.updatedAt)} - {exercise.status}
        </p>
      ) : null}
      {error ? <ValidationMessage message={error} /> : null}
    </BottomSheet>
  )
}
