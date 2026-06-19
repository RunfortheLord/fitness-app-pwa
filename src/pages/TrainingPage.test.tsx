import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { App } from '@app/App'
import { db } from '@db/database'
import { HistoryPage } from '@pages/HistoryPage'
import { HomePage } from '@pages/HomePage'
import { LiveWorkoutPage } from '@pages/LiveWorkoutPage'
import { TrainingPage } from '@pages/TrainingPage'
import { createProgramRepository } from '@repositories/programRepository'
import { initializeAppData } from '@services/appInitializationService'
import { seedExercise, seedProgram } from '@test/seedFactories'

beforeEach(async () => {
  await db.delete()
  await db.open()
  await initializeAppData()
})

afterEach(async () => {
  await db.delete()
})

describe('TrainingPage', () => {
  it('creates, searches, edits, normalizes rest inputs, and warns on duplicate exercise names', async () => {
    const user = userEvent.setup()
    renderTraining()

    expect(await screen.findByText('Barbell Bench Press')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Edit Barbell Bench Press' }),
    ).not.toBeInTheDocument()
    await user.click(
      screen.getAllByRole('button', { name: 'Create exercise' })[0],
    )
    await expectSaveExerciseDisabled()

    await fillExerciseForm(user, {
      name: 'Bench press',
      rest: '120',
      preset: 'weight_reps',
      notes: 'Barbell bench',
    })
    expect(
      screen.getByText(/external weight and repetitions/),
    ).toBeInTheDocument()
    expect(screen.getByText('Weight (lb)')).toBeInTheDocument()
    expect(screen.getByText('Reps')).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save exercise' }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    await waitFor(async () => {
      const created = await db.exercises.where({ name: 'Bench press' }).first()
      expect(created).toBeTruthy()
    })

    await user.type(
      screen.getByRole('searchbox', { name: 'Search exercises' }),
      'bench',
    )
    expect(await screen.findByText('Barbell bench')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Create exercise' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Name' }),
      'Bench press',
    )
    expect(
      await screen.findByText(/Similar exercise name already exists/),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save exercise' })).toBeEnabled()
    await user.click(
      within(screen.getByRole('dialog', { name: 'Create exercise' })).getByRole(
        'button',
        { name: /Close/ },
      ),
    )

    await user.click(screen.getByRole('button', { name: 'Edit Bench press' }))
    await user.clear(screen.getByRole('textbox', { name: 'Rest minutes' }))
    await user.type(screen.getByRole('textbox', { name: 'Rest minutes' }), '1')
    await user.clear(screen.getByRole('textbox', { name: 'Rest seconds' }))
    await user.type(screen.getByRole('textbox', { name: 'Rest seconds' }), '90')
    await user.tab()
    expect(screen.getByRole('textbox', { name: 'Rest minutes' })).toHaveValue(
      '2',
    )
    expect(screen.getByRole('textbox', { name: 'Rest seconds' })).toHaveValue(
      '30',
    )
    await user.selectOptions(
      screen.getByLabelText('Tracking preset'),
      'reps_only',
    )
    expect(screen.getByText(/repetitions are the only/)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Archive' }),
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save exercise' }))
    expect(await screen.findByText(/Reps only - 150s rest/)).toBeInTheDocument()
  })

  it('hides and restores custom exercises without offering hide for built-ins', async () => {
    const user = userEvent.setup()
    await seedExercise(db)
    renderTraining()

    expect(await screen.findByText('Barbell Bench Press')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Hide Barbell Bench Press' }),
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Hide Bench press' }))
    await waitFor(() =>
      expect(screen.queryByText('Bench press')).not.toBeInTheDocument(),
    )

    await user.click(screen.getByRole('button', { name: 'Hidden' }))
    expect(
      await screen.findByRole('button', { name: 'Restore Bench press' }),
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Restore Bench press' }),
    )
    await user.click(screen.getByRole('button', { name: 'Active' }))
    expect(await screen.findByText('Bench press')).toBeInTheDocument()
  })

  it('opens create exercise from the center Add sheet', async () => {
    const user = userEvent.setup()
    renderTraining(['/'])

    await user.click(screen.getByRole('button', { name: 'Open quick actions' }))
    await user.click(screen.getByRole('button', { name: /Create exercise/ }))

    expect(
      await screen.findByRole('dialog', { name: 'Create exercise' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Training' }),
    ).toBeInTheDocument()
  })

  it('opens create program from the center Add sheet', async () => {
    const user = userEvent.setup()
    renderTraining(['/'])

    await user.click(screen.getByRole('button', { name: 'Open quick actions' }))
    await user.click(
      within(screen.getByRole('dialog', { name: 'Quick actions' })).getByRole(
        'button',
        { name: /Create program/ },
      ),
    )

    expect(
      await screen.findByRole('dialog', { name: 'Create program' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Training' }),
    ).toBeInTheDocument()
  })

  it('creates a program, edits day and exercise ordering, activates it, and manually selects a day', async () => {
    const user = userEvent.setup()
    await seedExercise(db)
    renderTraining()

    await screen.findByText('No program templates')
    await user.click(
      screen.getAllByRole('button', { name: 'Create program' })[0],
    )
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'PPL')
    await user.click(screen.getByRole('button', { name: 'Save program' }))

    expect(
      await screen.findByRole('dialog', { name: 'Edit template' }),
    ).toBeInTheDocument()
    await user.type(
      await screen.findByRole('textbox', { name: 'Add workout day' }),
      'Push',
    )
    await user.click(screen.getByRole('button', { name: 'Add day' }))
    await user.type(
      await screen.findByRole('textbox', { name: 'Add workout day' }),
      'Pull',
    )
    await user.click(screen.getByRole('button', { name: 'Add day' }))
    expect(await screen.findByText('Push')).toBeInTheDocument()
    expect(await screen.findByText('Pull')).toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: 'Down' })[0])
    const builder = screen.getByRole('dialog', { name: 'Edit template' })
    await waitFor(() => {
      const names = within(builder)
        .getAllByText(/Push|Pull/)
        .map((node) => node.textContent)
      expect(names.indexOf('Pull')).toBeLessThan(names.indexOf('Push'))
    })

    await user.click(screen.getAllByRole('button', { name: 'Add exercise' })[0])
    const picker = screen.getByRole('dialog', { name: 'Edit template' })
    const search = await within(picker).findByRole('searchbox', {
      name: 'Search exercises',
    })
    expect(search).toHaveFocus()
    await user.type(search, 'bench')
    await user.keyboard('{Enter}')
    await user.click(
      within(picker).getByRole('button', { name: /Bench press/ }),
    )
    expect(
      within(picker).getByRole('textbox', { name: 'Min reps' }),
    ).toBeInTheDocument()
    expect(
      within(picker).getByRole('textbox', { name: 'Max reps' }),
    ).toBeInTheDocument()
    await user.type(
      within(picker).getByRole('textbox', { name: 'Min reps' }),
      '5',
    )
    await user.type(
      within(picker).getByRole('textbox', { name: 'Max reps' }),
      '10',
    )
    await user.click(screen.getByRole('button', { name: 'Save prescription' }))
    expect(await screen.findByText('Bench press')).toBeInTheDocument()
    await user.click(within(builder).getByRole('button', { name: /Close/ }))

    await user.click(screen.getByRole('button', { name: 'Activate PPL' }))
    await user.click(
      within(
        screen.getByRole('dialog', { name: 'Activate program?' }),
      ).getByRole('button', { name: 'Activate' }),
    )
    expect(await screen.findByText('Program activated.')).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: /Pull/ }))
    expect(
      await screen.findByRole('dialog', { name: 'Pull' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/stays on this day/)).toBeInTheDocument()
  }, 10_000)

  it('searches built-in and visible custom exercises while excluding hidden custom exercises', async () => {
    const user = userEvent.setup()
    const visible = await seedExercise(db)
    const hidden = await seedExercise(db)
    await db.exercises.update(hidden.id, {
      name: 'Hidden Bench Press',
      status: 'hidden',
    })
    await db.exercises.update(visible.id, { name: 'Visible Bench Press' })
    renderTraining()

    await user.click(
      screen.getAllByRole('button', { name: 'Create program' })[0],
    )
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Search')
    await user.click(screen.getByRole('button', { name: 'Save program' }))
    const builder = await screen.findByRole('dialog', { name: 'Edit template' })
    await user.type(
      await within(builder).findByRole('textbox', { name: 'Add workout day' }),
      'Day',
    )
    await user.click(within(builder).getByRole('button', { name: 'Add day' }))
    await within(builder).findByText('Day')
    await user.click(
      within(builder).getByRole('button', { name: 'Add exercise' }),
    )

    const search = within(builder).getByRole('searchbox', {
      name: 'Search exercises',
    })
    await user.type(search, '   ')
    expect(
      screen.getByText('Enter at least two characters to search exercises'),
    ).toBeInTheDocument()
    await user.clear(search)
    await user.type(search, 'bench')

    expect(
      await within(builder).findByText('Barbell Bench Press'),
    ).toBeInTheDocument()
    expect(within(builder).getByText('Visible Bench Press')).toBeInTheDocument()
    expect(
      within(builder).queryByText('Hidden Bench Press'),
    ).not.toBeInTheDocument()
  })

  it('starts a selected workout day, logs a set, and recovers after remount', async () => {
    const user = userEvent.setup()
    const program = await seedProgram(db)
    await createProgramRepository(db).activateTemplate(program.template.id)
    const firstRender = renderTraining()

    await user.click(
      within(await screen.findByLabelText('Workout days')).getByRole('button', {
        name: /Upper/,
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Start Workout' }))

    expect(await screen.findByText('Live workout')).toBeInTheDocument()
    await user.type(
      screen.getByRole('textbox', { name: 'Workout notes' }),
      'Good warmup',
    )
    await user.tab()
    await user.clear(screen.getByRole('textbox', { name: 'Set 1 Weight' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Set 1 Weight' }),
      '185',
    )
    await user.tab()
    await user.clear(screen.getByRole('textbox', { name: 'Set 1 Reps' }))
    await user.type(screen.getByRole('textbox', { name: 'Set 1 Reps' }), '8')
    await user.tab()
    await user.click(screen.getByRole('button', { name: 'Complete set 1' }))

    expect(await screen.findByText('Rest timer')).toBeInTheDocument()
    firstRender.unmount()
    renderTraining(['/workout'])

    expect(await screen.findByDisplayValue('Good warmup')).toBeInTheDocument()
    expect(await screen.findByDisplayValue('185')).toBeInTheDocument()
    expect(screen.getByDisplayValue('8')).toBeInTheDocument()
  })

  it('hides archived templates from the library', async () => {
    const user = userEvent.setup()
    await seedProgram(db)
    renderTraining()

    await waitFor(() =>
      expect(screen.getAllByText('Upper Lower').length).toBeGreaterThan(0),
    )
    await user.click(
      screen.getByRole('button', { name: 'Archive Upper Lower' }),
    )
    await user.click(
      within(
        screen.getByRole('dialog', { name: 'Archive program?' }),
      ).getByRole('button', { name: 'Archive' }),
    )

    await waitFor(() =>
      expect(screen.queryByText('Upper Lower')).not.toBeInTheDocument(),
    )
    expect(screen.getByText('No program templates')).toBeInTheDocument()
  })

  it('persists the active cycle after remount', async () => {
    const user = userEvent.setup()
    const program = await seedProgram(db)
    await createProgramRepository(db).activateTemplate(program.template.id)
    const firstRender = renderTraining()

    await waitFor(() =>
      expect(screen.getAllByText('Upper Lower').length).toBeGreaterThan(0),
    )
    firstRender.unmount()
    renderTraining()

    await waitFor(() =>
      expect(screen.getAllByText('Upper Lower').length).toBeGreaterThan(0),
    )
    expect(
      within(screen.getByLabelText('Workout days')).getByRole('button', {
        name: /Upper/,
      }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Edit current cycle' }))
    const cycleEditor = await screen.findByRole('dialog', {
      name: 'Edit current cycle',
    })
    const cycleNameInput = await within(cycleEditor).findByRole('textbox', {
      name: 'Name',
    })
    await user.clear(cycleNameInput)
    await user.click(
      within(cycleEditor).getByRole('button', { name: 'Save cycle' }),
    )
    expect(screen.getByText('Program name is required.')).toBeInTheDocument()
    expect(cycleEditor).toBeInTheDocument()
    await user.type(
      within(cycleEditor).getByRole('textbox', { name: 'Name' }),
      'Upper Lower',
    )
    await user.type(
      within(cycleEditor).getByRole('textbox', { name: 'Notes' }),
      'Block A',
    )
    await user.click(
      within(cycleEditor).getByRole('button', { name: 'Save cycle' }),
    )
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )

    const activeCycle = await db.activeProgramCycles.toCollection().first()
    expect(activeCycle?.notes).toBe('Block A')
  })
})

function renderTraining(initialEntries = ['/training']) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <App />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'training', element: <TrainingPage /> },
          { path: 'workout', element: <LiveWorkoutPage /> },
          { path: 'history', element: <HistoryPage /> },
        ],
      },
    ],
    { initialEntries },
  )

  return render(<RouterProvider router={router} />)
}

async function expectSaveExerciseDisabled() {
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Save exercise' }),
    ).toBeDisabled(),
  )
}

async function fillExerciseForm(
  user: ReturnType<typeof userEvent.setup>,
  values: {
    name: string
    notes: string
    preset: string
    rest: string
  },
) {
  await user.type(screen.getByRole('textbox', { name: 'Name' }), values.name)
  const totalRestSeconds = Number(values.rest)
  await user.clear(screen.getByRole('textbox', { name: 'Rest minutes' }))
  await user.type(
    screen.getByRole('textbox', { name: 'Rest minutes' }),
    String(Math.floor(totalRestSeconds / 60)),
  )
  await user.clear(screen.getByRole('textbox', { name: 'Rest seconds' }))
  await user.type(
    screen.getByRole('textbox', { name: 'Rest seconds' }),
    String(totalRestSeconds % 60),
  )
  await user.selectOptions(
    screen.getByLabelText('Tracking preset'),
    values.preset,
  )
  await user.type(screen.getByRole('textbox', { name: 'Notes' }), values.notes)
}
