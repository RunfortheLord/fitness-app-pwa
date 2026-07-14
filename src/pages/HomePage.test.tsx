import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { vi } from 'vitest'

import { App } from '@app/App'
import { db } from '@db/database'
import { addLocalDays, formatLocalDate } from '@domain/dates'
import { bodyweightRepository } from '@repositories/bodyweightRepository'
import { HomePage } from '@pages/HomePage'
import { NutritionPage } from '@pages/NutritionPage'
import { createProgramRepository } from '@repositories/programRepository'
import { createWorkoutRepository } from '@repositories/workoutRepository'
import { initializeAppData } from '@services/appInitializationService'
import { dashboardService } from '@services/dashboardService'
import { seedProgram, testLocalDate } from '@test/seedFactories'

beforeEach(async () => {
  dashboardService.clearCachedDashboardData()
  await db.delete()
  await db.open()
  await initializeAppData()
})

afterEach(async () => {
  cleanup()
  vi.restoreAllMocks()
  dashboardService.clearCachedDashboardData()
  await db.delete()
})

function renderHome() {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <App />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'workout', element: <div>Workout route</div> },
        ],
      },
    ],
    { initialEntries: ['/'] },
  )

  render(<RouterProvider router={router} />)
}

function renderHomeWithNutritionRoute() {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <App />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'nutrition', element: <NutritionPage /> },
        ],
      },
    ],
    { initialEntries: ['/'] },
  )

  render(<RouterProvider router={router} />)
}

describe('HomePage', () => {
  it('refreshes the live workout banner when the app resumes', async () => {
    const program = await seedProgram(db)
    const active = await createProgramRepository(db).activateTemplate(
      program.template.id,
    )
    renderHome()
    await waitForDashboardReady()

    await createWorkoutRepository(db).startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    fireEvent(window, new Event('pageshow'))

    expect(
      await screen.findByRole('heading', { name: 'Workout in progress' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Resume workout' }),
    ).toBeInTheDocument()
  })

  it('renders empty dashboard cards from local services', async () => {
    renderHome()

    await waitForDashboardReady()

    expect(
      screen.getByRole('button', { name: 'Return to today' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Trend weight')).toBeInTheDocument()
    expect(screen.getByText('Last recorded')).toBeInTheDocument()
    const bodyweightCard = screen.getByRole('region', { name: 'Bodyweight' })
    expect(
      within(bodyweightCard).getByRole('button', { name: 'Log bodyweight' }),
    ).toBeInTheDocument()
    expect(
      within(bodyweightCard).getByRole('button', { name: 'View graph' }),
    ).toBeInTheDocument()
    expect(
      within(bodyweightCard).queryByText('Edit latest'),
    ).not.toBeInTheDocument()
    expect(
      within(bodyweightCard).queryByText(/Selected date:/),
    ).not.toBeInTheDocument()
    expect(
      within(bodyweightCard).queryByText('Weekly change'),
    ).not.toBeInTheDocument()
    expect(screen.getByText('Calories remaining')).toBeInTheDocument()
    expect(
      screen.getByRole('img', {
        name: 'Daily calories logged and target graph',
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Nutrition' }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('No entry')).toBeInTheDocument()
    expect(screen.getByText('No active program')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Create program' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Dashboard' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'View all history' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Workout history')).not.toBeInTheDocument()
    expect(screen.queryByText('Recent activity')).not.toBeInTheDocument()
  })

  it('shows separated daily calorie bars and the historical target line', async () => {
    renderHome()
    await waitForDashboardReady()

    const chart = screen.getByRole('img', {
      name: 'Daily calories logged and target graph',
    })
    const bars = chart.querySelectorAll('rect.calorie-bar')
    expect(bars).toHaveLength(7)
    expect(Number(bars[0].getAttribute('width'))).toBeLessThan(100 / 7)
    expect(chart.querySelector('polyline.calorie-target-line')).not.toBeNull()
  })

  it('opens the nutrition day tab from the calories remaining card', async () => {
    const user = userEvent.setup()
    renderHomeWithNutritionRoute()
    await waitForDashboardReady()

    await user.click(
      screen.getByRole('button', { name: 'Open calories remaining' }),
    )

    expect(await screen.findByRole('button', { name: 'Day' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(
      await screen.findByText('Daily nutrition totals'),
    ).toBeInTheDocument()
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

  it('shows active program name with start workout in the top home card', async () => {
    const program = await seedProgram(db)
    await createProgramRepository(db).activateTemplate(program.template.id)

    renderHome()
    await waitForDashboardReady()

    expect(
      screen.getByRole('heading', { name: program.template.name }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Current program' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Start Upper' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Week 1 · Next workout')).toBeInTheDocument()
  })

  it('starts the next program day directly from Home', async () => {
    const user = userEvent.setup()
    const program = await seedProgram(db)
    const active = await createProgramRepository(db).activateTemplate(
      program.template.id,
    )

    renderHome()
    await waitForDashboardReady()
    await user.click(screen.getByRole('button', { name: 'Start Upper' }))

    expect(await screen.findByText('Workout route')).toBeInTheDocument()
    await expect(db.workouts.toCollection().first()).resolves.toMatchObject({
      sourceActiveCycleId: active.cycle.id,
      sourceDayId: active.days[0].id,
    })
  })

  it('reuses cached dashboard data immediately after returning Home', async () => {
    const user = userEvent.setup()
    const program = await seedProgram(db)
    await createProgramRepository(db).activateTemplate(program.template.id)
    renderHomeWithNutritionRoute()
    await waitForDashboardReady()

    await user.click(screen.getByRole('link', { name: 'Nutrition' }))
    expect(
      await screen.findByText('Daily nutrition totals'),
    ).toBeInTheDocument()
    vi.spyOn(dashboardService, 'getDashboardData').mockImplementation(
      () => new Promise(() => undefined),
    )
    await user.click(screen.getByRole('link', { name: 'Home' }))

    expect(
      screen.getByRole('button', { name: 'Start Upper' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Loading dashboard')).not.toBeInTheDocument()
    expect(screen.queryByText('No active program')).not.toBeInTheDocument()
  })

  it('replaces start actions with one resume action during an active workout', async () => {
    const program = await seedProgram(db)
    const active = await createProgramRepository(db).activateTemplate(
      program.template.id,
    )
    await createWorkoutRepository(db).startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })

    renderHome()
    await waitForDashboardReady()

    expect(
      screen.getByRole('heading', { name: 'Workout in progress' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Resume workout' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', {
        name: 'Active Workout - Tap to Resume',
      }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Start Upper' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Resume workout' }),
    ).not.toBeInTheDocument()
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

    await user.click(screen.getByRole('button', { name: 'Log bodyweight' }))
    const input = await bodyweightInput()
    await waitFor(() => expect(input).toHaveValue('188.4'))
    await user.clear(input)
    await user.type(input, '189.2')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findAllByText('189.2 lb')).not.toHaveLength(0)
    await expect(db.bodyweightEntries.toArray()).resolves.toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Log bodyweight' }))
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

  it('edits the existing entry when logging bodyweight again on the same date', async () => {
    const user = userEvent.setup()
    renderHome()
    await waitForDashboardReady()

    await user.click(
      await screen.findByRole('button', { name: 'Log bodyweight' }),
    )
    await user.type(await bodyweightInput(), '188')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await user.click(screen.getByRole('button', { name: 'Log bodyweight' }))
    const existingInput = await bodyweightInput()
    await waitFor(() => expect(existingInput).toHaveValue('188'))
    await user.clear(existingInput)
    await user.type(existingInput, '189')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findAllByText('189 lb')).not.toHaveLength(0)
    const bodyweightCard = screen.getByRole('region', { name: 'Bodyweight' })
    const lastRecordedStat = within(bodyweightCard)
      .getByText('Last recorded')
      .closest('.home-bw-stat')
    expect(lastRecordedStat).toHaveTextContent('189 lb')
    expect(screen.queryByText(/Selected date:/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Bodyweight trend')).not.toBeInTheDocument()
    await expect(db.bodyweightEntries.toArray()).resolves.toHaveLength(1)
  })

  it('shows trend weight without the weekly-change detail', async () => {
    const today = formatLocalDate(new Date())
    await bodyweightRepository.saveBodyweight({
      localDate: addLocalDays(today, -14),
      weight: 200,
    })
    await bodyweightRepository.saveBodyweight({
      localDate: addLocalDays(today, -7),
      weight: 190,
    })
    await bodyweightRepository.saveBodyweight({
      localDate: today,
      weight: 200,
    })

    renderHome()
    await waitForDashboardReady()

    const bodyweightCard = screen.getByRole('region', { name: 'Bodyweight' })
    const trendStat = within(bodyweightCard)
      .getByText('Trend weight')
      .closest('.home-bw-stat')
    expect(trendStat).not.toHaveTextContent('—')
    expect(
      within(bodyweightCard).queryByText('Weekly change'),
    ).not.toBeInTheDocument()
    expect(
      within(bodyweightCard).queryByLabelText('Bodyweight trend'),
    ).not.toBeInTheDocument()
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

  it('logs a weight for a past date from the bodyweight card', async () => {
    const user = userEvent.setup()
    renderHome()
    await waitForDashboardReady()

    await user.click(screen.getByRole('button', { name: 'Log bodyweight' }))
    const dialog = await screen.findByRole('dialog', {
      name: 'Log bodyweight',
    })
    const dateInput = within(dialog).getByLabelText('Date')
    expect(dateInput).toHaveClass('bodyweight-date-input')
    expect(dateInput).toHaveValue(formatLocalDate(new Date()))
    fireEvent.change(dateInput, { target: { value: '2026-01-15' } })
    await user.type(within(dialog).getByLabelText('Bodyweight'), '180')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    await expect(db.bodyweightEntries.toArray()).resolves.toEqual([
      expect.objectContaining({
        localDate: '2026-01-15',
        weight: 180,
      }),
    ])
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

    await user.click(screen.getByRole('button', { name: 'Log bodyweight' }))
    expect(await bodyweightInput()).toHaveValue('')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await user.click(screen.getByRole('button', { name: 'Previous day' }))

    await user.click(screen.getByRole('button', { name: 'Log bodyweight' }))
    expect(await bodyweightInput()).toHaveValue('188')
  })

  it('keeps completed workout history off the home dashboard', async () => {
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

    expect(screen.queryByText('Workout history')).not.toBeInTheDocument()
    expect(screen.queryByText('Recent activity')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'View all history' }),
    ).toBeInTheDocument()
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
