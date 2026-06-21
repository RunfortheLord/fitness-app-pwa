import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { vi } from 'vitest'

import { App } from '@app/App'
import { db } from '@db/database'
import { bodyweightRepository } from '@repositories/bodyweightRepository'
import { HomePage } from '@pages/HomePage'
import { createProgramRepository } from '@repositories/programRepository'
import { createWorkoutRepository } from '@repositories/workoutRepository'
import { initializeAppData } from '@services/appInitializationService'
import { seedProgram, testLocalDate } from '@test/seedFactories'

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
      await screen.findByRole('button', { name: 'Log bodyweight' }),
    )
    await user.type(await bodyweightInput(), '188.4')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findAllByText('188.4 lb')).not.toHaveLength(0)

    await user.click(screen.getByRole('button', { name: 'Edit latest' }))
    const input = await bodyweightInput()
    await waitFor(() => expect(input).toHaveValue('188.4'))
    await user.clear(input)
    await user.type(input, '189.2')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findAllByText('189.2 lb')).not.toHaveLength(0)
    await expect(db.bodyweightEntries.toArray()).resolves.toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Edit latest' }))
    await waitFor(() =>
      expect(
        within(
          screen.getByRole('dialog', { name: 'Log bodyweight' }),
        ).getByRole('textbox', { name: 'Bodyweight' }),
      ).toHaveValue('189.2'),
    )
    await user.click(await screen.findByRole('button', { name: /Delete/ }))
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

  it('validates bodyweight input and keeps the editor open when saving fails', async () => {
    const user = userEvent.setup()
    renderHome()
    await waitForDashboardReady()

    await user.click(
      await screen.findByRole('button', { name: 'Log bodyweight' }),
    )
    await user.type(await bodyweightInput(), '-10')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByRole('alert')).toHaveTextContent('positive')
    expect(
      screen.getByRole('dialog', { name: 'Log bodyweight' }),
    ).toBeInTheDocument()

    const saveSpy = vi
      .spyOn(bodyweightRepository, 'saveBodyweight')
      .mockRejectedValueOnce(new Error('forced persistence failure'))
    const input = await bodyweightInput()
    await user.clear(input)
    await user.type(input, '188')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'forced persistence failure',
    )
    expect(
      screen.getByRole('dialog', { name: 'Log bodyweight' }),
    ).toBeInTheDocument()
    saveSpy.mockRestore()
  })

  it('preserves multiple same-day entries while current weight uses the latest timestamp', async () => {
    const user = userEvent.setup()
    renderHome()
    await waitForDashboardReady()

    await user.click(
      await screen.findByRole('button', { name: 'Log bodyweight' }),
    )
    await user.type(await bodyweightInput(), '188')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await user.click(screen.getByRole('button', { name: 'Log bodyweight' }))
    await user.type(await bodyweightInput(), '189')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findAllByText('189 lb')).not.toHaveLength(0)
    expect(screen.getByText('Selected date: 189 lb')).toBeInTheDocument()
    expect(screen.getByLabelText('Bodyweight trend')).toHaveTextContent('+1 lb')
    await expect(db.bodyweightEntries.toArray()).resolves.toHaveLength(2)
  })

  it('opens bodyweight entry from the center Add sheet', async () => {
    const user = userEvent.setup()
    renderHome()
    await waitForDashboardReady()

    await user.click(
      await screen.findByRole('button', { name: 'Open quick actions' }),
    )
    await user.click(
      within(screen.getByRole('dialog', { name: 'Quick actions' })).getByRole(
        'button',
        { name: /Log bodyweight/ },
      ),
    )

    expect(
      await screen.findByRole('dialog', { name: 'Log bodyweight' }),
    ).toBeInTheDocument()
  })

  it('keeps entries scoped to the selected local date', async () => {
    const user = userEvent.setup()
    renderHome()
    await waitForDashboardReady()

    await user.click(
      await screen.findByRole('button', { name: 'Log bodyweight' }),
    )
    await user.type(await bodyweightInput(), '188')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findAllByText('188 lb')).not.toHaveLength(0)

    await user.click(screen.getByRole('button', { name: 'Next day' }))

    expect(
      await screen.findByText('Selected date: no bodyweight entry'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Previous day' }))

    expect(await screen.findAllByText('188 lb')).not.toHaveLength(0)
  })

  it('shows compact recent workout history from completed history', async () => {
    const program = await seedProgram(db)
    const active = await createProgramRepository(db).activateTemplate(
      program.template.id,
    )
    const repository = createWorkoutRepository(db)
    const started = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    await repository.updateWorkoutSet(started.sets[0].id, {
      metricValues: { weight: 185, reps: 8 },
      completed: true,
    })
    await repository.completeWorkout({
      workoutId: started.workout.id,
      completedAt: new Date(
        Date.parse(started.workout.startedAt) + 20 * 60 * 1000,
      ).toISOString(),
    })

    renderHome()
    await waitForDashboardReady()

    const workoutRow = screen
      .getAllByRole('button', { name: /Upper/ })
      .find((button) =>
        button.getAttribute('aria-controls')?.startsWith('home-history-'),
      )
    expect(workoutRow).toBeTruthy()
    expect(workoutRow).toHaveTextContent('Upper')
    expect(workoutRow).toHaveTextContent('1 exercises')
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
