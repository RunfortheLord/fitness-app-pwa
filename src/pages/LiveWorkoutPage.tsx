import {
  Check,
  ChevronLeft,
  ChevronRight,
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
import { useEffect, useRef, useState, type PointerEvent } from 'react'
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
import { getEffectiveTarget } from '@domain/progressionRecommendations'
import { getRestTimerRemainingSeconds } from '@domain/restTimer'
import { exerciseRepository } from '@repositories/exerciseRepository'
import { workoutRepository } from '@repositories/workoutRepository'
import type {
  Exercise,
  ActiveCycleWorkoutExercise,
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
      sourcePrescriptionsByExercise: Record<string, ActiveCycleWorkoutExercise>
    }
  | { status: 'error'; message: string }

type ExercisePickerState =
  | { mode: 'add' }
  | { mode: 'replace'; workoutExerciseId: string }
  | null

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
  }
}

export function LiveWorkoutPage() {
  const navigate = useNavigate()
  const [state, setState] = useState<LiveWorkoutState>({ status: 'loading' })
  const [revision, setRevision] = useState(0)
  const [now, setNow] = useState(() => new Date())
  const [error, setError] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [picker, setPicker] = useState<ExercisePickerState>(null)
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null)
  const alertedTimerIds = useRef(new Set<string>())

  useEffect(() => {
    let isCurrent = true

    void workoutRepository
      .getActiveWorkoutStructure()
      .then((loaded) => {
        if (!isCurrent) {
          return
        }
        if (!loaded) {
          setState({ status: 'empty' })
          return
        }
        setActiveExerciseId((current) => {
          if (loaded.exercises.some((exercise) => exercise.id === current)) {
            return current
          }
          const storedId = window.localStorage.getItem(
            activeExerciseStorageKey(loaded.workout.id),
          )
          if (loaded.exercises.some((exercise) => exercise.id === storedId)) {
            return storedId
          }
          return loaded.exercises[0]?.id ?? null
        })
        setState({
          status: 'ready',
          workout: loaded.workout,
          exercises: loaded.exercises,
          setsByExercise: loaded.setsByExercise,
          sourcePrescriptionsByExercise: loaded.sourcePrescriptionsByExercise,
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

  const readyState = state.status === 'ready' ? state : null
  const elapsedSeconds = readyState
    ? Math.max(
        0,
        Math.floor(
          (now.getTime() - Date.parse(readyState.workout.startedAt)) / 1000,
        ) - readyState.workout.elapsedPausedSeconds,
      )
    : 0
  const restRemaining = getRestTimerRemainingSeconds(
    readyState?.workout.activeRestTimer ?? null,
    now.toISOString(),
  )
  const activeIndex = readyState
    ? getActiveExerciseIndex(readyState.exercises, activeExerciseId)
    : 0
  const activeExercise = readyState?.exercises[activeIndex]
  const activeSets =
    readyState && activeExercise
      ? (readyState.setsByExercise[activeExercise.id] ?? [])
      : []
  const activePrescription =
    readyState && activeExercise
      ? readyState.sourcePrescriptionsByExercise[activeExercise.id]
      : undefined
  const canGoPrevious = activeIndex > 0
  const canGoNext = readyState
    ? activeIndex < readyState.exercises.length - 1
    : false
  const announcement =
    readyState && activeExercise
      ? `${activeExercise.exerciseSnapshot.exerciseName}, exercise ${
          activeIndex + 1
        } of ${readyState.exercises.length}`
      : ''

  function selectExercise(index: number) {
    const next = readyState?.exercises[index]
    if (!next) {
      return
    }
    setActiveExerciseId(next.id)
  }

  useEffect(() => {
    if (!readyState || !activeExercise) {
      return
    }
    window.localStorage.setItem(
      activeExerciseStorageKey(readyState.workout.id),
      activeExercise.id,
    )
  }, [activeExercise, readyState])

  useEffect(() => {
    const timer = readyState?.workout.activeRestTimer
    if (
      !readyState ||
      !timer ||
      timer.status !== 'running' ||
      restRemaining > 0 ||
      alertedTimerIds.current.has(timer.id)
    ) {
      return
    }
    alertedTimerIds.current.add(timer.id)
    announceRestComplete()
    void workoutRepository
      .completeRestTimer(readyState.workout.id)
      .then(() => setRevision((current) => current + 1))
      .catch((caught: unknown) => {
        setError(
          caught instanceof Error
            ? caught.message
            : 'Rest timer could not be completed.',
        )
      })
  }, [readyState, restRemaining])

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

  return (
    <PageContainer>
      <div aria-live="polite" className="visually-hidden">
        {announcement}
      </div>
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
        onSubtractTime={() =>
          run(workoutRepository.addRestTimerSeconds(state.workout.id, -30))
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

      <ExerciseNavigator
        activeExerciseId={activeExercise?.id ?? null}
        exercises={state.exercises}
        onSelect={(id) => setActiveExerciseId(id)}
      />

      {activeExercise ? (
        <ExerciseWorkspace
          canGoNext={canGoNext}
          canGoPrevious={canGoPrevious}
          exercise={activeExercise}
          exerciseCount={state.exercises.length}
          exerciseIndex={activeIndex}
          onAddSet={() => run(workoutRepository.addSet(activeExercise.id))}
          onCompleteSet={(set, completed) => {
            const restSeconds =
              set.restSecondsUsed ??
              activeExercise.exerciseSnapshot.defaultRestSeconds ??
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
          onNext={() => selectExercise(activeIndex + 1)}
          onPrevious={() => selectExercise(activeIndex - 1)}
          onReplaceExercise={() =>
            setPicker({
              mode: 'replace',
              workoutExerciseId: activeExercise.id,
            })
          }
          onSetMetric={(set, metricValues) =>
            run(workoutRepository.updateWorkoutSet(set.id, { metricValues }))
          }
          onSetRir={(set, rir) =>
            run(workoutRepository.updateWorkoutSet(set.id, { rir }))
          }
          onSetTarget={(set, target) =>
            run(workoutRepository.updateWorkoutSetTarget(set.id, target))
          }
          onSkip={(skipped) =>
            run(workoutRepository.skipExercise(activeExercise.id, skipped))
          }
          onUpdateNotes={(notes) =>
            run(
              workoutRepository.updateWorkoutExerciseNotes(
                activeExercise.id,
                notes,
              ),
            )
          }
          prescription={activePrescription}
          sets={activeSets}
        />
      ) : (
        <Card>
          <EmptyState
            title="No exercises"
            message="Add an exercise to begin logging this workout."
          />
        </Card>
      )}

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
                .then((completed) =>
                  navigate(`/history?workout=${completed.history.id}`),
                ),
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
        onSelected={(selectedExerciseId) => {
          setPicker(null)
          setActiveExerciseId(selectedExerciseId)
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

function ExerciseNavigator({
  activeExerciseId,
  exercises,
  onSelect,
}: {
  activeExerciseId: string | null
  exercises: WorkoutExercise[]
  onSelect: (id: string) => void
}) {
  if (exercises.length <= 1) {
    return null
  }

  return (
    <Card className="exercise-navigator" title="Exercise navigator">
      <div className="exercise-tab-list" role="list">
        {exercises.map((exercise, index) => (
          <button
            aria-current={exercise.id === activeExerciseId ? 'true' : undefined}
            key={exercise.id}
            onClick={() => onSelect(exercise.id)}
            type="button"
          >
            <span>{index + 1}</span>
            <small>{exercise.exerciseSnapshot.exerciseName}</small>
          </button>
        ))}
      </div>
    </Card>
  )
}

function ExerciseWorkspace({
  canGoNext,
  canGoPrevious,
  exercise,
  exerciseCount,
  exerciseIndex,
  onAddSet,
  onCompleteSet,
  onDeleteSet,
  onNext,
  onPrevious,
  onReplaceExercise,
  onSetMetric,
  onSetRir,
  onSetTarget,
  onSkip,
  onUpdateNotes,
  prescription,
  sets,
}: {
  canGoNext: boolean
  canGoPrevious: boolean
  exercise: WorkoutExercise
  exerciseCount: number
  exerciseIndex: number
  onAddSet: () => void
  onCompleteSet: (set: WorkoutSet, completed: boolean) => void
  onDeleteSet: (setId: string) => void
  onNext: () => void
  onPrevious: () => void
  onReplaceExercise: () => void
  onSetMetric: (set: WorkoutSet, values: WorkoutSet['metricValues']) => void
  onSetRir: (set: WorkoutSet, rir: number | null) => void
  onSetTarget: (
    set: WorkoutSet,
    values: Parameters<typeof workoutRepository.updateWorkoutSetTarget>[1],
  ) => void
  onSkip: (skipped: boolean) => void
  onUpdateNotes: (notes: string) => void
  prescription: ActiveCycleWorkoutExercise | undefined
  sets: WorkoutSet[]
}) {
  const metrics = exercise.exerciseSnapshot.trackingMetrics
  const swipe = useSwipeNavigation({ onNext, onPrevious })
  const finalProgrammedSetId = getFinalProgrammedSetId(sets)

  return (
    <Card
      className={
        exercise.skipped ? 'exercise-workspace skipped' : 'exercise-workspace'
      }
      onKeyDown={(event) => {
        if (isInteractiveElement(event.target)) {
          return
        }
        if (event.key === 'ArrowLeft' && canGoPrevious) {
          event.preventDefault()
          onPrevious()
        }
        if (event.key === 'ArrowRight' && canGoNext) {
          event.preventDefault()
          onNext()
        }
      }}
      tabIndex={0}
      {...swipe}
    >
      <div className="exercise-card-header">
        <div>
          <p className="eyebrow">
            Exercise {exerciseIndex + 1} of {exerciseCount}
          </p>
          <h2>{exercise.exerciseSnapshot.exerciseName}</h2>
          {exercise.skipped ? <p className="muted">Skipped</p> : null}
          <p className="muted">{formatPrescriptionSummary(prescription)}</p>
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

      <div className="exercise-stepper" aria-label="Exercise navigation">
        <SecondaryButton
          disabled={!canGoPrevious}
          type="button"
          onClick={onPrevious}
        >
          <ChevronLeft aria-hidden="true" size={18} />
          Previous
        </SecondaryButton>
        <SecondaryButton disabled={!canGoNext} type="button" onClick={onNext}>
          Next
          <ChevronRight aria-hidden="true" size={18} />
        </SecondaryButton>
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
            exercise={exercise}
            finalProgrammedSetId={finalProgrammedSetId}
            key={set.id}
            metrics={metrics}
            onComplete={(completed) => onCompleteSet(set, completed)}
            onDelete={() => onDeleteSet(set.id)}
            onMetricChange={(values) => onSetMetric(set, values)}
            onRirChange={(rir) => onSetRir(set, rir)}
            onTargetChange={(target) => onSetTarget(set, target)}
            prescription={prescription}
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
  exercise,
  finalProgrammedSetId,
  metrics,
  onComplete,
  onDelete,
  onMetricChange,
  onRirChange,
  onTargetChange,
  prescription,
  set,
}: {
  exercise: WorkoutExercise
  finalProgrammedSetId: string | null
  metrics: TrackingMetric[]
  onComplete: (completed: boolean) => void
  onDelete: () => void
  onMetricChange: (values: WorkoutSet['metricValues']) => void
  onRirChange: (rir: number | null) => void
  onTargetChange: (
    values: Parameters<typeof workoutRepository.updateWorkoutSetTarget>[1],
  ) => void
  prescription: ActiveCycleWorkoutExercise | undefined
  set: WorkoutSet
}) {
  const showRir = supportsRir(metrics) && set.id === finalProgrammedSetId
  const repsPerSide = exerciseRecordsRepsPerSide(exercise)
  const effectiveTarget = getEffectiveTarget(set)
  const recommendation = set.targetRecommendation
  const recommendationId = recommendation
    ? `${set.id}-recommendation`
    : undefined
  return (
    <div
      aria-describedby={recommendationId}
      className={recommendation ? 'set-row has-recommendation' : 'set-row'}
    >
      <div className="set-number">
        <strong>Set {set.setNumber}</strong>
        <small>{set.targetSnapshot ? 'Programmed' : 'Added'}</small>
      </div>
      <div className="set-target">
        <span>
          Target
          {recommendation?.userEditedTarget
            ? ' - Edited'
            : recommendation?.suggestedTarget
              ? ' - Suggested'
              : ''}
        </span>
        <strong>
          {formatSetTarget(prescription, metrics, repsPerSide, effectiveTarget)}
        </strong>
      </div>
      {metrics.map((metric) => (
        <label key={metric.key}>
          <span>{formatMetricLabel(metric, repsPerSide)}</span>
          <NumericInput
            aria-label={`Set ${set.setNumber} ${formatMetricLabel(
              metric,
              repsPerSide,
            )}`}
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
      {showRir ? (
        <label>
          <span>Final RIR</span>
          <NumericInput
            aria-label={`Set ${set.setNumber} final RIR`}
            onBlur={(event) =>
              onRirChange(parseNullableNumber(event.currentTarget.value))
            }
            defaultValue={set.rir?.toString() ?? ''}
          />
        </label>
      ) : null}
      <label className="failed-set-toggle">
        <input
          checked={set.metricValues.failed === true}
          onChange={(event) =>
            onMetricChange({
              ...set.metricValues,
              failed: event.currentTarget.checked,
            })
          }
          type="checkbox"
        />
        <span>Failed</span>
      </label>
      <IconButton
        aria-label={`${set.completed ? 'Mark incomplete' : 'Complete'} set ${set.setNumber}`}
        aria-pressed={set.completed}
        className={
          set.completed
            ? 'set-complete-button completed'
            : 'set-complete-button'
        }
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
      {recommendation ? (
        <div className="set-recommendation" id={recommendationId}>
          <p aria-live="polite">{recommendation.explanation}</p>
          {!set.completed &&
          (recommendation.suggestedTarget ||
            recommendation.userEditedTarget) ? (
            <div className="target-edit-grid">
              {effectiveTarget?.targetWeight !== null &&
              effectiveTarget?.targetWeight !== undefined ? (
                <label>
                  <span>Target load</span>
                  <NumericInput
                    aria-label={`Set ${set.setNumber} target load`}
                    defaultValue={String(effectiveTarget.targetWeight)}
                    onBlur={(event) =>
                      onTargetChange({
                        targetWeight: parseNullableNumber(
                          event.currentTarget.value,
                        ),
                      })
                    }
                  />
                </label>
              ) : null}
              {effectiveTarget?.targetRepsMin !== null &&
              effectiveTarget?.targetRepsMin !== undefined ? (
                <label>
                  <span>Target reps</span>
                  <NumericInput
                    aria-label={`Set ${set.setNumber} target reps`}
                    defaultValue={String(effectiveTarget.targetRepsMin)}
                    onBlur={(event) => {
                      const reps = parseNullableNumber(
                        event.currentTarget.value,
                      )
                      onTargetChange({
                        targetRepsMin: reps,
                        targetRepsMax: reps,
                      })
                    }}
                  />
                </label>
              ) : null}
              <SecondaryButton
                type="button"
                onClick={() => onTargetChange({ restoreOriginal: true })}
              >
                Original
              </SecondaryButton>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function RestTimerCard({
  onAddTime,
  onDismiss,
  onPause,
  onResume,
  onSkip,
  onSubtractTime,
  remainingSeconds,
  timer,
}: {
  onAddTime: () => void
  onDismiss: () => void
  onPause: () => void
  onResume: () => void
  onSkip: () => void
  onSubtractTime: () => void
  remainingSeconds: number
  timer: Workout['activeRestTimer']
}) {
  if (!timer || timer.status === 'dismissed') {
    return null
  }

  return (
    <Card className="rest-timer-card" title="Rest timer">
      <p aria-live="polite" className="metric-value metric-value-small">
        {formatDuration(remainingSeconds)}
      </p>
      <p className="muted">
        {timer.status === 'completed'
          ? 'Rest complete'
          : timer.status === 'paused'
            ? 'Timer paused'
            : 'Timer running'}
      </p>
      <div className="button-row">
        {timer.status === 'completed' ? null : timer.status === 'paused' ? (
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
        <SecondaryButton
          disabled={remainingSeconds === 0}
          type="button"
          onClick={onSubtractTime}
        >
          -30s
        </SecondaryButton>
        {timer.status === 'completed' ? null : (
          <SecondaryButton type="button" onClick={onSkip}>
            <TimerOff aria-hidden="true" size={18} />
            Stop
          </SecondaryButton>
        )}
        <SecondaryButton type="button" onClick={onDismiss}>
          Clear
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
  onSelected: (selectedExerciseId: string) => void
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

    void action
      .then((selected) => onSelected(selected.id))
      .catch((caught: unknown) => {
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

function activeExerciseStorageKey(workoutId: string) {
  return `fitness-log.active-exercise.${workoutId}`
}

function getActiveExerciseIndex(
  exercises: WorkoutExercise[],
  activeId: string | null,
) {
  const index = exercises.findIndex((exercise) => exercise.id === activeId)
  return index >= 0 ? index : 0
}

function formatPrescriptionSummary(
  prescription: ActiveCycleWorkoutExercise | undefined,
) {
  if (!prescription) {
    return 'Added during workout'
  }
  const parts = [`${prescription.targetSetCount} sets`]
  const reps = formatRepTarget(prescription)
  if (reps) {
    parts.push(reps)
  }
  if (
    prescription.targetWeight !== null &&
    prescription.targetWeight !== undefined
  ) {
    parts.push(`${prescription.targetWeight} lb`)
  }
  if (
    prescription.targetDurationSeconds !== null &&
    prescription.targetDurationSeconds !== undefined
  ) {
    parts.push(formatDuration(prescription.targetDurationSeconds))
  }
  if (
    prescription.targetDistance !== null &&
    prescription.targetDistance !== undefined
  ) {
    parts.push(`${prescription.targetDistance} ft`)
  }
  return parts.join(' - ')
}

function formatSetTarget(
  prescription: ActiveCycleWorkoutExercise | undefined,
  metrics: TrackingMetric[],
  repsPerSide: boolean,
  effectiveTarget?: ReturnType<typeof getEffectiveTarget>,
) {
  if (!prescription) {
    return 'Open'
  }
  const parts = metrics
    .map((metric) => {
      if (metric.key === 'reps') {
        const reps = effectiveTarget
          ? formatRepTargetFromValues(
              effectiveTarget.targetRepsMin,
              effectiveTarget.targetRepsMax,
            )
          : formatRepTarget(prescription)
        return reps ? (repsPerSide ? `${reps}/side` : reps) : null
      }
      if (
        metric.key === 'weight' ||
        metric.key === 'assistedWeight' ||
        metric.key === 'addedWeight'
      ) {
        const targetWeight =
          effectiveTarget?.targetWeight ?? prescription.targetWeight
        return targetWeight !== null && targetWeight !== undefined
          ? `${formatTargetLoad(metric.key, targetWeight)}`
          : null
      }
      if (metric.key === 'durationSeconds') {
        return prescription.targetDurationSeconds
          ? formatDuration(prescription.targetDurationSeconds)
          : null
      }
      if (metric.key === 'distance') {
        return prescription.targetDistance
          ? `${prescription.targetDistance} ft`
          : null
      }
      return null
    })
    .filter(Boolean)
  return parts.length ? parts.join(' / ') : 'Open'
}

function formatRepTarget(prescription: ActiveCycleWorkoutExercise) {
  return formatRepTargetFromValues(
    prescription.targetRepsMin,
    prescription.targetRepsMax,
  )
}

function formatRepTargetFromValues(min: number | null, max: number | null) {
  if (min !== null && max !== null) {
    return min === max ? `${min} reps` : `${min}-${max} reps`
  }
  if (min !== null) {
    return `${min}+ reps`
  }
  if (max !== null) {
    return `up to ${max} reps`
  }
  return null
}

function formatTargetLoad(metricKey: string, value: number) {
  if (metricKey === 'assistedWeight') {
    return `${value} lb assist`
  }
  if (metricKey === 'addedWeight') {
    return `${value} lb added`
  }
  return `${value} lb`
}

function formatMetricLabel(metric: TrackingMetric, repsPerSide: boolean) {
  if (metric.key === 'reps' && repsPerSide) {
    return 'Reps/side'
  }
  if (metric.key === 'assistedWeight') {
    return 'Assist'
  }
  if (metric.key === 'addedWeight') {
    return 'Added'
  }
  if (metric.key === 'durationSeconds') {
    return 'Duration'
  }
  return metric.label
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

function supportsRir(metrics: TrackingMetric[]) {
  return metrics.some((metric) => metric.key === 'reps')
}

function getFinalProgrammedSetId(sets: WorkoutSet[]) {
  return (
    sets
      .filter((set) => set.targetSnapshot)
      .sort((first, second) => first.setNumber - second.setNumber)
      .at(-1)?.id ?? null
  )
}

function exerciseRecordsRepsPerSide(exercise: WorkoutExercise) {
  return Boolean(
    'recordsRepsPerSide' in exercise.exerciseSnapshot &&
    exercise.exerciseSnapshot.recordsRepsPerSide,
  )
}

function useSwipeNavigation({
  onNext,
  onPrevious,
}: {
  onNext: () => void
  onPrevious: () => void
}) {
  const pointerStart = useRef<{
    x: number
    y: number
    time: number
    ignore: boolean
  } | null>(null)

  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      pointerStart.current = {
        x: event.clientX,
        y: event.clientY,
        time: performance.now(),
        ignore: isInteractiveElement(event.target),
      }
    },
    onPointerUp(event: PointerEvent<HTMLElement>) {
      const start = pointerStart.current
      pointerStart.current = null
      if (!start || start.ignore || isInteractiveElement(event.target)) {
        return
      }
      const dx = event.clientX - start.x
      const dy = event.clientY - start.y
      const elapsed = Math.max(1, performance.now() - start.time)
      const velocity = Math.abs(dx) / elapsed
      const intentional =
        Math.abs(dx) >= 64 &&
        Math.abs(dx) > Math.abs(dy) * 1.35 &&
        velocity >= 0.25
      if (!intentional) {
        return
      }
      if (dx < 0) {
        onNext()
      } else {
        onPrevious()
      }
    },
    onPointerCancel() {
      pointerStart.current = null
    },
  }
}

function isInteractiveElement(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false
  }
  return Boolean(
    target.closest(
      'button, input, select, textarea, a, [contenteditable="true"], [role="slider"]',
    ),
  )
}

function announceRestComplete() {
  if ('vibrate' in navigator) {
    navigator.vibrate?.([160, 80, 160])
  }
  playCompletionTone()
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Rest timer complete')
  }
}

function playCompletionTone() {
  const AudioContextConstructor =
    window.AudioContext ?? window.webkitAudioContext
  if (!AudioContextConstructor) {
    return
  }
  try {
    const context = new AudioContextConstructor()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.frequency.value = 880
    gain.gain.value = 0.04
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.18)
    oscillator.addEventListener('ended', () => void context.close())
  } catch {
    // Browser autoplay policies can reject workout timer audio; vibration and UI still work.
  }
}
