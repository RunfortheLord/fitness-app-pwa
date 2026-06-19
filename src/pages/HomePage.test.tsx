import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { App } from '@app/App'
import { db } from '@db/database'
import { HomePage } from '@pages/HomePage'
import { initializeAppData } from '@services/appInitializationService'

beforeEach(async () => {
  await db.delete()
  await db.open()
  await initializeAppData()
})

afterEach(async () => {
  await db.delete()
})

function renderHome() {
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
}

describe('HomePage', () => {
  it('renders empty dashboard cards from local services', async () => {
    renderHome()

    await waitForDashboardReady()

    expect(
      screen.getByRole('button', { name: 'Return to today' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Calories consumed')).toBeInTheDocument()
    expect(screen.getByText('Calories remaining')).toBeInTheDocument()
    expect(screen.getByText('No entry')).toBeInTheDocument()
    expect(screen.getByText('No active program')).toBeInTheDocument()
    expect(screen.getByText('No completed workouts')).toBeInTheDocument()
  })

  it('waits for initial dashboard initialization before stable empty-state assertions', async () => {
    renderHome()

    expect(await screen.findByText('Loading dashboard')).toBeInTheDocument()

    await waitForDashboardReady()

    expect(screen.queryByText('Loading dashboard')).not.toBeInTheDocument()
    expect(
      screen.getByRole('status', { name: 'Dashboard ready' }),
    ).toBeInTheDocument()
    expect(screen.getByText('No entry')).toBeInTheDocument()
    expect(screen.getByText('No active program')).toBeInTheDocument()
  })

  it('creates, edits, and deletes bodyweight through the dashboard sheet', async () => {
    const user = userEvent.setup()
    renderHome()
    await waitForDashboardReady()

    await user.click(
      await screen.findByRole('button', { name: 'Add bodyweight' }),
    )
    await user.type(await bodyweightInput(), '188.4')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findAllByText('188.4 lb')).not.toHaveLength(0)

    await user.click(screen.getByRole('button', { name: 'Edit bodyweight' }))
    const input = await bodyweightInput()
    await waitFor(() => expect(input).toHaveValue('188.4'))
    await user.clear(input)
    await user.type(input, '189.2')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findAllByText('189.2 lb')).not.toHaveLength(0)

    await user.click(screen.getByRole('button', { name: 'Edit bodyweight' }))
    await user.click(screen.getByRole('button', { name: /Delete/ }))
    await user.click(
      within(
        screen.getByRole('dialog', { name: 'Delete bodyweight?' }),
      ).getByRole('button', {
        name: 'Delete',
      }),
    )

    await waitFor(() =>
      expect(screen.getByText('No entry')).toBeInTheDocument(),
    )
  })

  it('opens bodyweight entry from the center Add sheet', async () => {
    const user = userEvent.setup()
    renderHome()
    await waitForDashboardReady()

    await user.click(
      await screen.findByRole('button', { name: 'Open quick actions' }),
    )
    await user.click(screen.getByRole('button', { name: /Log bodyweight/ }))

    expect(
      await screen.findByRole('dialog', { name: 'Log bodyweight' }),
    ).toBeInTheDocument()
  })

  it('keeps entries scoped to the selected local date', async () => {
    const user = userEvent.setup()
    renderHome()
    await waitForDashboardReady()

    await user.click(
      await screen.findByRole('button', { name: 'Add bodyweight' }),
    )
    await user.type(await bodyweightInput(), '188')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findAllByText('188 lb')).not.toHaveLength(0)

    await user.click(screen.getByRole('button', { name: 'Next day' }))

    expect(await screen.findByText('No entry')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Previous day' }))

    expect(await screen.findAllByText('188 lb')).not.toHaveLength(0)
  })
})

async function bodyweightInput() {
  return within(
    await screen.findByRole('dialog', { name: 'Log bodyweight' }),
  ).findByRole('textbox', { name: 'Bodyweight' })
}

async function waitForDashboardReady() {
  await screen.findByRole('status', { name: 'Dashboard ready' })
}
