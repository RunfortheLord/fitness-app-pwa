import {
  BellRing,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Minus,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCcw,
  Search,
  Settings2,
  Square,
  TimerOff,
  Trash2,
  X,
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
import { RestWheelPicker } from '@components/WheelPicker'
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
import { rankedExerciseReplacements } from '@domain/exerciseReplacements'
import { TRACKING_METHODS } from '@domain/trackingMethods'
import {
  formatWeight as formatWeightWithUnit,
  weightInputToLb,
  weightInputValue,
} from '@domain/weightUnits'
import { useRirTracking } from '@hooks/useRirTracking'
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
  | { mode: 'replace'; workoutExerciseId: string; exerciseId: string | null }
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
  const [isFinishing, setIsFinishing] = useState(false)
  const [saveAllChanges, setSaveAllChanges] = useState(false)
  const [timerSound, setTimerSound] = useState({
    bannersEnabled: true,
    enabled: true,
    soundId: DEFAULT_TIMER_SOUND_ID,
  })
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null)
  const pendingWorkoutMutations = useRef(new Set<Promise<unknown>>())
  const autoFinishPromptedRef = useRef(false)

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

  function trackWorkoutMutation<T>(
    action: Promise<T>,
    failure = 'Workout change failed.',
  ) {
    const tracked = action
      .then((result) => {
        setError(null)
        reload()
        return result
      })
      .catch((caught: unknown) => {
        const error = caught instanceof Error ? caught : new Error(failure)
        setError(error.message)
        reload()
        throw error
      })
      .finally(() => pendingWorkoutMutations.current.delete(tracked))
    pendingWorkoutMutations.current.add(tracked)
    return tracked
  }

  function run(action: Promise<unknown>, failure = 'Workout change failed.') {
    void trackWorkoutMutation(action, failure).catch(() => undefined)
  }

  async function waitForPendingWorkoutMutations() {
    while (pendingWorkoutMutations.current.size > 0) {
      await Promise.all([...pendingWorkoutMutations.current])
    }
  }

  async function finishActiveWorkout(workout: Workout) {
    setConfirmFinish(false)
    setIsFinishing(true)
    try {
      await waitForPendingWorkoutMutations()
      const completed = await workoutRepository.completeWorkout({
        workoutId: workout.id,
      })
      let changeSaveFailed = false
      if (completed.detectedChanges.length > 0) {
        const destination = saveAllChanges
          ? workout.sourceTemplateId
            ? 'both'
            : 'cycle_only'
          : 'neither'
        try {
          await workoutRepository.applyDetectedChanges(
            completed.detectedChanges.map((change) => ({
              changeId: change.id,
              destination,
            })),
          )
        } catch {
          changeSaveFailed = true
        }
      }
      await cancelNativeRestTimer()
      const params = new URLSearchParams({ workout: completed.history.id })
      if (changeSaveFailed) {
        params.set('changeSave', 'failed')
      }
      navigate(`/history?${params.toString()}`)
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Workout could not finish.',
      )
    } finally {
      setIsFinishing(false)
    }
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

  function showRestTimerImmediately(
    update: (timer: RestTimerState) => RestTimerState,
  ) {
    setState((current) => {
      if (current.status !== 'ready' || !current.workout.activeRestTimer) {
        return current
      }
      return {
        ...current,
        workout: {
          ...current.workout,
          activeRestTimer: update(current.workout.activeRestTimer),
        },
      }
    })
  }

  function updateRestTimerImmediately(
    update: (timer: RestTimerState) => RestTimerState,
    persist: () => Promise<RestTimerState>,
  ) {
    showRestTimerImmediately(update)
    runRestTimerMutation(persist())
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

  useEffect(() => {
    if (!readyState) {
      return
    }
    const sets = Object.values(readyState.setsByExercise).flat()
    const everySetCompleted =
      sets.length > 0 && sets.every((set) => set.completed)
    if (!everySetCompleted) {
      autoFinishPromptedRef.current = false
      return
    }
    if (!autoFinishPromptedRef.current) {
      autoFinishPromptedRef.current = true
      setSaveAllChanges(false)
      setConfirmFinish(true)
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
        </div>
      </Card>

      <div className="live-workout-session-bar">
        <span className="live-workout-session-time">
          <Clock aria-hidden="true" size={17} />
          {formatDuration(elapsedSeconds)}
        </span>
        <SecondaryButton
          className="button-danger live-workout-discard"
          type="button"
          onClick={() => setConfirmDiscard(true)}
        >
          <Trash2 aria-hidden="true" size={16} />
          {t('Discard workout')}
        </SecondaryButton>
        <PrimaryButton
          className="live-workout-finish"
          disabled={isFinishing}
          type="button"
          onClick={() => {
            setSaveAllChanges(false)
            setConfirmFinish(true)
          }}
        >
          {isFinishing ? t('Saving...') : t('Finish')}
        </PrimaryButton>
      </div>

      {error ? <ValidationMessage message={error} /> : null}
      {nativeTimerMessage ? (
        <div className="live-timer-notice" role="status">
          <BellRing aria-hidden="true" size={17} />
          <span>{nativeTimerMessage}</span>
          <button
            type="button"
            onClick={() => void navigate('/settings?section=notifications')}
          >
            {t('Timer settings')}
          </button>
          <IconButton
            aria-label={t('Dismiss timer notice')}
            onClick={() => setNativeTimerMessage(null)}
          >
            <X aria-hidden="true" size={16} />
          </IconButton>
        </div>
      ) : null}

      {state.exercises.length > 1 ? (
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
      ) : null}

      {activeExercise ? (
        <ExerciseWorkspace
          canGoNext={canGoNext}
          canGoPrevious={canGoPrevious}
          exercise={activeExercise}
          exerciseCount={state.exercises.length}
          exerciseIndex={activeIndex}
          rirTargetOnEverySet={state.workout.trackRirEverySet ?? false}
          key={activeExercise.id}
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
            const changedAt = new Date().toISOString()
            const optimisticTimer =
              completed && hasMoreSetsInExercise && restSeconds > 0
                ? {
                    id: crypto.randomUUID(),
                    startedAt: changedAt,
                    durationSeconds: restSeconds,
                    pausedAt: null,
                    accumulatedPausedSeconds: 0,
                    status: 'running' as const,
                  }
                : state.workout.activeRestTimer
                  ? {
                      ...state.workout.activeRestTimer,
                      pausedAt: null,
                      status: 'dismissed' as const,
                    }
                  : null
            setState((current) => {
              if (current.status !== 'ready') {
                return current
              }
              return {
                ...current,
                workout: {
                  ...current.workout,
                  activeRestTimer: optimisticTimer,
                },
                setsByExercise: {
                  ...current.setsByExercise,
                  [set.workoutExerciseId]: (
                    current.setsByExercise[set.workoutExerciseId] ?? []
                  ).map((candidate) =>
                    candidate.id === set.id
                      ? {
                          ...candidate,
                          completed,
                          completedAt: completed
                            ? (candidate.completedAt ?? changedAt)
                            : null,
                          updatedAt: changedAt,
                        }
                      : candidate,
                  ),
                },
              }
            })
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
          onDeleteSet={(setId) => {
            const deletingLastSet = activeSets.at(-1)?.id === setId
            const timerIsActive =
              state.workout.activeRestTimer?.status === 'running' ||
              state.workout.activeRestTimer?.status === 'paused'
            run(
              workoutRepository.deleteSet(setId).then(async () => {
                if (!deletingLastSet || !timerIsActive) {
                  return
                }
                const timer = await workoutRepository.dismissRestTimer(
                  state.workout.id,
                )
                await syncNativeRestTimer(timer)
              }),
            )
          }}
          onMoveExercise={(offset) => {
            const ids = state.exercises.map((entry) => entry.id)
            const target = activeIndex + offset
            if (target < 0 || target >= ids.length) {
              return
            }
            ;[ids[activeIndex], ids[target]] = [ids[target], ids[activeIndex]]
            run(
              workoutRepository.reorderWorkoutExercises(state.workout.id, ids),
              'Exercise order could not be changed.',
            )
          }}
          onNext={() => selectExercise(activeIndex + 1)}
          onPrevious={() => selectExercise(activeIndex - 1)}
          onReplaceExercise={() =>
            setPicker({
              mode: 'replace',
              workoutExerciseId: activeExercise.id,
              exerciseId: activeExercise.exerciseId,
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
          onSaveNotes={(notes) =>
            trackWorkoutMutation(
              workoutRepository.updateWorkoutExerciseNotes(
                activeExercise.id,
                notes,
              ),
              'Exercise notes could not be saved.',
            )
          }
          onSkip={(skipped) =>
            run(workoutRepository.skipExercise(activeExercise.id, skipped))
          }
          prescription={activePrescription}
          restTimerPanel={
            <RestTimerPanel
              onAddTime={() => {
                updateRestTimerImmediately(
                  (timer) =>
                    timer.status === 'completed'
                      ? {
                          ...timer,
                          startedAt: new Date().toISOString(),
                          durationSeconds: 30,
                          pausedAt: null,
                          accumulatedPausedSeconds: 0,
                          status: 'running',
                        }
                      : {
                          ...timer,
                          durationSeconds: timer.durationSeconds + 30,
                        },
                  () =>
                    workoutRepository.addRestTimerSeconds(state.workout.id, 30),
                )
              }}
              onSubtractTime={() => {
                updateRestTimerImmediately(
                  (timer) => ({
                    ...timer,
                    durationSeconds: Math.max(0, timer.durationSeconds - 30),
                  }),
                  () =>
                    workoutRepository.addRestTimerSeconds(
                      state.workout.id,
                      -30,
                    ),
                )
              }}
              onDismiss={() => {
                updateRestTimerImmediately(
                  (timer) => ({
                    ...timer,
                    pausedAt: null,
                    status: 'dismissed',
                  }),
                  () => workoutRepository.dismissRestTimer(state.workout.id),
                )
              }}
              onPause={() => {
                updateRestTimerImmediately(
                  (timer) =>
                    timer.status === 'running'
                      ? {
                          ...timer,
                          pausedAt: new Date().toISOString(),
                          status: 'paused',
                        }
                      : timer,
                  () => workoutRepository.pauseRestTimer(state.workout.id),
                )
              }}
              onResume={() => {
                updateRestTimerImmediately(
                  (timer) => {
                    if (timer.status !== 'paused' || !timer.pausedAt) {
                      return timer
                    }
                    const resumedAt = new Date().toISOString()
                    return {
                      ...timer,
                      accumulatedPausedSeconds:
                        timer.accumulatedPausedSeconds +
                        Math.max(
                          0,
                          Math.round(
                            (Date.parse(resumedAt) -
                              Date.parse(timer.pausedAt)) /
                              1000,
                          ),
                        ),
                      pausedAt: null,
                      status: 'running',
                    }
                  },
                  () => workoutRepository.resumeRestTimer(state.workout.id),
                )
              }}
              remainingSeconds={restRemaining}
              timer={state.workout.activeRestTimer}
              exerciseDefaultRestSeconds={
                activeExercise.exerciseSnapshot.defaultRestSeconds ?? 0
              }
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
      <div aria-hidden="true" className="live-workout-session-bar-spacer" />

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
        onCancel={() => {
          setConfirmFinish(false)
          setSaveAllChanges(false)
        }}
        onConfirm={() => void finishActiveWorkout(state.workout)}
        title="Finish workout?"
      >
        <p>
          {t(
            'This saves the completed workout to your history and ends the active session.',
          )}
        </p>
        <label className="checkbox-row finish-save-changes">
          <input
            aria-label={t('Save all live workout changes to my program')}
            checked={saveAllChanges}
            onChange={(event) => setSaveAllChanges(event.currentTarget.checked)}
            type="checkbox"
          />
          <span>
            <strong>{t('Save all live workout changes to my program')}</strong>
            <small>
              {t(
                'If changes are detected, save them to the active program and reusable template. Leave unchecked to keep them in workout history only.',
              )}
            </small>
          </span>
        </label>
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
  onMoveExercise,
  onNext,
  onPrevious,
  onReplaceExercise,
  onRemoveExercise,
  onSetMetric,
  onSetRir,
  onSaveNotes,
  onSkip,
  prescription,
  restTimerPanel,
  rirTargetOnEverySet,
  sets,
}: {
  canGoNext: boolean
  canGoPrevious: boolean
  exercise: WorkoutExercise
  exerciseCount: number
  exerciseIndex: number
  rirTargetOnEverySet: boolean
  onAddExercise: () => void
  onAddSet: () => void
  onCompleteSet: (set: WorkoutSet, completed: boolean) => void
  onDeleteSet: (setId: string) => void
  onMoveExercise: (offset: 1 | -1) => void
  onNext: () => void
  onPrevious: () => void
  onReplaceExercise: () => void
  onRemoveExercise: () => void
  onSetMetric: (
    set: WorkoutSet,
    value: { key: string; value: WorkoutSetMetricValue },
  ) => void
  onSetRir: (set: WorkoutSet, rir: number | null) => void
  onSaveNotes: (notes: string) => Promise<unknown>
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
  const exerciseNotes = exercise.notes.trim()
  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const [isSavingNotes, setIsSavingNotes] = useState(false)
  const [notesDraft, setNotesDraft] = useState(exercise.notes)

  async function saveNotes() {
    setIsSavingNotes(true)
    try {
      await onSaveNotes(notesDraft.trim())
      setIsEditingNotes(false)
    } catch {
      // The page-level mutation handler keeps the editor open and shows error.
    } finally {
      setIsSavingNotes(false)
    }
  }

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
        </div>
        {restTimerPanel}
      </div>

      {exerciseCount > 1 ? (
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
      ) : null}

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
            rirTargetOnEverySet={rirTargetOnEverySet}
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
          {t('Swap Exercise')}
        </SecondaryButton>
        <SecondaryButton
          type="button"
          disabled={exerciseIndex === 0}
          onClick={() => onMoveExercise(-1)}
        >
          <ChevronsLeft aria-hidden="true" size={16} />
          {t('Move Earlier')}
        </SecondaryButton>
        <SecondaryButton
          type="button"
          disabled={exerciseIndex >= exerciseCount - 1}
          onClick={() => onMoveExercise(1)}
        >
          {t('Move Later')}
          <ChevronsRight aria-hidden="true" size={16} />
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

      <aside aria-label={t('Exercise notes')} className="live-exercise-notes">
        <div className="live-exercise-notes-header">
          <p className="eyebrow">{t('Exercise notes')}</p>
          {!isEditingNotes ? (
            <IconButton
              aria-label={t('Edit exercise notes')}
              onClick={() => setIsEditingNotes(true)}
            >
              <Pencil aria-hidden="true" size={16} />
            </IconButton>
          ) : null}
        </div>
        {isEditingNotes ? (
          <>
            <textarea
              aria-label={t('Exercise notes')}
              onChange={(event) => setNotesDraft(event.currentTarget.value)}
              rows={3}
              value={notesDraft}
            />
            <div className="live-exercise-notes-actions">
              <SecondaryButton
                disabled={isSavingNotes}
                type="button"
                onClick={() => {
                  setNotesDraft(exercise.notes)
                  setIsEditingNotes(false)
                }}
              >
                {t('Cancel')}
              </SecondaryButton>
              <PrimaryButton
                disabled={isSavingNotes}
                type="button"
                onClick={() => void saveNotes()}
              >
                {isSavingNotes ? t('Saving...') : t('Save notes')}
              </PrimaryButton>
            </div>
          </>
        ) : (
          <p>{exerciseNotes || t('No exercise notes.')}</p>
        )}
      </aside>
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
  rirTargetOnEverySet,
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
  rirTargetOnEverySet: boolean
  set: WorkoutSet
}) {
  const { t } = useLanguage()
  const [validationRequested, setValidationRequested] = useState(false)
  const [rirTouched, setRirTouched] = useState(false)
  const [locallyValidMetricKeys, setLocallyValidMetricKeys] = useState(
    () => new Set<string>(),
  )
  const [rirDraftValid, setRirDraftValid] = useState(false)
  const rirEnabled = useRirTracking()
  const isFinalProgrammedSet = set.id === finalProgrammedSetId
  // RIR is recordable on any set. The prescribed target/required prompt lands
  // on the final programmed set only, unless the program tracks RIR on every
  // set — then every set is a target set.
  const isRirTargetSet = rirTargetOnEverySet || isFinalProgrammedSet
  const showRir = supportsRir(metrics) && rirEnabled
  const repsPerSide = exerciseRecordsRepsPerSide(exercise)
  const invalidMetricKeys = invalidRequiredMetricKeys(set, metrics)
  const effectiveInvalidMetricKeys = new Set(
    [...invalidMetricKeys].filter((key) => !locallyValidMetricKeys.has(key)),
  )
  const isRirInvalid =
    showRir &&
    isRirTargetSet &&
    (set.rir === null || set.rir === undefined) &&
    !rirDraftValid
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
              invalid={effectiveInvalidMetricKeys.has(metric.key)}
              validationRequested={validationRequested}
              onDraftValidityChange={(valid) => {
                setLocallyValidMetricKeys((current) => {
                  const next = new Set(current)
                  if (valid) {
                    next.add(metric.key)
                  } else {
                    next.delete(metric.key)
                  }
                  return next
                })
              }}
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
          <span>{isFinalProgrammedSet ? t('Final RIR') : t('RIR')}</span>
          <NumericInput
            aria-label={
              isFinalProgrammedSet
                ? `Set ${set.setNumber} final RIR`
                : `Set ${set.setNumber} RIR`
            }
            disabled={set.completed}
            aria-invalid={(validationRequested || rirTouched) && isRirInvalid}
            placeholder={
              isRirTargetSet && prescription?.targetRir != null
                ? String(prescription.targetRir)
                : undefined
            }
            onBlur={(event) => {
              setRirTouched(true)
              const rir = parseNullableNumber(event.currentTarget.value)
              setRirDraftValid(
                typeof rir === 'number' && Number.isFinite(rir) && rir >= 0,
              )
              onRirChange(rir)
            }}
            onFocus={(event) => {
              if (event.currentTarget.value) {
                event.currentTarget.select()
              }
            }}
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
        onClick={() => {
          if (
            !set.completed &&
            (effectiveInvalidMetricKeys.size > 0 || isRirInvalid)
          ) {
            setValidationRequested(true)
            return
          }
          setValidationRequested(false)
          onComplete(!set.completed)
        }}
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
      {validationRequested &&
      (effectiveInvalidMetricKeys.size > 0 || isRirInvalid) ? (
        <span className="set-validation-message" role="alert">
          {t('Enter the required set values before completing it.')}
        </span>
      ) : null}
    </div>
  )
}

function MetricNumericInput({
  disabled,
  invalid,
  metricKey,
  onDraftValidityChange,
  onKeyDown,
  onValueChange,
  placeholder,
  validationRequested,
  value,
  valueType,
  ...props
}: Omit<
  React.ComponentProps<typeof NumericInput>,
  'aria-invalid' | 'onChange' | 'value'
> & {
  invalid: boolean
  metricKey: string
  onDraftValidityChange: (valid: boolean) => void
  onValueChange: (value: WorkoutSetMetricValue) => void
  validationRequested: boolean
  value: string
  valueType: TrackingMetric['valueType']
}) {
  const [draft, setDraft] = useState(value)
  const [touched, setTouched] = useState(false)
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
      aria-invalid={invalid && (touched || validationRequested)}
      disabled={disabled}
      onBlur={() => {
        isEditingRef.current = false
        lastPropValueRef.current = value
        setTouched(true)
      }}
      onChange={(event) => {
        const next =
          metricKey === 'durationSeconds'
            ? event.currentTarget.value.replace(/[^\d:]/g, '')
            : valueType === 'integer'
              ? event.currentTarget.value.replace(/\D+/g, '')
              : event.currentTarget.value
        const parsedValue = parseMetricValue(next, valueType, metricKey)
        isEditingRef.current = true
        setDraft(next)
        onDraftValidityChange(
          typeof parsedValue === 'number' &&
            Number.isFinite(parsedValue) &&
            parsedValue >= 0,
        )
        onValueChange(parsedValue)
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
  const [draftRestSeconds, setDraftRestSeconds] = useState(0)

  if (!timer || timer.status === 'dismissed') {
    return null
  }

  function openSettings() {
    setDraftRestSeconds(clampRestPickerSeconds(exerciseDefaultRestSeconds))
    setSettingsOpen(true)
  }

  function saveSettings() {
    onChangeExerciseDefaultRest(draftRestSeconds)
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
            label="Exercise default rest"
          >
            <RestWheelPicker
              minutes={Math.floor(draftRestSeconds / 60)}
              onChange={(minutes, seconds) =>
                setDraftRestSeconds(minutes * 60 + seconds)
              }
              seconds={draftRestSeconds % 60}
            />
          </FormField>
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
  const title = picker?.mode === 'replace' ? 'Swap Exercise' : 'Add Exercise'
  const searchable = hasSearchableQuery(searchQuery)
  const currentExercise =
    picker?.mode === 'replace'
      ? exercises.find((exercise) => exercise.id === picker.exerciseId)
      : undefined
  const results = searchable
    ? searchExercises(exercises, searchQuery).map((result) => result.exercise)
    : picker?.mode === 'replace' && currentExercise
      ? rankedExerciseReplacements({
          candidates: exercises,
          current: currentExercise,
        })
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
            <>
              <p className="muted">Recommended swaps are shown first.</p>
              <p className="muted">Swap exercises start blank.</p>
            </>
          ) : null}
          <p className="visually-hidden" role="status">
            {searchable
              ? `${results.length} exercise results`
              : picker?.mode === 'replace'
                ? `${results.length} recommended exercise swaps`
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

function clampRestPickerSeconds(totalSeconds: number) {
  const maxSeconds = 15 * 60 + 59
  return Math.min(maxSeconds, Math.max(0, Math.round(totalSeconds)))
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
