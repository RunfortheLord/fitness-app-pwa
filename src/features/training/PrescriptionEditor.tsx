import { ArrowLeft, Plus, Search } from 'lucide-react'
import { useState } from 'react'

import {
  EmptyState,
  FormField,
  IconButton,
  ModalConfirmationDialog,
  NumericInput,
  PrimaryButton,
  SecondaryButton,
  ValidationMessage,
} from '@components/ui'
import { TRACKING_METHODS } from '@domain/trackingMethods'
import {
  defaultExerciseResults,
  hasSearchableQuery,
  searchExercises,
  type ExerciseUsageSummary,
} from '@domain/exerciseSearch'
import {
  formatWeight as formatWeightWithUnit,
  weightInputValue,
  weightUnitSuffix,
} from '@domain/weightUnits'
import { useWeightUnit } from '@hooks/useWeightUnit'
import { exerciseRepository } from '@repositories/exerciseRepository'
import { programRepository } from '@repositories/programRepository'
import type {
  ActiveCycleWorkoutExercise,
  Exercise,
  TemplateWorkoutExercise,
} from '@shared-types/app'

import {
  exerciseMetadata,
  isRepetitionBased,
  parseTrackingMethodId,
  showsWeightTarget,
} from './exerciseMetadata'
import {
  emptyExerciseForm,
  emptyPrescriptionForm,
  formIsDirty,
  parseExerciseForm,
  parsePrescriptionForm,
  parseRestDuration,
  restFieldsFromSeconds,
  type PrescriptionFormState,
} from './programForms'
import type { BuilderMode } from './types'

export function PrescriptionEditor({
  exerciseUsage,
  exercises,
  mode,
  onClose,
  target,
  onSaved,
}: {
  exerciseUsage: ExerciseUsageSummary
  exercises: Exercise[]
  mode: BuilderMode
  onClose: () => void
  onSaved: () => void
  target: {
    dayId: string
    exercise: TemplateWorkoutExercise | ActiveCycleWorkoutExercise | null
  }
}) {
  const weightUnit = useWeightUnit()
  const [availableExercises, setAvailableExercises] = useState(exercises)
  const [step, setStep] = useState<'search' | 'edit' | 'create'>(
    target.exercise ? 'edit' : 'search',
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [form, setForm] = useState<PrescriptionFormState>(() =>
    target.exercise
      ? (() => {
          const currentExercise = exercises.find(
            (exercise) => exercise.id === target.exercise?.exerciseId,
          )
          const restSeconds =
            currentExercise?.defaultRestSeconds ??
            target.exercise.exerciseSnapshot.defaultRestSeconds
          return {
            exerciseId: target.exercise.exerciseId,
            ...restFieldsFromSeconds(restSeconds),
            targetSetCount: String(target.exercise.targetSetCount),
            targetWeight: weightInputValue(
              target.exercise.targetWeight,
              weightUnit,
              'lifting',
            ),
            targetDurationSeconds:
              target.exercise.targetDurationSeconds?.toString() ?? '',
            targetDistance: target.exercise.targetDistance?.toString() ?? '',
            targetRepsMin: target.exercise.targetRepsMin?.toString() ?? '',
            targetRepsMax: target.exercise.targetRepsMax?.toString() ?? '',
            targetRir: target.exercise.targetRir?.toString() ?? '',
            notes: target.exercise.notes,
          }
        })()
      : emptyPrescriptionForm,
  )
  const [error, setError] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState(emptyExerciseForm)
  const [createError, setCreateError] = useState<string | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const selectedExercise =
    availableExercises.find((exercise) => exercise.id === form.exerciseId) ??
    null
  const parsed = parsePrescriptionForm(form, selectedExercise, weightUnit)
  const searchable = hasSearchableQuery(searchQuery)
  const results = searchable
    ? searchExercises(availableExercises, searchQuery, exerciseUsage)
    : []
  const defaultResults = defaultExerciseResults(
    availableExercises,
    exerciseUsage,
  )
  const isDirty =
    formIsDirty(form, target.exercise, weightUnit, selectedExercise) ||
    step === 'create'

  function update(field: keyof PrescriptionFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function selectExercise(exercise: Exercise) {
    setForm((current) => ({
      ...current,
      exerciseId: exercise.id,
      ...restFieldsFromSeconds(exercise.defaultRestSeconds),
    }))
    setStep('edit')
    setError(null)
  }

  function requestClose() {
    if (isDirty) {
      setConfirmDiscard(true)
      return
    }
    onClose()
  }

  function save() {
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }
    const parsedRest = parseRestDuration(form.restMinutes, form.restSeconds)
    if (!parsedRest.ok) {
      setError(parsedRest.error)
      return
    }
    const savePrescription = (): Promise<unknown> => {
      if (target.exercise) {
        return mode === 'template'
          ? programRepository.updateTemplateExercise(
              target.exercise.id,
              parsed.value,
            )
          : programRepository.updateActiveCycleExercise(
              target.exercise.id,
              parsed.value,
            )
      }
      return mode === 'template'
        ? programRepository.addTemplateExercise(target.dayId, parsed.value)
        : programRepository.addActiveCycleExercise(target.dayId, parsed.value)
    }

    void exerciseRepository
      .updateExerciseDefaultRest(parsed.value.exerciseId, parsedRest.value)
      .then((updatedExercise) => {
        setAvailableExercises((current) =>
          current.map((exercise) =>
            exercise.id === updatedExercise.id ? updatedExercise : exercise,
          ),
        )
        return savePrescription()
      })
      .then(onSaved)
      .catch((caught: unknown) => {
        setError(
          caught instanceof Error
            ? caught.message
            : 'Prescription could not save.',
        )
      })
  }

  function saveCustomExercise() {
    const parsedExercise = parseExerciseForm(createForm)
    if (!parsedExercise.ok) {
      setCreateError(parsedExercise.error)
      return
    }

    void exerciseRepository
      .createExercise(parsedExercise.value)
      .then((created) => {
        setAvailableExercises((current) => [...current, created])
        selectExercise(created)
        setCreateForm(emptyExerciseForm)
        setCreateError(null)
      })
      .catch((caught: unknown) => {
        setCreateError(
          caught instanceof Error ? caught.message : 'Exercise could not save.',
        )
      })
  }

  return (
    <>
      <div className="prescription-workflow" aria-label="Prescription editor">
        <div className="nested-screen-header">
          <IconButton
            aria-label="Back to program editor"
            onClick={requestClose}
          >
            <ArrowLeft aria-hidden="true" size={18} />
          </IconButton>
          <div>
            <h3>{target.exercise ? 'Edit prescription' : 'Add exercise'}</h3>
            <p className="muted">Choose an exercise, then set the target.</p>
          </div>
        </div>

        {step === 'search' ? (
          <div className="exercise-picker">
            <FormField
              id="prescription-exercise-search"
              label="Search exercises"
            >
              <div className="input-icon-row">
                <Search aria-hidden="true" size={18} />
                <input
                  autoFocus
                  id="prescription-exercise-search"
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search at least 2 characters"
                  type="search"
                  value={searchQuery}
                />
              </div>
            </FormField>
            <p className="visually-hidden" role="status">
              {searchable
                ? `${results.length} exercise results`
                : 'Enter at least two characters to search exercises'}
            </p>
            <div className="exercise-result-list">
              {(searchable
                ? results.map((result) => result.exercise)
                : defaultResults
              ).map((exercise) => (
                <ExerciseResultButton
                  exercise={exercise}
                  key={exercise.id}
                  onSelect={() => selectExercise(exercise)}
                />
              ))}
            </div>
            {!searchable && !defaultResults.length ? (
              <EmptyState
                title="Search exercise library"
                message="Type at least two characters to search built-in and custom exercises."
              />
            ) : null}
            {searchable && !results.length ? (
              <EmptyState
                title="No exercises found"
                message="Create a custom exercise if this movement is not in the library."
              />
            ) : null}
            <SecondaryButton type="button" onClick={() => setStep('create')}>
              <Plus aria-hidden="true" size={18} />
              Create custom exercise
            </SecondaryButton>
          </div>
        ) : null}

        {step === 'create' ? (
          <div className="compact-create-exercise">
            <SecondaryButton type="button" onClick={() => setStep('search')}>
              <ArrowLeft aria-hidden="true" size={18} />
              Back to search
            </SecondaryButton>
            <FormField id="picker-exercise-name" label="Name">
              <input
                autoFocus
                id="picker-exercise-name"
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                value={createForm.name}
              />
            </FormField>
            <div className="compact-field-grid">
              <FormField id="picker-rest-minutes" label="Rest minutes">
                <NumericInput
                  id="picker-rest-minutes"
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      restMinutes: event.target.value,
                    }))
                  }
                  pattern="[0-9]*"
                  value={createForm.restMinutes}
                />
              </FormField>
              <FormField id="picker-rest-seconds" label="Rest seconds">
                <NumericInput
                  id="picker-rest-seconds"
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      restSeconds: event.target.value,
                    }))
                  }
                  pattern="[0-9]*"
                  value={createForm.restSeconds}
                />
              </FormField>
            </div>
            <FormField id="picker-tracking-method" label="Tracking preset">
              <select
                id="picker-tracking-method"
                onChange={(event) => {
                  const trackingMethodId = parseTrackingMethodId(
                    event.target.value,
                  )
                  if (trackingMethodId) {
                    setCreateForm((current) => ({
                      ...current,
                      trackingMethodId,
                    }))
                  }
                }}
                value={createForm.trackingMethodId}
              >
                {TRACKING_METHODS.map((method) => (
                  <option key={method.id} value={method.id}>
                    {method.name}
                  </option>
                ))}
              </select>
            </FormField>
            {createError ? <ValidationMessage message={createError} /> : null}
            <PrimaryButton type="button" onClick={saveCustomExercise}>
              Save and select
            </PrimaryButton>
          </div>
        ) : null}

        {step === 'edit' && selectedExercise ? (
          <div className="compact-prescription-form">
            <div className="sheet-top-actions">
              <PrimaryButton disabled={!parsed.ok} type="button" onClick={save}>
                Save prescription
              </PrimaryButton>
            </div>
            {!target.exercise ? (
              <SecondaryButton type="button" onClick={() => setStep('search')}>
                <ArrowLeft aria-hidden="true" size={18} />
                Back to search
              </SecondaryButton>
            ) : null}
            <div className="selected-exercise-summary">
              <strong>{selectedExercise.name}</strong>
              <small>{exerciseMetadata(selectedExercise)}</small>
              <small>
                {selectedExercise.defaultRestSeconds}s rest
                {selectedExercise.defaultWeightIncrement !== null
                  ? ` - ${formatWeightWithUnit(
                      selectedExercise.defaultWeightIncrement,
                      weightUnit,
                      'lifting',
                    )} increment`
                  : ''}
              </small>
            </div>
            <div className="compact-field-grid">
              <FormField id="prescription-rest-minutes" label="Rest minutes">
                <NumericInput
                  id="prescription-rest-minutes"
                  onChange={(event) =>
                    update('restMinutes', event.target.value)
                  }
                  pattern="[0-9]*"
                  value={form.restMinutes}
                />
              </FormField>
              <FormField id="prescription-rest-seconds" label="Rest seconds">
                <NumericInput
                  id="prescription-rest-seconds"
                  onChange={(event) =>
                    update('restSeconds', event.target.value)
                  }
                  pattern="[0-9]*"
                  value={form.restSeconds}
                />
              </FormField>
            </div>
            <div className="compact-field-grid">
              <FormField id="target-sets" label="Sets">
                <NumericInput
                  autoFocus
                  id="target-sets"
                  onChange={(event) =>
                    update('targetSetCount', event.target.value)
                  }
                  value={form.targetSetCount}
                />
              </FormField>
              {showsWeightTarget(selectedExercise) ? (
                <FormField
                  id="target-weight"
                  label={`${
                    selectedExercise.trackingMethodId === 'assisted_weight_reps'
                      ? 'Assistance target'
                      : selectedExercise.trackingMethodId ===
                          'added_weight_reps'
                        ? 'Added-weight target'
                        : 'Weight target'
                  } (${weightUnitSuffix(weightUnit)})`}
                >
                  <NumericInput
                    id="target-weight"
                    onChange={(event) =>
                      update('targetWeight', event.target.value)
                    }
                    value={form.targetWeight}
                  />
                </FormField>
              ) : null}
              {selectedExercise.trackingMethodId === 'distance_duration' ? (
                <FormField id="target-distance" label="Distance target (ft)">
                  <NumericInput
                    id="target-distance"
                    onChange={(event) =>
                      update('targetDistance', event.target.value)
                    }
                    value={form.targetDistance}
                  />
                </FormField>
              ) : null}
            </div>
            {isRepetitionBased(selectedExercise) ? (
              <div className="rep-range-grid">
                <FormField id="target-reps-min" label="Min reps">
                  <NumericInput
                    id="target-reps-min"
                    onChange={(event) =>
                      update('targetRepsMin', event.target.value)
                    }
                    value={form.targetRepsMin}
                  />
                </FormField>
                <FormField id="target-reps-max" label="Max reps">
                  <NumericInput
                    id="target-reps-max"
                    onChange={(event) =>
                      update('targetRepsMax', event.target.value)
                    }
                    value={form.targetRepsMax}
                  />
                </FormField>
              </div>
            ) : null}
            <FormField id="target-rir" label="RIR">
              <NumericInput
                id="target-rir"
                onChange={(event) => update('targetRir', event.target.value)}
                value={form.targetRir}
              />
            </FormField>
            <FormField id="prescription-notes" label="Notes">
              <textarea
                id="prescription-notes"
                onChange={(event) => update('notes', event.target.value)}
                value={form.notes}
              />
            </FormField>
            {error ? <ValidationMessage message={error} /> : null}
            <div className="button-row">
              <SecondaryButton type="button" onClick={requestClose}>
                Cancel
              </SecondaryButton>
            </div>
          </div>
        ) : null}
      </div>
      <ModalConfirmationDialog
        confirmLabel="Discard"
        isOpen={confirmDiscard}
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false)
          onClose()
        }}
        title="Discard prescription changes?"
      >
        <p>Entered prescription values will be discarded.</p>
      </ModalConfirmationDialog>
    </>
  )
}

function ExerciseResultButton({
  exercise,
  onSelect,
}: {
  exercise: Exercise
  onSelect: () => void
}) {
  return (
    <button className="exercise-result-row" onClick={onSelect} type="button">
      <strong>{exercise.name}</strong>
      <small>{exerciseMetadata(exercise)}</small>
    </button>
  )
}
