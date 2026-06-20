import { Footprints, Pause, Play, Square, Timer } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import {
  Card,
  EmptyState,
  LoadingState,
  ModalConfirmationDialog,
  PageContainer,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  StatusMessage,
  ValidationMessage,
} from '@components/ui'
import {
  formatDistance,
  formatDuration,
  formatPace,
} from '@domain/runFormatting'
import { runRepository, type RunStructure } from '@repositories/runRepository'
import type { Run, RunAlertResponse } from '@shared-types/app'

type RunPageState =
  | { status: 'loading' }
  | { status: 'idle' }
  | { status: 'ready'; structure: RunStructure }
  | { status: 'error'; message: string }

export function RunPage() {
  const [state, setState] = useState<RunPageState>({ status: 'loading' })
  const [geoError, setGeoError] = useState<string | null>(null)
  const [finishRequested, setFinishRequested] = useState(false)
  const [lowPacePrompt, setLowPacePrompt] = useState(false)
  const watchId = useRef<number | null>(null)

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
      stopGpsWatch(watchId.current)
      watchId.current = null
    }
  }, [])

  const activeRunId = state.status === 'ready' ? state.structure.run.id : null
  const activeRunStatus =
    state.status === 'ready' ? state.structure.run.status : null

  useEffect(() => {
    if (!activeRunId || activeRunStatus !== 'active') {
      stopGpsWatch(watchId.current)
      watchId.current = null
      return
    }
    watchId.current = startGpsWatch(activeRunId, {
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
      stopGpsWatch(watchId.current)
      watchId.current = null
    }
  }, [activeRunId, activeRunStatus])

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
    setGeoError(null)
    if (!('geolocation' in navigator)) {
      setGeoError(formatGeoError('unsupported'))
      return
    }
    try {
      const run = await runRepository.startRun()
      await reload(run.id)
    } catch (caught) {
      setGeoError(
        caught instanceof Error ? caught.message : 'Run could not start.',
      )
    }
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
    stopGpsWatch(watchId.current)
    watchId.current = null
    setFinishRequested(false)
    await reload(run.id)
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
        <Card>
          <EmptyState
            title="No active run"
            message="GPS collection starts only after Start Run."
            action={
              <PrimaryButton type="button" onClick={startRun}>
                <Play aria-hidden="true" size={18} />
                Start Run
              </PrimaryButton>
            }
          />
        </Card>
        <RunLimitations />
      </PageContainer>
    )
  }

  const { run, splits, classifications } = state.structure
  const completed = run.status === 'completed'

  return (
    <PageContainer>
      <SectionHeader title={completed ? 'Run complete' : 'Run'} />
      <p className="visually-hidden" aria-live="polite">
        Run status {run.status}. Distance {formatDistance(run.distanceMeters)}.
      </p>
      {geoError ? <ValidationMessage message={geoError} /> : null}
      {run.hasGpsGap ? (
        <StatusMessage tone="warning">
          GPS signal gap detected. Distance was not fabricated across the gap.
        </StatusMessage>
      ) : null}

      <Card className="run-hero">
        <div className="run-status-row">
          <span>
            <Footprints aria-hidden="true" size={18} />
            {run.status}
          </span>
          <span>
            <Timer aria-hidden="true" size={18} />
            {formatDuration(run.elapsedSeconds)}
          </span>
        </div>
        <div className="run-metrics">
          <span>
            <strong>{formatDistance(run.distanceMeters)}</strong>
            <small>Distance</small>
          </span>
          <span>
            <strong>{formatDuration(run.movingSeconds)}</strong>
            <small>Moving time</small>
          </span>
          <span>
            <strong>{formatPace(run.currentPaceSecondsPerMile)}</strong>
            <small>Current pace</small>
          </span>
          <span>
            <strong>{formatPace(run.averageMovingPaceSecondsPerMile)}</strong>
            <small>Average moving pace</small>
          </span>
        </div>
      </Card>

      {!completed ? (
        <Card className="run-controls">
          <div className="button-row">
            {run.status === 'active' ? (
              <SecondaryButton type="button" onClick={() => pauseRun(run)}>
                <Pause aria-hidden="true" size={18} />
                Pause
              </SecondaryButton>
            ) : (
              <PrimaryButton type="button" onClick={() => resumeRun(run)}>
                <Play aria-hidden="true" size={18} />
                Resume
              </PrimaryButton>
            )}
            <SecondaryButton
              className="button-danger"
              type="button"
              onClick={() => setFinishRequested(true)}
            >
              <Square aria-hidden="true" size={18} />
              Finish
            </SecondaryButton>
          </div>
        </Card>
      ) : null}

      <Card title="Mile splits">
        {splits.length ? (
          <div className="run-split-list">
            {splits.map((split) => (
              <div key={split.id}>
                <strong>Mile {split.mileNumber}</strong>
                <span>{formatPace(split.paceSecondsPerMile)}</span>
                <small>
                  {formatDuration(split.movingSeconds)} moving -{' '}
                  {formatDuration(split.elapsedSeconds)} elapsed
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
                <span>{classification.type}</span>
                <strong>{formatTimestamp(classification.startedAt)}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No walking or rest classifications recorded.</p>
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
          Save this run to History with its elapsed time, moving time, samples,
          splits, classifications, and GPS-gap markers.
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
          Your recent pace has stayed low. Classify it without changing stored
          GPS samples.
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

function startGpsWatch(
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
  return navigator.geolocation.watchPosition(
    (position) => {
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
    },
    (error) => callbacks.onError(formatPositionError(error)),
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15000,
    },
  )
}

function stopGpsWatch(watchId: number | null) {
  if (watchId !== null && 'geolocation' in navigator) {
    navigator.geolocation.clearWatch(watchId)
  }
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
  return (
    <StatusMessage>
      Foreground browser tracking is supported when location permission exists.
      iOS and other browsers may suspend geolocation when the browser or
      installed PWA is backgrounded.
    </StatusMessage>
  )
}

function formatTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp))
}
