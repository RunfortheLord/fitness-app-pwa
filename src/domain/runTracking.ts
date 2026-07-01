import type {
  Run,
  RunPause,
  RunSample,
  RunSampleRejectionReason,
  RunSplit,
} from '@shared-types/app'

export const METERS_PER_MILE = 1609.344

export type RawRunSample = {
  latitude: number
  longitude: number
  timestamp: string
  accuracyMeters: number
  altitudeMeters?: number | null
}

export type RunProcessingConfig = {
  maxAccuracyMeters: number
  minDistanceMeters: number
  accuracyDistanceMultiplier: number
  maxSpeedMetersPerSecond: number
  staleSampleSeconds: number
  maxGapSeconds: number
  movingSpeedMetersPerSecond: number
  currentPaceWindowSeconds: number
  lowPaceSpeedMetersPerSecond: number
  lowPaceSustainedSeconds: number
  lowPaceCooldownSeconds: number
}

export const defaultRunProcessingConfig: RunProcessingConfig = {
  maxAccuracyMeters: 25,
  minDistanceMeters: 7,
  accuracyDistanceMultiplier: 1,
  maxSpeedMetersPerSecond: 8.5,
  staleSampleSeconds: 1,
  maxGapSeconds: 30,
  movingSpeedMetersPerSecond: 0.75,
  currentPaceWindowSeconds: 45,
  lowPaceSpeedMetersPerSecond: 1.25,
  lowPaceSustainedSeconds: 90,
  lowPaceCooldownSeconds: 300,
}

export type ProcessRunSampleResult = {
  decision: 'accepted' | 'rejected' | 'gap'
  rejectionReason: RunSampleRejectionReason | null
  segmentDistanceMeters: number
  movingSeconds: number
  gapStarted: boolean
}

export function processRunSample(
  sample: RawRunSample,
  previousAccepted: RunSample | null,
  config = defaultRunProcessingConfig,
  bounds?: {
    notBeforeTimestamp?: string
  },
): ProcessRunSampleResult {
  const sampleTime = Date.parse(sample.timestamp)
  const notBeforeTime = bounds?.notBeforeTimestamp
    ? Date.parse(bounds.notBeforeTimestamp)
    : null
  if (
    !Number.isFinite(sampleTime) ||
    (notBeforeTime !== null &&
      Number.isFinite(notBeforeTime) &&
      sampleTime < notBeforeTime)
  ) {
    return reject('stale')
  }

  if (sample.accuracyMeters > config.maxAccuracyMeters) {
    return reject('poor_accuracy')
  }

  if (!previousAccepted) {
    return {
      decision: 'accepted',
      rejectionReason: 'first_sample',
      segmentDistanceMeters: 0,
      movingSeconds: 0,
      gapStarted: false,
    }
  }

  const seconds = secondsBetween(previousAccepted.timestamp, sample.timestamp)
  if (seconds <= 0 || seconds < config.staleSampleSeconds) {
    return reject('stale')
  }

  if (
    previousAccepted.latitude === sample.latitude &&
    previousAccepted.longitude === sample.longitude
  ) {
    return reject('duplicate')
  }

  const distance = haversineMeters(previousAccepted, sample)
  if (seconds > config.maxGapSeconds) {
    return {
      decision: 'gap',
      rejectionReason: 'long_gap',
      segmentDistanceMeters: 0,
      movingSeconds: 0,
      gapStarted: true,
    }
  }

  const minimumReliableDistance = Math.max(
    config.minDistanceMeters,
    (previousAccepted.accuracyMeters + sample.accuracyMeters) *
      config.accuracyDistanceMultiplier,
  )
  if (distance < minimumReliableDistance) {
    return reject('jitter')
  }

  const speed = distance / seconds
  if (speed > config.maxSpeedMetersPerSecond) {
    return reject('unrealistic_speed')
  }

  return {
    decision: 'accepted',
    rejectionReason: null,
    segmentDistanceMeters: distance,
    movingSeconds: speed >= config.movingSpeedMetersPerSecond ? seconds : 0,
    gapStarted: false,
  }
}

export function createCompletedSplits({
  currentDistanceMeters,
  nextDistanceMeters,
  previousMovingSeconds,
  movingSeconds,
  elapsedSeconds,
  completedAt,
  runId,
  createId,
}: {
  currentDistanceMeters: number
  nextDistanceMeters: number
  previousMovingSeconds: number
  movingSeconds: number
  elapsedSeconds: number
  completedAt: string
  runId: string
  createId: () => string
}): RunSplit[] {
  const previousMiles = Math.floor(currentDistanceMeters / METERS_PER_MILE)
  const nextMiles = Math.floor(nextDistanceMeters / METERS_PER_MILE)
  const created: RunSplit[] = []
  for (
    let mileNumber = previousMiles + 1;
    mileNumber <= nextMiles;
    mileNumber += 1
  ) {
    const mileDistance = mileNumber * METERS_PER_MILE
    const ratio =
      nextDistanceMeters === currentDistanceMeters
        ? 1
        : (mileDistance - currentDistanceMeters) /
          (nextDistanceMeters - currentDistanceMeters)
    const splitMovingSeconds = Math.round(
      previousMovingSeconds + (movingSeconds - previousMovingSeconds) * ratio,
    )
    created.push({
      id: createId(),
      runId,
      mileNumber,
      distanceMeters: mileDistance,
      elapsedSeconds: Math.round(elapsedSeconds),
      movingSeconds: splitMovingSeconds,
      paceSecondsPerMile:
        mileNumber === 1
          ? splitMovingSeconds
          : splitMovingSeconds - created[created.length - 1]!.movingSeconds,
      completedAt,
      createdAt: completedAt,
    })
  }
  return created
}

export function calculatePaceSecondsPerMile(
  distanceMeters: number,
  seconds: number,
) {
  if (distanceMeters <= 0 || seconds <= 0) {
    return null
  }
  return Math.round(seconds / (distanceMeters / METERS_PER_MILE))
}

export function calculateLiveRunMetrics(
  run: Run,
  pauses: RunPause[],
  now: string,
): Pick<
  Run,
  | 'elapsedSeconds'
  | 'movingSeconds'
  | 'currentPaceSecondsPerMile'
  | 'averageMovingPaceSecondsPerMile'
> {
  if (run.status !== 'active') {
    return {
      elapsedSeconds: run.elapsedSeconds,
      movingSeconds: run.movingSeconds,
      currentPaceSecondsPerMile: run.currentPaceSecondsPerMile,
      averageMovingPaceSecondsPerMile: run.averageMovingPaceSecondsPerMile,
    }
  }
  const elapsedSeconds = Math.floor(secondsBetween(run.startedAt, now))
  if (run.trackingMode !== 'treadmill') {
    return {
      elapsedSeconds,
      movingSeconds: run.movingSeconds,
      currentPaceSecondsPerMile: run.currentPaceSecondsPerMile,
      averageMovingPaceSecondsPerMile: run.averageMovingPaceSecondsPerMile,
    }
  }
  const pausedSeconds = pauses.reduce(
    (total, pause) =>
      total + secondsBetween(pause.startedAt, pause.endedAt ?? now),
    0,
  )
  const movingSeconds = Math.max(0, elapsedSeconds - pausedSeconds)
  const pace = calculatePaceSecondsPerMile(run.distanceMeters, movingSeconds)
  return {
    elapsedSeconds,
    movingSeconds,
    currentPaceSecondsPerMile: pace,
    averageMovingPaceSecondsPerMile: pace,
  }
}

export function calculateCurrentPaceSecondsPerMile(
  samples: RunSample[],
  now: string,
  config = defaultRunProcessingConfig,
) {
  const cutoff = Date.parse(now) - config.currentPaceWindowSeconds * 1000
  const recent = samples.filter(
    (sample) =>
      sample.decision === 'accepted' && Date.parse(sample.timestamp) >= cutoff,
  )
  const distance = recent.reduce(
    (sum, sample) => sum + sample.segmentDistanceMeters,
    0,
  )
  const first = recent[0]
  const last = recent.at(-1)
  if (!first || !last) {
    return null
  }
  return calculatePaceSecondsPerMile(
    distance,
    secondsBetween(first.timestamp, last.timestamp),
  )
}

export function shouldShowLowPaceAlert({
  samples,
  now,
  lastAlertedAt,
  config = defaultRunProcessingConfig,
}: {
  samples: RunSample[]
  now: string
  lastAlertedAt: string | null
  config?: RunProcessingConfig
}) {
  if (
    lastAlertedAt &&
    secondsBetween(lastAlertedAt, now) < config.lowPaceCooldownSeconds
  ) {
    return false
  }
  const cutoff = Date.parse(now) - config.lowPaceSustainedSeconds * 1000
  const recent = samples.filter(
    (sample) =>
      sample.decision === 'accepted' && Date.parse(sample.timestamp) >= cutoff,
  )
  if (recent.length < 2) {
    return false
  }
  const first = recent[0]!
  const last = recent.at(-1)!
  const seconds = secondsBetween(first.timestamp, last.timestamp)
  if (seconds < config.lowPaceSustainedSeconds) {
    return false
  }
  const distance = recent.reduce(
    (sum, sample) => sum + sample.segmentDistanceMeters,
    0,
  )
  return distance / seconds <= config.lowPaceSpeedMetersPerSecond
}

export function haversineMeters(
  a: Pick<RawRunSample, 'latitude' | 'longitude'>,
  b: Pick<RawRunSample, 'latitude' | 'longitude'>,
) {
  const earthRadiusMeters = 6371000
  const lat1 = toRadians(a.latitude)
  const lat2 = toRadians(b.latitude)
  const deltaLat = toRadians(b.latitude - a.latitude)
  const deltaLon = toRadians(b.longitude - a.longitude)
  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

export function secondsBetween(start: string, end: string) {
  return Math.max(0, (Date.parse(end) - Date.parse(start)) / 1000)
}

function reject(
  rejectionReason: RunSampleRejectionReason,
): ProcessRunSampleResult {
  return {
    decision: 'rejected',
    rejectionReason,
    segmentDistanceMeters: 0,
    movingSeconds: 0,
    gapStarted: false,
  }
}

function toRadians(value: number) {
  return (value * Math.PI) / 180
}
