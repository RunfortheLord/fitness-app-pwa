import { Footprints, Pause, Play, Square, Timer } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import {
  Card,
  EmptyState,
  FormField,
  LoadingState,
  ModalConfirmationDialog,
  NumericInput,
  PageContainer,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  StatusMessage,
  ValidationMessage,
} from '@components/ui'
import { useLanguage } from '@components/languageContextValue'
import { formatLocalDate } from '@domain/dates'
import {
  formatDistance,
  formatDuration,
  formatPace,
} from '@domain/runFormatting'
import { calculateLiveRunMetrics, METERS_PER_MILE } from '@domain/runTracking'
import {
  createTreadmillMotionState,
  processTreadmillMotion,
} from '@domain/treadmillTracking'
import { runRepository, type RunStructure } from '@repositories/runRepository'
import { workoutRepository } from '@repositories/workoutRepository'
import type { Run, RunAlertResponse, RunTrackingMode } from '@shared-types/app'

type RunPageState =
  | { status: 'loading' }
  | { status: 'idle' }
  | { status: 'ready'; structure: RunStructure }
  | { status: 'error'; message: string }

export function RunPage() {
  const { language, t } = useLanguage()
  const [state, setState] = useState<RunPageState>({ status: 'loading' })
  const [geoError, setGeoError] = useState<string | null>(null)
  const [finishRequested, setFinishRequested] = useState(false)
  const [discardRequested, setDiscardRequested] = useState(false)
  const [activeWorkoutConflictId, setActiveWorkoutConflictId] = useState<
    string | null
  >(null)
  const [lowPacePrompt, setLowPacePrompt] = useState(false)
  const [clockNow, setClockNow] = useState(Date.now())
  const [manualFormOpen, setManualFormOpen] = useState(false)
  const [treadmillFormOpen, setTreadmillFormOpen] = useState(false)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [manualDate, setManualDate] = useState(formatLocalDate(new Date()))
  const [manualDistanceMiles, setManualDistanceMiles] = useState('')
  const [manualDurationMinutes, setManualDurationMinutes] = useState('')
  const [manualNotes, setManualNotes] = useState('')
  const [manualMode, setManualMode] =
    useState<Extract<RunTrackingMode, 'manual' | 'treadmill'>>('manual')
  const [treadmillStrideInches, setTreadmillStrideInches] = useState('30')
  const gpsTracker = useRef<GpsTrackerHandle | null>(null)
  const treadmillMotion = useRef(createTreadmillMotionState())
  const storedTreadmillSteps = useRef(0)

  useEffect(() => {
    let isCurrent = true
    void runRepository
      .getActiveRun()
      .then(async (run) => {
        if (!isCurrent) {
          return
        }
        setState(
          run
            ? {
                status: 'ready',
                structure: await runRepository.getRunStructure(run.id),
              }
            : { status: 'idle' },
        )
      })
      .catch((caught: unknown) => {
        if (isCurrent) {
          setState({
            status: 'error',
            message:
              caught instanceof Error ? caught.message : 'Run could not load.',
          })
        }
      })
    return () => {
      isCurrent = false
      stopGpsTracking(gpsTracker.current)
      gpsTracker.current = null
    }
  }, [])

  const activeRunId = state.status === 'ready' ? state.structure.run.id : null
  const activeRunStatus =
    state.status === 'ready' ? state.structure.run.status : null
  const activeRunMode =
    state.status === 'ready'
      ? (state.structure.run.trackingMode ?? 'gps')
      : null
  const activeTreadmillSteps =
    state.status === 'ready' ? (state.structure.run.treadmillStepCount ?? 0) : 0
  storedTreadmillSteps.current = activeTreadmillSteps

  useEffect(() => {
    if (
      !activeRunId ||
      activeRunStatus !== 'active' ||
      activeRunMode !== 'gps'
    ) {
      stopGpsTracking(gpsTracker.current)
      gpsTracker.current = null
      return
    }
    gpsTracker.current = startGpsTracking(activeRunId, {
      onError: (message) => setGeoError(message || null),
      onSample: (result) => {
        setState({ status: 'ready', structure: result.structure })
        if (result.lowPaceAlert) {
          notifyLowPaceIfSupported()
          setLowPacePrompt(true)
        }
      },
    })
    return () => {
      stopGpsTracking(gpsTracker.current)
      gpsTracker.current = null
    }
  }, [activeRunId, activeRunMode, activeRunStatus])

  useEffect(() => {
    if (state.status !== 'ready' || activeRunStatus === 'completed') {
      return
    }
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [activeRunId, activeRunStatus, state.status])

  useEffect(() => {
    if (
      state.status !== 'ready' ||
      activeRunStatus !== 'active' ||
      activeRunMode !== 'treadmill' ||
      !activeRunId
    ) {
      return
    }
    const runId = activeRunId
    treadmillMotion.current = createTreadmillMotionState(
      storedTreadmillSteps.current,
    )
    const onMotion = (event: DeviceMotionEvent) => {
      const acceleration =
        event.accelerationIncludingGravity ?? event.acceleration
      if (
        acceleration?.x == null ||
        acceleration.y == null ||
        acceleration.z == null
      ) {
        return
      }
      const previousCount = treadmillMotion.current.stepCount
      treadmillMotion.current = processTreadmillMotion(
        treadmillMotion.current,
        {
          timestamp: event.timeStamp,
          x: acceleration.x,
          y: acceleration.y,
          z: acceleration.z,
        },
      )
      if (treadmillMotion.current.stepCount === previousCount) {
        return
      }
      void runRepository
        .recordTreadmillSteps(
          runId,
          treadmillMotion.current.stepCount,
          new Date(),
        )
        .then(() => reload(runId))
        .catch((caught: unknown) =>
          setGeoError(
            caught instanceof Error
              ? caught.message
              : 'Treadmill motion could not be recorded.',
          ),
        )
    }
    window.addEventListener('devicemotion', onMotion)
    return () => window.removeEventListener('devicemotion', onMotion)
  }, [activeRunId, activeRunMode, activeRunStatus, state.status])

  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (
        state.status === 'ready' &&
        (state.structure.run.status === 'active' ||
          state.structure.run.status === 'paused')
      ) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [state])

  async function reload(runId: string) {
    setState({
      status: 'ready',
      structure: await runRepository.getRunStructure(runId),
    })
  }

  async function startRun() {
    blurActiveControl()
    setGeoError(null)
    if (!('geolocation' in navigator)) {
      setGeoError(formatGeoError('unsupported'))
      return
    }
    try {
      const run = await runRepository.startRun(new Date(), 'gps')
      await reload(run.id)
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : 'Run could not start.'
      if (message.toLocaleLowerCase().includes('active lifting workout')) {
        const workout = await workoutRepository.getActiveWorkout()
        setActiveWorkoutConflictId(workout?.id ?? null)
        setGeoError(null)
        return
      }
      setGeoError(message)
    }
  }

  async function startTreadmillRun() {
    blurActiveControl()
    setGeoError(null)
    const strideInches = Number(treadmillStrideInches)
    if (
      !Number.isFinite(strideInches) ||
      strideInches < 10 ||
      strideInches > 80
    ) {
      setGeoError('Stride length must be between 10 and 80 inches.')
      return
    }
    if (!(await requestTreadmillMotionPermission())) {
      setGeoError(
        'Motion access is required for treadmill sensing. Allow Motion & Fitness access and try again.',
      )
      return
    }
    try {
      const run = await runRepository.startRun(
        new Date(),
        'treadmill',
        strideInches * 0.0254,
      )
      treadmillMotion.current = createTreadmillMotionState()
      setTreadmillFormOpen(false)
      await reload(run.id)
    } catch (caught) {
      setGeoError(
        caught instanceof Error
          ? caught.message
          : 'Treadmill run could not start.',
      )
    }
  }

  async function saveManualRun() {
    blurActiveControl()
    setGeoError(null)
    const distanceMiles = Number(manualDistanceMiles)
    const durationMinutes = Number(manualDurationMinutes)
    try {
      await runRepository.logManualRun({
        localDate: manualDate,
        distanceMeters: distanceMiles * METERS_PER_MILE,
        elapsedSeconds: Math.round(durationMinutes * 60),
        notes: manualNotes,
        trackingMode: manualMode,
      })
      setManualDistanceMiles('')
      setManualDurationMinutes('')
      setManualNotes('')
      setManualFormOpen(false)
      setSavedMessage('Run saved to History.')
    } catch (caught) {
      setGeoError(
        caught instanceof Error ? caught.message : 'Run could not be saved.',
      )
    }
  }

  async function discardWorkoutAndStartRun() {
    if (!activeWorkoutConflictId) {
      return
    }
    await workoutRepository.discardWorkout(activeWorkoutConflictId)
    setActiveWorkoutConflictId(null)
    await startRun()
  }

  async function pauseRun(run: Run) {
    await runRepository.pauseRun(run.id)
    await reload(run.id)
  }

  async function resumeRun(run: Run) {
    await runRepository.resumeRun(run.id)
    await reload(run.id)
  }

  async function finishRun(run: Run) {
    await runRepository.finishRun(run.id)
    stopGpsTracking(gpsTracker.current)
    gpsTracker.current = null
    setFinishRequested(false)
    await reload(run.id)
  }

  async function discardRun(run: Run) {
    await runRepository.discardRun(run.id)
    stopGpsTracking(gpsTracker.current)
    gpsTracker.current = null
    setDiscardRequested(false)
    setState({ status: 'idle' })
  }

  async function respondToLowPace(run: Run, response: RunAlertResponse) {
    await runRepository.recordLowPaceResponse(run.id, response)
    if (response === 'paused') {
      await runRepository.pauseRun(run.id)
    }
    setLowPacePrompt(false)
    await reload(run.id)
  }

  if (state.status === 'loading') {
    return (
      <PageContainer>
        <LoadingState label="Loading run tracker" />
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

  if (state.status === 'idle') {
    return (
      <PageContainer>
        <SectionHeader title="Run" />
        {geoError ? <ValidationMessage message={geoError} /> : null}
        {savedMessage ? (
          <StatusMessage tone="success">{savedMessage}</StatusMessage>
        ) : null}
        <Card>
          <EmptyState
            title="No active run"
            message="Track outside with GPS, sense treadmill steps, or add a completed run manually."
            action={
              <div className="run-start-actions">
                <PrimaryButton type="button" onClick={startRun}>
                  <Play aria-hidden="true" size={18} />
                  Start Outdoor Run
                </PrimaryButton>
                <SecondaryButton
                  type="button"
                  onClick={() => {
                    setTreadmillFormOpen((current) => !current)
                    setManualFormOpen(false)
                  }}
                >
                  Start Treadmill
                </SecondaryButton>
                <SecondaryButton
                  type="button"
                  onClick={() => {
                    setManualFormOpen((current) => !current)
                    setTreadmillFormOpen(false)
                  }}
                >
                  Log Run Manually
                </SecondaryButton>
              </div>
            }
          />
        </Card>
        {treadmillFormOpen ? (
          <Card title="Treadmill sensing">
            <p className="muted">
              Keep the phone secured on your body. Steps and estimated distance
              use motion sensing and your stride length.
            </p>
            <FormField id="treadmill-stride" label="Stride length (inches)">
              <NumericInput
                id="treadmill-stride"
                min="10"
                max="80"
                onChange={(event) =>
                  setTreadmillStrideInches(event.currentTarget.value)
                }
                value={treadmillStrideInches}
              />
            </FormField>
            <PrimaryButton type="button" onClick={startTreadmillRun}>
              Start Treadmill Run
            </PrimaryButton>
          </Card>
        ) : null}
        {manualFormOpen ? (
          <ManualRunForm
            date={manualDate}
            distanceMiles={manualDistanceMiles}
            durationMinutes={manualDurationMinutes}
            mode={manualMode}
            notes={manualNotes}
            onDate={setManualDate}
            onDistance={setManualDistanceMiles}
            onDuration={setManualDurationMinutes}
            onMode={setManualMode}
            onNotes={setManualNotes}
            onSave={saveManualRun}
          />
        ) : null}
        <RunLimitations />
        <ModalConfirmationDialog
          confirmLabel="Resume Active Workout"
          isOpen={activeWorkoutConflictId !== null}
          onCancel={() => setActiveWorkoutConflictId(null)}
          onConfirm={() => {
            window.location.assign('/workout')
          }}
          title="Workout in progress"
        >
          <p>
            {t(
              'An active workout is in progress. Resume it, discard it before starting this run, or cancel.',
            )}
          </p>
          <SecondaryButton
            className="button-danger"
            type="button"
            onClick={() => void discardWorkoutAndStartRun()}
          >
            {t('Discard Active Workout')}
          </SecondaryButton>
        </ModalConfirmationDialog>
      </PageContainer>
    )
  }

  const { splits, classifications, pauses } = state.structure
  const run = {
    ...state.structure.run,
    ...calculateLiveRunMetrics(
      state.structure.run,
      pauses,
      new Date(clockNow).toISOString(),
    ),
  }
  const completed = run.status === 'completed'

  return (
    <PageContainer>
      <SectionHeader title={completed ? 'Run complete' : 'Run'} />
      {!completed ? (
        <SecondaryButton
          className="button-danger"
          type="button"
          onClick={() => setDiscardRequested(true)}
        >
          {t('Discard Run')}
        </SecondaryButton>
      ) : null}
      <p className="visually-hidden" aria-live="polite">
        {t('Run status')} {t(run.status)}. {t('Distance')}{' '}
        {formatDistance(run.distanceMeters)}.
      </p>
      {geoError ? <ValidationMessage message={geoError} /> : null}
      <Card className="run-hero">
        <div className="run-status-row">
          <span>
            <Footprints aria-hidden="true" size={18} />
            {t(run.status)}
          </span>
          <span>
            <Timer aria-hidden="true" size={18} />
            {formatDuration(run.elapsedSeconds)}
          </span>
          <span>{run.trackingMode === 'treadmill' ? 'Treadmill' : 'GPS'}</span>
        </div>
        <div className="run-metrics">
          <span>
            <strong>{formatDistance(run.distanceMeters)}</strong>
            <small>{t('Distance')}</small>
          </span>
          {run.trackingMode === 'treadmill' ? (
            <span>
              <strong>{run.treadmillStepCount ?? 0}</strong>
              <small>Steps sensed</small>
            </span>
          ) : null}
          <span>
            <strong>{formatDuration(run.movingSeconds)}</strong>
            <small>{t('Moving time')}</small>
          </span>
          <span>
            <strong>{formatPace(run.currentPaceSecondsPerMile)}</strong>
            <small>{t('Current pace')}</small>
          </span>
          <span>
            <strong>{formatPace(run.averageMovingPaceSecondsPerMile)}</strong>
            <small>{t('Average moving pace')}</small>
          </span>
        </div>
      </Card>

      {!completed ? (
        <Card className="run-controls">
          <div className="button-row">
            {run.status === 'active' ? (
              <SecondaryButton type="button" onClick={() => pauseRun(run)}>
                <Pause aria-hidden="true" size={18} />
                {t('Pause')}
              </SecondaryButton>
            ) : (
              <PrimaryButton type="button" onClick={() => resumeRun(run)}>
                <Play aria-hidden="true" size={18} />
                {t('Resume')}
              </PrimaryButton>
            )}
            <SecondaryButton
              className="button-danger"
              type="button"
              onClick={() => setFinishRequested(true)}
            >
              <Square aria-hidden="true" size={18} />
              {t('Finish')}
            </SecondaryButton>
          </div>
        </Card>
      ) : null}

      <Card title="Mile splits">
        {splits.length ? (
          <div className="run-split-list">
            {splits.map((split) => (
              <div key={split.id}>
                <strong>
                  {t('Mile')} {split.mileNumber}
                </strong>
                <span>{formatPace(split.paceSecondsPerMile)}</span>
                <small>
                  {formatDuration(split.movingSeconds)} {t('moving')} -{' '}
                  {formatDuration(split.elapsedSeconds)} {t('elapsed')}
                </small>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No completed mile yet"
            message="Splits appear after each completed mile."
          />
        )}
      </Card>

      <Card title="Walking and rest">
        {classifications.length ? (
          <ul className="compact-list">
            {classifications.map((classification) => (
              <li key={classification.id}>
                <span>{t(classification.type)}</span>
                <strong>
                  {formatTimestamp(classification.startedAt, language)}
                </strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">
            {t('No walking or rest classifications recorded.')}
          </p>
        )}
      </Card>
      <RunLimitations />

      <ModalConfirmationDialog
        confirmLabel="Finish"
        isOpen={finishRequested}
        onCancel={() => setFinishRequested(false)}
        onConfirm={() => void finishRun(run)}
        title="Finish run?"
      >
        <p>
          {t(
            'Save this run to History with its elapsed time, moving time, samples, splits, classifications, and GPS-gap markers.',
          )}
        </p>
      </ModalConfirmationDialog>

      <ModalConfirmationDialog
        confirmLabel="Discard Run"
        isOpen={discardRequested}
        onCancel={() => setDiscardRequested(false)}
        onConfirm={() => void discardRun(run)}
        title="Discard run?"
      >
        <p>
          {t(
            'This permanently discards the active run and all recorded GPS data. It will not appear in history, graphs, or statistics.',
          )}
        </p>
      </ModalConfirmationDialog>

      <ModalConfirmationDialog
        confirmLabel="Continuing"
        isOpen={lowPacePrompt}
        onCancel={() => setLowPacePrompt(false)}
        onConfirm={() => void respondToLowPace(run, 'continuing')}
        title="Still running?"
      >
        <p>
          {t(
            'Your recent pace has stayed low. Classify it without changing stored GPS samples.',
          )}
        </p>
        <div className="button-row">
          <SecondaryButton
            type="button"
            onClick={() => void respondToLowPace(run, 'walking')}
          >
            Walking
          </SecondaryButton>
          <SecondaryButton
            type="button"
            onClick={() => void respondToLowPace(run, 'resting')}
          >
            Resting
          </SecondaryButton>
          <SecondaryButton
            type="button"
            onClick={() => void respondToLowPace(run, 'paused')}
          >
            Pause
          </SecondaryButton>
        </div>
      </ModalConfirmationDialog>
    </PageContainer>
  )
}

function ManualRunForm({
  date,
  distanceMiles,
  durationMinutes,
  mode,
  notes,
  onDate,
  onDistance,
  onDuration,
  onMode,
  onNotes,
  onSave,
}: {
  date: string
  distanceMiles: string
  durationMinutes: string
  mode: Extract<RunTrackingMode, 'manual' | 'treadmill'>
  notes: string
  onDate: (value: Run['localDate']) => void
  onDistance: (value: string) => void
  onDuration: (value: string) => void
  onMode: (value: Extract<RunTrackingMode, 'manual' | 'treadmill'>) => void
  onNotes: (value: string) => void
  onSave: () => void
}) {
  return (
    <Card title="Log completed run">
      <div className="manual-run-form">
        <FormField id="manual-run-date" label="Date">
          <input
            id="manual-run-date"
            onChange={(event) => {
              const value = event.currentTarget.value
              if (isLocalDate(value)) {
                onDate(value)
              }
            }}
            type="date"
            value={date}
          />
        </FormField>
        <FormField id="manual-run-type" label="Run type">
          <select
            id="manual-run-type"
            onChange={(event) => {
              const value = event.currentTarget.value
              if (isManualRunMode(value)) {
                onMode(value)
              }
            }}
            value={mode}
          >
            <option value="manual">Outdoor / other</option>
            <option value="treadmill">Treadmill</option>
          </select>
        </FormField>
        <FormField id="manual-run-distance" label="Distance (miles)">
          <NumericInput
            id="manual-run-distance"
            min="0.01"
            onChange={(event) => onDistance(event.currentTarget.value)}
            placeholder="3.1"
            value={distanceMiles}
          />
        </FormField>
        <FormField id="manual-run-duration" label="Duration (minutes)">
          <NumericInput
            id="manual-run-duration"
            min="0.02"
            onChange={(event) => onDuration(event.currentTarget.value)}
            placeholder="30"
            value={durationMinutes}
          />
        </FormField>
        <FormField id="manual-run-notes" label="Notes">
          <textarea
            id="manual-run-notes"
            onChange={(event) => onNotes(event.currentTarget.value)}
            rows={3}
            value={notes}
          />
        </FormField>
        <PrimaryButton type="button" onClick={onSave}>
          Save Run
        </PrimaryButton>
      </div>
    </Card>
  )
}

type GpsTrackerHandle = {
  watchId: number
  refreshTimer: number | null
}

function startGpsTracking(
  runId: string,
  callbacks: {
    onError: (message: string) => void
    onSample: (result: {
      structure: RunStructure
      lowPaceAlert: boolean
    }) => void
  },
) {
  if (!('geolocation' in navigator)) {
    callbacks.onError(formatGeoError('unsupported'))
    return null
  }
  const options: PositionOptions = {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 15000,
  }
  const onPosition = (position: GeolocationPosition) => {
    const timestamp = new Date(position.timestamp).toISOString()
    void runRepository
      .addSample(runId, {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        timestamp,
        accuracyMeters: position.coords.accuracy,
        altitudeMeters: position.coords.altitude,
      })
      .then(async (result) => {
        callbacks.onError('')
        callbacks.onSample({
          structure: await runRepository.getRunStructure(runId),
          lowPaceAlert: result.lowPaceAlert,
        })
      })
      .catch((caught: unknown) => {
        callbacks.onError(
          caught instanceof Error ? caught.message : formatGeoError('signal'),
        )
      })
  }
  const onError = (error: GeolocationPositionError) =>
    callbacks.onError(formatPositionError(error))
  const watchId = navigator.geolocation.watchPosition(
    onPosition,
    onError,
    options,
  )
  const refreshTimer =
    typeof navigator.geolocation.getCurrentPosition === 'function'
      ? window.setInterval(
          () =>
            navigator.geolocation.getCurrentPosition(
              onPosition,
              onError,
              options,
            ),
          5000,
        )
      : null
  return { watchId, refreshTimer }
}

function stopGpsTracking(handle: GpsTrackerHandle | null) {
  if (!handle) {
    return
  }
  if ('geolocation' in navigator) {
    navigator.geolocation.clearWatch(handle.watchId)
  }
  if (handle.refreshTimer !== null) {
    window.clearInterval(handle.refreshTimer)
  }
}

async function requestTreadmillMotionPermission() {
  if (!('DeviceMotionEvent' in window)) {
    return false
  }
  const motionEvent = window.DeviceMotionEvent as typeof DeviceMotionEvent & {
    requestPermission?: () => Promise<'granted' | 'denied'>
  }
  return motionEvent.requestPermission
    ? (await motionEvent.requestPermission()) === 'granted'
    : true
}

function blurActiveControl() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }
}

function isLocalDate(value: string): value is Run['localDate'] {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function isManualRunMode(
  value: string,
): value is Extract<RunTrackingMode, 'manual' | 'treadmill'> {
  return value === 'manual' || value === 'treadmill'
}

function notifyLowPaceIfSupported() {
  if ('vibrate' in navigator) {
    navigator.vibrate(120)
  }
}

function formatPositionError(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return formatGeoError('permission')
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return formatGeoError('unavailable')
  }
  if (error.code === error.TIMEOUT) {
    return formatGeoError('timeout')
  }
  return formatGeoError('signal')
}

function formatGeoError(
  kind: 'permission' | 'unavailable' | 'timeout' | 'unsupported' | 'signal',
) {
  if (kind === 'permission') {
    return 'Location permission was denied. Enable location access in browser settings to track a run.'
  }
  if (kind === 'unavailable') {
    return 'GPS is unavailable right now. Keep the app open and try again with a clearer signal.'
  }
  if (kind === 'timeout') {
    return 'GPS timed out before a fresh location was available.'
  }
  if (kind === 'unsupported') {
    return 'This browser does not support geolocation.'
  }
  return 'GPS signal was temporarily lost.'
}

function RunLimitations() {
  const { t } = useLanguage()
  return (
    <StatusMessage>
      {t(
        'Foreground browser tracking is supported when location permission exists. iOS and other browsers may suspend geolocation when the browser or installed PWA is backgrounded.',
      )}
    </StatusMessage>
  )
}

function formatTimestamp(timestamp: string, language: 'en' | 'es') {
  return new Intl.DateTimeFormat(language === 'es' ? 'es' : 'en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp))
}
