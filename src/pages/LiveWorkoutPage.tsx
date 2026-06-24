import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Pause,
  Play,
  Plus,
  RefreshCcw,
  Search,
  Settings2,
  Square,
  Trash2,
} from 'lucide-react'
import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type PointerEvent,
} from 'react'
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
import {
  DEFAULT_TIMER_SOUND_ID,
  playTimerSoundOnce,
  primeTimerSound,
} from '@domain/timerSounds'
import {
  defaultExerciseResults,
  hasSearchableQuery,
  primaryMuscleLabel,
  searchExercises,
} from '@domain/exerciseSearch'
import { canSkipWorkoutExercise } from '@domain/workoutSkip'
import { exerciseRepository } from '@repositories/exerciseRepository'
import { settingsRepository } from '@repositories/settingsRepository'
import {
  workoutRepository,
  type WorkoutSetMetricValue,
} from '@repositories/workoutRepository'
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
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [confirmFinish, setConfirmFinish] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [picker, setPicker] = useState<ExercisePickerState>(null)
  const [timerSound, setTimerSound] = useState({
    enabled: true,
    soundId: DEFAULT_TIMER_SOUND_ID,
  })
  const [defaultRestSeconds, setDefaultRestSeconds] = useState<number | null>(
    null,
  )
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
    let isCurrent = true
    void settingsRepository.ensureSettings().then((settings) => {
      if (!isCurrent) {
        return
      }
      setTimerSound({
        enabled: settings.timerSoundEnabled ?? true,
        soundId: settings.selectedTimerSoundId ?? DEFAULT_TIMER_SOUND_ID,
      })
      setDefaultRestSeconds(settings.defaultRestSeconds ?? null)
    })
    return () => {
      isCurrent = false
    }
  }, [])

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
    announceRestComplete(timerSound)
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
  }, [readyState, restRemaining, timerSound])

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
            <h2>{state.workout.name}</h2>
            <p className="muted">
              {state.workout.workoutSnapshot.activeCycleName ?? 'Program'}
            </p>
          </div>
          <SecondaryButton
            className="button-danger"
            type="button"
            onClick={() => setConfirmDiscard(true)}
          >
            Discard Workout
          </SecondaryButton>
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
        remainingSeconds={restRemaining}
        timer={state.workout.activeRestTimer}
        defaultRestSeconds={defaultRestSeconds}
        onChangeDefaultRest={(seconds) => {
          setDefaultRestSeconds(seconds)
          void settingsRepository
            .saveDefaultRestSeconds(seconds)
            .catch(() => setError('Default rest time could not be saved.'))
        }}
      />

      <Card className="exercise-navigator" title="Exercises">
        <div className="exercise-tab-list">
          {state.exercises.map((exercise, index) => (
            <button
              aria-current={exercise.id === activeExercise?.id}
              key={exercise.id}
              onClick={() => selectExercise(index)}
              type="button"
            >
              <span>{index + 1}</span>
              <small>{exercise.exerciseSnapshot.exerciseName}</small>
            </button>
          ))}
        </div>
      </Card>

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
              defaultRestSeconds ??
              activeExercise.exerciseSnapshot.defaultRestSeconds ??
              0
            const hasMoreSetsInExercise = activeSets.some(
              (candidate) => candidate.id !== set.id && !candidate.completed,
            )
            // Unlock the selected completion sound synchronously within this
            // tap gesture when a rest timer is about to start, so it can play
            // when the timer later fires without its own user interaction.
            if (completed && hasMoreSetsInExercise && restSeconds > 0) {
              if (timerSound.enabled) {
                primeTimerSound(timerSound.soundId)
              }
            }
            const nextIncompleteExercise = state.exercises.find(
              (exercise) =>
                exercise.id !== activeExercise.id &&
                (state.setsByExercise[exercise.id] ?? []).some(
                  (candidate) => !candidate.completed,
                ),
            )
            run(
              workoutRepository
                .updateWorkoutSet(set.id, { completed })
                .then(async () => {
                  if (!completed) {
                    await workoutRepository.dismissRestTimer(state.workout.id)
                    return
                  }
                  if (hasMoreSetsInExercise && restSeconds > 0) {
                    await workoutRepository.setRestTimer(
                      state.workout.id,
                      restSeconds,
                    )
                    return
                  }
                  await workoutRepository.dismissRestTimer(state.workout.id)
                  if (nextIncompleteExercise) {
                    setActiveExerciseId(nextIncompleteExercise.id)
                  }
                }),
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
          onRemoveExercise={() => setConfirmRemove(true)}
          onSetMetric={(set, metricValues) => {
            run(
              workoutRepository.updateWorkoutSetMetricAndPropagate(
                set.id,
                metricValues.key,
                metricValues.value,
              ),
            )
          }}
          onSetRir={(set, rir) =>
            run(workoutRepository.updateWorkoutSet(set.id, { rir }))
          }
          onSkip={(skipped) =>
            run(workoutRepository.skipExercise(activeExercise.id, skipped))
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
        <PrimaryButton type="button" onClick={() => setConfirmFinish(true)}>
          Finish Workout
        </PrimaryButton>
      </div>

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
        confirmLabel="Discard Workout"
        isOpen={confirmDiscard}
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => {
          run(
            workoutRepository.discardWorkout(state.workout.id).then(() => {
              setConfirmDiscard(false)
              navigate('/training')
            }),
            'Workout could not be discarded.',
          )
        }}
        title="Discard workout?"
      >
        This permanently discards the active workout and all recorded set data.
        It will not appear in history, graphs, or statistics.
      </ModalConfirmationDialog>

      <ModalConfirmationDialog
        cancelLabel="Keep working out"
        confirmLabel="Finish Workout"
        isOpen={confirmFinish}
        onCancel={() => setConfirmFinish(false)}
        onConfirm={() => {
          setConfirmFinish(false)
          run(
            workoutRepository
              .completeWorkout({ workoutId: state.workout.id })
              .then((completed) =>
                navigate(`/history?workout=${completed.history.id}`),
              ),
            'Workout could not finish.',
          )
        }}
        title="Finish workout?"
      >
        This saves the completed workout to your history and ends the active
        session.
      </ModalConfirmationDialog>

      <ModalConfirmationDialog
        confirmLabel="Remove Exercise"
        isOpen={confirmRemove}
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() => {
          if (!activeExercise) {
            setConfirmRemove(false)
            return
          }
          setConfirmRemove(false)
          run(
            workoutRepository.removeExerciseFromLiveWorkout(activeExercise.id),
            'Exercise could not be removed.',
          )
        }}
        title="Remove exercise?"
      >
        Remove{' '}
        {activeExercise?.exerciseSnapshot.exerciseName ?? 'this exercise'} and
        its entered sets from this active workout?
      </ModalConfirmationDialog>
    </PageContainer>
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
  onRemoveExercise,
  onSetMetric,
  onSetRir,
  onSkip,
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
  onRemoveExercise: () => void
  onSetMetric: (
    set: WorkoutSet,
    value: { key: string; value: WorkoutSetMetricValue },
  ) => void
  onSetRir: (set: WorkoutSet, rir: number | null) => void
  onSkip: (skipped: boolean) => void
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
            className="button-danger"
            type="button"
            onClick={onRemoveExercise}
          >
            Remove Exercise
          </SecondaryButton>
          <SecondaryButton
            type="button"
            disabled={!exercise.skipped && !canSkipWorkoutExercise(sets)}
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

      <div className="set-list">
        {sets.map((set) => (
          <SetRow
            exercise={exercise}
            finalProgrammedSetId={finalProgrammedSetId}
            key={set.id}
            metrics={metrics}
            onComplete={(completed) => onCompleteSet(set, completed)}
            onDelete={() => onDeleteSet(set.id)}
            onMetricChange={(key, value) => onSetMetric(set, { key, value })}
            onRirChange={(rir) => onSetRir(set, rir)}
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
  prescription,
  set,
}: {
  exercise: WorkoutExercise
  finalProgrammedSetId: string | null
  metrics: TrackingMetric[]
  onComplete: (completed: boolean) => void
  onDelete: () => void
  onMetricChange: (key: string, value: WorkoutSetMetricValue) => void
  onRirChange: (rir: number | null) => void
  prescription: ActiveCycleWorkoutExercise | undefined
  set: WorkoutSet
}) {
  const showRir = supportsRir(metrics) && set.id === finalProgrammedSetId
  const repsPerSide = exerciseRecordsRepsPerSide(exercise)
  const invalidMetricKeys = invalidRequiredMetricKeys(set, metrics)
  return (
    <div className={set.completed ? 'set-row completed' : 'set-row'}>
      <div className="set-number">
        <strong>{set.setNumber}</strong>
      </div>
      {metrics.map((metric) => (
        <label key={metric.key}>
          <span>{formatMetricLabel(metric, repsPerSide)}</span>
          <MetricNumericInput
            aria-label={`Set ${set.setNumber} ${formatMetricLabel(
              metric,
              repsPerSide,
            )}`}
            disabled={set.completed}
            invalid={invalidMetricKeys.has(metric.key)}
            onValueChange={(value) => onMetricChange(metric.key, value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                event.currentTarget.blur()
              }
            }}
            placeholder={
              metric.key === 'reps'
                ? (formatRepTargetPlaceholder(prescription) ?? undefined)
                : undefined
            }
            metricKey={metric.key}
            value={formatMetricInput(set.metricValues[metric.key], metric.key)}
            valueType={metric.valueType}
          />
        </label>
      ))}
      {showRir ? (
        <label>
          <span>Final RIR</span>
          <NumericInput
            aria-label={`Set ${set.setNumber} final RIR`}
            disabled={set.completed}
            aria-invalid={
              showRir && (set.rir === null || set.rir === undefined)
            }
            onBlur={(event) =>
              onRirChange(parseNullableNumber(event.currentTarget.value))
            }
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                event.currentTarget.blur()
              }
            }}
            defaultValue={set.rir?.toString() ?? ''}
          />
        </label>
      ) : null}
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
    </div>
  )
}

function MetricNumericInput({
  disabled,
  invalid,
  metricKey,
  onKeyDown,
  onValueChange,
  placeholder,
  value,
  valueType,
  ...props
}: Omit<
  React.ComponentProps<typeof NumericInput>,
  'aria-invalid' | 'onChange' | 'value'
> & {
  invalid: boolean
  metricKey: string
  onValueChange: (value: WorkoutSetMetricValue) => void
  value: string
  valueType: TrackingMetric['valueType']
}) {
  const [draft, setDraft] = useState(value)
  const isEditingRef = useRef(false)
  const lastPropValueRef = useRef(value)

  useEffect(() => {
    if (value === lastPropValueRef.current) {
      return
    }
    lastPropValueRef.current = value
    if (!isEditingRef.current) {
      setDraft(value)
    }
  }, [value])

  function selectCurrentValue(event: FocusEvent<HTMLInputElement>) {
    if (event.currentTarget.value) {
      event.currentTarget.select()
    }
  }

  return (
    <NumericInput
      {...props}
      aria-invalid={invalid}
      disabled={disabled}
      onBlur={() => {
        isEditingRef.current = false
        lastPropValueRef.current = value
      }}
      onChange={(event) => {
        const next =
          metricKey === 'durationSeconds'
            ? event.currentTarget.value.replace(/[^\d:]/g, '')
            : valueType === 'integer'
              ? event.currentTarget.value.replace(/\D+/g, '')
              : event.currentTarget.value
        isEditingRef.current = true
        setDraft(next)
        onValueChange(parseMetricValue(next, valueType, metricKey))
      }}
      onFocus={(event) => {
        isEditingRef.current = true
        selectCurrentValue(event)
      }}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      value={draft}
    />
  )
}

function RestTimerCard({
  defaultRestSeconds,
  onAddTime,
  onChangeDefaultRest,
  onDismiss,
  onPause,
  onResume,
  onSubtractTime,
  remainingSeconds,
  timer,
}: {
  defaultRestSeconds: number | null
  onAddTime: () => void
  onChangeDefaultRest: (seconds: number | null) => void
  onDismiss: () => void
  onPause: () => void
  onResume: () => void
  onSubtractTime: () => void
  remainingSeconds: number
  timer: Workout['activeRestTimer']
}) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [draftRest, setDraftRest] = useState('')

  if (!timer || timer.status === 'dismissed') {
    return null
  }

  function openSettings() {
    setDraftRest(defaultRestSeconds != null ? String(defaultRestSeconds) : '')
    setSettingsOpen(true)
  }

  function saveSettings() {
    const trimmed = draftRest.trim()
    if (trimmed === '') {
      onChangeDefaultRest(null)
    } else {
      const parsed = Number(trimmed)
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return
      }
      onChangeDefaultRest(Math.round(parsed))
    }
    setSettingsOpen(false)
  }

  return (
    <Card className="rest-timer-card" title="Rest timer">
      <div className="rest-timer-header">
        <IconButton
          aria-label="Rest timer settings"
          aria-expanded={settingsOpen}
          type="button"
          onClick={() =>
            settingsOpen ? setSettingsOpen(false) : openSettings()
          }
        >
          <Settings2 aria-hidden="true" size={18} />
        </IconButton>
      </div>
      {settingsOpen ? (
        <div className="rest-timer-settings">
          <FormField id="default-rest-seconds" label="Default rest (seconds)">
            <NumericInput
              id="default-rest-seconds"
              onChange={(event) => setDraftRest(event.target.value)}
              placeholder="e.g. 90"
              value={draftRest}
            />
          </FormField>
          <p className="muted">
            Applies to rest timers that start after a set. Leave blank to use
            each exercise&rsquo;s own default.
          </p>
          <div className="button-row">
            <SecondaryButton
              type="button"
              onClick={() => setSettingsOpen(false)}
            >
              Cancel
            </SecondaryButton>
            <PrimaryButton type="button" onClick={saveSettings}>
              Save
            </PrimaryButton>
          </div>
        </div>
      ) : null}
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
        <div className="timer-adjust-row" aria-label="Timer adjustment">
          <SecondaryButton
            aria-label="Subtract 30 seconds"
            disabled={remainingSeconds === 0}
            type="button"
            onClick={onSubtractTime}
          >
            -30
          </SecondaryButton>
          <SecondaryButton
            aria-label="Add 30 seconds"
            type="button"
            onClick={onAddTime}
          >
            +30
          </SecondaryButton>
        </div>
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
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [lastPicker, setLastPicker] = useState(picker)

  // Reset the search field each time the picker opens or changes mode. Adjusting
  // state during render (React's recommended alternative to an effect) keeps the
  // lint rule happy and avoids a cascading render.
  if (picker !== lastPicker) {
    setLastPicker(picker)
    setSearchQuery('')
    setError(null)
  }

  useEffect(() => {
    if (!picker) {
      return
    }
    void exerciseRepository
      .searchExercises({ includeArchived: false, query: '' })
      .then(setExercises)
  }, [picker])

  const title = picker?.mode === 'replace' ? 'Replace Exercise' : 'Add Exercise'
  const searchable = hasSearchableQuery(searchQuery)
  const results = searchable
    ? searchExercises(exercises, searchQuery).map((result) => result.exercise)
    : defaultExerciseResults(exercises)

  function choose(exerciseId: string) {
    if (!picker) {
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
            keepCompatibleSetValues: false,
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
    <BottomSheet
      isOpen={picker !== null}
      onClose={onClose}
      title={title}
      variant="page"
    >
      <FormField id="live-exercise-search" label="Search exercises">
        <div className="input-icon-row">
          <Search aria-hidden="true" size={18} />
          <input
            autoFocus
            id="live-exercise-search"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search at least 2 characters"
            type="search"
            value={searchQuery}
          />
        </div>
      </FormField>
      {picker?.mode === 'replace' ? (
        <p className="muted">Replacement exercises start blank.</p>
      ) : null}
      <p className="visually-hidden" role="status">
        {searchable
          ? `${results.length} exercise results`
          : 'Enter at least two characters to search exercises'}
      </p>
      {error ? <ValidationMessage message={error} /> : null}
      <div className="exercise-result-list">
        {results.map((exercise) => (
          <button
            className="exercise-result-row"
            key={exercise.id}
            onClick={() => choose(exercise.id)}
            type="button"
          >
            <strong>{exercise.name}</strong>
            {exercise.primaryMuscleGroups[0] ? (
              <small>
                {primaryMuscleLabel(exercise.primaryMuscleGroups[0])}
              </small>
            ) : null}
          </button>
        ))}
      </div>
      {searchable && !results.length ? (
        <EmptyState
          title="No exercises found"
          message="Try a different search term."
        />
      ) : !searchable && !results.length ? (
        <EmptyState
          title="Search exercise library"
          message="Type at least two characters to find an exercise to add."
        />
      ) : null}
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

function formatRepTarget(prescription: ActiveCycleWorkoutExercise | undefined) {
  if (!prescription) {
    return null
  }
  return formatRepTargetFromValues(
    prescription.targetRepsMin,
    prescription.targetRepsMax,
  )
}

function formatRepTargetPlaceholder(
  prescription: ActiveCycleWorkoutExercise | undefined,
) {
  if (!prescription) {
    return null
  }
  const min = prescription.targetRepsMin
  const max = prescription.targetRepsMax
  if (min !== null && max !== null) {
    return min === max ? `${min}` : `${min}-${max}`
  }
  if (min !== null) {
    return `${min}`
  }
  if (max !== null) {
    return `${max}`
  }
  return null
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

function parseMetricValue(
  value: string,
  valueType: TrackingMetric['valueType'] = 'number',
  metricKey = '',
) {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  if (metricKey === 'durationSeconds') {
    return parseDurationInput(trimmed)
  }
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null
  }
  if (valueType === 'integer' && !Number.isInteger(parsed)) {
    return null
  }
  return parsed
}

function parseDurationInput(value: string) {
  const parts = value.split(':')
  if (parts.length === 1) {
    const parsed = Number(parts[0])
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
  }
  if (parts.length !== 2) {
    return null
  }
  const [minutesValue, secondsValue] = parts
  const minutes = Number(minutesValue)
  const seconds = Number(secondsValue)
  if (
    !Number.isInteger(minutes) ||
    !Number.isInteger(seconds) ||
    minutes < 0 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null
  }
  return minutes * 60 + seconds
}

function parseNullableNumber(value: string) {
  const parsed = parseMetricValue(value)
  return typeof parsed === 'number' ? parsed : null
}

function formatMetricInput(
  value: WorkoutSet['metricValues'][string],
  metricKey = '',
) {
  if (typeof value !== 'number') {
    return ''
  }
  return metricKey === 'durationSeconds' ? formatDuration(value) : String(value)
}

function supportsRir(metrics: TrackingMetric[]) {
  return metrics.some((metric) => metric.key === 'reps')
}

function invalidRequiredMetricKeys(set: WorkoutSet, metrics: TrackingMetric[]) {
  if (set.completed) {
    return new Set<string>()
  }
  return new Set(
    metrics
      .filter((metric) => {
        if (!metric.requiredForCompletion) {
          return false
        }
        const value = set.metricValues[metric.key]
        return typeof value !== 'number' || !Number.isFinite(value) || value < 0
      })
      .map((metric) => metric.key),
  )
}

function getFinalProgrammedSetId(sets: WorkoutSet[]) {
  const bySetNumber = (first: WorkoutSet, second: WorkoutSet) =>
    first.setNumber - second.setNumber
  const programmed = sets.filter((set) => set.targetSnapshot).sort(bySetNumber)
  if (programmed.length) {
    return programmed.at(-1)?.id ?? null
  }
  // Exercises added during a live workout have no programmed target, so no set
  // carries a targetSnapshot. Still expose the RIR field on the final set so it
  // can be recorded even when an RIR was never specified.
  return [...sets].sort(bySetNumber).at(-1)?.id ?? null
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

function announceRestComplete(timerSound: {
  enabled: boolean
  soundId: string
}) {
  if ('vibrate' in navigator) {
    navigator.vibrate?.(180)
  }
  if (timerSound.enabled) {
    void playTimerSoundOnce(timerSound.soundId).catch(() => {
      // Browser autoplay policies can reject timer audio; the visual completion state remains authoritative.
    })
  }
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Rest timer complete')
  }
}
