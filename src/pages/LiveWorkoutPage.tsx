import {
  Check,
  Clock,
  Ellipsis,
  Minus,
  NotebookPen,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCcw,
  Search,
  Square,
  TimerOff,
  Trash2,
} from 'lucide-react'
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
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
  PageContainer,
  PrimaryButton,
  SecondaryButton,
  StatusMessage,
  ValidationMessage,
} from '@components/ui'
import {
  SortableDragHandle,
  SortableList,
  SortableListItem,
} from '@components/SortableList'
import {
  LiveWorkoutNumericInput,
  LiveWorkoutNumericKeypadProvider,
} from '@components/LiveWorkoutNumericInput'
import { RestWheelPicker } from '@components/WheelPicker'
import { useLanguage } from '@components/languageContextValue'
import type { LiveWorkoutNumericKeypadMode } from '@domain/liveWorkoutKeypad'
import {
  getRestTimerRemainingSeconds,
  updateRestTimerDuration,
} from '@domain/restTimer'
import { DEFAULT_TIMER_SOUND_ID, preloadTimerSound } from '@domain/timerSounds'
import { buildSetMetricPropagationUpdates } from '@domain/setPropagation'
import {
  defaultExerciseResults,
  hasSearchableQuery,
  primaryMuscleLabel,
  searchExercises,
} from '@domain/exerciseSearch'
import {
  canSkipWorkoutExercise,
  hasPendingWorkoutExerciseWork,
} from '@domain/workoutSkip'
import {
  formatClockDuration as formatDuration,
  workoutElapsedSeconds,
} from '@domain/workoutTiming'
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
import { trackAnalyticsEvent } from '@services/analyticsService'
import { nativeRestTimerNotificationService } from '@services/nativeRestTimerNotificationService'
import { webPushRestTimerNotificationService } from '@services/webPushRestTimerNotificationService'
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

type LiveExercisePrescription = Pick<
  ActiveCycleWorkoutExercise,
  | 'targetSetCount'
  | 'targetWeight'
  | 'targetDurationSeconds'
  | 'targetDistance'
  | 'targetRepsMin'
  | 'targetRepsMax'
  | 'targetRir'
>

type LivePrescriptionInput = Pick<
  LiveExercisePrescription,
  'targetSetCount' | 'targetRepsMin' | 'targetRepsMax'
> & { targetRir?: number | null }

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
  }
}

export function LiveWorkoutPage() {
  return (
    <LiveWorkoutNumericKeypadProvider>
      <LiveWorkoutPageContent />
    </LiveWorkoutNumericKeypadProvider>
  )
}

function LiveWorkoutPageContent() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [state, setState] = useState<LiveWorkoutState>({ status: 'loading' })
  const [revision, setRevision] = useState(0)
  const [now, setNow] = useState(() => new Date())
  const [error, setError] = useState<string | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [isDiscarding, setIsDiscarding] = useState(false)
  const [isWorkoutPauseBusy, setIsWorkoutPauseBusy] = useState(false)
  const [isRestTimerSheetOpen, setIsRestTimerSheetOpen] = useState(false)
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
  const [workspaceEnterDirection, setWorkspaceEnterDirection] = useState<
    'next' | 'previous' | null
  >(null)
  const pendingWorkoutMutations = useRef(new Set<Promise<unknown>>())
  const restDurationMutationChain = useRef<Promise<void>>(Promise.resolve())
  const deletingSetIds = useRef(new Set<string>())
  const discardInProgressRef = useRef(false)
  const finishInProgressRef = useRef(false)
  const pendingOptimisticMutations = useRef(0)
  const autoFinishPromptedRef = useRef(false)
  const exerciseTabListRef = useRef<HTMLDivElement>(null)
  const [exerciseTabOverflow, setExerciseTabOverflow] = useState({
    left: false,
    right: false,
  })

  useEffect(() => {
    const isReady = state.status === 'ready'
    document.documentElement.classList.toggle('live-workout-open', isReady)
    document.body.classList.toggle('live-workout-open', isReady)
    return () => {
      document.documentElement.classList.remove('live-workout-open')
      document.body.classList.remove('live-workout-open')
    }
  }, [state.status])

  useEffect(() => {
    let isCurrent = true

    void workoutRepository
      .getActiveWorkoutStructure()
      .then((loaded) => {
        if (!isCurrent || discardInProgressRef.current) {
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
        if (!isCurrent || discardInProgressRef.current) {
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
    const list = exerciseTabListRef.current
    if (!list || state.status !== 'ready') {
      return
    }

    const updateOverflow = () => {
      const maxScrollLeft = Math.max(0, list.scrollWidth - list.clientWidth)
      const left = list.scrollLeft > 2
      const right = list.scrollLeft < maxScrollLeft - 2
      setExerciseTabOverflow((current) => {
        if (current.left === left && current.right === right) {
          return current
        }
        return { left, right }
      })
    }
    updateOverflow()
    list.addEventListener('scroll', updateOverflow, { passive: true })
    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(updateOverflow)
    resizeObserver?.observe(list)
    return () => {
      list.removeEventListener('scroll', updateOverflow)
      resizeObserver?.disconnect()
    }
  }, [state])

  useEffect(() => {
    if (!activeExerciseId) {
      return
    }
    const list = exerciseTabListRef.current
    const activeTab = list?.querySelector<HTMLElement>(
      `[data-exercise-id="${activeExerciseId}"]`,
    )
    activeTab?.scrollIntoView?.({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'nearest',
    })
  }, [activeExerciseId])

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
    if (discardInProgressRef.current) {
      return
    }
    setRevision((current) => current + 1)
  }

  function trackWorkoutMutation<T>(
    action: Promise<T>,
    failure = 'Workout change failed.',
  ) {
    const tracked = action
      .then((result) => {
        setError(null)
        if (pendingOptimisticMutations.current === 0) {
          reload()
        }
        return result
      })
      .catch((caught: unknown) => {
        const error = caught instanceof Error ? caught : new Error(failure)
        setError(error.message)
        if (pendingOptimisticMutations.current === 0) {
          reload()
        }
        throw error
      })
      .finally(() => pendingWorkoutMutations.current.delete(tracked))
    pendingWorkoutMutations.current.add(tracked)
    return tracked
  }

  function run(action: Promise<unknown>, failure = 'Workout change failed.') {
    void trackWorkoutMutation(action, failure).catch(() => undefined)
  }

  function trackOptimisticMutation<T>(action: Promise<T>) {
    pendingOptimisticMutations.current += 1
    return action.finally(() => {
      pendingOptimisticMutations.current = Math.max(
        0,
        pendingOptimisticMutations.current - 1,
      )
    })
  }

  function updateSetMetricOptimistically(
    setId: string,
    metricKey: string,
    value: WorkoutSetMetricValue,
  ) {
    const updatedAt = new Date().toISOString()
    setState((current) => {
      if (current.status !== 'ready') {
        return current
      }
      const sourceSet = Object.values(current.setsByExercise)
        .flat()
        .find((set) => set.id === setId)
      if (!sourceSet) {
        return current
      }
      const allSets = current.setsByExercise[sourceSet.workoutExerciseId] ?? []
      const updatesById = new Map(
        buildSetMetricPropagationUpdates({
          allSets,
          sourceSet,
          metricKey,
          value,
        }).map((update) => [update.setId, update]),
      )
      return {
        ...current,
        setsByExercise: {
          ...current.setsByExercise,
          [sourceSet.workoutExerciseId]: allSets.map((set) => {
            const update = updatesById.get(set.id)
            return update
              ? {
                  ...set,
                  metricValues: update.metricValues,
                  metricValueSources: update.metricValueSources,
                  updatedAt,
                }
              : set
          }),
        },
      }
    })
  }

  function updateSetRirOptimistically(setId: string, rir: number | null) {
    const updatedAt = new Date().toISOString()
    setState((current) => {
      if (current.status !== 'ready') {
        return current
      }
      const setsByExercise = Object.fromEntries(
        Object.entries(current.setsByExercise).map(([exerciseId, sets]) => [
          exerciseId,
          sets.map((set) =>
            set.id === setId ? { ...set, rir, updatedAt } : set,
          ),
        ]),
      )
      return { ...current, setsByExercise }
    })
  }

  function deleteSetOptimistically(workoutExerciseId: string, setId: string) {
    setState((current) => {
      if (current.status !== 'ready') {
        return current
      }
      const remaining = (current.setsByExercise[workoutExerciseId] ?? [])
        .filter((set) => set.id !== setId)
        .map((set, index) => ({ ...set, setNumber: index + 1 }))
      return {
        ...current,
        setsByExercise: {
          ...current.setsByExercise,
          [workoutExerciseId]: remaining,
        },
      }
    })
  }

  function addSetAndShowImmediately(workoutExerciseId: string) {
    run(
      workoutRepository.addSet(workoutExerciseId).then((added) => {
        setState((current) => {
          if (current.status !== 'ready') {
            return current
          }
          const currentSets = current.setsByExercise[workoutExerciseId] ?? []
          if (currentSets.some((set) => set.id === added.id)) {
            return current
          }
          return {
            ...current,
            setsByExercise: {
              ...current.setsByExercise,
              [workoutExerciseId]: [...currentSets, added].sort(
                (left, right) => left.setNumber - right.setNumber,
              ),
            },
          }
        })
        return added
      }),
    )
  }

  async function waitForPendingWorkoutMutations(timeoutMs = 4000) {
    // Wait for tracked persistence to settle before finishing, but never wait
    // forever: if a mutation stalls (e.g. a hung native bridge slipped into the
    // set), proceed after the timeout so finishing can never deadlock.
    let timedOut = false
    const timeout = new Promise<void>((resolve) => {
      setTimeout(() => {
        timedOut = true
        resolve()
      }, timeoutMs)
    })
    while (pendingWorkoutMutations.current.size > 0 && !timedOut) {
      await Promise.race([
        Promise.all([...pendingWorkoutMutations.current]),
        timeout,
      ])
    }
  }

  function runAfterPendingWorkoutMutations<T>(action: () => Promise<T>) {
    const pending = [...pendingWorkoutMutations.current]
    return Promise.all(pending).then(action)
  }

  async function finishActiveWorkout(workout: Workout) {
    if (finishInProgressRef.current) {
      return
    }
    finishInProgressRef.current = true
    setConfirmFinish(false)
    setIsFinishing(true)
    try {
      await waitForPendingWorkoutMutations()
      const completed = await workoutRepository.completeWorkout({
        workoutId: workout.id,
      })
      trackAnalyticsEvent('workout_logged')
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
      // Best-effort notification cleanup; do not block navigation on it.
      void cancelNativeRestTimer()
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
      finishInProgressRef.current = false
      setIsFinishing(false)
    }
  }

  async function discardActiveWorkout(workout: Workout) {
    if (discardInProgressRef.current) {
      return
    }

    discardInProgressRef.current = true
    setIsDiscarding(true)
    setError(null)
    try {
      await workoutRepository.discardWorkout(workout.id)
      void cancelNativeRestTimer()
      setConfirmDiscard(false)
      navigate('/training', { replace: true })
    } catch (caught) {
      discardInProgressRef.current = false
      setIsDiscarding(false)
      setError(
        caught instanceof Error
          ? caught.message
          : 'Workout could not be discarded.',
      )
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
      if (nativeStatus === 'unavailable') {
        if (timerSound.bannersEnabled) {
          await webPushRestTimerNotificationService.sync(timer)
        } else {
          await webPushRestTimerNotificationService.cancel()
        }
      }
    } catch {
      // Outside-app alert delivery is optional and must never block or cover
      // live set entry. Settings remains the place to inspect alert status.
    }
  }

  function runRestTimerMutation(
    action: Promise<RestTimerState | null>,
    requestPermission = false,
  ) {
    // Only the IndexedDB persistence is tracked as a pending workout mutation so
    // that finishing waits for the write. The native notification sync is a
    // best-effort side effect fired detached: on iOS the native bridge can hang
    // (e.g. while the app is resuming or a permission prompt is pending), and it
    // must never be able to block finishing the workout.
    run(action, 'Rest timer could not be updated.')
    void action
      .then((timer) =>
        timer
          ? syncNativeRestTimer(timer, requestPermission)
          : cancelNativeRestTimer(),
      )
      .catch(() => undefined)
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
    persist: () => Promise<RestTimerState | null>,
  ) {
    showRestTimerImmediately(update)
    runRestTimerMutation(persist())
  }

  function changeActiveExerciseRest(seconds: number) {
    if (!readyState || !activeExercise?.exerciseId) {
      setError('Exercise default rest time could not be saved.')
      return
    }
    const normalizedSeconds = clampRestPickerSeconds(seconds)
    const changedAt = new Date().toISOString()
    const exerciseId = activeExercise.exerciseId
    const workoutExerciseId = activeExercise.id
    const workoutId = readyState.workout.id
    const shouldUpdateTimer = Boolean(
      readyState.workout.activeRestTimer &&
      readyState.workout.activeRestTimer.status !== 'dismissed',
    )

    setState((current) => {
      if (current.status !== 'ready' || current.workout.id !== workoutId) {
        return current
      }
      return {
        ...current,
        workout: {
          ...current.workout,
          activeRestTimer:
            shouldUpdateTimer && current.workout.activeRestTimer
              ? updateRestTimerDuration(
                  current.workout.activeRestTimer,
                  normalizedSeconds,
                  changedAt,
                )
              : current.workout.activeRestTimer,
        },
        exercises: current.exercises.map((exercise) =>
          exercise.id === workoutExerciseId
            ? {
                ...exercise,
                exerciseSnapshot: {
                  ...exercise.exerciseSnapshot,
                  defaultRestSeconds: normalizedSeconds,
                },
              }
            : exercise,
        ),
      }
    })

    const mutation = restDurationMutationChain.current.then(async () => {
      await Promise.all([
        exerciseRepository.updateExerciseDefaultRest(
          exerciseId,
          normalizedSeconds,
        ),
        workoutRepository.updateWorkoutExerciseDefaultRest(
          workoutExerciseId,
          normalizedSeconds,
        ),
      ])
      if (shouldUpdateTimer) {
        const timer = await workoutRepository.setRestTimerDuration(
          workoutId,
          normalizedSeconds,
        )
        // Detached OS notification sync; never gate the tracked mutation.
        void syncNativeRestTimer(timer).catch(() => undefined)
      }
    })
    restDurationMutationChain.current = mutation.catch(() => undefined)
    run(mutation, 'Exercise rest duration could not be saved.')
  }

  async function cancelNativeRestTimer() {
    try {
      const nativeStatus = await nativeRestTimerNotificationService.cancel()
      if (nativeStatus === 'unavailable') {
        await webPushRestTimerNotificationService.cancel()
      }
    } catch {
      // Keep local timer controls usable even if notification cleanup fails.
    }
  }

  async function dismissRestTimerIfPresent(workout: Workout) {
    // The IndexedDB dismissal is awaited so callers can gate on persisted state,
    // but the native notification cleanup is fired detached: on iOS the bridge
    // can hang, and it must never block a tracked mutation (and therefore
    // finishing the workout).
    const timer = workout.activeRestTimer
    if (!timer || timer.status === 'dismissed') {
      void cancelNativeRestTimer()
      return
    }

    const dismissedTimer = await workoutRepository.dismissRestTimer(workout.id)
    if (dismissedTimer) {
      void syncNativeRestTimer(dismissedTimer)
    } else {
      void cancelNativeRestTimer()
    }
  }

  async function toggleWorkoutPause(workout: Workout) {
    if (isWorkoutPauseBusy) {
      return
    }
    setIsWorkoutPauseBusy(true)
    setError(null)
    try {
      const changedAt = new Date().toISOString()
      const updated = workout.pausedAt
        ? await workoutRepository.resumeWorkout(workout.id, changedAt)
        : await workoutRepository.pauseWorkout(workout.id, changedAt)
      setState((current) =>
        current.status === 'ready' && current.workout.id === updated.id
          ? { ...current, workout: updated }
          : current,
      )
      window.dispatchEvent(new CustomEvent('fitness-log:workout-pause-changed'))
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'The workout timer could not be changed.',
      )
    } finally {
      setIsWorkoutPauseBusy(false)
    }
  }

  const readyState = state.status === 'ready' ? state : null
  const elapsedSeconds = readyState
    ? workoutElapsedSeconds(readyState.workout, now)
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
  const activeSourcePrescription =
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
    setWorkspaceEnterDirection(index > activeIndex ? 'next' : 'previous')
    setActiveExerciseId(next.id)
  }

  function reorderExercises(orderedIds: string[]) {
    if (!readyState) {
      return
    }
    const byId = new Map(
      readyState.exercises.map((exercise) => [exercise.id, exercise]),
    )
    const reordered = orderedIds
      .map((id) => byId.get(id))
      .filter((exercise): exercise is WorkoutExercise => Boolean(exercise))
      .map((exercise, orderIndex) => ({ ...exercise, orderIndex }))
    if (reordered.length !== readyState.exercises.length) {
      return
    }
    setState((current) =>
      current.status === 'ready'
        ? { ...current, exercises: reordered }
        : current,
    )
    run(
      workoutRepository.reorderWorkoutExercises(
        readyState.workout.id,
        orderedIds,
      ),
      'Exercise order could not be changed.',
    )
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

    function reloadWorkoutPause() {
      setRevision((current) => current + 1)
    }

    window.addEventListener(
      'fitness-log:rest-timer-completed',
      reloadCompletedTimer,
    )
    window.addEventListener(
      'fitness-log:workout-pause-changed',
      reloadWorkoutPause,
    )
    return () => {
      window.removeEventListener(
        'fitness-log:rest-timer-completed',
        reloadCompletedTimer,
      )
      window.removeEventListener(
        'fitness-log:workout-pause-changed',
        reloadWorkoutPause,
      )
    }
  }, [readyState])

  useEffect(() => {
    if (!readyState) {
      return
    }
    const hasRecordedResult = readyState.exercises.some((exercise) => {
      const sets = readyState.setsByExercise[exercise.id] ?? []
      return exercise.skipped || sets.some((set) => set.completed)
    })
    const hasPendingWork = readyState.exercises.some((exercise) =>
      hasPendingWorkoutExerciseWork(
        readyState.setsByExercise[exercise.id] ?? [],
        exercise.skipped,
      ),
    )
    if (!hasRecordedResult || hasPendingWork) {
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
        <LoadingState label="Loading active workout" variant="cards" />
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

  const currentWorkoutId = state.workout.id

  function addRestTimerTime() {
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
          : { ...timer, durationSeconds: timer.durationSeconds + 30 },
      () => workoutRepository.addRestTimerSeconds(currentWorkoutId, 30),
    )
  }

  function subtractRestTimerTime() {
    updateRestTimerImmediately(
      (timer) => ({
        ...timer,
        durationSeconds: Math.max(0, timer.durationSeconds - 30),
      }),
      () => workoutRepository.addRestTimerSeconds(currentWorkoutId, -30),
    )
  }

  function dismissCurrentRestTimer() {
    updateRestTimerImmediately(
      (timer) => ({ ...timer, pausedAt: null, status: 'dismissed' }),
      () => workoutRepository.dismissRestTimer(currentWorkoutId),
    )
  }

  function pauseCurrentRestTimer() {
    updateRestTimerImmediately(
      (timer) =>
        timer.status === 'running'
          ? {
              ...timer,
              pausedAt: new Date().toISOString(),
              status: 'paused',
            }
          : timer,
      () => workoutRepository.pauseRestTimer(currentWorkoutId),
    )
  }

  function resumeCurrentRestTimer() {
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
                (Date.parse(resumedAt) - Date.parse(timer.pausedAt)) / 1000,
              ),
            ),
          pausedAt: null,
          status: 'running',
        }
      },
      () => workoutRepository.resumeRestTimer(currentWorkoutId),
    )
  }

  return (
    <div className="page-container live-workout-page">
      <div aria-live="polite" className="visually-hidden">
        {announcement}
      </div>
      {error ? <ValidationMessage message={error} /> : null}

      {state.exercises.length > 1 ? (
        <section
          aria-label={t('Exercises')}
          className={[
            'exercise-navigator',
            exerciseTabOverflow.left ? 'can-scroll-left' : '',
            exerciseTabOverflow.right ? 'can-scroll-right' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <SortableList
            direction="horizontal"
            getItemLabel={(id) =>
              state.exercises.find((exercise) => exercise.id === id)
                ?.exerciseSnapshot.exerciseName ?? id
            }
            itemIds={state.exercises.map((exercise) => exercise.id)}
            onReorder={reorderExercises}
          >
            <div className="exercise-tab-list" ref={exerciseTabListRef}>
              {state.exercises.map((exercise, index) => (
                <SortableListItem id={exercise.id} key={exercise.id}>
                  {(drag) => (
                    <div
                      className={`exercise-sort-card${
                        exercise.id === activeExercise?.id ? ' is-active' : ''
                      }${exercise.skipped ? ' is-skipped' : ''}`}
                      data-exercise-id={exercise.id}
                    >
                      <button
                        aria-current={exercise.id === activeExercise?.id}
                        aria-label={`${exercise.exerciseSnapshot.exerciseName}, exercise ${index + 1} of ${state.exercises.length}`}
                        className="exercise-sort-select"
                        onClick={() => selectExercise(index)}
                        type="button"
                      >
                        <span>{index + 1}</span>
                        <small>{exercise.exerciseSnapshot.exerciseName}</small>
                      </button>
                      <SortableDragHandle
                        drag={drag}
                        label={`Reorder ${exercise.exerciseSnapshot.exerciseName}`}
                      />
                    </div>
                  )}
                </SortableListItem>
              ))}
            </div>
          </SortableList>
        </section>
      ) : null}

      {activeExercise ? (
        <ExerciseWorkspace
          canGoNext={canGoNext}
          canGoPrevious={canGoPrevious}
          exercise={activeExercise}
          exerciseCount={state.exercises.length}
          exerciseIndex={activeIndex}
          elapsedSeconds={elapsedSeconds}
          enterDirection={workspaceEnterDirection}
          forceRir={state.workout.isDeload === true}
          isWorkoutPauseBusy={isWorkoutPauseBusy}
          rirTargetOnEverySet={state.workout.trackRirEverySet ?? false}
          key={activeExercise.id}
          onAddExercise={() => setPicker({ mode: 'add' })}
          onAddSet={() => addSetAndShowImmediately(activeExercise.id)}
          onCompleteSet={(set, completed) => {
            if (deletingSetIds.current.has(set.id)) {
              return
            }
            const restSeconds =
              set.restSecondsUsed ??
              activeExercise.exerciseSnapshot.defaultRestSeconds ??
              0
            const hasMoreSetsInExercise = activeSets.some(
              (candidate) => candidate.id !== set.id && !candidate.completed,
            )
            const nextExercise = state.exercises[activeIndex + 1]
            const changedAt = new Date().toISOString()
            const optimisticTimer = !completed
              ? state.workout.activeRestTimer
              : hasMoreSetsInExercise && restSeconds > 0
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
            if (completed && !hasMoreSetsInExercise && nextExercise) {
              setActiveExerciseId(nextExercise.id)
            }
            const setMutation = trackOptimisticMutation(
              workoutRepository
                .updateWorkoutSet(set.id, { completed })
                .then(async () => {
                  if (!completed) {
                    return
                  }
                  if (hasMoreSetsInExercise && restSeconds > 0) {
                    const timer = await workoutRepository.setRestTimer(
                      state.workout.id,
                      restSeconds,
                    )
                    // Detached: the OS notification must never gate the tracked
                    // mutation, or a hung native bridge would stall finishing.
                    void syncNativeRestTimer(timer, true).catch(() => undefined)
                    return
                  }
                  await dismissRestTimerIfPresent(state.workout)
                }),
            )
            run(setMutation)
          }}
          onDeleteSet={(setId) => {
            if (deletingSetIds.current.has(setId)) {
              return
            }
            deletingSetIds.current.add(setId)
            deleteSetOptimistically(activeExercise.id, setId)
            const deletingLastSet = activeSets.at(-1)?.id === setId
            const timerIsActive =
              state.workout.activeRestTimer?.status === 'running' ||
              state.workout.activeRestTimer?.status === 'paused'
            const deletion = runAfterPendingWorkoutMutations(() =>
              workoutRepository.deleteSet(setId).then(async () => {
                if (!deletingLastSet || !timerIsActive) {
                  return
                }
                const timer = await workoutRepository.dismissRestTimer(
                  state.workout.id,
                )
                // Detached OS notification cleanup; never gate the mutation.
                if (timer) {
                  void syncNativeRestTimer(timer)
                } else {
                  void cancelNativeRestTimer()
                }
              }),
            ).finally(() => deletingSetIds.current.delete(setId))
            run(trackOptimisticMutation(deletion))
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
          onChangeExerciseDefaultRest={changeActiveExerciseRest}
          onDismissRestTimer={dismissCurrentRestTimer}
          onPauseRestTimer={pauseCurrentRestTimer}
          onResumeRestTimer={resumeCurrentRestTimer}
          onSetMetric={(set, metricValues) => {
            if (deletingSetIds.current.has(set.id)) {
              return
            }
            updateSetMetricOptimistically(
              set.id,
              metricValues.key,
              metricValues.value,
            )
            run(
              trackOptimisticMutation(
                workoutRepository.updateWorkoutSetMetricAndPropagate(
                  set.id,
                  metricValues.key,
                  metricValues.value,
                ),
              ),
            )
          }}
          onSetRir={(set, rir) => {
            if (!deletingSetIds.current.has(set.id)) {
              updateSetRirOptimistically(set.id, rir)
              run(
                trackOptimisticMutation(
                  workoutRepository.updateWorkoutSet(set.id, { rir }),
                ),
              )
            }
          }}
          onSaveNotes={(notes) =>
            trackWorkoutMutation(
              workoutRepository.updateWorkoutExerciseNotes(
                activeExercise.id,
                notes,
              ),
              'Exercise notes could not be saved.',
            )
          }
          onSavePrescription={(input) =>
            trackWorkoutMutation(
              workoutRepository.updateLiveExercisePrescription({
                workoutExerciseId: activeExercise.id,
                ...input,
              }),
              'Exercise target could not be saved.',
            )
          }
          onSkip={(skipped) => {
            const nextExercise = state.exercises[activeIndex + 1]
            if (skipped && nextExercise) {
              setActiveExerciseId(nextExercise.id)
            }
            run(workoutRepository.skipExercise(activeExercise.id, skipped))
          }}
          onToggleWorkoutPause={() => void toggleWorkoutPause(state.workout)}
          prescription={liveExercisePrescription(
            activeExercise,
            activeSets,
            activeSourcePrescription,
          )}
          restRemainingSeconds={restRemaining}
          restTimer={state.workout.activeRestTimer}
          sets={activeSets}
          workoutPaused={Boolean(state.workout.pausedAt)}
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
      <div className="live-workout-session-bar">
        <RestTimerControls
          onAddTime={addRestTimerTime}
          onOpen={() => setIsRestTimerSheetOpen(true)}
          onSubtractTime={subtractRestTimerTime}
          remainingSeconds={restRemaining}
          timer={state.workout.activeRestTimer}
        />
        <SecondaryButton
          className="button-danger live-workout-discard"
          type="button"
          onClick={() => setConfirmDiscard(true)}
        >
          <Trash2 aria-hidden="true" size={16} />
          {t('Discard')}
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

      <BottomSheet
        isOpen={isRestTimerSheetOpen}
        onClose={() => setIsRestTimerSheetOpen(false)}
        title="Rest timer"
        variant="page"
      >
        <ExerciseOptionsTimerSettings
          defaultRestSeconds={
            activeExercise?.exerciseSnapshot.defaultRestSeconds ?? 0
          }
          elapsedSeconds={elapsedSeconds}
          isWorkoutPauseBusy={isWorkoutPauseBusy}
          onChangeDefaultRest={changeActiveExerciseRest}
          onDismissRestTimer={dismissCurrentRestTimer}
          onPauseRestTimer={pauseCurrentRestTimer}
          onResumeRestTimer={resumeCurrentRestTimer}
          onToggleWorkoutPause={() => void toggleWorkoutPause(state.workout)}
          restRemainingSeconds={restRemaining}
          restTimer={state.workout.activeRestTimer}
          showExerciseRest={Boolean(activeExercise)}
          workoutPaused={Boolean(state.workout.pausedAt)}
        />
      </BottomSheet>

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
        confirmLabel={isDiscarding ? 'Discarding...' : 'Discard Workout'}
        isConfirming={isDiscarding}
        isOpen={confirmDiscard}
        onCancel={() => {
          if (!isDiscarding) {
            setConfirmDiscard(false)
          }
        }}
        onConfirm={() => discardActiveWorkout(state.workout)}
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
          const removedIndex = state.exercises.findIndex(
            (exercise) => exercise.id === activeExercise.id,
          )
          const remainingExercises = state.exercises.filter(
            (exercise) => exercise.id !== activeExercise.id,
          )
          const nextExercise =
            remainingExercises[
              Math.min(Math.max(removedIndex, 0), remainingExercises.length - 1)
            ] ?? null
          setActiveExerciseId(nextExercise?.id ?? null)
          setState((current) => {
            if (current.status !== 'ready') {
              return current
            }
            const setsByExercise = { ...current.setsByExercise }
            delete setsByExercise[activeExercise.id]
            return {
              ...current,
              exercises: current.exercises.filter(
                (exercise) => exercise.id !== activeExercise.id,
              ),
              setsByExercise,
            }
          })
          const removal = runAfterPendingWorkoutMutations(() =>
            workoutRepository.removeExerciseFromLiveWorkout(activeExercise.id),
          )
          run(
            trackOptimisticMutation(removal),
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
    </div>
  )
}

function ExerciseWorkspace({
  canGoNext,
  canGoPrevious,
  exercise,
  exerciseCount,
  exerciseIndex,
  elapsedSeconds,
  enterDirection,
  forceRir,
  isWorkoutPauseBusy,
  onAddExercise,
  onAddSet,
  onChangeExerciseDefaultRest,
  onCompleteSet,
  onDeleteSet,
  onDismissRestTimer,
  onNext,
  onPrevious,
  onReplaceExercise,
  onRemoveExercise,
  onPauseRestTimer,
  onResumeRestTimer,
  onSetMetric,
  onSetRir,
  onSaveNotes,
  onSavePrescription,
  onSkip,
  onToggleWorkoutPause,
  prescription,
  restRemainingSeconds,
  restTimer,
  rirTargetOnEverySet,
  sets,
  workoutPaused,
}: {
  canGoNext: boolean
  canGoPrevious: boolean
  exercise: WorkoutExercise
  exerciseCount: number
  exerciseIndex: number
  elapsedSeconds: number
  enterDirection: 'next' | 'previous' | null
  forceRir: boolean
  isWorkoutPauseBusy: boolean
  rirTargetOnEverySet: boolean
  onAddExercise: () => void
  onAddSet: () => void
  onChangeExerciseDefaultRest: (seconds: number) => void
  onCompleteSet: (set: WorkoutSet, completed: boolean) => void
  onDeleteSet: (setId: string) => void
  onDismissRestTimer: () => void
  onNext: () => void
  onPrevious: () => void
  onReplaceExercise: () => void
  onRemoveExercise: () => void
  onPauseRestTimer: () => void
  onResumeRestTimer: () => void
  onSetMetric: (
    set: WorkoutSet,
    value: { key: string; value: WorkoutSetMetricValue },
  ) => void
  onSetRir: (set: WorkoutSet, rir: number | null) => void
  onSaveNotes: (notes: string) => Promise<unknown>
  onSavePrescription: (input: LivePrescriptionInput) => Promise<unknown>
  onSkip: (skipped: boolean) => void
  onToggleWorkoutPause: () => void
  prescription: LiveExercisePrescription
  restRemainingSeconds: number
  restTimer: Workout['activeRestTimer']
  sets: WorkoutSet[]
  workoutPaused: boolean
}) {
  const { t } = useLanguage()
  const metrics = exercise.exerciseSnapshot.trackingMetrics
  const swipe = useSwipeNavigation({
    canGoNext,
    canGoPrevious,
    onNext,
    onPrevious,
  })
  const weightUnit = useWeightUnit()
  const rirEnabled = useRirTracking()
  const canEditTargetRir = supportsRir(metrics) && rirEnabled
  const finalProgrammedSetId = getFinalProgrammedSetId(sets)
  const exerciseNotes = exercise.notes.trim()
  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const [isExerciseOptionsOpen, setIsExerciseOptionsOpen] = useState(false)
  const [isEditingPrescription, setIsEditingPrescription] = useState(false)
  const [isSavingPrescription, setIsSavingPrescription] = useState(false)
  const [prescriptionError, setPrescriptionError] = useState<string | null>(
    null,
  )
  const [setCountDraft, setSetCountDraft] = useState(
    String(prescription.targetSetCount),
  )
  const [repsMinDraft, setRepsMinDraft] = useState(
    prescription.targetRepsMin === null
      ? ''
      : String(prescription.targetRepsMin),
  )
  const [repsMaxDraft, setRepsMaxDraft] = useState(
    prescription.targetRepsMax === null
      ? ''
      : String(prescription.targetRepsMax),
  )
  const [rirDraft, setRirDraft] = useState(
    prescription.targetRir === null ? '' : String(prescription.targetRir),
  )
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

  function openExerciseOptions() {
    setSetCountDraft(String(prescription.targetSetCount))
    setRepsMinDraft(
      prescription.targetRepsMin === null
        ? ''
        : String(prescription.targetRepsMin),
    )
    setRepsMaxDraft(
      prescription.targetRepsMax === null
        ? ''
        : String(prescription.targetRepsMax),
    )
    setRirDraft(
      prescription.targetRir === null ? '' : String(prescription.targetRir),
    )
    setPrescriptionError(null)
    setIsEditingPrescription(false)
    setIsExerciseOptionsOpen(true)
  }

  async function savePrescription() {
    const parsed = parseLivePrescriptionDraft({
      setCount: setCountDraft,
      repsMin: repsMinDraft,
      repsMax: repsMaxDraft,
      // When RIR editing is unavailable the field is hidden; omit the target so
      // saving sets/reps never rewrites the recorded RIR on the last set.
      rir: canEditTargetRir ? rirDraft : '',
    })
    if (!parsed.ok) {
      setPrescriptionError(parsed.error)
      return
    }
    const payload: LivePrescriptionInput = canEditTargetRir
      ? parsed.value
      : {
          targetSetCount: parsed.value.targetSetCount,
          targetRepsMin: parsed.value.targetRepsMin,
          targetRepsMax: parsed.value.targetRepsMax,
        }
    setIsSavingPrescription(true)
    try {
      await onSavePrescription(payload)
      setPrescriptionError(null)
      setIsEditingPrescription(false)
    } catch (caught: unknown) {
      setPrescriptionError(
        caught instanceof Error
          ? caught.message
          : 'Exercise target could not be saved.',
      )
    } finally {
      setIsSavingPrescription(false)
    }
  }

  return (
    <div
      className={['exercise-workspace', exercise.skipped ? 'skipped' : '']
        .filter(Boolean)
        .join(' ')}
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
    >
      <div
        className={[
          'exercise-workspace-swipe-area',
          enterDirection === 'next'
            ? 'exercise-workspace-enter-next'
            : enterDirection === 'previous'
              ? 'exercise-workspace-enter-previous'
              : '',
          swipe.isDragging ? 'is-swiping' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={swipe.style}
        {...swipe.handlers}
      >
        <div className="exercise-card-header">
          <div className="exercise-title-block">
            <p className="eyebrow">
              {t('Exercise {current} of {total}', {
                current: exerciseIndex + 1,
                total: exerciseCount,
              })}
            </p>
            <div className="exercise-title-line">
              <div className="exercise-title-main">
                <h2>{exercise.exerciseSnapshot.exerciseName}</h2>
              </div>
              <IconButton
                aria-label={t('Edit exercise notes')}
                className={`exercise-notes-button${exerciseNotes ? ' has-notes' : ''}`}
                onClick={() => setIsEditingNotes(true)}
                title={t('Exercise notes')}
              >
                <NotebookPen aria-hidden="true" size={19} />
              </IconButton>
              <IconButton
                aria-expanded={isExerciseOptionsOpen}
                aria-haspopup="dialog"
                aria-label={t('More exercise actions')}
                className="exercise-options-button"
                onClick={openExerciseOptions}
                title={t('More exercise actions')}
              >
                <Ellipsis aria-hidden="true" size={20} />
              </IconButton>
            </div>
            {exercise.skipped ? <p className="muted">{t('Skipped')}</p> : null}
          </div>
        </div>

        <div className="set-list">
          {sets.map((set) => (
            <SetRow
              exercise={exercise}
              finalProgrammedSetId={finalProgrammedSetId}
              forceRir={forceRir}
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
      </div>

      <SecondaryButton
        className="exercise-add-set-button"
        type="button"
        onClick={onAddSet}
      >
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
        <SecondaryButton
          className="button-danger"
          type="button"
          onClick={onRemoveExercise}
        >
          {t('Remove Exercise')}
        </SecondaryButton>
      </div>

      <BottomSheet
        isOpen={isExerciseOptionsOpen}
        onClose={() => setIsExerciseOptionsOpen(false)}
        title="Exercise options"
        variant="page"
      >
        {isEditingPrescription ? (
          <div className="live-prescription-form">
            <FormField id="live-target-set-count" label="Sets">
              <LiveWorkoutNumericInput
                id="live-target-set-count"
                max={99}
                min={1}
                mode="integer"
                onValueChange={(value) =>
                  setSetCountDraft(value.replace(/\D+/g, ''))
                }
                value={setCountDraft}
              />
            </FormField>
            {metrics.some((metric) => metric.key === 'reps') ? (
              <div className="live-prescription-rep-fields">
                <FormField id="live-target-reps-min" label="Minimum reps">
                  <LiveWorkoutNumericInput
                    id="live-target-reps-min"
                    max={999}
                    min={1}
                    mode="integer"
                    onValueChange={(value) =>
                      setRepsMinDraft(value.replace(/\D+/g, ''))
                    }
                    value={repsMinDraft}
                  />
                </FormField>
                <FormField id="live-target-reps-max" label="Maximum reps">
                  <LiveWorkoutNumericInput
                    id="live-target-reps-max"
                    max={999}
                    min={1}
                    mode="integer"
                    onValueChange={(value) =>
                      setRepsMaxDraft(value.replace(/\D+/g, ''))
                    }
                    value={repsMaxDraft}
                  />
                </FormField>
              </div>
            ) : null}
            {canEditTargetRir ? (
              <FormField
                id="live-target-rir"
                label="Target RIR"
                helpText="Applies to the last set, replacing any RIR recorded there."
              >
                <LiveWorkoutNumericInput
                  id="live-target-rir"
                  max={99}
                  min={0}
                  mode="integer"
                  onValueChange={(value) =>
                    setRirDraft(value.replace(/\D+/g, ''))
                  }
                  value={rirDraft}
                />
              </FormField>
            ) : null}
            {prescriptionError ? (
              <ValidationMessage message={prescriptionError} />
            ) : null}
            <div className="button-row">
              <SecondaryButton
                disabled={isSavingPrescription}
                type="button"
                onClick={() => {
                  setPrescriptionError(null)
                  setIsEditingPrescription(false)
                }}
              >
                Cancel
              </SecondaryButton>
              <PrimaryButton
                aria-busy={isSavingPrescription}
                disabled={isSavingPrescription}
                type="button"
                onClick={() => void savePrescription()}
              >
                Save target
              </PrimaryButton>
            </div>
          </div>
        ) : (
          <div className="exercise-options-sheet-actions">
            <div className="exercise-options-prescription">
              <div>
                <p className="eyebrow">Current workout target</p>
                <h3>{formatPrescriptionSummary(prescription, weightUnit)}</h3>
              </div>
              <IconButton
                aria-label="Edit current workout target"
                title="Edit current workout target"
                onClick={() => setIsEditingPrescription(true)}
              >
                <Pencil aria-hidden="true" size={18} />
              </IconButton>
            </div>
            <ExerciseOptionsTimerSettings
              defaultRestSeconds={
                exercise.exerciseSnapshot.defaultRestSeconds ?? 0
              }
              elapsedSeconds={elapsedSeconds}
              isWorkoutPauseBusy={isWorkoutPauseBusy}
              onChangeDefaultRest={onChangeExerciseDefaultRest}
              onDismissRestTimer={onDismissRestTimer}
              onPauseRestTimer={onPauseRestTimer}
              onResumeRestTimer={onResumeRestTimer}
              onToggleWorkoutPause={onToggleWorkoutPause}
              restRemainingSeconds={restRemainingSeconds}
              restTimer={restTimer}
              workoutPaused={workoutPaused}
            />
            <SecondaryButton
              type="button"
              onClick={() => {
                setIsExerciseOptionsOpen(false)
                onReplaceExercise()
              }}
            >
              <RefreshCcw aria-hidden="true" size={18} />
              {t('Swap Exercise')}
            </SecondaryButton>
            <SecondaryButton
              type="button"
              disabled={!exercise.skipped && !canSkipWorkoutExercise(sets)}
              onClick={() => {
                setIsExerciseOptionsOpen(false)
                onSkip(!exercise.skipped)
              }}
            >
              {t(exercise.skipped ? 'Unskip' : 'Skip Exercise')}
            </SecondaryButton>
          </div>
        )}
      </BottomSheet>

      <BottomSheet
        isOpen={isEditingNotes}
        onClose={() => {
          setNotesDraft(exercise.notes)
          setIsEditingNotes(false)
        }}
        title="Exercise notes"
      >
        <div className="live-exercise-notes-editor">
          <textarea
            aria-label={t('Exercise notes')}
            onChange={(event) => setNotesDraft(event.currentTarget.value)}
            placeholder={t('No exercise notes.')}
            rows={5}
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
        </div>
      </BottomSheet>
    </div>
  )
}

function SetRow({
  exercise,
  finalProgrammedSetId,
  forceRir,
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
  forceRir: boolean
  metrics: TrackingMetric[]
  onComplete: (completed: boolean) => void
  onDelete: () => void
  onMetricChange: (key: string, value: WorkoutSetMetricValue) => void
  onRirChange: (rir: number | null) => void
  prescription: LiveExercisePrescription
  rirTargetOnEverySet: boolean
  set: WorkoutSet
}) {
  const { t } = useLanguage()
  const [validationRequested, setValidationRequested] = useState(false)
  const [rirTouched, setRirTouched] = useState(false)
  const [rirDraft, setRirDraft] = useState(set.rir?.toString() ?? '')
  const rirEditingRef = useRef(false)
  const lastRirPropRef = useRef(set.rir)
  const [locallyValidMetricKeys, setLocallyValidMetricKeys] = useState(
    () => new Set<string>(),
  )
  const [rirDraftValid, setRirDraftValid] = useState(
    () => set.rir == null || (Number.isFinite(set.rir) && set.rir >= 0),
  )
  const rirEnabled = useRirTracking()
  const isFinalProgrammedSet = set.id === finalProgrammedSetId
  // RIR is recordable on any set. The prescribed target/required prompt lands
  // on the final programmed set only, unless the program tracks RIR on every
  // set — then every set is a target set.
  const isRirTargetSet = rirTargetOnEverySet || isFinalProgrammedSet
  const showRir = supportsRir(metrics) && (rirEnabled || forceRir)
  const repsPerSide = exerciseRecordsRepsPerSide(exercise)
  const invalidMetricKeys = invalidRequiredMetricKeys(set, metrics)
  const effectiveInvalidMetricKeys = new Set(
    [...invalidMetricKeys].filter((key) => !locallyValidMetricKeys.has(key)),
  )
  const isRirInvalid = showRir && !rirDraftValid
  const weightUnit = useWeightUnit()

  useEffect(() => {
    if (set.rir === lastRirPropRef.current) {
      return
    }
    lastRirPropRef.current = set.rir
    if (!rirEditingRef.current) {
      setRirDraft(set.rir?.toString() ?? '')
    }
  }, [set.rir])

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
          <LiveWorkoutNumericInput
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
            mode="decimal"
            onCommit={() => {
              rirEditingRef.current = false
              setRirTouched(true)
              const draft = rirDraft.trim()
              const rir = parseNullableNumber(draft)
              setRirDraftValid(
                draft === '' ||
                  (typeof rir === 'number' && Number.isFinite(rir) && rir >= 0),
              )
              onRirChange(rir)
            }}
            onEditStart={() => {
              rirEditingRef.current = true
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                event.currentTarget.blur()
              }
            }}
            onValueChange={(value) => {
              const next = value.replace(/[^\d.]/g, '')
              const rir = parseNullableNumber(next.trim())
              setRirDraft(next)
              setRirDraftValid(
                next.trim() === '' ||
                  (typeof rir === 'number' && Number.isFinite(rir) && rir >= 0),
              )
            }}
            value={rirDraft}
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
  React.ComponentProps<typeof LiveWorkoutNumericInput>,
  | 'aria-invalid'
  | 'mode'
  | 'onCommit'
  | 'onEditStart'
  | 'onValueChange'
  | 'value'
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

  const keypadMode: LiveWorkoutNumericKeypadMode =
    metricKey === 'durationSeconds'
      ? 'duration'
      : valueType === 'integer'
        ? 'integer'
        : 'decimal'

  return (
    <LiveWorkoutNumericInput
      {...props}
      aria-invalid={invalid && (touched || validationRequested)}
      disabled={disabled}
      mode={keypadMode}
      onCommit={() => {
        isEditingRef.current = false
        lastPropValueRef.current = value
        setTouched(true)
      }}
      onEditStart={() => {
        isEditingRef.current = true
      }}
      onValueChange={(value) => {
        const next =
          metricKey === 'durationSeconds'
            ? value.replace(/[^\d:]/g, '')
            : valueType === 'integer'
              ? value.replace(/\D+/g, '')
              : value
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
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      value={draft}
    />
  )
}

function RestTimerControls({
  onAddTime,
  onOpen,
  onSubtractTime,
  remainingSeconds,
  timer,
}: {
  onAddTime: () => void
  onOpen?: () => void
  onSubtractTime: () => void
  remainingSeconds: number
  timer: Workout['activeRestTimer']
}) {
  const { t } = useLanguage()
  const isAvailable = Boolean(timer && timer.status !== 'dismissed')
  const timerStatus = !isAvailable
    ? t('Rest timer ready')
    : timer?.status === 'completed'
      ? t('Rest complete')
      : timer?.status === 'paused'
        ? t('Timer paused')
        : t('Timer running')
  const readoutContent = (
    <>
      <Clock aria-hidden="true" size={17} />
      <span className="rest-timer-digits">
        {formatDuration(remainingSeconds)}
      </span>
    </>
  )

  return (
    <div
      className={`live-session-rest-timer${
        timer?.status === 'running' &&
        remainingSeconds > 0 &&
        remainingSeconds <= 5
          ? ' rest-timer-urgent'
          : ''
      }`}
      aria-label={t('Rest timer')}
    >
      {onOpen ? (
        <button
          type="button"
          aria-label={`${timerStatus}: ${formatDuration(remainingSeconds)}`}
          aria-live="polite"
          className="rest-timer-readout rest-timer-readout-button"
          title={t('Open rest timer')}
          onClick={onOpen}
        >
          {readoutContent}
        </button>
      ) : (
        <span
          aria-label={`${timerStatus}: ${formatDuration(remainingSeconds)}`}
          aria-live="polite"
          className="rest-timer-readout"
          title={timerStatus}
        >
          {readoutContent}
        </span>
      )}
      <IconButton
        aria-label="Subtract 30 seconds"
        disabled={!isAvailable || remainingSeconds === 0}
        title="Subtract 30 seconds"
        type="button"
        onClick={onSubtractTime}
      >
        <Minus aria-hidden="true" size={17} />
      </IconButton>
      <IconButton
        aria-label="Add 30 seconds"
        disabled={!isAvailable}
        title="Add 30 seconds"
        type="button"
        onClick={onAddTime}
      >
        <Plus aria-hidden="true" size={17} />
      </IconButton>
    </div>
  )
}

function ExerciseOptionsTimerSettings({
  defaultRestSeconds,
  elapsedSeconds,
  isWorkoutPauseBusy,
  onChangeDefaultRest,
  onDismissRestTimer,
  onPauseRestTimer,
  onResumeRestTimer,
  onToggleWorkoutPause,
  restRemainingSeconds,
  restTimer,
  showExerciseRest = true,
  workoutPaused,
}: {
  defaultRestSeconds: number
  elapsedSeconds: number
  isWorkoutPauseBusy: boolean
  onChangeDefaultRest: (seconds: number) => void
  onDismissRestTimer: () => void
  onPauseRestTimer: () => void
  onResumeRestTimer: () => void
  onToggleWorkoutPause: () => void
  restRemainingSeconds: number
  restTimer: Workout['activeRestTimer']
  /** Hide the per-exercise rest picker when no exercise is in focus. */
  showExerciseRest?: boolean
  workoutPaused: boolean
}) {
  const { t } = useLanguage()
  const selectedRestSeconds = clampRestPickerSeconds(defaultRestSeconds)
  const hasCurrentTimer = Boolean(restTimer && restTimer.status !== 'dismissed')
  const restTimerPaused = restTimer?.status === 'paused'

  return (
    <div className="exercise-options-timers">
      <div className="exercise-options-workout-time">
        <div>
          <p className="eyebrow">Total workout time</p>
          <strong>
            <Clock aria-hidden="true" size={17} />
            {formatDuration(elapsedSeconds)}
          </strong>
        </div>
        <IconButton
          aria-label={
            workoutPaused ? t('Resume workout timer') : t('Pause workout timer')
          }
          disabled={isWorkoutPauseBusy}
          onClick={onToggleWorkoutPause}
          title={
            workoutPaused ? t('Resume workout timer') : t('Pause workout timer')
          }
        >
          {workoutPaused ? (
            <Play aria-hidden="true" size={18} />
          ) : (
            <Pause aria-hidden="true" size={18} />
          )}
        </IconButton>
      </div>
      {showExerciseRest ? (
        <>
          <FormField
            id="exercise-default-rest-seconds"
            label="Rest duration for this exercise"
          >
            <RestWheelPicker
              minutes={Math.floor(selectedRestSeconds / 60)}
              onChange={(minutes, seconds) =>
                onChangeDefaultRest(minutes * 60 + seconds)
              }
              seconds={selectedRestSeconds % 60}
            />
          </FormField>
          <p className="muted exercise-options-timer-help">
            Changes apply immediately to the current rest timer and future sets.
          </p>
        </>
      ) : null}
      <div className="exercise-options-rest-actions">
        <SecondaryButton
          disabled={!hasCurrentTimer || restTimer?.status === 'completed'}
          type="button"
          onClick={restTimerPaused ? onResumeRestTimer : onPauseRestTimer}
        >
          {restTimerPaused ? (
            <Play aria-hidden="true" size={17} />
          ) : (
            <Pause aria-hidden="true" size={17} />
          )}
          {t(restTimerPaused ? 'Resume rest timer' : 'Pause rest timer')}
        </SecondaryButton>
        <SecondaryButton
          disabled={!hasCurrentTimer}
          type="button"
          onClick={onDismissRestTimer}
        >
          <TimerOff aria-hidden="true" size={17} />
          {t('Clear rest timer')}
        </SecondaryButton>
      </div>
      {hasCurrentTimer ? (
        <p className="visually-hidden" aria-live="polite">
          {t('Current rest time: {time}', {
            time: formatDuration(restRemainingSeconds),
          })}
        </p>
      ) : null}
    </div>
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
  const [isChoosing, setIsChoosing] = useState(false)
  const [isLoadingExercises, setIsLoadingExercises] = useState(false)
  const [lastPicker, setLastPicker] = useState(picker)
  const selectionInProgressRef = useRef(false)

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
    setIsChoosing(false)
    setIsLoadingExercises(Boolean(picker))
    setExercises([])
  }

  useEffect(() => {
    if (!picker) {
      return
    }
    let isCurrent = true
    void exerciseRepository
      .searchExercises({ includeArchived: false, query: '' })
      .then((loaded) => {
        if (isCurrent) {
          setExercises(loaded)
        }
      })
      .catch(() => {
        if (isCurrent) {
          setError('Exercise library could not be loaded. Try again.')
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoadingExercises(false)
        }
      })
    return () => {
      isCurrent = false
    }
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
    if (!picker || selectionInProgressRef.current) {
      return
    }
    if (blockedExerciseIds.has(exerciseId)) {
      setError('That exercise is already in this workout.')
      return
    }
    runSelection(() =>
      picker.mode === 'add'
        ? workoutRepository.addExercise({
            workoutId: currentWorkoutId,
            exerciseId,
          })
        : workoutRepository.replaceExercise({
            workoutExerciseId: picker.workoutExerciseId,
            exerciseId,
            keepCompatibleSetValues: false,
          }),
    )
  }

  function createAndChoose() {
    if (!picker) {
      return
    }
    if (!newName.trim()) {
      setError('Exercise name is required.')
      return
    }
    if (selectionInProgressRef.current) {
      return
    }
    runSelection(async () => {
      const created = await exerciseRepository.createExercise({
        name: newName,
        defaultRestSeconds: 120,
        trackingMethodId: newTrackingMethodId,
      })
      return picker.mode === 'add'
        ? workoutRepository.addExercise({
            workoutId: currentWorkoutId,
            exerciseId: created.id,
          })
        : workoutRepository.replaceExercise({
            workoutExerciseId: picker.workoutExerciseId,
            exerciseId: created.id,
            keepCompatibleSetValues: false,
          })
    }, 'Custom exercise could not be created.')
  }

  function runSelection(
    action: () => Promise<WorkoutExercise>,
    fallbackError = 'Exercise change failed.',
  ) {
    selectionInProgressRef.current = true
    setIsChoosing(true)
    setError(null)
    void action()
      .then((selected) => onSelected(selected.id))
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : fallbackError)
      })
      .finally(() => {
        selectionInProgressRef.current = false
        setIsChoosing(false)
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
            <PrimaryButton
              aria-busy={isChoosing}
              disabled={isChoosing}
              type="button"
              onClick={createAndChoose}
            >
              {isChoosing ? 'Adding...' : 'Create & add'}
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
              <p className="muted">
                Previous set count and values are filled when available.
              </p>
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
          {isLoadingExercises ? (
            <LoadingState label="Loading exercises" variant="inline" />
          ) : null}
          <div className="exercise-result-list" aria-busy={isChoosing}>
            {results.map((exercise) => {
              const alreadyAdded = blockedExerciseIds.has(exercise.id)
              return (
                <button
                  className="exercise-result-row"
                  disabled={alreadyAdded || isChoosing}
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
            disabled={isChoosing || isLoadingExercises}
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

function liveExercisePrescription(
  exercise: WorkoutExercise,
  sets: WorkoutSet[],
  source: ActiveCycleWorkoutExercise | undefined,
): LiveExercisePrescription {
  return {
    targetSetCount: sets.length,
    targetWeight: source?.targetWeight ?? null,
    targetDurationSeconds: source?.targetDurationSeconds ?? null,
    targetDistance: source?.targetDistance ?? null,
    targetRepsMin:
      exercise.sessionTargetRepsMin !== undefined
        ? exercise.sessionTargetRepsMin
        : (source?.targetRepsMin ?? null),
    targetRepsMax:
      exercise.sessionTargetRepsMax !== undefined
        ? exercise.sessionTargetRepsMax
        : (source?.targetRepsMax ?? null),
    targetRir:
      exercise.sessionTargetRir !== undefined
        ? exercise.sessionTargetRir
        : (source?.targetRir ?? null),
  }
}

function parseLivePrescriptionDraft(draft: {
  setCount: string
  repsMin: string
  repsMax: string
  rir: string
}): { ok: true; value: LivePrescriptionInput } | { ok: false; error: string } {
  const targetSetCount = Number(draft.setCount)
  if (
    !Number.isInteger(targetSetCount) ||
    targetSetCount < 1 ||
    targetSetCount > 99
  ) {
    return { ok: false, error: 'Sets must be a whole number from 1 to 99.' }
  }
  const parseReps = (value: string) =>
    value.trim() === '' ? null : Number(value)
  const targetRepsMin = parseReps(draft.repsMin)
  const targetRepsMax = parseReps(draft.repsMax)
  if (
    [targetRepsMin, targetRepsMax].some(
      (value) =>
        value !== null &&
        (!Number.isInteger(value) || value < 1 || value > 999),
    )
  ) {
    return {
      ok: false,
      error: 'Rep targets must be whole numbers from 1 to 999.',
    }
  }
  if (
    targetRepsMin !== null &&
    targetRepsMax !== null &&
    targetRepsMin > targetRepsMax
  ) {
    return {
      ok: false,
      error: 'Minimum reps cannot be greater than maximum reps.',
    }
  }
  const targetRir = draft.rir.trim() === '' ? null : Number(draft.rir)
  if (
    targetRir !== null &&
    (!Number.isFinite(targetRir) || targetRir < 0 || targetRir > 99)
  ) {
    return {
      ok: false,
      error: 'Target RIR must be a number from 0 to 99.',
    }
  }
  return {
    ok: true,
    value: { targetSetCount, targetRepsMin, targetRepsMax, targetRir },
  }
}

function formatPrescriptionSummary(
  prescription: LiveExercisePrescription,
  unit: WeightUnit = 'lb',
) {
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
  if (prescription.targetRir !== null && prescription.targetRir !== undefined) {
    parts.push(`${prescription.targetRir} RIR`)
  }
  return parts.join(' - ')
}

function formatRepTarget(prescription: LiveExercisePrescription) {
  return formatRepTargetFromValues(
    prescription.targetRepsMin,
    prescription.targetRepsMax,
  )
}

function formatRepTargetPlaceholder(prescription: LiveExercisePrescription) {
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
  // The live set count is the current workout target, including sets added
  // during the session, so the final visible row always owns the final RIR.
  return [...sets].sort(bySetNumber).at(-1)?.id ?? null
}

function exerciseRecordsRepsPerSide(exercise: WorkoutExercise) {
  return Boolean(
    'recordsRepsPerSide' in exercise.exerciseSnapshot &&
    exercise.exerciseSnapshot.recordsRepsPerSide,
  )
}

function useSwipeNavigation({
  canGoNext,
  canGoPrevious,
  onNext,
  onPrevious,
}: {
  canGoNext: boolean
  canGoPrevious: boolean
  onNext: () => void
  onPrevious: () => void
}) {
  const pointerStart = useRef<{
    pointerId: number
    x: number
    y: number
    time: number
  } | null>(null)
  const navigationTimeout = useRef<number | null>(null)
  const [offset, setOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isSettling, setIsSettling] = useState(false)

  useEffect(
    () => () => {
      if (navigationTimeout.current !== null) {
        window.clearTimeout(navigationTimeout.current)
      }
    },
    [],
  )

  function settleAt(nextOffset: number, navigate?: () => void) {
    setIsDragging(false)
    setIsSettling(true)
    setOffset(nextOffset)
    const duration = swipeAnimationDuration()
    if (duration === 0) {
      setIsSettling(false)
      navigate?.()
      return
    }
    if (!navigate) {
      navigationTimeout.current = window.setTimeout(() => {
        setIsSettling(false)
      }, duration)
      return
    }
    navigationTimeout.current = window.setTimeout(navigate, duration)
  }

  function reset() {
    pointerStart.current = null
    settleAt(0)
  }

  return {
    isDragging,
    style: {
      '--exercise-swipe-x': `${offset}px`,
      transition: isDragging
        ? 'none'
        : isSettling
          ? 'transform 180ms cubic-bezier(0.2, 0.82, 0.22, 1), opacity 180ms ease'
          : undefined,
    } as CSSProperties,
    handlers: {
      onPointerDown(event: PointerEvent<HTMLElement>) {
        if (isSwipeBlockedElement(event.target)) {
          return
        }
        if (navigationTimeout.current !== null) {
          window.clearTimeout(navigationTimeout.current)
          navigationTimeout.current = null
        }
        setIsSettling(false)
        event.currentTarget.setPointerCapture?.(event.pointerId)
        pointerStart.current = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          time: performance.now(),
        }
      },
      onPointerMove(event: PointerEvent<HTMLElement>) {
        const start = pointerStart.current
        if (!start || start.pointerId !== event.pointerId) {
          return
        }
        const dx = event.clientX - start.x
        const dy = event.clientY - start.y
        if (!isDragging && Math.abs(dx) < 7) {
          return
        }
        if (!isDragging && Math.abs(dx) <= Math.abs(dy) * 1.05) {
          return
        }
        event.preventDefault()
        if (
          document.activeElement instanceof HTMLInputElement &&
          event.currentTarget.contains(document.activeElement)
        ) {
          document.activeElement.blur()
        }
        setIsDragging(true)
        const movingPastStart = dx > 0 && !canGoPrevious
        const movingPastEnd = dx < 0 && !canGoNext
        setOffset(movingPastStart || movingPastEnd ? dx * 0.24 : dx)
      },
      onPointerUp(event: PointerEvent<HTMLElement>) {
        const start = pointerStart.current
        pointerStart.current = null
        if (!start || start.pointerId !== event.pointerId) {
          return
        }
        if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
          event.currentTarget.releasePointerCapture?.(event.pointerId)
        }
        const dx = event.clientX - start.x
        const dy = event.clientY - start.y
        const elapsed = Math.max(1, performance.now() - start.time)
        const velocity = Math.abs(dx) / elapsed
        const horizontalDistance = Math.abs(dx)
        const intentional =
          horizontalDistance > Math.abs(dy) * 1.05 &&
          (horizontalDistance >= 44 ||
            (horizontalDistance >= 30 && velocity >= 0.2))
        const width = Math.max(event.currentTarget.clientWidth, 320)
        if (intentional && dx < 0 && canGoNext) {
          settleAt(-width * 1.06, onNext)
          return
        }
        if (intentional && dx > 0 && canGoPrevious) {
          settleAt(width * 1.06, onPrevious)
          return
        }
        reset()
      },
      onPointerCancel() {
        reset()
      },
      onLostPointerCapture() {
        if (pointerStart.current) {
          reset()
        }
      },
    },
  }
}

function swipeAnimationDuration() {
  if (
    import.meta.env.MODE === 'test' ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  ) {
    return 0
  }
  return 180
}

function prefersReducedMotion() {
  return (
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  )
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

function isSwipeBlockedElement(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false
  }
  return Boolean(
    target.closest(
      'button, select, textarea, a, [contenteditable="true"], [role="slider"]',
    ),
  )
}
