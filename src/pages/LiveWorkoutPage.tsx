import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Minus,
  Pause,
  Play,
  Plus,
  RefreshCcw,
  Search,
  Settings2,
  Square,
  TimerOff,
  Trash2,
} from 'lucide-react'
import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type PointerEvent,
  type ReactNode,
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
import { useLanguage } from '@components/languageContextValue'
import { getRestTimerRemainingSeconds } from '@domain/restTimer'
import { DEFAULT_TIMER_SOUND_ID, preloadTimerSound } from '@domain/timerSounds'
import {
  defaultExerciseResults,
  hasSearchableQuery,
  primaryMuscleLabel,
  searchExercises,
} from '@domain/exerciseSearch'
import { canSkipWorkoutExercise } from '@domain/workoutSkip'
import { TRACKING_METHODS } from '@domain/trackingMethods'
import {
  formatWeight as formatWeightWithUnit,
  weightInputToLb,
  weightInputValue,
} from '@domain/weightUnits'
import { useWeightUnit } from '@hooks/useWeightUnit'
import { exerciseRepository } from '@repositories/exerciseRepository'
import { settingsRepository } from '@repositories/settingsRepository'
import {
  nativeRestTimerNotificationService,
  type NativeRestTimerNotificationStatus,
} from '@services/nativeRestTimerNotificationService'
import {
  webPushRestTimerNotificationService,
  type WebPushRestTimerNotificationStatus,
} from '@services/webPushRestTimerNotificationService'
import {
  workoutRepository,
  type WorkoutSetMetricValue,
} from '@repositories/workoutRepository'
import type {
  Exercise,
  ActiveCycleWorkoutExercise,
  TrackingMetric,
  TrackingMethodId,
  WeightUnit,
  RestTimerState,
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
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [state, setState] = useState<LiveWorkoutState>({ status: 'loading' })
  const [revision, setRevision] = useState(0)
  const [now, setNow] = useState(() => new Date())
  const [error, setError] = useState<string | null>(null)
  const [nativeTimerMessage, setNativeTimerMessage] = useState<string | null>(
    null,
  )
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [confirmFinish, setConfirmFinish] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [picker, setPicker] = useState<ExercisePickerState>(null)
  const [timerSound, setTimerSound] = useState({
    bannersEnabled: true,
    enabled: true,
    soundId: DEFAULT_TIMER_SOUND_ID,
  })
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null)

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
        bannersEnabled: settings.timerBannersEnabled ?? true,
        enabled: settings.timerSoundEnabled ?? true,
        soundId: settings.selectedTimerSoundId ?? DEFAULT_TIMER_SOUND_ID,
      })
      if (settings.timerSoundEnabled ?? true) {
        preloadTimerSound(
          settings.selectedTimerSoundId ?? DEFAULT_TIMER_SOUND_ID,
        )
      }
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

  async function syncNativeRestTimer(
    timer: RestTimerState,
    requestPermission = false,
  ) {
    try {
      const nativeStatus = timerSound.bannersEnabled
        ? await nativeRestTimerNotificationService.sync(timer, {
            requestPermission,
            soundEnabled: timerSound.enabled,
          })
        : await nativeRestTimerNotificationService.cancel()
      const webPushStatus =
        nativeStatus === 'unavailable'
          ? timerSound.bannersEnabled
            ? await webPushRestTimerNotificationService.sync(timer)
            : await webPushRestTimerNotificationService.cancel()
          : 'unavailable'
      setNativeTimerMessage(
        nativeTimerStatusMessage(nativeStatus) ??
          webPushTimerStatusMessage(webPushStatus),
      )
    } catch {
      setNativeTimerMessage(
        'The outside-app timer alert could not be scheduled.',
      )
    }
  }

  function runRestTimerMutation(
    action: Promise<RestTimerState>,
    requestPermission = false,
  ) {
    run(
      action.then((timer) => syncNativeRestTimer(timer, requestPermission)),
      'Rest timer could not be updated.',
    )
  }

  function saveActiveExerciseDefaultRest(seconds: number) {
    if (!activeExercise?.exerciseId) {
      setError('Exercise default rest time could not be saved.')
      return
    }
    const exerciseId = activeExercise.exerciseId
    const workoutExerciseId = activeExercise.id
    void Promise.all([
      exerciseRepository.updateExerciseDefaultRest(exerciseId, seconds),
      workoutRepository.updateWorkoutExerciseDefaultRest(
        workoutExerciseId,
        seconds,
      ),
    ])
      .then(() => {
        setError(null)
        setState((current) => {
          if (current.status !== 'ready') {
            return current
          }
          return {
            ...current,
            exercises: current.exercises.map((exercise) =>
              exercise.id === workoutExerciseId
                ? {
                    ...exercise,
                    exerciseSnapshot: {
                      ...exercise.exerciseSnapshot,
                      defaultRestSeconds: seconds,
                    },
                  }
                : exercise,
            ),
          }
        })
      })
      .catch((caught: unknown) => {
        setError(
          caught instanceof Error
            ? caught.message
            : 'Exercise default rest time could not be saved.',
        )
      })
  }

  async function cancelNativeRestTimer() {
    try {
      const nativeStatus = await nativeRestTimerNotificationService.cancel()
      if (nativeStatus === 'unavailable') {
        await webPushRestTimerNotificationService.cancel()
      }
      setNativeTimerMessage(null)
    } catch {
      setNativeTimerMessage(
        'The pending outside-app timer alert could not be canceled.',
      )
    }
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
    function reloadCompletedTimer(event: Event) {
      if (!(event instanceof CustomEvent) || !readyState) {
        return
      }
      const detail: unknown = event.detail
      if (
        detail &&
        typeof detail === 'object' &&
        'workoutId' in detail &&
        detail.workoutId === readyState.workout.id
      ) {
        setRevision((current) => current + 1)
      }
    }

    window.addEventListener(
      'fitness-log:rest-timer-completed',
      reloadCompletedTimer,
    )
    return () => {
      window.removeEventListener(
        'fitness-log:rest-timer-completed',
        reloadCompletedTimer,
      )
    }
  }, [readyState])

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
              {state.workout.workoutSnapshot.activeCycleName ?? t('Program')}
            </p>
          </div>
          <div className="live-workout-header-actions">
            <PrimaryButton type="button" onClick={() => setConfirmFinish(true)}>
              Finish Workout
            </PrimaryButton>
            <SecondaryButton
              className="button-danger"
              type="button"
              onClick={() => setConfirmDiscard(true)}
            >
              {t('Discard Workout')}
            </SecondaryButton>
          </div>
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
      {nativeTimerMessage ? (
        <StatusMessage tone="warning">{nativeTimerMessage}</StatusMessage>
      ) : null}

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
          onAddExercise={() => setPicker({ mode: 'add' })}
          onAddSet={() => run(workoutRepository.addSet(activeExercise.id))}
          onCompleteSet={(set, completed) => {
            const restSeconds =
              set.restSecondsUsed ??
              activeExercise.exerciseSnapshot.defaultRestSeconds ??
              0
            const hasMoreSetsInExercise = activeSets.some(
              (candidate) => candidate.id !== set.id && !candidate.completed,
            )
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
                    const timer = await workoutRepository.dismissRestTimer(
                      state.workout.id,
                    )
                    await syncNativeRestTimer(timer)
                    return
                  }
                  if (hasMoreSetsInExercise && restSeconds > 0) {
                    const timer = await workoutRepository.setRestTimer(
                      state.workout.id,
                      restSeconds,
                    )
                    await syncNativeRestTimer(timer, true)
                    return
                  }
                  const timer = await workoutRepository.dismissRestTimer(
                    state.workout.id,
                  )
                  await syncNativeRestTimer(timer)
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
          restTimerPanel={
            <RestTimerPanel
              onAddTime={() =>
                runRestTimerMutation(
                  workoutRepository.addRestTimerSeconds(state.workout.id, 30),
                )
              }
              onSubtractTime={() =>
                runRestTimerMutation(
                  workoutRepository.addRestTimerSeconds(state.workout.id, -30),
                )
              }
              onDismiss={() =>
                runRestTimerMutation(
                  workoutRepository.dismissRestTimer(state.workout.id),
                )
              }
              onPause={() =>
                runRestTimerMutation(
                  workoutRepository.pauseRestTimer(state.workout.id),
                )
              }
              onResume={() =>
                runRestTimerMutation(
                  workoutRepository.resumeRestTimer(state.workout.id),
                )
              }
              remainingSeconds={restRemaining}
              timer={state.workout.activeRestTimer}
              exerciseDefaultRestSeconds={
                activeExercise.exerciseSnapshot.defaultRestSeconds ?? 0
              }
              exerciseName={activeExercise.exerciseSnapshot.exerciseName}
              onChangeExerciseDefaultRest={saveActiveExerciseDefaultRest}
            />
          }
          sets={activeSets}
        />
      ) : (
        <Card>
          <EmptyState
            title="No exercises"
            message="Add an exercise to begin logging this workout."
            action={
              <PrimaryButton
                type="button"
                onClick={() => setPicker({ mode: 'add' })}
              >
                <Plus aria-hidden="true" size={18} />
                {t('Add Exercise')}
              </PrimaryButton>
            }
          />
        </Card>
      )}

      <ExercisePickerSheet
        currentWorkoutId={state.workout.id}
        existingExerciseIds={state.exercises
          .map((exercise) => exercise.exerciseId)
          .filter((id): id is string => id !== null)}
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
            workoutRepository
              .discardWorkout(state.workout.id)
              .then(() => cancelNativeRestTimer())
              .then(() => {
                setConfirmDiscard(false)
                navigate('/training')
              }),
            'Workout could not be discarded.',
          )
        }}
        title="Discard workout?"
      >
        {t(
          'This permanently discards the active workout and all recorded set data. It will not appear in history, graphs, or statistics.',
        )}
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
              .then(async (completed) => {
                await cancelNativeRestTimer()
                navigate(`/history?workout=${completed.history.id}`)
              }),
            'Workout could not finish.',
          )
        }}
        title="Finish workout?"
      >
        {t(
          'This saves the completed workout to your history and ends the active session.',
        )}
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
        {t('Remove {name} and its entered sets from this active workout?', {
          name:
            activeExercise?.exerciseSnapshot.exerciseName ?? t('this exercise'),
        })}
      </ModalConfirmationDialog>
    </PageContainer>
  )
}

function nativeTimerStatusMessage(status: NativeRestTimerNotificationStatus) {
  switch (status) {
    case 'denied':
      return 'Outside-app timer alerts are disabled. Allow notifications for this app in iPhone Settings.'
    case 'permission-required':
      return 'Allow notifications to receive rest-timer alerts outside the app.'
    case 'unavailable':
    case 'granted':
    case 'scheduled':
    case 'canceled':
    case 'expired':
      return null
  }
}

function webPushTimerStatusMessage(status: WebPushRestTimerNotificationStatus) {
  switch (status) {
    case 'denied':
      return 'Outside-app timer alerts are disabled. Allow notifications for this app in iPhone Settings.'
    case 'install-required':
      return 'Install this app on the Home Screen before enabling outside-app timer alerts.'
    case 'permission-required':
      return 'Enable outside-app timer alerts in Settings before leaving the app.'
    case 'not-configured':
      return 'Outside-app timer alerts are not configured on this deployment.'
    case 'failed':
      return 'The outside-app timer alert could not be scheduled. Check your internet connection.'
    case 'unavailable':
    case 'granted':
    case 'scheduled':
    case 'canceled':
    case 'expired':
      return null
  }
}

function ExerciseWorkspace({
  canGoNext,
  canGoPrevious,
  exercise,
  exerciseCount,
  exerciseIndex,
  onAddExercise,
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
  restTimerPanel,
  sets,
}: {
  canGoNext: boolean
  canGoPrevious: boolean
  exercise: WorkoutExercise
  exerciseCount: number
  exerciseIndex: number
  onAddExercise: () => void
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
  restTimerPanel: ReactNode
  sets: WorkoutSet[]
}) {
  const { t } = useLanguage()
  const metrics = exercise.exerciseSnapshot.trackingMetrics
  const swipe = useSwipeNavigation({ onNext, onPrevious })
  const weightUnit = useWeightUnit()
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
        <div className="exercise-title-block">
          <p className="eyebrow">
            {t('Exercise {current} of {total}', {
              current: exerciseIndex + 1,
              total: exerciseCount,
            })}
          </p>
          <h2>{exercise.exerciseSnapshot.exerciseName}</h2>
          {exercise.skipped ? <p className="muted">{t('Skipped')}</p> : null}
          <p className="muted">
            {formatPrescriptionSummary(prescription, weightUnit)}
          </p>
          {prescription?.notes ? (
            <p className="muted">{prescription.notes}</p>
          ) : null}
        </div>
        {restTimerPanel}
      </div>

      <div className="exercise-stepper" aria-label={t('Exercise navigation')}>
        <SecondaryButton
          disabled={!canGoPrevious}
          type="button"
          onClick={onPrevious}
        >
          <ChevronLeft aria-hidden="true" size={18} />
          {t('Previous')}
        </SecondaryButton>
        <SecondaryButton disabled={!canGoNext} type="button" onClick={onNext}>
          {t('Next')}
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
        {t('Add Set')}
      </SecondaryButton>

      <div
        className="exercise-management-actions"
        aria-label={t('Exercise actions')}
      >
        <SecondaryButton type="button" onClick={onAddExercise}>
          <Plus aria-hidden="true" size={16} />
          {t('Add Exercise')}
        </SecondaryButton>
        <SecondaryButton type="button" onClick={onReplaceExercise}>
          <RefreshCcw aria-hidden="true" size={16} />
          {t('Replace Exercise')}
        </SecondaryButton>
        <SecondaryButton
          className="button-danger"
          type="button"
          onClick={onRemoveExercise}
        >
          {t('Remove Exercise')}
        </SecondaryButton>
        <SecondaryButton
          type="button"
          disabled={!exercise.skipped && !canSkipWorkoutExercise(sets)}
          onClick={() => onSkip(!exercise.skipped)}
        >
          {t(exercise.skipped ? 'Unskip' : 'Skip Exercise')}
        </SecondaryButton>
      </div>
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
  const { t } = useLanguage()
  const showRir = supportsRir(metrics) && set.id === finalProgrammedSetId
  const repsPerSide = exerciseRecordsRepsPerSide(exercise)
  const invalidMetricKeys = invalidRequiredMetricKeys(set, metrics)
  const weightUnit = useWeightUnit()
  return (
    <div className={set.completed ? 'set-row completed' : 'set-row'}>
      <div className="set-number">
        <strong>{set.setNumber}</strong>
      </div>
      {metrics.map((metric) => {
        // Weight metrics (unit "lb") persist in canonical pounds; show and read
        // them in the user's display unit while leaving reps/duration untouched.
        const isWeightMetric = metric.unit === 'lb'
        const storedValue = set.metricValues[metric.key]
        return (
          <label key={metric.key}>
            <span>{formatMetricLabel(metric, repsPerSide)}</span>
            <MetricNumericInput
              aria-label={`Set ${set.setNumber} ${formatMetricLabel(
                metric,
                repsPerSide,
              )}`}
              disabled={set.completed}
              invalid={invalidMetricKeys.has(metric.key)}
              onValueChange={(value) =>
                onMetricChange(
                  metric.key,
                  isWeightMetric && typeof value === 'number'
                    ? weightInputToLb(value, weightUnit)
                    : value,
                )
              }
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
              value={
                isWeightMetric
                  ? weightInputValue(
                      typeof storedValue === 'number' ? storedValue : null,
                      weightUnit,
                      'lifting',
                    )
                  : formatMetricInput(storedValue, metric.key)
              }
              valueType={metric.valueType}
            />
          </label>
        )
      })}
      {showRir ? (
        <label>
          <span>{t('Final RIR')}</span>
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

function RestTimerPanel({
  exerciseDefaultRestSeconds,
  exerciseName,
  onAddTime,
  onChangeExerciseDefaultRest,
  onDismiss,
  onPause,
  onResume,
  onSubtractTime,
  remainingSeconds,
  timer,
}: {
  exerciseDefaultRestSeconds: number
  exerciseName: string
  onAddTime: () => void
  onChangeExerciseDefaultRest: (seconds: number) => void
  onDismiss: () => void
  onPause: () => void
  onResume: () => void
  onSubtractTime: () => void
  remainingSeconds: number
  timer: Workout['activeRestTimer']
}) {
  const { t } = useLanguage()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [draftRest, setDraftRest] = useState('')

  if (!timer || timer.status === 'dismissed') {
    return null
  }

  function openSettings() {
    setDraftRest(String(exerciseDefaultRestSeconds))
    setSettingsOpen(true)
  }

  function saveSettings() {
    const trimmed = draftRest.trim()
    const parsed = Number(trimmed)
    if (!trimmed || !Number.isFinite(parsed) || parsed < 0) {
      return
    }
    onChangeExerciseDefaultRest(Math.round(parsed))
    setSettingsOpen(false)
  }

  const timerStatus =
    timer.status === 'completed'
      ? t('Rest complete')
      : timer.status === 'paused'
        ? t('Timer paused')
        : t('Timer running')

  return (
    <>
      <div className="rest-timer-toolbar" aria-label={t('Rest timer')}>
        <span
          aria-label={`${timerStatus}: ${formatDuration(remainingSeconds)}`}
          aria-live="polite"
          className="rest-timer-readout"
          title={timerStatus}
        >
          <Clock aria-hidden="true" size={17} />
          <span>{formatDuration(remainingSeconds)}</span>
        </span>
        {timer.status === 'completed' ? null : timer.status === 'paused' ? (
          <IconButton
            aria-label={t('Resume')}
            title={t('Resume')}
            type="button"
            onClick={onResume}
          >
            <Play aria-hidden="true" size={17} />
          </IconButton>
        ) : (
          <IconButton
            aria-label={t('Pause')}
            title={t('Pause')}
            type="button"
            onClick={onPause}
          >
            <Pause aria-hidden="true" size={17} />
          </IconButton>
        )}
        <IconButton
          aria-label="Subtract 30 seconds"
          disabled={remainingSeconds === 0}
          title="Subtract 30 seconds"
          type="button"
          onClick={onSubtractTime}
        >
          <Minus aria-hidden="true" size={17} />
        </IconButton>
        <IconButton
          aria-label="Add 30 seconds"
          title="Add 30 seconds"
          type="button"
          onClick={onAddTime}
        >
          <Plus aria-hidden="true" size={17} />
        </IconButton>
        <IconButton
          aria-label="Clear rest timer"
          title="Clear rest timer"
          type="button"
          onClick={onDismiss}
        >
          <TimerOff aria-hidden="true" size={17} />
        </IconButton>
        <IconButton
          aria-label="Rest timer settings"
          aria-expanded={settingsOpen}
          title="Rest timer settings"
          type="button"
          onClick={openSettings}
        >
          <Settings2 aria-hidden="true" size={17} />
        </IconButton>
      </div>

      <BottomSheet
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Rest timer settings"
      >
        <div className="rest-timer-settings-form">
          <FormField
            id="exercise-default-rest-seconds"
            label="Exercise default rest (seconds)"
          >
            <NumericInput
              id="exercise-default-rest-seconds"
              onChange={(event) => setDraftRest(event.target.value)}
              placeholder="e.g. 90"
              value={draftRest}
            />
          </FormField>
          <p className="muted">
            {t(
              `Saved to ${exerciseName || 'this exercise'} and reused anywhere this exercise appears.`,
            )}
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
      </BottomSheet>
    </>
  )
}

function ExercisePickerSheet({
  currentWorkoutId,
  existingExerciseIds,
  onClose,
  onSelected,
  picker,
}: {
  currentWorkoutId: string
  existingExerciseIds: string[]
  onClose: () => void
  onSelected: (selectedExerciseId: string) => void
  picker: ExercisePickerState
}) {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newTrackingMethodId, setNewTrackingMethodId] =
    useState<TrackingMethodId>('weight_reps')
  const [lastPicker, setLastPicker] = useState(picker)

  // Reset the search field each time the picker opens or changes mode. Adjusting
  // state during render (React's recommended alternative to an effect) keeps the
  // lint rule happy and avoids a cascading render.
  if (picker !== lastPicker) {
    setLastPicker(picker)
    setSearchQuery('')
    setError(null)
    setCreating(false)
    setNewName('')
    setNewTrackingMethodId('weight_reps')
  }

  useEffect(() => {
    if (!picker) {
      return
    }
    void exerciseRepository
      .searchExercises({ includeArchived: false, query: '' })
      .then(setExercises)
  }, [picker])

  // Only the "add" flow guards against duplicates; replacing intentionally swaps
  // one exercise for another and may legitimately reuse a name already present.
  const blockedExerciseIds =
    picker?.mode === 'add' ? new Set(existingExerciseIds) : new Set<string>()
  const title = picker?.mode === 'replace' ? 'Replace Exercise' : 'Add Exercise'
  const searchable = hasSearchableQuery(searchQuery)
  const results = searchable
    ? searchExercises(exercises, searchQuery).map((result) => result.exercise)
    : defaultExerciseResults(exercises)

  function choose(exerciseId: string) {
    if (!picker) {
      return
    }
    if (blockedExerciseIds.has(exerciseId)) {
      setError('That exercise is already in this workout.')
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

  function createAndChoose() {
    if (!newName.trim()) {
      setError('Exercise name is required.')
      return
    }
    void exerciseRepository
      .createExercise({
        name: newName,
        defaultRestSeconds: 120,
        trackingMethodId: newTrackingMethodId,
      })
      .then((created) => choose(created.id))
      .catch((caught: unknown) => {
        setError(
          caught instanceof Error
            ? caught.message
            : 'Custom exercise could not be created.',
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
      {creating ? (
        <>
          <FormField id="live-new-exercise-name" label="Exercise name">
            <input
              autoFocus
              id="live-new-exercise-name"
              onChange={(event) => setNewName(event.target.value)}
              placeholder="e.g. Cable Pull-Through"
              type="text"
              value={newName}
            />
          </FormField>
          <FormField id="live-new-exercise-tracking" label="Tracking method">
            <select
              id="live-new-exercise-tracking"
              onChange={(event) =>
                setNewTrackingMethodId(event.target.value as TrackingMethodId)
              }
              value={newTrackingMethodId}
            >
              {TRACKING_METHODS.map((method) => (
                <option key={method.id} value={method.id}>
                  {method.name}
                </option>
              ))}
            </select>
          </FormField>
          <p className="muted">
            Added as a custom exercise. Edit muscle groups and defaults later in
            Training.
          </p>
          {error ? <ValidationMessage message={error} /> : null}
          <div className="button-row">
            <SecondaryButton
              type="button"
              onClick={() => {
                setCreating(false)
                setError(null)
              }}
            >
              Cancel
            </SecondaryButton>
            <PrimaryButton type="button" onClick={createAndChoose}>
              Create &amp; add
            </PrimaryButton>
          </div>
        </>
      ) : (
        <>
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
            {results.map((exercise) => {
              const alreadyAdded = blockedExerciseIds.has(exercise.id)
              return (
                <button
                  className="exercise-result-row"
                  disabled={alreadyAdded}
                  key={exercise.id}
                  onClick={() => choose(exercise.id)}
                  type="button"
                >
                  <strong>{exercise.name}</strong>
                  {alreadyAdded ? (
                    <small>Already in workout</small>
                  ) : exercise.primaryMuscleGroups[0] ? (
                    <small>
                      {primaryMuscleLabel(exercise.primaryMuscleGroups[0])}
                    </small>
                  ) : null}
                </button>
              )
            })}
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
          <SecondaryButton
            className="live-create-exercise-button"
            type="button"
            onClick={() => {
              setError(null)
              setNewName(searchable ? searchQuery.trim() : '')
              setCreating(true)
            }}
          >
            <Plus aria-hidden="true" size={18} />
            Create custom exercise
          </SecondaryButton>
        </>
      )}
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
  unit: WeightUnit = 'lb',
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
    parts.push(formatWeightWithUnit(prescription.targetWeight, unit, 'lifting'))
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
