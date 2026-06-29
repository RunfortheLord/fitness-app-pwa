import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '@db/database'
import { initializeAppData } from '@services/appInitializationService'
import { RunPage } from './RunPage'

let successCallback: ((position: GeolocationPosition) => void) | null = null
let errorCallback: ((error: GeolocationPositionError) => void) | null = null

beforeEach(async () => {
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
    render(<RunPage />)

    expect(await screen.findByText('No active run')).toBeInTheDocument()
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
      successCallback?.(mockPosition(41.8801, -87.63, 8, 10))
    })
    await waitFor(async () => {
      await expect(db.runSamples.count()).resolves.toBe(2)
      expect((await db.runs.toArray())[0]?.distanceMeters).toBeGreaterThan(0)
    })
  })

  it('handles permission denied without repeating prompts', async () => {
    const user = userEvent.setup()
    render(<RunPage />)

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
    const { unmount } = render(<RunPage />)
    await user.click(
      await screen.findByRole('button', { name: /Start Outdoor Run/ }),
    )
    unmount()

    render(<RunPage />)
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

  it('logs a completed run manually without starting GPS', async () => {
    const user = userEvent.setup()
    render(<RunPage />)

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
    render(<RunPage />)

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
    timestamp: Date.parse('2026-06-19T12:00:00.000Z') + offsetSeconds * 1000,
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
