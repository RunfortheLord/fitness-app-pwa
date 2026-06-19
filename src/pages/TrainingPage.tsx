import { Archive, Dumbbell, Edit2, Plus, RotateCcw, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import {
  BottomSheet,
  Card,
  EmptyState,
  FormField,
  IconButton,
  LoadingState,
  NumericInput,
  PageContainer,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  StatusMessage,
  ValidationMessage,
} from '@components/ui'
import { TRACKING_METHODS, getTrackingMethod } from '@domain/trackingMethods'
import {
  exerciseRepository,
  type CreateExerciseInput,
} from '@repositories/exerciseRepository'
import type { Exercise, TrackingMethodId } from '@shared-types/app'

type ExerciseView = 'active' | 'archived'
type SheetState = { type: 'exercise'; exercise: Exercise | null } | null

type ExerciseFormState = {
  name: string
  notes: string
  defaultRestSeconds: string
  trackingMethodId: TrackingMethodId
}

type LoadState = {
  exercises: Exercise[]
  status: 'loading' | 'ready' | 'error'
}

const emptyExerciseForm: ExerciseFormState = {
  name: '',
  notes: '',
  defaultRestSeconds: '120',
  trackingMethodId: 'weight_reps',
}

export function TrainingPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [view, setView] = useState<ExerciseView>('active')
  const [sheet, setSheet] = useState<SheetState>(null)
  const [revision, setRevision] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [loadState, setLoadState] = useState<LoadState>({
    exercises: [],
    status: 'loading',
  })
  const activeSheet =
    searchParams.get('createExercise') === '1'
      ? ({ type: 'exercise', exercise: null } satisfies SheetState)
      : sheet

  useEffect(() => {
    let isCurrent = true

    void exerciseRepository
      .searchExercises({
        includeArchived: view === 'archived',
        query,
      })
      .then((exercises) => {
        if (!isCurrent) {
          return
        }

        setLoadState({
          exercises:
            view === 'archived'
              ? exercises.filter((exercise) => exercise.status === 'archived')
              : exercises,
          status: 'ready',
        })
      })
      .catch(() => {
        if (!isCurrent) {
          return
        }

        setLoadState((current) => ({ ...current, status: 'error' }))
      })

    return () => {
      isCurrent = false
    }
  }, [query, revision, view])

  function reload() {
    setRevision((current) => current + 1)
  }

  return (
    <PageContainer>
      <StatusMessage>
        Programs never advance automatically. Choose workout days manually when
        program workflows are available.
      </StatusMessage>

      <Card title="Active program">
        <EmptyState
          title="No active program"
          message="Program creation and activation are reserved for a later milestone."
          action={<PrimaryButton type="button">Create program</PrimaryButton>}
        />
      </Card>

      <SectionHeader
        title="Exercise library"
        action={
          <IconButton
            aria-label="Create exercise"
            onClick={() => setSheet({ type: 'exercise', exercise: null })}
          >
            <Plus aria-hidden="true" size={20} />
          </IconButton>
        }
      />

      {message ? <StatusMessage tone="success">{message}</StatusMessage> : null}

      <ExerciseLibraryCard
        exercises={loadState.exercises}
        loadStatus={loadState.status}
        onCreateExercise={() => setSheet({ type: 'exercise', exercise: null })}
        onEditExercise={(exercise) => setSheet({ type: 'exercise', exercise })}
        onRestoreExercise={(exercise) => {
          void exerciseRepository.restoreExercise(exercise.id).then(() => {
            setMessage('Exercise restored.')
            reload()
          })
        }}
        query={query}
        setQuery={setQuery}
        setView={setView}
        view={view}
      />

      <SectionHeader
        title="Workout library"
        action={
          <IconButton aria-label="Create workout placeholder">
            <Dumbbell aria-hidden="true" size={20} />
          </IconButton>
        }
      />
      <Card>
        <p className="metric-value metric-value-small">0 workouts</p>
        <p className="muted">
          Workout day cards will use this compact surface.
        </p>
        <div className="button-row">
          <SecondaryButton type="button">Program library</SecondaryButton>
        </div>
      </Card>

      {activeSheet?.type === 'exercise' ? (
        <ExerciseFormSheet
          exercise={activeSheet.exercise}
          isOpen
          onClose={() => {
            setSheet(null)
            if (searchParams.get('createExercise') === '1') {
              setSearchParams({}, { replace: true })
            }
          }}
          onSaved={(action) => {
            setMessage(
              action === 'archived'
                ? 'Exercise archived.'
                : activeSheet.exercise
                  ? 'Exercise updated.'
                  : 'Exercise created.',
            )
            setSheet(null)
            if (searchParams.get('createExercise') === '1') {
              setSearchParams({}, { replace: true })
            }
            reload()
          }}
        />
      ) : null}
    </PageContainer>
  )
}

function ExerciseLibraryCard({
  exercises,
  loadStatus,
  onCreateExercise,
  onEditExercise,
  onRestoreExercise,
  query,
  setQuery,
  setView,
  view,
}: {
  exercises: Exercise[]
  loadStatus: LoadState['status']
  onCreateExercise: () => void
  onEditExercise: (exercise: Exercise) => void
  onRestoreExercise: (exercise: Exercise) => void
  query: string
  setQuery: (query: string) => void
  setView: (view: ExerciseView) => void
  view: ExerciseView
}) {
  return (
    <Card title={view === 'active' ? 'Active exercises' : 'Archived exercises'}>
      <div className="button-row library-filter-row" role="group">
        <SecondaryButton
          aria-pressed={view === 'active'}
          type="button"
          onClick={() => setView('active')}
        >
          Active
        </SecondaryButton>
        <SecondaryButton
          aria-pressed={view === 'archived'}
          type="button"
          onClick={() => setView('archived')}
        >
          Archived
        </SecondaryButton>
      </div>

      <FormField id="exercise-search" label="Search exercises">
        <div className="input-icon-row">
          <Search aria-hidden="true" size={18} />
          <input
            id="exercise-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your exercises"
            type="search"
            value={query}
          />
        </div>
      </FormField>

      {loadStatus === 'loading' ? (
        <LoadingState label="Loading exercises" />
      ) : null}
      {loadStatus === 'error' ? (
        <StatusMessage tone="warning">
          Exercise library could not load.
        </StatusMessage>
      ) : null}

      {loadStatus === 'ready' && exercises.length ? (
        <div className="exercise-list">
          {exercises.map((exercise) => (
            <ExerciseLibraryRow
              exercise={exercise}
              key={exercise.id}
              onEdit={() => onEditExercise(exercise)}
              onRestore={() => onRestoreExercise(exercise)}
            />
          ))}
        </div>
      ) : null}

      {loadStatus === 'ready' && !exercises.length ? (
        <EmptyState
          title={
            query.trim()
              ? 'No exercises found'
              : view === 'active'
                ? 'No exercises yet'
                : 'No archived exercises'
          }
          message={
            view === 'active'
              ? 'Create a custom exercise to use in future programs and workouts.'
              : 'Archived exercises stay available for restore when needed.'
          }
          action={
            view === 'active' ? (
              <SecondaryButton type="button" onClick={onCreateExercise}>
                Create exercise
              </SecondaryButton>
            ) : undefined
          }
        />
      ) : null}
    </Card>
  )
}

function ExerciseLibraryRow({
  exercise,
  onEdit,
  onRestore,
}: {
  exercise: Exercise
  onEdit: () => void
  onRestore: () => void
}) {
  const trackingMethod = getTrackingMethod(exercise.trackingMethodId)

  return (
    <div className="exercise-item">
      <span className="quick-action-icon">
        <Dumbbell aria-hidden="true" size={18} />
      </span>
      <div>
        <strong>{exercise.name}</strong>
        <small>
          {trackingMethod?.name ?? exercise.trackingMethodId} -{' '}
          {exercise.defaultRestSeconds}s rest
        </small>
        <small>{metricSummary(exercise)}</small>
        {exercise.notes ? <small>{exercise.notes}</small> : null}
      </div>
      <div className="row-actions">
        {exercise.status === 'archived' ? (
          <IconButton
            aria-label={`Restore ${exercise.name}`}
            onClick={onRestore}
          >
            <RotateCcw aria-hidden="true" size={18} />
          </IconButton>
        ) : null}
        <IconButton aria-label={`Edit ${exercise.name}`} onClick={onEdit}>
          <Edit2 aria-hidden="true" size={18} />
        </IconButton>
      </div>
    </div>
  )
}

function ExerciseFormSheet({
  exercise,
  isOpen,
  onClose,
  onSaved,
}: {
  exercise: Exercise | null
  isOpen: boolean
  onClose: () => void
  onSaved: (action: 'saved' | 'archived') => void
}) {
  const [form, setForm] = useState(() =>
    exercise
      ? {
          name: exercise.name,
          notes: exercise.notes,
          defaultRestSeconds: String(exercise.defaultRestSeconds),
          trackingMethodId: exercise.trackingMethodId,
        }
      : emptyExerciseForm,
  )
  const [error, setError] = useState<string | null>(null)
  const [duplicates, setDuplicates] = useState<Exercise[]>([])
  const parsed = useMemo(() => parseExerciseForm(form), [form])
  const selectedTrackingMethod = getTrackingMethod(form.trackingMethodId)

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

  function saveExercise() {
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }

    const action = exercise
      ? exerciseRepository.updateExercise(exercise.id, parsed.value)
      : exerciseRepository.createExercise(parsed.value)

    void action
      .then(() => onSaved('saved'))
      .catch((caught: unknown) => {
        setError(
          caught instanceof Error ? caught.message : 'Exercise could not save.',
        )
      })
  }

  function archiveExercise() {
    if (!exercise) {
      return
    }

    void exerciseRepository
      .archiveExercise(exercise.id)
      .then(() => onSaved('archived'))
      .catch((caught: unknown) => {
        setError(
          caught instanceof Error
            ? caught.message
            : 'Exercise could not archive.',
        )
      })
  }

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={exercise ? 'Edit exercise' : 'Create exercise'}
    >
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
      <FormField
        id="exercise-rest"
        label="Default rest time"
        helpText="Seconds. Set 0 when no rest timer is needed."
      >
        <NumericInput
          id="exercise-rest"
          onChange={(event) => update('defaultRestSeconds', event.target.value)}
          value={form.defaultRestSeconds}
        />
      </FormField>
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
      {selectedTrackingMethod ? (
        <div className="tracking-method-panel">
          <p>{selectedTrackingMethod.explanation}</p>
          <div className="macro-row">
            {selectedTrackingMethod.metrics.map((metric) => (
              <span key={metric.key}>
                {metric.label}
                {metric.unit ? ` (${metric.unit})` : ''}
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
      <div className="button-row">
        <PrimaryButton
          disabled={!parsed.ok}
          type="button"
          onClick={saveExercise}
        >
          Save exercise
        </PrimaryButton>
        {exercise?.status === 'active' ? (
          <SecondaryButton
            className="button-danger"
            type="button"
            onClick={archiveExercise}
          >
            <Archive aria-hidden="true" size={18} />
            Archive
          </SecondaryButton>
        ) : null}
      </div>
    </BottomSheet>
  )
}

function parseExerciseForm(
  form: ExerciseFormState,
): { ok: true; value: CreateExerciseInput } | { ok: false; error: string } {
  const name = form.name.trim()
  const defaultRestSeconds = Number(form.defaultRestSeconds)
  const trackingMethod = getTrackingMethod(form.trackingMethodId)

  if (!name) {
    return { ok: false, error: 'Exercise name is required.' }
  }

  if (
    !Number.isFinite(defaultRestSeconds) ||
    defaultRestSeconds < 0 ||
    !Number.isInteger(defaultRestSeconds)
  ) {
    return {
      ok: false,
      error: 'Default rest time must be a whole number of seconds.',
    }
  }

  if (!trackingMethod) {
    return { ok: false, error: 'Tracking preset is required.' }
  }

  return {
    ok: true,
    value: {
      name,
      notes: form.notes.trim(),
      defaultRestSeconds,
      trackingMethodId: trackingMethod.id,
    },
  }
}

function parseTrackingMethodId(value: string) {
  return TRACKING_METHODS.find((method) => method.id === value)?.id ?? null
}

function metricSummary(exercise: Exercise) {
  const metricLabels = exercise.trackingMetrics.map((metric) => metric.label)
  return [...metricLabels, 'RIR', 'Completed'].join(' - ')
}

function formatTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp))
}
