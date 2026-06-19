import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { App } from '@app/App'
import { db } from '@db/database'
import { HomePage } from '@pages/HomePage'
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
  it('creates, searches, edits, archives, restores, and warns on duplicate exercise names', async () => {
    const user = userEvent.setup()
    renderTraining()

    await screen.findByText('No exercises yet')
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
    expect(await screen.findByText('Bench press')).toBeInTheDocument()

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
        { name: 'Close quick actions' },
      ),
    )

    await user.click(screen.getByRole('button', { name: 'Edit Bench press' }))
    await user.clear(screen.getByRole('textbox', { name: 'Default rest time' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Default rest time' }),
      '150',
    )
    await user.selectOptions(
      screen.getByLabelText('Tracking preset'),
      'reps_only',
    )
    expect(screen.getByText(/repetitions are the only/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save exercise' }))
    expect(await screen.findByText(/Reps only - 150s rest/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Edit Bench press' }))
    await user.click(screen.getByRole('button', { name: 'Archive' }))
    await waitFor(() =>
      expect(screen.queryByText('Bench press')).not.toBeInTheDocument(),
    )

    await user.click(screen.getByRole('button', { name: 'Archived' }))
    expect(await screen.findByText('Bench press')).toBeInTheDocument()
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
    await user.selectOptions(screen.getByLabelText('Exercise'), 'Bench press')
    await user.click(screen.getByRole('button', { name: 'Save prescription' }))
    expect(await screen.findByText('Bench press')).toBeInTheDocument()
    await user.click(
      within(builder).getByRole('button', { name: 'Close quick actions' }),
    )

    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    await user.click(screen.getByRole('button', { name: 'Activate PPL' }))
    expect(await screen.findByText('Program activated.')).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: /Pull/ }))
    expect(
      await screen.findByRole('dialog', { name: 'Pull' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/stays on this day/)).toBeInTheDocument()
    confirm.mockRestore()
  })

  it('hides archived templates from the library', async () => {
    const user = userEvent.setup()
    await seedProgram(db)
    renderTraining()

    await waitFor(() =>
      expect(screen.getAllByText('Upper Lower').length).toBeGreaterThan(0),
    )
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await user.click(
      screen.getByRole('button', { name: 'Archive Upper Lower' }),
    )

    await waitFor(() =>
      expect(screen.queryByText('Upper Lower')).not.toBeInTheDocument(),
    )
    expect(screen.getByText('No program templates')).toBeInTheDocument()
    vi.restoreAllMocks()
  })

  it('persists the active cycle after remount', async () => {
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
  await user.clear(screen.getByRole('textbox', { name: 'Default rest time' }))
  await user.type(
    screen.getByRole('textbox', { name: 'Default rest time' }),
    values.rest,
  )
  await user.selectOptions(
    screen.getByLabelText('Tracking preset'),
    values.preset,
  )
  await user.type(screen.getByRole('textbox', { name: 'Notes' }), values.notes)
}
