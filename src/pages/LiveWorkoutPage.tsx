import {
  Check,
  Clock,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RefreshCcw,
  Square,
  TimerOff,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  BottomSheet,
  Card,
  EmptyState,
  FormField,
  IconButton,
  LoadingState,
  ModalConfirmationDialog,
  NumericInput,
  PageContainer,
  PrimaryButton,
  SecondaryButton,
  StatusMessage,
  ValidationMessage,
} from '@components/ui'
import { getRestTimerRemainingSeconds } from '@domain/restTimer'
import { exerciseRepository } from '@repositories/exerciseRepository'
import { workoutRepository } from '@repositories/workoutRepository'
import type {
  Exercise,
  TrackingMetric,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@shared-types/app'

type LiveWorkoutState =
  | { status: 'loading' }
  | { status: 'empty' }
  | {
      status: 'ready'
      workout: Workout
      exercises: WorkoutExercise[]
      setsByExercise: Record<string, WorkoutSet[]>
      previousByExercise: Record<string, WorkoutSet[]>
    }
  | { status: 'error'; message: string }

type ExercisePickerState =
  | { mode: 'add' }
  | { mode: 'replace'; workoutExerciseId: string }
  | null

export function LiveWorkoutPage() {
  const navigate = useNavigate()
  const [state, setState] = useState<LiveWorkoutState>({ status: 'loading' })
  const [revision, setRevision] = useState(0)
  const [now, setNow] = useState(() => new Date())
  const [error, setError] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [picker, setPicker] = useState<ExercisePickerState>(null)

  useEffect(() => {
    let isCurrent = true

    void workoutRepository
      .getActiveWorkoutStructure()
      .then(async (loaded) => {
        if (!isCurrent) {
          return
        }
        if (!loaded) {
          setState({ status: 'empty' })
          return
        }
        const previousEntries = await Promise.all(
          loaded.exercises.map(async (exercise) => [
            exercise.id,
            exercise.exerciseId
              ? await workoutRepository.getPreviousPerformance(
                  exercise.exerciseId,
                  loaded.workout.startedAt,
                )
              : [],
          ]),
        )
        if (!isCurrent) {
          return
        }
        setState({
          status: 'ready',
          workout: loaded.workout,
          exercises: loaded.exercises,
          setsByExercise: loaded.setsByExercise,
          previousByExercise: Object.fromEntries(previousEntries),
        })
      })
      .catch((caught: unknown) => {
        if (!isCurrent) {
          return
        }
        setState({
          status: 'error',
          message:
            caught instanceof Error
              ? caught.message
              : 'Live workout could not load.',
        })
      })

    return () => {
      isCurrent = false
    }
  }, [revision])

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  function reload() {
    setRevision((current) => current + 1)
  }

  function run(action: Promise<unknown>, failure = 'Workout change failed.') {
    void action
      .then(() => {
        setError(null)
        reload()
      })
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : failure)
      })
  }

  if (state.status === 'loading') {
    return (
      <PageContainer>
        <LoadingState label="Loading active workout" />
      </PageContainer>
    )
  }

  if (state.status === 'empty') {
    return (
      <PageContainer>
        <Card>
          <EmptyState
            title="No active workout"
            message="Choose a workout day from the current active cycle to start a live workout."
            action={
              <PrimaryButton
                type="button"
                onClick={() => void navigate('/training')}
              >
                Go to training
              </PrimaryButton>
            }
          />
        </Card>
      </PageContainer>
    )
  }

  if (state.status === 'error') {
    return (
      <PageContainer>
        <StatusMessage tone="warning">{state.message}</StatusMessage>
      </PageContainer>
    )
  }

  const elapsedSeconds = Math.max(
    0,
    Math.floor((now.getTime() - Date.parse(state.workout.startedAt)) / 1000) -
      state.workout.elapsedPausedSeconds,
  )
  const restRemaining = getRestTimerRemainingSeconds(
    state.workout.activeRestTimer,
    now.toISOString(),
  )

  return (
    <PageContainer>
      <Card className="live-workout-hero">
        <div className="live-workout-title-row">
          <div>
            <p className="eyebrow">Live workout</p>
            <h2>{state.workout.name}</h2>
            <p className="muted">
              {state.workout.workoutSnapshot.activeCycleName ?? 'Program'} -{' '}
              {state.workout.workoutSnapshot.dayName}
            </p>
          </div>
          <IconButton
            aria-label="Workout actions"
            onClick={() => setActionsOpen(true)}
          >
            <MoreHorizontal aria-hidden="true" size={20} />
          </IconButton>
        </div>
        <div className="live-workout-stats">
          <span>
            <Clock aria-hidden="true" size={16} />
            {formatDuration(elapsedSeconds)}
          </span>
          <span>{state.workout.localDate}</span>
        </div>
      </Card>

      {error ? <ValidationMessage message={error} /> : null}

      <Card title="Workout notes">
        <textarea
          aria-label="Workout notes"
          onBlur={(event) =>
            run(
              workoutRepository.updateWorkoutNotes(
                state.workout.id,
                event.currentTarget.value,
              ),
            )
          }
          defaultValue={state.workout.notes}
          placeholder="Session notes"
        />
      </Card>

      <RestTimerCard
        onAddTime={() =>
          run(workoutRepository.addRestTimerSeconds(state.workout.id, 30))
        }
        onDismiss={() =>
          run(workoutRepository.dismissRestTimer(state.workout.id))
        }
        onPause={() => run(workoutRepository.pauseRestTimer(state.workout.id))}
        onResume={() =>
          run(workoutRepository.resumeRestTimer(state.workout.id))
        }
        onSkip={() => run(workoutRepository.dismissRestTimer(state.workout.id))}
        remainingSeconds={restRemaining}
        timer={state.workout.activeRestTimer}
      />

      {state.exercises.map((exercise) => (
        <ExerciseCard
          exercise={exercise}
          key={exercise.id}
          onAddSet={() => run(workoutRepository.addSet(exercise.id))}
          onCompleteSet={(set, completed) => {
            const restSeconds =
              set.restSecondsUsed ??
              exercise.exerciseSnapshot.defaultRestSeconds ??
              0
            run(
              workoutRepository
                .updateWorkoutSet(set.id, { completed })
                .then(() =>
                  completed && restSeconds > 0
                    ? workoutRepository.setRestTimer(
                        state.workout.id,
                        restSeconds,
                      )
                    : undefined,
                ),
            )
          }}
          onDeleteSet={(setId) => run(workoutRepository.deleteSet(setId))}
          onReplaceExercise={() =>
            setPicker({ mode: 'replace', workoutExerciseId: exercise.id })
          }
          onSetMetric={(set, metricValues) =>
            run(workoutRepository.updateWorkoutSet(set.id, { metricValues }))
          }
          onSetRir={(set, rir) =>
            run(workoutRepository.updateWorkoutSet(set.id, { rir }))
          }
          onSkip={(skipped) =>
            run(workoutRepository.skipExercise(exercise.id, skipped))
          }
          onUpdateNotes={(notes) =>
            run(
              workoutRepository.updateWorkoutExerciseNotes(exercise.id, notes),
            )
          }
          previous={state.previousByExercise[exercise.id] ?? []}
          sets={state.setsByExercise[exercise.id] ?? []}
        />
      ))}

      <div className="live-workout-finish">
        <SecondaryButton
          type="button"
          onClick={() => setPicker({ mode: 'add' })}
        >
          <Plus aria-hidden="true" size={18} />
          Add Exercise
        </SecondaryButton>
        <PrimaryButton
          type="button"
          onClick={() =>
            run(
              workoutRepository
                .completeWorkout({ workoutId: state.workout.id })
                .then(() => navigate('/history')),
              'Workout could not finish.',
            )
          }
        >
          Finish Workout
        </PrimaryButton>
      </div>

      <BottomSheet
        isOpen={actionsOpen}
        onClose={() => setActionsOpen(false)}
        title="Workout actions"
      >
        <div className="quick-action-list">
          <button type="button" onClick={() => setPicker({ mode: 'add' })}>
            <span className="quick-action-icon">
              <Plus aria-hidden="true" size={20} />
            </span>
            <span>
              <strong>Add Exercise</strong>
              <small>Add an exercise to this active workout only</small>
            </span>
          </button>
          <button type="button" onClick={() => setConfirmCancel(true)}>
            <span className="quick-action-icon">
              <X aria-hidden="true" size={20} />
            </span>
            <span>
              <strong>Cancel Workout</strong>
              <small>Discard this active workout after confirmation</small>
            </span>
          </button>
        </div>
      </BottomSheet>

      <ExercisePickerSheet
        currentWorkoutId={state.workout.id}
        onClose={() => setPicker(null)}
        onSelected={() => {
          setPicker(null)
          reload()
        }}
        picker={picker}
      />

      <ModalConfirmationDialog
        confirmLabel="Cancel Workout"
        isOpen={confirmCancel}
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() => {
          run(
            workoutRepository.cancelWorkout(state.workout.id).then(() => {
              setConfirmCancel(false)
              navigate('/training')
            }),
            'Workout could not be cancelled.',
          )
        }}
        title="Cancel workout?"
      >
        This discards the active workout and its unsaved history entry.
      </ModalConfirmationDialog>
    </PageContainer>
  )
}

function ExerciseCard({
  exercise,
  onAddSet,
  onCompleteSet,
  onDeleteSet,
  onReplaceExercise,
  onSetMetric,
  onSetRir,
  onSkip,
  onUpdateNotes,
  previous,
  sets,
}: {
  exercise: WorkoutExercise
  onAddSet: () => void
  onCompleteSet: (set: WorkoutSet, completed: boolean) => void
  onDeleteSet: (setId: string) => void
  onReplaceExercise: () => void
  onSetMetric: (set: WorkoutSet, values: WorkoutSet['metricValues']) => void
  onSetRir: (set: WorkoutSet, rir: number | null) => void
  onSkip: (skipped: boolean) => void
  onUpdateNotes: (notes: string) => void
  previous: WorkoutSet[]
  sets: WorkoutSet[]
}) {
  const metrics = exercise.exerciseSnapshot.trackingMetrics

  return (
    <Card
      className={exercise.skipped ? 'exercise-card skipped' : 'exercise-card'}
    >
      <div className="exercise-card-header">
        <div>
          <h2>{exercise.exerciseSnapshot.exerciseName}</h2>
          {exercise.skipped ? <p className="muted">Skipped</p> : null}
        </div>
        <div className="row-actions">
          <SecondaryButton type="button" onClick={onReplaceExercise}>
            <RefreshCcw aria-hidden="true" size={16} />
            Replace Exercise
          </SecondaryButton>
          <SecondaryButton
            type="button"
            onClick={() => onSkip(!exercise.skipped)}
          >
            {exercise.skipped ? 'Unskip' : 'Skip Exercise'}
          </SecondaryButton>
        </div>
      </div>

      <FormField id={`${exercise.id}-notes`} label="Exercise notes">
        <textarea
          id={`${exercise.id}-notes`}
          onBlur={(event) => onUpdateNotes(event.currentTarget.value)}
          defaultValue={exercise.notes}
        />
      </FormField>

      <div className="set-list">
        {sets.map((set) => (
          <SetRow
            key={set.id}
            metrics={metrics}
            onComplete={(completed) => onCompleteSet(set, completed)}
            onDelete={() => onDeleteSet(set.id)}
            onMetricChange={(values) => onSetMetric(set, values)}
            onRirChange={(rir) => onSetRir(set, rir)}
            previous={previous[set.setNumber - 1]}
            set={set}
          />
        ))}
      </div>

      <SecondaryButton type="button" onClick={onAddSet}>
        <Plus aria-hidden="true" size={18} />
        Add Set
      </SecondaryButton>
    </Card>
  )
}

function SetRow({
  metrics,
  onComplete,
  onDelete,
  onMetricChange,
  onRirChange,
  previous,
  set,
}: {
  metrics: TrackingMetric[]
  onComplete: (completed: boolean) => void
  onDelete: () => void
  onMetricChange: (values: WorkoutSet['metricValues']) => void
  onRirChange: (rir: number | null) => void
  previous: WorkoutSet | undefined
  set: WorkoutSet
}) {
  return (
    <div className="set-row">
      <div className="set-number">
        <strong>{set.setNumber}</strong>
        <small>
          {previous ? formatSetPerformance(previous, metrics) : 'No previous'}
        </small>
      </div>
      {metrics.map((metric) => (
        <label key={metric.key}>
          <span>{metric.label}</span>
          <NumericInput
            aria-label={`Set ${set.setNumber} ${metric.label}`}
            onBlur={(event) =>
              onMetricChange({
                ...set.metricValues,
                [metric.key]: parseMetricValue(event.currentTarget.value),
              })
            }
            defaultValue={formatMetricInput(set.metricValues[metric.key])}
          />
        </label>
      ))}
      {usesRir(metrics) ? (
        <label>
          <span>RIR</span>
          <NumericInput
            aria-label={`Set ${set.setNumber} RIR`}
            onBlur={(event) =>
              onRirChange(parseNullableNumber(event.currentTarget.value))
            }
            defaultValue={set.rir?.toString() ?? ''}
          />
        </label>
      ) : null}
      <IconButton
        aria-label={`${set.completed ? 'Mark incomplete' : 'Complete'} set ${set.setNumber}`}
        onClick={() => onComplete(!set.completed)}
      >
        {set.completed ? (
          <Check aria-hidden="true" size={18} />
        ) : (
          <Square aria-hidden="true" size={18} />
        )}
      </IconButton>
      <IconButton aria-label={`Delete set ${set.setNumber}`} onClick={onDelete}>
        <Trash2 aria-hidden="true" size={18} />
      </IconButton>
    </div>
  )
}

function RestTimerCard({
  onAddTime,
  onDismiss,
  onPause,
  onResume,
  onSkip,
  remainingSeconds,
  timer,
}: {
  onAddTime: () => void
  onDismiss: () => void
  onPause: () => void
  onResume: () => void
  onSkip: () => void
  remainingSeconds: number
  timer: Workout['activeRestTimer']
}) {
  if (!timer || timer.status === 'dismissed') {
    return null
  }

  return (
    <Card className="rest-timer-card" title="Rest timer">
      <p className="metric-value metric-value-small">
        {formatDuration(remainingSeconds)}
      </p>
      <div className="button-row">
        {timer.status === 'paused' ? (
          <SecondaryButton type="button" onClick={onResume}>
            <Play aria-hidden="true" size={18} />
            Resume
          </SecondaryButton>
        ) : (
          <SecondaryButton type="button" onClick={onPause}>
            <Pause aria-hidden="true" size={18} />
            Pause
          </SecondaryButton>
        )}
        <SecondaryButton type="button" onClick={onAddTime}>
          +30s
        </SecondaryButton>
        <SecondaryButton type="button" onClick={onSkip}>
          <TimerOff aria-hidden="true" size={18} />
          Skip
        </SecondaryButton>
        <SecondaryButton type="button" onClick={onDismiss}>
          Dismiss
        </SecondaryButton>
      </div>
    </Card>
  )
}

function ExercisePickerSheet({
  currentWorkoutId,
  onClose,
  onSelected,
  picker,
}: {
  currentWorkoutId: string
  onClose: () => void
  onSelected: () => void
  picker: ExercisePickerState
}) {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [exerciseId, setExerciseId] = useState('')
  const [keepCompatible, setKeepCompatible] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!picker) {
      return
    }
    void exerciseRepository
      .searchExercises({ includeArchived: false, query: '' })
      .then((loaded) => {
        setExercises(loaded)
        setExerciseId(loaded[0]?.id ?? '')
      })
  }, [picker])

  const title = picker?.mode === 'replace' ? 'Replace Exercise' : 'Add Exercise'

  function save() {
    if (!picker || !exerciseId) {
      setError('Exercise selection is required.')
      return
    }
    const action =
      picker.mode === 'add'
        ? workoutRepository.addExercise({
            workoutId: currentWorkoutId,
            exerciseId,
          })
        : workoutRepository.replaceExercise({
            workoutExerciseId: picker.workoutExerciseId,
            exerciseId,
            keepCompatibleSetValues: keepCompatible,
          })

    void action.then(onSelected).catch((caught: unknown) => {
      setError(
        caught instanceof Error ? caught.message : 'Exercise change failed.',
      )
    })
  }

  return (
    <BottomSheet isOpen={picker !== null} onClose={onClose} title={title}>
      <FormField id="live-exercise-picker" label="Exercise">
        <select
          id="live-exercise-picker"
          onChange={(event) => setExerciseId(event.target.value)}
          value={exerciseId}
        >
          {exercises.map((exercise) => (
            <option key={exercise.id} value={exercise.id}>
              {exercise.name}
            </option>
          ))}
        </select>
      </FormField>
      {picker?.mode === 'replace' ? (
        <label className="checkbox-row">
          <input
            checked={keepCompatible}
            onChange={(event) => setKeepCompatible(event.currentTarget.checked)}
            type="checkbox"
          />
          Keep compatible set values
        </label>
      ) : null}
      {error ? <ValidationMessage message={error} /> : null}
      <PrimaryButton disabled={!exerciseId} type="button" onClick={save}>
        {title}
      </PrimaryButton>
    </BottomSheet>
  )
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function parseMetricValue(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function parseNullableNumber(value: string) {
  const parsed = parseMetricValue(value)
  return typeof parsed === 'number' ? parsed : null
}

function formatMetricInput(value: WorkoutSet['metricValues'][string]) {
  return typeof value === 'number' ? String(value) : ''
}

function formatSetPerformance(set: WorkoutSet, metrics: TrackingMetric[]) {
  const values = metrics
    .map((metric) => {
      const value = set.metricValues[metric.key]
      if (typeof value !== 'number') {
        return null
      }
      return `${value}${metric.unit ? ` ${metric.unit}` : ''}`
    })
    .filter(Boolean)
  return values.length ? values.join(' / ') : 'Previous logged'
}

function usesRir(metrics: TrackingMetric[]) {
  return metrics.some((metric) =>
    ['weight', 'reps', 'assistedWeight'].includes(metric.key),
  )
}
