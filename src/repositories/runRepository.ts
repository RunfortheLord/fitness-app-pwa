import { db, type TrainingLogDatabase } from '@db/database'
import { formatLocalDate } from '@domain/dates'
import { createId } from '@domain/ids'
import {
  calculateCurrentPaceSecondsPerMile,
  calculatePaceSecondsPerMile,
  createCompletedSplits,
  processRunSample,
  secondsBetween,
  shouldShowLowPaceAlert,
  type RawRunSample,
} from '@domain/runTracking'
import type {
  Run,
  RunAlertResponse,
  RunClassification,
  RunClassificationType,
  RunPause,
  RunSample,
  RunSplit,
} from '@shared-types/app'

export type RunStructure = {
  run: Run
  samples: RunSample[]
  pauses: RunPause[]
  splits: RunSplit[]
  classifications: RunClassification[]
}

export function createRunRepository(database: TrainingLogDatabase = db) {
  return {
    async startRun(now = new Date()) {
      const timestamp = now.toISOString()
      return database.transaction(
        'rw',
        [database.runs, database.workouts],
        async () => {
          const [existingRun, existingWorkout] = await Promise.all([
            database.runs.where('status').anyOf('active', 'paused').first(),
            database.workouts.where({ status: 'active' }).first(),
          ])
          if (existingRun) {
            throw new Error('An active run already exists.')
          }
          if (existingWorkout) {
            throw new Error(
              'Finish or cancel the active lifting workout before starting a run.',
            )
          }

          const run: Run = {
            id: createId(),
            localDate: formatLocalDate(now),
            status: 'active',
            startedAt: timestamp,
            completedAt: null,
            elapsedSeconds: 0,
            movingSeconds: 0,
            distanceMeters: 0,
            currentPaceSecondsPerMile: null,
            averageMovingPaceSecondsPerMile: null,
            hasGpsGap: false,
            lowPaceAlertedAt: null,
            notes: '',
            createdAt: timestamp,
            updatedAt: timestamp,
          }
          await database.runs.add(run)
          return run
        },
      )
    },

    async getActiveRun() {
      return database.runs.where('status').anyOf('active', 'paused').first()
    },

    async getRunStructure(runId: string): Promise<RunStructure> {
      const run = await database.runs.get(runId)
      if (!run) {
        throw new Error(`Run ${runId} was not found.`)
      }
      const [samples, pauses, splits, classifications] = await Promise.all([
        database.runSamples.where({ runId }).sortBy('timestamp'),
        database.runPauses.where({ runId }).sortBy('startedAt'),
        database.runSplits.where({ runId }).sortBy('mileNumber'),
        database.runClassifications.where({ runId }).sortBy('startedAt'),
      ])
      return { run, samples, pauses, splits, classifications }
    },

    async addSample(runId: string, rawSample: RawRunSample) {
      return database.transaction(
        'rw',
        [database.runs, database.runSamples, database.runSplits],
        async () => {
          const run = await database.runs.get(runId)
          if (!run || run.status !== 'active') {
            throw new Error(`Active run ${runId} was not found.`)
          }
          const previousAccepted = await latestAcceptedSample(database, runId)
          const result = processRunSample(rawSample, previousAccepted)
          const timestamp = rawSample.timestamp
          const sample: RunSample = {
            id: createId(),
            runId,
            latitude: rawSample.latitude,
            longitude: rawSample.longitude,
            timestamp,
            accuracyMeters: rawSample.accuracyMeters,
            altitudeMeters: rawSample.altitudeMeters ?? null,
            decision: result.decision,
            rejectionReason: result.rejectionReason,
            segmentDistanceMeters: result.segmentDistanceMeters,
            createdAt: timestamp,
          }
          await database.runSamples.add(sample)

          const nextDistance = run.distanceMeters + result.segmentDistanceMeters
          const nextMoving = run.movingSeconds + result.movingSeconds
          const elapsedSeconds = secondsBetween(run.startedAt, timestamp)
          const acceptedSamples =
            result.decision === 'accepted'
              ? [...(await acceptedSamplesForRun(database, runId)), sample]
              : await acceptedSamplesForRun(database, runId)
          const splits = createCompletedSplits({
            currentDistanceMeters: run.distanceMeters,
            nextDistanceMeters: nextDistance,
            previousMovingSeconds: run.movingSeconds,
            movingSeconds: nextMoving,
            elapsedSeconds,
            completedAt: timestamp,
            runId,
            createId,
          })
          if (splits.length) {
            await database.runSplits.bulkAdd(splits)
          }
          const updated: Run = {
            ...run,
            elapsedSeconds,
            movingSeconds: nextMoving,
            distanceMeters: nextDistance,
            currentPaceSecondsPerMile: calculateCurrentPaceSecondsPerMile(
              acceptedSamples,
              timestamp,
            ),
            averageMovingPaceSecondsPerMile: calculatePaceSecondsPerMile(
              nextDistance,
              nextMoving,
            ),
            hasGpsGap: run.hasGpsGap || result.gapStarted,
            updatedAt: timestamp,
          }
          await database.runs.put(updated)
          return {
            run: updated,
            sample,
            splits,
            lowPaceAlert: shouldShowLowPaceAlert({
              samples: acceptedSamples,
              now: timestamp,
              lastAlertedAt: run.lowPaceAlertedAt,
            }),
          }
        },
      )
    },

    async pauseRun(runId: string, now = new Date()) {
      const timestamp = now.toISOString()
      return database.transaction(
        'rw',
        [database.runs, database.runPauses],
        async () => {
          const run = await database.runs.get(runId)
          if (!run || run.status !== 'active') {
            throw new Error(`Active run ${runId} was not found.`)
          }
          const pause: RunPause = {
            id: createId(),
            runId,
            startedAt: timestamp,
            endedAt: null,
            createdAt: timestamp,
            updatedAt: timestamp,
          }
          await database.runPauses.add(pause)
          await database.runs.update(runId, {
            status: 'paused',
            elapsedSeconds: secondsBetween(run.startedAt, timestamp),
            updatedAt: timestamp,
          })
          return pause
        },
      )
    },

    async resumeRun(runId: string, now = new Date()) {
      const timestamp = now.toISOString()
      return database.transaction(
        'rw',
        [database.runs, database.runPauses],
        async () => {
          const run = await database.runs.get(runId)
          if (!run || run.status !== 'paused') {
            throw new Error(`Paused run ${runId} was not found.`)
          }
          const pause = await database.runPauses
            .where({ runId })
            .filter((record) => record.endedAt === null)
            .last()
          if (pause) {
            await database.runPauses.update(pause.id, {
              endedAt: timestamp,
              updatedAt: timestamp,
            })
          }
          await database.runs.update(runId, {
            status: 'active',
            elapsedSeconds: secondsBetween(run.startedAt, timestamp),
            updatedAt: timestamp,
          })
        },
      )
    },

    async finishRun(runId: string, now = new Date()) {
      const timestamp = now.toISOString()
      return database.transaction(
        'rw',
        [database.runs, database.runPauses],
        async () => {
          const run = await database.runs.get(runId)
          if (!run || (run.status !== 'active' && run.status !== 'paused')) {
            throw new Error(`Active run ${runId} was not found.`)
          }
          const openPause = await database.runPauses
            .where({ runId })
            .filter((record) => record.endedAt === null)
            .last()
          if (openPause) {
            await database.runPauses.update(openPause.id, {
              endedAt: timestamp,
              updatedAt: timestamp,
            })
          }
          const completed: Run = {
            ...run,
            status: 'completed',
            completedAt: timestamp,
            elapsedSeconds: secondsBetween(run.startedAt, timestamp),
            updatedAt: timestamp,
          }
          await database.runs.put(completed)
          return completed
        },
      )
    },

    async discardRun(runId: string) {
      return database.transaction(
        'rw',
        [
          database.runs,
          database.runSamples,
          database.runPauses,
          database.runSplits,
          database.runClassifications,
        ],
        async () => {
          const run = await database.runs.get(runId)
          if (!run || (run.status !== 'active' && run.status !== 'paused')) {
            throw new Error(`Active run ${runId} was not found.`)
          }
          await database.runClassifications.where({ runId }).delete()
          await database.runSplits.where({ runId }).delete()
          await database.runPauses.where({ runId }).delete()
          await database.runSamples.where({ runId }).delete()
          await database.runs.delete(runId)
        },
      )
    },

    async recordLowPaceResponse(
      runId: string,
      response: RunAlertResponse,
      now = new Date(),
    ) {
      const timestamp = now.toISOString()
      return database.transaction(
        'rw',
        [database.runs, database.runClassifications],
        async () => {
          const run = await database.runs.get(runId)
          if (!run || (run.status !== 'active' && run.status !== 'paused')) {
            throw new Error(`Active run ${runId} was not found.`)
          }
          const type = responseToClassification(response)
          if (type) {
            await database.runClassifications.add({
              id: createId(),
              runId,
              type,
              response,
              startedAt: timestamp,
              endedAt: null,
              createdAt: timestamp,
            })
          }
          await database.runs.update(runId, {
            lowPaceAlertedAt: timestamp,
            updatedAt: timestamp,
          })
        },
      )
    },

    async listRecentCompletedRuns(limit = 25) {
      const runs = await database.runs.where({ status: 'completed' }).toArray()
      return runs
        .sort(
          (first, second) =>
            second.localDate.localeCompare(first.localDate) ||
            (second.completedAt ?? '').localeCompare(first.completedAt ?? ''),
        )
        .slice(0, limit)
    },
  }
}

async function latestAcceptedSample(
  database: TrainingLogDatabase,
  runId: string,
): Promise<RunSample | null> {
  return (
    (await database.runSamples
      .where({ runId })
      .filter((sample) => sample.decision === 'accepted')
      .last()) ?? null
  )
}

async function acceptedSamplesForRun(
  database: TrainingLogDatabase,
  runId: string,
) {
  return database.runSamples
    .where({ runId })
    .filter((sample) => sample.decision === 'accepted')
    .toArray()
}

function responseToClassification(
  response: RunAlertResponse,
): RunClassificationType | null {
  if (response === 'walking') {
    return 'walking'
  }
  if (response === 'resting') {
    return 'resting'
  }
  return null
}

export const runRepository = createRunRepository()
