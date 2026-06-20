import { describe, expect, it } from 'vitest'

import {
  METERS_PER_MILE,
  calculateCurrentPaceSecondsPerMile,
  calculatePaceSecondsPerMile,
  createCompletedSplits,
  defaultRunProcessingConfig,
  processRunSample,
  shouldShowLowPaceAlert,
} from './runTracking'
import type { RunSample } from '@shared-types/app'

const baseSample: RunSample = {
  id: 'sample-1',
  runId: 'run-1',
  latitude: 41.88,
  longitude: -87.63,
  timestamp: '2026-06-19T12:00:00.000Z',
  accuracyMeters: 8,
  altitudeMeters: null,
  decision: 'accepted',
  rejectionReason: 'first_sample',
  segmentDistanceMeters: 0,
  createdAt: '2026-06-19T12:00:00.000Z',
}

describe('runTracking', () => {
  it('accepts the first accurate sample without adding distance', () => {
    expect(
      processRunSample(
        {
          latitude: 41.88,
          longitude: -87.63,
          timestamp: '2026-06-19T12:00:00.000Z',
          accuracyMeters: 10,
        },
        null,
      ),
    ).toMatchObject({
      decision: 'accepted',
      rejectionReason: 'first_sample',
      segmentDistanceMeters: 0,
    })
  })

  it('rejects poor accuracy, stale samples, jitter, and impossible jumps', () => {
    expect(
      processRunSample({ ...baseSample, accuracyMeters: 80 }, baseSample)
        .rejectionReason,
    ).toBe('poor_accuracy')
    expect(
      processRunSample(
        {
          latitude: 41.8801,
          longitude: -87.6301,
          timestamp: baseSample.timestamp,
          accuracyMeters: 8,
        },
        baseSample,
      ).rejectionReason,
    ).toBe('stale')
    expect(
      processRunSample(
        {
          latitude: 41.88001,
          longitude: -87.63,
          timestamp: '2026-06-19T12:00:10.000Z',
          accuracyMeters: 8,
        },
        baseSample,
      ).rejectionReason,
    ).toBe('jitter')
    expect(
      processRunSample(
        {
          latitude: 41.99,
          longitude: -87.63,
          timestamp: '2026-06-19T12:00:10.000Z',
          accuracyMeters: 8,
        },
        baseSample,
      ).rejectionReason,
    ).toBe('unrealistic_speed')
  })

  it('marks long outages as gaps without fabricating a segment', () => {
    expect(
      processRunSample(
        {
          latitude: 41.881,
          longitude: -87.63,
          timestamp: '2026-06-19T12:02:00.000Z',
          accuracyMeters: 8,
        },
        baseSample,
      ),
    ).toMatchObject({
      decision: 'gap',
      rejectionReason: 'long_gap',
      segmentDistanceMeters: 0,
      gapStarted: true,
    })
  })

  it('creates a split for each completed mile', () => {
    const splits = createCompletedSplits({
      currentDistanceMeters: METERS_PER_MILE - 10,
      nextDistanceMeters: METERS_PER_MILE * 2 + 5,
      previousMovingSeconds: 500,
      movingSeconds: 1300,
      elapsedSeconds: 1400,
      completedAt: '2026-06-19T12:30:00.000Z',
      runId: 'run-1',
      createId: () => crypto.randomUUID(),
    })

    expect(splits).toHaveLength(2)
    expect(splits[0]?.mileNumber).toBe(1)
    expect(splits[1]?.mileNumber).toBe(2)
    expect(splits[1]?.paceSecondsPerMile).toBeGreaterThan(0)
  })

  it('calculates current and average pace with invalid denominator guards', () => {
    expect(calculatePaceSecondsPerMile(0, 500)).toBeNull()
    expect(calculatePaceSecondsPerMile(METERS_PER_MILE, 480)).toBe(480)
    const samples = [
      baseSample,
      {
        ...baseSample,
        id: 'sample-2',
        timestamp: '2026-06-19T12:00:30.000Z',
        segmentDistanceMeters: METERS_PER_MILE / 16,
      },
    ]
    expect(
      calculateCurrentPaceSecondsPerMile(samples, '2026-06-19T12:00:30.000Z'),
    ).toBe(480)
  })

  it('uses sustained low pace and cooldown for alerts', () => {
    const config = {
      ...defaultRunProcessingConfig,
      lowPaceSustainedSeconds: 60,
      lowPaceCooldownSeconds: 300,
    }
    const samples = [
      baseSample,
      {
        ...baseSample,
        id: 'sample-2',
        timestamp: '2026-06-19T12:01:00.000Z',
        segmentDistanceMeters: 10,
      },
    ]
    expect(
      shouldShowLowPaceAlert({
        samples,
        now: '2026-06-19T12:01:00.000Z',
        lastAlertedAt: null,
        config,
      }),
    ).toBe(true)
    expect(
      shouldShowLowPaceAlert({
        samples,
        now: '2026-06-19T12:02:00.000Z',
        lastAlertedAt: '2026-06-19T12:01:00.000Z',
        config,
      }),
    ).toBe(false)
  })
})
