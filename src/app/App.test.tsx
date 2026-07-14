import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { App } from '@app/App'
import { HomePage } from '@pages/HomePage'

const appShellMocks = vi.hoisted(() => ({
  automaticBackupStart: vi.fn(),
  signIn: vi.fn(),
  useAuth: vi.fn(),
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
  appShellMocks.automaticBackupStart.mockReset()
  appShellMocks.automaticBackupStart.mockReturnValue(() => undefined)
  appShellMocks.signIn.mockReset()
  appShellMocks.signIn.mockResolvedValue(undefined)
  appShellMocks.useAuth.mockReset()
  appShellMocks.useAuth.mockReturnValue({
    signIn: appShellMocks.signIn,
    signOut: vi.fn(),
    status: 'signedOut',
    user: null,
  })
})

describe('App', () => {
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
      name: 'Prevent data loss',
    })
    expect(prompt).toHaveTextContent(
      'Sign in with Google to automatically back up your fitness data.',
    )

    await user.click(
      screen.getByRole('button', { name: 'Sign in with Google' }),
    )
    expect(appShellMocks.signIn).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: 'Not now' }))
    expect(
      screen.queryByRole('complementary', { name: 'Prevent data loss' }),
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
      screen.queryByRole('complementary', { name: 'Prevent data loss' }),
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
      screen.queryByRole('complementary', { name: 'Prevent data loss' }),
    ).not.toBeInTheDocument()

    await act(() => router.navigate('/'))
    expect(
      screen.queryByRole('complementary', { name: 'Prevent data loss' }),
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
