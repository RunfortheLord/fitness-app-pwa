import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '@db/database'
import { createExerciseRepository } from '@repositories/exerciseRepository'
import { createProgramRepository } from '@repositories/programRepository'
import { runRepository } from '@repositories/runRepository'
import { workoutRepository } from '@repositories/workoutRepository'
import { initializeAppData } from '@services/appInitializationService'
import { clearCachedRunPageData } from '@pages/runPageCache'
import { RunPage } from './RunPage'

let successCallback: ((position: GeolocationPosition) => void) | null = null
let errorCallback: ((error: GeolocationPositionError) => void) | null = null

function renderRunPage() {
  const router = createMemoryRouter(
    [
      { path: '/run', element: <RunPage /> },
      { path: '/workout', element: <div>Workout destination</div> },
    ],
    { initialEntries: ['/run'] },
  )
  return { router, ...render(<RouterProvider router={router} />) }
}

async function startLiftingWorkout() {
  const exercise = await createExerciseRepository(db).createExercise({
    name: 'Active press',
    defaultRestSeconds: 90,
    trackingMethodId: 'weight_reps',
    notes: '',
  })
  const programRepository = createProgramRepository(db)
  const program = await programRepository.createProgramTemplate({
    name: 'Active split',
    days: [
      {
        name: 'Upper',
        exercises: [
          {
            exerciseId: exercise.id,
            targetSetCount: 1,
            targetRepsMin: 6,
            targetRepsMax: 8,
            targetRir: 1,
            restSecondsOverride: null,
          },
        ],
      },
    ],
  })
  const active = await programRepository.activateTemplate(program.template.id)
  await workoutRepository.startWorkout({
    activeCycleId: active.cycle.id,
    dayId: active.days[0].id,
    localDate: '2026-07-30',
  })
}

beforeEach(async () => {
  clearCachedRunPageData()
  await db.delete()
  await db.open()
  await initializeAppData()
  successCallback = null
  errorCallback = null
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      watchPosition: vi.fn((success, error) => {
        successCallback = success
        errorCallback = error
        return 42
      }),
      getCurrentPosition: vi.fn(),
      clearWatch: vi.fn(),
    },
  })
})

afterEach(async () => {
  await db.delete()
  vi.restoreAllMocks()
})

describe('RunPage', () => {
  it('does not start GPS until Start Run and then records a sample', async () => {
    const user = userEvent.setup()
    renderRunPage()

    expect(await screen.findByText('Choose a run')).toBeInTheDocument()
    expect(navigator.geolocation.watchPosition).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /Start Outdoor Run/ }))
    await waitFor(() =>
      expect(navigator.geolocation.watchPosition).toHaveBeenCalledTimes(1),
    )

    await act(async () => {
      successCallback?.(mockPosition(41.88, -87.63, 8, 0))
    })
    await waitFor(async () => {
      await expect(db.runSamples.count()).resolves.toBe(1)
    })
    expect(await screen.findByText('Mile splits')).toBeInTheDocument()

    await act(async () => {
      successCallback?.(mockPosition(41.8802, -87.63, 8, 10))
    })
    await waitFor(async () => {
      await expect(db.runSamples.count()).resolves.toBe(2)
      expect((await db.runs.toArray())[0]?.distanceMeters).toBeGreaterThan(0)
    })
  })

  it('replaces run starts with the active lifting workout action', async () => {
    const user = userEvent.setup()
    await startLiftingWorkout()
    const { router } = renderRunPage()

    const finishWorkout = await screen.findByRole('link', {
      name: 'Finish current workout',
    })
    expect(
      screen.queryByRole('button', { name: /Start Outdoor Run/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Start Treadmill' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Log Run Manually' }),
    ).not.toBeInTheDocument()

    await user.click(finishWorkout)
    expect(router.state.location.pathname).toBe('/workout')
  })

  it('handles permission denied without repeating prompts', async () => {
    const user = userEvent.setup()
    renderRunPage()

    await user.click(
      await screen.findByRole('button', { name: /Start Outdoor Run/ }),
    )
    await waitFor(() =>
      expect(navigator.geolocation.watchPosition).toHaveBeenCalledTimes(1),
    )
    await act(async () => {
      errorCallback?.({
        code: 1,
        message: 'denied',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      })
    })

    expect(
      await screen.findByText(/Location permission was denied/),
    ).toBeInTheDocument()
    expect(navigator.geolocation.watchPosition).toHaveBeenCalledTimes(1)
  })

  it('recovers an active run after remount and confirms finish', async () => {
    const user = userEvent.setup()
    const { unmount } = renderRunPage()
    await user.click(
      await screen.findByRole('button', { name: /Start Outdoor Run/ }),
    )
    unmount()

    renderRunPage()
    expect(await screen.findByText('active')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Finish/ }))
    await user.click(
      within(screen.getByRole('dialog', { name: 'Finish run?' })).getByRole(
        'button',
        { name: 'Finish' },
      ),
    )

    await waitFor(async () => {
      await expect(db.runs.toArray()).resolves.toEqual([
        expect.objectContaining({ status: 'completed' }),
      ])
    })
  })

  it('shows a paused run before the pause write finishes', async () => {
    const user = userEvent.setup()
    renderRunPage()
    await user.click(
      await screen.findByRole('button', { name: /Start Outdoor Run/ }),
    )
    await screen.findByRole('button', { name: 'Pause' })

    const persistPause = runRepository.pauseRun.bind(runRepository)
    let releasePersistence: () => void = () => undefined
    const persistenceGate = new Promise<void>((resolve) => {
      releasePersistence = resolve
    })
    vi.spyOn(runRepository, 'pauseRun').mockImplementation(async (...args) => {
      await persistenceGate
      return persistPause(...args)
    })

    await user.click(screen.getByRole('button', { name: 'Pause' }))

    expect(screen.getByText('paused')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument()

    releasePersistence()
    await waitFor(async () => {
      await expect(db.runs.toCollection().first()).resolves.toMatchObject({
        status: 'paused',
      })
    })
  })

  it('logs a completed run manually without starting GPS', async () => {
    const user = userEvent.setup()
    renderRunPage()

    await user.click(
      await screen.findByRole('button', { name: 'Log Run Manually' }),
    )
    await user.selectOptions(screen.getByLabelText('Run type'), 'treadmill')
    await user.type(screen.getByLabelText('Distance (miles)'), '3.1')
    await user.type(screen.getByLabelText('Duration (minutes)'), '30')
    await user.type(screen.getByLabelText('Notes'), 'Incline session')
    await user.click(screen.getByRole('button', { name: 'Save Run' }))

    expect(await screen.findByText('Run saved to History.')).toBeInTheDocument()
    await expect(db.runs.toArray()).resolves.toEqual([
      expect.objectContaining({
        status: 'completed',
        trackingMode: 'treadmill',
        elapsedSeconds: 1800,
        notes: 'Incline session',
      }),
    ])
    expect(navigator.geolocation.watchPosition).not.toHaveBeenCalled()
  })

  it('starts treadmill sensing only after motion permission and persists detected steps', async () => {
    const user = userEvent.setup()
    class MockDeviceMotionEvent extends Event {
      static requestPermission = vi.fn().mockResolvedValue('granted')
    }
    Object.defineProperty(window, 'DeviceMotionEvent', {
      configurable: true,
      value: MockDeviceMotionEvent,
    })
    const addEventListener = vi.spyOn(window, 'addEventListener')
    renderRunPage()

    await user.click(
      await screen.findByRole('button', { name: 'Start Treadmill' }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Start Treadmill Run' }),
    )
    await waitFor(() =>
      expect(MockDeviceMotionEvent.requestPermission).toHaveBeenCalledOnce(),
    )
    await waitFor(async () => {
      await expect(db.runs.toArray()).resolves.toEqual([
        expect.objectContaining({
          status: 'active',
          trackingMode: 'treadmill',
        }),
      ])
    })
    await waitFor(() =>
      expect(addEventListener).toHaveBeenCalledWith(
        'devicemotion',
        expect.any(Function),
      ),
    )

    act(() => {
      window.dispatchEvent(mockMotionEvent(0, 9.8))
      window.dispatchEvent(mockMotionEvent(300, 12))
    })
    await waitFor(async () => {
      await expect(db.runs.toArray()).resolves.toEqual([
        expect.objectContaining({
          treadmillStepCount: 1,
        }),
      ])
    })
  })
})

function mockPosition(
  latitude: number,
  longitude: number,
  accuracy: number,
  offsetSeconds: number,
): GeolocationPosition {
  return {
    coords: {
      latitude,
      longitude,
      accuracy,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      toJSON: () => ({}),
    },
    timestamp: Date.now() + offsetSeconds * 1000,
    toJSON: () => ({}),
  }
}

function mockMotionEvent(timestamp: number, z: number) {
  const event = new Event('devicemotion')
  Object.defineProperties(event, {
    timeStamp: { value: timestamp },
    accelerationIncludingGravity: {
      value: { x: 0, y: 0, z },
    },
  })
  return event
}
