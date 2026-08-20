import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { App } from '@app/App'
import { AppLaunchScreen } from '@app/AppLaunchScreen'
import { HomePage } from '@pages/HomePage'
import { workoutRepository } from '@repositories/workoutRepository'
import { saveCurrentLegalAcceptance } from '@services/legalAcceptanceService'
import type { Workout } from '@shared-types/app'

const appShellMocks = vi.hoisted(() => ({
  automaticBackupStart: vi.fn(),
  preloadInitialPageData: vi.fn(),
  preloadRoutePages: vi.fn(),
  signIn: vi.fn(),
  signInWithApple: vi.fn(),
  useAuth: vi.fn(),
}))

vi.mock('@app/preloadRoutePages', () => ({
  preloadRoutePages: appShellMocks.preloadRoutePages,
}))

vi.mock('@app/preloadInitialPageData', () => ({
  preloadInitialPageData: appShellMocks.preloadInitialPageData,
}))

vi.mock('@hooks/useAuth', () => ({
  useAuth: appShellMocks.useAuth,
}))

vi.mock('@services/automaticCloudBackupService', () => ({
  automaticCloudBackupService: {
    start: appShellMocks.automaticBackupStart,
  },
}))

beforeEach(() => {
  window.localStorage.clear()
  saveCurrentLegalAcceptance('2026-08-20T18:30:00.000Z')
  appShellMocks.automaticBackupStart.mockReset()
  appShellMocks.automaticBackupStart.mockReturnValue(() => undefined)
  appShellMocks.preloadRoutePages.mockReset()
  appShellMocks.preloadRoutePages.mockResolvedValue(undefined)
  appShellMocks.preloadInitialPageData.mockReset()
  appShellMocks.preloadInitialPageData.mockResolvedValue(undefined)
  appShellMocks.signIn.mockReset()
  appShellMocks.signInWithApple.mockReset()
  appShellMocks.signIn.mockResolvedValue(undefined)
  appShellMocks.signInWithApple.mockResolvedValue(undefined)
  appShellMocks.useAuth.mockReset()
  appShellMocks.useAuth.mockReturnValue({
    signIn: appShellMocks.signIn,
    signInWithApple: appShellMocks.signInWithApple,
    signOut: vi.fn(),
    status: 'signedOut',
    user: null,
  })
})

describe('App', () => {
  it('renders a stable startup screen while the app prepares', () => {
    render(<AppLaunchScreen />)

    expect(
      screen.getByRole('main', { name: 'Loading Vigorune' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Vigorune' })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Getting everything ready…',
    )
  })

  it('preloads the lazy route modules after launch', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <App />,
          children: [{ index: true, element: <p>Dashboard</p> }],
        },
      ],
      { initialEntries: ['/'] },
    )

    render(<RouterProvider router={router} />)

    await waitFor(() =>
      expect(appShellMocks.preloadRoutePages).toHaveBeenCalledOnce(),
    )
    expect(appShellMocks.preloadInitialPageData).toHaveBeenCalledOnce()
  })

  it('releases input focus when the app moves to the background', () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <App />,
          children: [
            {
              index: true,
              element: <input aria-label="Workout entry" />,
            },
          ],
        },
      ],
      { initialEntries: ['/'] },
    )

    render(<RouterProvider router={router} />)
    const input = screen.getByRole('textbox', { name: 'Workout entry' })
    input.focus()
    expect(input).toHaveFocus()

    const originalVisibilityState = document.visibilityState
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    })
    try {
      fireEvent(document, new Event('visibilitychange'))
      expect(input).not.toHaveFocus()
    } finally {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: originalVisibilityState,
      })
    }
  })

  it('renders the mobile shell and home route', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <App />,
          children: [{ index: true, element: <HomePage /> }],
        },
      ],
      { initialEntries: ['/'] },
    )

    render(<RouterProvider router={router} />)

    expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument()
    expect(
      screen.getByRole('navigation', { name: 'Primary' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Skip to content' }),
    ).toHaveAttribute('href', '#main-content')
    const navigation = screen.getByRole('navigation', { name: 'Primary' })
    expect(navigation).toHaveTextContent('Home')
    expect(navigation).toHaveTextContent('Nutrition')
    expect(navigation).toHaveTextContent('Training')
    expect(navigation).toHaveTextContent('Run')
    expect(navigation).not.toHaveTextContent('History')
    expect(
      screen
        .getAllByRole('link')
        .filter((link) => link.closest('nav[aria-label="Primary"]')),
    ).toHaveLength(4)
    expect(
      screen.getByRole('button', { name: 'Open quick actions' }),
    ).toBeInTheDocument()
    expect(await screen.findByLabelText('Selected date')).toBeInTheDocument()
  })

  it("keeps the What's New banner visible after an active workout loads", async () => {
    const timestamp = new Date().toISOString()
    const activeWorkout: Workout = {
      id: 'active-workout',
      sourceActiveCycleId: null,
      sourceTemplateId: null,
      sourceDayId: null,
      localDate: '2026-08-05',
      name: 'Upper',
      workoutSnapshot: {
        activeCycleName: null,
        templateName: null,
        dayName: 'Upper',
        dayNotes: '',
      },
      notes: '',
      startedAt: timestamp,
      completedAt: null,
      durationSeconds: null,
      elapsedPausedSeconds: 0,
      pausedAt: null,
      activeRestTimer: null,
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    vi.spyOn(workoutRepository, 'getActiveWorkout').mockResolvedValue(
      activeWorkout,
    )
    appShellMocks.useAuth.mockReturnValue({
      signIn: appShellMocks.signIn,
      signOut: vi.fn(),
      status: 'signedIn',
      user: { id: 'user-1' },
    })

    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <App />,
          children: [{ index: true, element: <p>Dashboard</p> }],
        },
      ],
      { initialEntries: ['/'] },
    )

    render(<RouterProvider router={router} />)

    expect(
      await screen.findByRole('link', { name: "See what's new" }),
    ).toBeVisible()
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Training' })).toHaveAttribute(
        'href',
        '/workout',
      ),
    )
    expect(screen.getByRole('link', { name: "See what's new" })).toBeVisible()
  })

  it('prompts signed-out users to enable automatic backup on launch', async () => {
    const user = userEvent.setup()
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <App />,
          children: [{ index: true, element: <HomePage /> }],
        },
      ],
      { initialEntries: ['/'] },
    )

    render(<RouterProvider router={router} />)

    const prompt = await screen.findByRole('complementary', {
      name: 'Your data stays local',
    })
    expect(prompt).toHaveTextContent(
      'Start offline with no account, or sign in with Apple or Google',
    )

    await user.click(screen.getByRole('button', { name: 'Sign in with Apple' }))
    expect(appShellMocks.signInWithApple).toHaveBeenCalledOnce()

    await user.click(
      screen.getByRole('button', { name: 'Sign in with Google' }),
    )
    expect(appShellMocks.signIn).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: 'Continue offline' }))
    expect(window.localStorage.getItem('fitness-log.onboarding-seen')).toBe(
      'true',
    )
    expect(
      screen.queryByRole('complementary', { name: 'Your data stays local' }),
    ).not.toBeInTheDocument()
  })

  it('starts automatic backup without prompting when signed in', async () => {
    appShellMocks.useAuth.mockReturnValue({
      signIn: appShellMocks.signIn,
      signOut: vi.fn(),
      status: 'signedIn',
      user: { id: 'user-1' },
    })
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <App />,
          children: [{ index: true, element: <HomePage /> }],
        },
      ],
      { initialEntries: ['/'] },
    )

    render(<RouterProvider router={router} />)

    expect(appShellMocks.automaticBackupStart).toHaveBeenCalledOnce()
    expect(
      screen.queryByRole('complementary', { name: 'Your data stays local' }),
    ).not.toBeInTheDocument()
  })

  it('keeps automatic cloud-backup failures out of the app shell', () => {
    appShellMocks.useAuth.mockReturnValue({
      signIn: appShellMocks.signIn,
      signOut: vi.fn(),
      status: 'signedIn',
      user: { id: 'user-1' },
    })
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <App />,
          children: [
            { index: true, element: <HomePage /> },
            { path: 'settings', element: <p>Settings page</p> },
          ],
        },
      ],
      { initialEntries: ['/'] },
    )

    render(<RouterProvider router={router} />)
    expect(appShellMocks.automaticBackupStart).toHaveBeenCalledWith()
    expect(
      screen.queryByText(/Cloud backup has been failing/),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/A cloud backup already exists/),
    ).not.toBeInTheDocument()
  })

  it('does not show the launch prompt when navigation started elsewhere', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <App />,
          children: [
            { index: true, element: <HomePage /> },
            { path: 'settings', element: <p>Settings page</p> },
          ],
        },
      ],
      { initialEntries: ['/settings'] },
    )

    render(<RouterProvider router={router} />)
    expect(
      screen.queryByRole('complementary', { name: 'Your data stays local' }),
    ).not.toBeInTheDocument()

    await act(() => router.navigate('/'))
    expect(
      screen.queryByRole('complementary', { name: 'Your data stays local' }),
    ).not.toBeInTheDocument()
  })

  it('minimizes the live workout to reach the training screen', async () => {
    appShellMocks.useAuth.mockReturnValue({
      signIn: appShellMocks.signIn,
      signOut: vi.fn(),
      status: 'signedIn',
      user: { id: 'user-1' },
    })
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <App />,
          children: [
            { index: true, element: <HomePage /> },
            { path: 'workout', element: <p>Workout page</p> },
            { path: 'training', element: <p>Training page</p> },
          ],
        },
      ],
      { initialEntries: ['/workout'] },
    )

    render(<RouterProvider router={router} />)

    const minimize = await screen.findByRole('button', {
      name: 'Minimize workout',
    })
    await userEvent.setup().click(minimize)

    expect(screen.getByText('Training page')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Minimize workout' }),
    ).not.toBeInTheDocument()
  })

  it('moves focus to main content after a primary route change', async () => {
    appShellMocks.useAuth.mockReturnValue({
      signIn: appShellMocks.signIn,
      signOut: vi.fn(),
      status: 'signedIn',
      user: { id: 'user-1' },
    })
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <App />,
          children: [
            { index: true, element: <HomePage /> },
            { path: 'settings', element: <p>Settings page</p> },
          ],
        },
      ],
      { initialEntries: ['/'] },
    )

    render(<RouterProvider router={router} />)
    await act(() => router.navigate('/settings'))

    await waitFor(() => {
      expect(screen.getByRole('main', { name: 'Settings' })).toHaveFocus()
    })
  })
})
