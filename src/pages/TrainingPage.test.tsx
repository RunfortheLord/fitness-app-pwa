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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { App } from '@app/App'
import { db } from '@db/database'
import { HistoryPage } from '@pages/HistoryPage'
import { HomePage } from '@pages/HomePage'
import { LiveWorkoutPage } from '@pages/LiveWorkoutPage'
import { TrainingPage } from '@pages/TrainingPage'
import { createProgramRepository } from '@repositories/programRepository'
import { createExerciseRepository } from '@repositories/exerciseRepository'
import { workoutRepository } from '@repositories/workoutRepository'
import { initializeAppData } from '@services/appInitializationService'
import { seedExercise, seedProgram, testLocalDate } from '@test/seedFactories'

beforeEach(async () => {
  await db.delete()
  await db.open()
  await initializeAppData()
})

afterEach(async () => {
  cleanup()
  vi.restoreAllMocks()
  await db.delete()
})

describe('TrainingPage', () => {
  it('creates, searches, edits, normalizes rest inputs, and warns on duplicate exercise names', async () => {
    const user = userEvent.setup()
    renderTraining()

    await user.click(
      await screen.findByRole('button', { name: 'Exercise Library' }),
    )
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
    const duplicateDialog = await screen.findByRole('dialog', {
      name: 'Create exercise',
    })
    await user.type(
      within(duplicateDialog).getByRole('textbox', { name: 'Name' }),
      'Bench press',
    )
    expect(
      await within(duplicateDialog).findByText(
        /Similar exercise name already exists/,
        undefined,
        { timeout: 5_000 },
      ),
    ).toBeInTheDocument()
    expect(
      within(duplicateDialog).getByRole('button', { name: 'Save exercise' }),
    ).toBeEnabled()
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

    await user.click(
      await screen.findByRole('button', { name: 'Exercise Library' }),
    )
    expect(await screen.findByText('Barbell Bench Press')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Hide Barbell Bench Press' }),
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Hide Bench press' }))
    await waitFor(async () => {
      const exercise = await db.exercises.where({ name: 'Bench press' }).first()
      expect(exercise?.status).toBe('hidden')
    })
    await waitFor(() =>
      expect(screen.queryByText('Bench press')).not.toBeInTheDocument(),
    )

    await user.click(screen.getByRole('button', { name: 'Hidden' }))
    expect(
      await screen.findByRole(
        'button',
        { name: 'Restore Bench press' },
        { timeout: 5_000 },
      ),
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Restore Bench press' }),
    )
    await user.click(screen.getByRole('button', { name: 'Active' }))
    expect(await screen.findByText('Bench press')).toBeInTheDocument()
  }, 10_000)

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

    // The main library shows only user-owned programs (built-ins live under
    // Browse programs), so wait for the create affordance to confirm load.
    await screen.findAllByRole('button', { name: 'Create program' })
    await user.click(
      screen.getAllByRole('button', { name: 'Create program' })[0],
    )
    await user.type(
      screen.getByRole('textbox', { name: 'Program name' }),
      'PPL',
    )
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
    await waitFor(() => {
      expect(
        within(
          screen.getByRole('dialog', { name: 'Edit template' }),
        ).getAllByText('Push').length,
      ).toBeGreaterThan(0)
      expect(
        within(
          screen.getByRole('dialog', { name: 'Edit template' }),
        ).getAllByText('Pull').length,
      ).toBeGreaterThan(0)
    })

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
    await waitFor(async () => {
      // Ignore the seeded built-in library; only the created program's single
      // prescription should be user-owned.
      const all = await db.templateWorkoutExercises.toArray()
      const userOwned = all.filter(
        (entry) => !entry.templateId.startsWith('builtin-program:'),
      )
      expect(userOwned).toHaveLength(1)
    })
    await user.click(
      within(builder).getByRole('button', { name: /Back from edit template/i }),
    )

    await user.click(screen.getByRole('button', { name: 'Activate PPL' }))
    await user.click(
      within(
        screen.getByRole('dialog', { name: 'Activate program?' }),
      ).getByRole('button', { name: 'Activate' }),
    )
    expect(await screen.findByText('Program activated.')).toBeInTheDocument()
    await waitFor(async () => {
      const activeCycle = await db.activeProgramCycles.toCollection().first()
      expect(activeCycle?.name).toBe('PPL')
    })
    await user.click(
      await screen.findByRole('button', { name: /^Pull/ }, { timeout: 5_000 }),
    )
    expect(
      await screen.findByRole('dialog', { name: 'Pull' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/stays on this day/)).toBeInTheDocument()
  }, 15_000)

  it('saves prescription rest edits to the selected exercise default', async () => {
    const user = userEvent.setup()
    const exercise = await seedExercise(db)
    renderTraining()

    await screen.findAllByRole('button', { name: 'Create program' })
    await user.click(
      screen.getAllByRole('button', { name: 'Create program' })[0],
    )
    await user.type(
      screen.getByRole('textbox', { name: 'Program name' }),
      'Rest defaults',
    )
    await user.click(screen.getByRole('button', { name: 'Save program' }))

    const builder = await screen.findByRole('dialog', { name: 'Edit template' })
    await user.type(
      await within(builder).findByRole('textbox', { name: 'Add workout day' }),
      'Day A',
    )
    await user.click(within(builder).getByRole('button', { name: 'Add day' }))
    await user.click(
      await within(builder).findByRole('button', { name: 'Add exercise' }),
    )
    const search = await within(builder).findByRole('searchbox', {
      name: 'Search exercises',
    })
    await user.type(search, 'bench')
    await user.click(
      await within(builder).findByRole('button', { name: /Bench press/ }),
    )
    await user.clear(
      within(builder).getByRole('textbox', { name: 'Rest minutes' }),
    )
    await user.type(
      within(builder).getByRole('textbox', { name: 'Rest minutes' }),
      '1',
    )
    await user.clear(
      within(builder).getByRole('textbox', { name: 'Rest seconds' }),
    )
    await user.type(
      within(builder).getByRole('textbox', { name: 'Rest seconds' }),
      '45',
    )
    await user.type(
      within(builder).getByRole('textbox', { name: 'Min reps' }),
      '5',
    )
    await user.type(
      within(builder).getByRole('textbox', { name: 'Max reps' }),
      '8',
    )
    await user.click(
      within(builder).getByRole('button', { name: 'Save prescription' }),
    )

    await waitFor(() =>
      expect(
        within(builder).queryByRole('searchbox', {
          name: 'Search exercises',
        }),
      ).not.toBeInTheDocument(),
    )
    await waitFor(async () => {
      await expect(db.exercises.get(exercise.id)).resolves.toMatchObject({
        defaultRestSeconds: 105,
      })
    })
    const prescription = (
      await db.templateWorkoutExercises
        .where({ exerciseId: exercise.id })
        .toArray()
    ).find((entry) => !entry.templateId.startsWith('builtin-program:'))
    expect(prescription).toMatchObject({
      restSecondsOverride: null,
      exerciseSnapshot: { defaultRestSeconds: 105 },
    })
  }, 15_000)

  it('renames the selected workout day inline by editing its name field', async () => {
    const user = userEvent.setup()
    renderTraining()

    await screen.findAllByRole('button', { name: 'Create program' })
    await user.click(
      screen.getAllByRole('button', { name: 'Create program' })[0],
    )
    await user.type(
      screen.getByRole('textbox', { name: 'Program name' }),
      'Split',
    )
    await user.click(screen.getByRole('button', { name: 'Save program' }))

    const builder = await screen.findByRole('dialog', { name: 'Edit template' })
    await user.type(
      await within(builder).findByRole('textbox', { name: 'Add workout day' }),
      'Push',
    )
    await user.click(within(builder).getByRole('button', { name: 'Add day' }))

    const dayNameField = await within(builder).findByRole('textbox', {
      name: 'Workout day name',
    })
    expect(dayNameField).toHaveValue('Push')
    await user.clear(dayNameField)
    await user.type(dayNameField, 'Pull')
    await user.tab()

    await waitFor(() => {
      expect(within(builder).getAllByText('Pull').length).toBeGreaterThan(0)
      expect(within(builder).queryByText('Push')).not.toBeInTheDocument()
    })
  })

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
      (await screen.findAllByRole('button', { name: 'Create program' }))[0],
    )
    await user.type(
      screen.getByRole('textbox', { name: 'Program name' }),
      'Search',
    )
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
        name: /^Upper/,
      }),
    )
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Upper' })).getByRole(
        'button',
        { name: 'Start Workout' },
      ),
    )

    expect(
      await screen.findByRole('button', { name: 'Finish' }, { timeout: 5_000 }),
    ).toBeInTheDocument()
    const workoutHeader =
      firstRender.container.querySelector('.live-workout-hero')
    const exerciseWorkspace = firstRender.container.querySelector(
      '.exercise-workspace',
    )
    expect(workoutHeader).not.toBeNull()
    expect(exerciseWorkspace).not.toBeNull()
    expect(
      within(workoutHeader as HTMLElement).getByRole('button', {
        name: 'Finish',
      }),
    ).toBeInTheDocument()

    const addSetButton = within(exerciseWorkspace as HTMLElement).getByRole(
      'button',
      { name: 'Add Set' },
    )
    const exerciseActions = within(
      exerciseWorkspace as HTMLElement,
    ).getByLabelText('Exercise actions')
    expect(
      addSetButton.compareDocumentPosition(exerciseActions) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      within(exerciseActions).getByRole('button', { name: 'Add Exercise' }),
    ).toBeInTheDocument()
    expect(
      within(exerciseActions).getByRole('button', {
        name: 'Replace Exercise',
      }),
    ).toBeInTheDocument()
    expect(
      within(exerciseActions).getByRole('button', {
        name: 'Remove Exercise',
      }),
    ).toBeInTheDocument()
    expect(
      within(exerciseActions).getByRole('button', { name: 'Skip Exercise' }),
    ).toBeInTheDocument()
    expect(
      within(exerciseWorkspace as HTMLElement).getByLabelText('Exercise notes'),
    ).toHaveTextContent('No exercise notes.')

    const initialWeight = screen.getByRole('textbox', {
      name: 'Set 1 Weight',
    })
    expect(initialWeight).toHaveAttribute('aria-invalid', 'false')
    await user.click(screen.getByRole('button', { name: 'Complete set 1' }))
    expect(
      screen.getByText('Enter the required set values before completing it.'),
    ).toBeInTheDocument()
    expect(initialWeight).toHaveAttribute('aria-invalid', 'true')

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

    expect(await screen.findByLabelText('Rest timer')).toBeInTheDocument()
    expect(
      firstRender.container.querySelector('.rest-timer-card'),
    ).not.toBeInTheDocument()
    expect(
      firstRender.container.querySelector(
        '.exercise-workspace .rest-timer-toolbar',
      ),
    ).toBeInTheDocument()
    expect(
      firstRender.container.querySelector('.rest-timer-panel'),
    ).not.toBeInTheDocument()
    firstRender.unmount()
    renderTraining(['/workout'])

    await waitFor(() =>
      expect(screen.getAllByDisplayValue('185').length).toBeGreaterThan(0),
    )
    expect(screen.getAllByDisplayValue('8').length).toBeGreaterThan(0)
  })

  it('starts live rest timers from the exercise default instead of a global setting', async () => {
    const user = userEvent.setup()
    const exerciseRepository = createExerciseRepository(db)
    const exercise = await exerciseRepository.createExercise({
      name: 'Rested press',
      defaultRestSeconds: 60,
      trackingMethodId: 'weight_reps',
      notes: '',
    })
    const program = await createProgramRepository(db).createProgramTemplate({
      name: 'Rest split',
      days: [
        {
          name: 'Day',
          exercises: [
            {
              exerciseId: exercise.id,
              targetSetCount: 2,
              targetRepsMin: 5,
              targetRepsMax: 8,
              restSecondsOverride: null,
            },
          ],
        },
      ],
    })
    const active = await createProgramRepository(db).activateTemplate(
      program.template.id,
    )
    await db.userSettings.update('settings', { defaultRestSeconds: 300 })
    await workoutRepository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    renderTraining(['/workout'])

    await user.type(
      await screen.findByRole('textbox', { name: 'Set 1 Weight' }),
      '95',
    )
    await user.type(screen.getByRole('textbox', { name: 'Set 1 Reps' }), '8')
    await user.click(screen.getByRole('button', { name: 'Complete set 1' }))

    await waitFor(async () => {
      const workout = await db.workouts.toCollection().first()
      expect(workout?.activeRestTimer?.durationSeconds).toBe(60)
    })
  })

  it('waits for live exercise notes to save before finishing the workout', async () => {
    const user = userEvent.setup()
    const program = await seedProgram(db)
    const active = await createProgramRepository(db).activateTemplate(
      program.template.id,
    )
    const started = await workoutRepository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    await workoutRepository.updateWorkoutSet(started.sets[0].id, {
      metricValues: { weight: 185, reps: 8 },
      completed: true,
    })

    const updateNotes =
      workoutRepository.updateWorkoutExerciseNotes.bind(workoutRepository)
    const releaseSave = { current: null as (() => void) | null }
    let markSaveStarted: (() => void) | null = null
    const saveStarted = new Promise<void>((resolve) => {
      markSaveStarted = resolve
    })
    vi.spyOn(
      workoutRepository,
      'updateWorkoutExerciseNotes',
    ).mockImplementation(
      (workoutExerciseId, notes) =>
        new Promise<void>((resolve, reject) => {
          markSaveStarted?.()
          releaseSave.current = () => {
            void updateNotes(workoutExerciseId, notes).then(
              () => resolve(),
              reject,
            )
          }
        }),
    )
    const completeWorkout = vi.spyOn(workoutRepository, 'completeWorkout')

    renderTraining(['/workout'])

    const notes = await screen.findByLabelText('Exercise notes')
    await user.click(
      within(notes).getByRole('button', { name: 'Edit exercise notes' }),
    )
    const notesInput = within(notes).getByRole('textbox', {
      name: 'Exercise notes',
    })
    await user.clear(notesInput)
    await user.type(notesInput, 'Pause every first rep.')
    await user.click(within(notes).getByRole('button', { name: 'Save notes' }))
    await saveStarted

    await user.click(screen.getByRole('button', { name: 'Finish' }))
    expect(
      within(screen.getByRole('dialog', { name: 'Finish workout?' })).getByRole(
        'checkbox',
        {
          name: 'Save all live workout changes to my program',
        },
      ),
    ).not.toBeChecked()
    await user.click(
      within(screen.getByRole('dialog', { name: 'Finish workout?' })).getByRole(
        'button',
        { name: 'Finish Workout' },
      ),
    )
    expect(completeWorkout).not.toHaveBeenCalled()

    expect(releaseSave.current).not.toBeNull()
    releaseSave.current?.()

    expect(await screen.findByText('Date completed')).toBeInTheDocument()
    await expect(
      db.workoutHistoryExercises.get(started.exercises[0].id),
    ).resolves.toMatchObject({
      notes: 'Pause every first rep.',
    })
  })

  it('does not save live workout changes to the program by default', async () => {
    const user = userEvent.setup()
    const program = await seedProgram(db)
    const active = await createProgramRepository(db).activateTemplate(
      program.template.id,
    )
    const started = await workoutRepository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    await workoutRepository.updateWorkoutSet(started.sets[0].id, {
      completed: true,
    })
    await workoutRepository.addSet(started.exercises[0].id)
    renderTraining(['/workout'])

    await user.click(await screen.findByRole('button', { name: 'Finish' }))
    const finishDialog = screen.getByRole('dialog', {
      name: 'Finish workout?',
    })
    expect(
      within(finishDialog).getByRole('checkbox', {
        name: 'Save all live workout changes to my program',
      }),
    ).not.toBeChecked()
    await user.click(
      within(finishDialog).getByRole('button', { name: 'Finish Workout' }),
    )

    expect(await screen.findByText('Date completed')).toBeInTheDocument()
    await expect(
      db.activeCycleWorkoutExercises.get(active.exercises[0].id),
    ).resolves.toMatchObject({ targetSetCount: 2 })
    await expect(
      db.templateWorkoutExercises.get(program.exercises[0].id),
    ).resolves.toMatchObject({ targetSetCount: 2 })
    await expect(db.detectedWorkoutChanges.toArray()).resolves.toMatchObject([
      {
        type: 'set_added',
        status: 'rejected',
        selectedDestination: 'neither',
      },
    ])
  })

  it('saves all live workout changes when selected at finish', async () => {
    const user = userEvent.setup()
    const program = await seedProgram(db)
    const active = await createProgramRepository(db).activateTemplate(
      program.template.id,
    )
    const started = await workoutRepository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    await workoutRepository.updateWorkoutSet(started.sets[0].id, {
      completed: true,
    })
    await workoutRepository.addSet(started.exercises[0].id)
    renderTraining(['/workout'])

    await user.click(await screen.findByRole('button', { name: 'Finish' }))
    const finishDialog = screen.getByRole('dialog', {
      name: 'Finish workout?',
    })
    await user.click(
      within(finishDialog).getByRole('checkbox', {
        name: 'Save all live workout changes to my program',
      }),
    )
    await user.click(
      within(finishDialog).getByRole('button', { name: 'Finish Workout' }),
    )

    expect(await screen.findByText('Date completed')).toBeInTheDocument()
    await expect(
      db.activeCycleWorkoutExercises.get(active.exercises[0].id),
    ).resolves.toMatchObject({ targetSetCount: 3 })
    await expect(
      db.templateWorkoutExercises.get(program.exercises[0].id),
    ).resolves.toMatchObject({ targetSetCount: 3 })
    await expect(db.detectedWorkoutChanges.toArray()).resolves.toMatchObject([
      {
        type: 'set_added',
        status: 'applied',
        selectedDestination: 'both',
      },
    ])
  })

  it('keeps completed history when saving program changes fails', async () => {
    const user = userEvent.setup()
    const program = await seedProgram(db)
    const active = await createProgramRepository(db).activateTemplate(
      program.template.id,
    )
    const started = await workoutRepository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    await workoutRepository.updateWorkoutSet(started.sets[0].id, {
      completed: true,
    })
    await workoutRepository.addSet(started.exercises[0].id)
    vi.spyOn(workoutRepository, 'applyDetectedChanges').mockRejectedValue(
      new Error('Program update failed.'),
    )
    renderTraining(['/workout'])

    await user.click(await screen.findByRole('button', { name: 'Finish' }))
    const finishDialog = screen.getByRole('dialog', {
      name: 'Finish workout?',
    })
    await user.click(
      within(finishDialog).getByRole('checkbox', {
        name: 'Save all live workout changes to my program',
      }),
    )
    await user.click(
      within(finishDialog).getByRole('button', { name: 'Finish Workout' }),
    )

    expect(
      await screen.findByText(
        'Workout saved, but live workout changes could not be saved to your program.',
      ),
    ).toBeInTheDocument()
    await expect(db.workoutHistoryEntries.toArray()).resolves.toHaveLength(1)
    await expect(db.workouts.toArray()).resolves.toEqual([])
    await expect(
      db.activeCycleWorkoutExercises.get(active.exercises[0].id),
    ).resolves.toMatchObject({ targetSetCount: 2 })
  })

  it('shows start workout controls beside active cycle days and at the top of day detail', async () => {
    const user = userEvent.setup()
    const program = await seedProgram(db)
    await createProgramRepository(db).activateTemplate(program.template.id)
    renderTraining()

    const workoutDays = await screen.findByLabelText('Workout days')
    const upperDay = within(workoutDays)
      .getByText('Upper')
      .closest('.program-day-card')
    expect(upperDay).toBeTruthy()
    expect(
      within(upperDay as HTMLElement).getByRole('button', {
        name: 'Start Workout',
      }),
    ).toBeInTheDocument()

    await user.click(
      within(upperDay as HTMLElement).getByRole('button', { name: /^Upper/ }),
    )
    const dialog = await screen.findByRole('dialog', { name: 'Upper' })
    const startButton = within(dialog).getByRole('button', {
      name: 'Start Workout',
    })
    const firstExercise = within(dialog).getByText('Bench press')
    expect(
      startButton.compareDocumentPosition(firstExercise) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('shows the current program week on the active cycle card', async () => {
    const program = await seedProgram(db)
    await createProgramRepository(db).activateTemplate(program.template.id)
    renderTraining()

    // A freshly activated cycle is in its first week.
    expect(await screen.findByText('Week 1')).toBeInTheDocument()
  })

  it('checks off and unchecks a workout day for the current week with no confirmation', async () => {
    const user = userEvent.setup()
    const program = await seedProgram(db)
    await createProgramRepository(db).activateTemplate(program.template.id)
    renderTraining()

    const checkButton = await screen.findByRole('button', {
      name: 'Mark Upper done this week',
    })
    await user.click(checkButton)

    const checked = await screen.findByRole('button', {
      name: 'Mark Upper not done this week',
    })
    expect(checked).toHaveAttribute('aria-pressed', 'true')

    // Unchecking is also a single tap (no "are you sure" dialog).
    await user.click(checked)
    expect(
      await screen.findByRole('button', {
        name: 'Mark Upper done this week',
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('dialog', { name: /sure/i }),
    ).not.toBeInTheDocument()
  })

  it('shows one live exercise workspace and keeps the active exercise stable after edits, swipes, and reload', async () => {
    const user = userEvent.setup()
    const exerciseRepository = createExerciseRepository(db)
    const press = await exerciseRepository.createExercise({
      name: 'Live press',
      defaultRestSeconds: 60,
      trackingMethodId: 'weight_reps',
      notes: '',
    })
    const row = await exerciseRepository.createExercise({
      name: 'Live pull-up',
      defaultRestSeconds: 60,
      trackingMethodId: 'added_weight_reps',
      notes: '',
    })
    const program = await createProgramRepository(db).createProgramTemplate({
      name: 'Live split',
      days: [
        {
          name: 'Day',
          exercises: [
            {
              exerciseId: press.id,
              targetSetCount: 2,
              targetRepsMin: 6,
              targetRepsMax: 8,
              targetRir: 1,
              restSecondsOverride: null,
              notes: 'Brace hard and pause every first rep.',
            },
            {
              exerciseId: row.id,
              targetSetCount: 2,
              targetRepsMin: 10,
              targetRepsMax: 12,
              targetRir: 1,
              restSecondsOverride: null,
              notes: 'Keep the chest tall and reset between reps.',
            },
          ],
        },
      ],
    })
    const active = await createProgramRepository(db).activateTemplate(
      program.template.id,
    )
    await workoutRepository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })

    const rendered = renderTraining(['/workout'])

    expect(await screen.findByText('Exercise 1 of 2')).toBeInTheDocument()
    expect(
      rendered.container.querySelectorAll('.exercise-workspace'),
    ).toHaveLength(1)
    expect(
      screen.getByRole('heading', { name: 'Live press' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Live pull-up' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('textbox', { name: 'Set 2 final RIR' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('textbox', { name: 'Set 1 final RIR' }),
    ).not.toBeInTheDocument()
    const firstWorkspace = rendered.container.querySelector(
      '.exercise-workspace',
    )
    expect(firstWorkspace).toBeTruthy()
    const firstActions = within(firstWorkspace as HTMLElement).getByLabelText(
      'Exercise actions',
    )
    const firstNotes = within(firstWorkspace as HTMLElement).getByLabelText(
      'Exercise notes',
    )
    expect(
      within(firstNotes).getByText('Brace hard and pause every first rep.'),
    ).toBeInTheDocument()
    expect(
      firstActions.compareDocumentPosition(firstNotes) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('Exercise 2 of 2')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Live pull-up' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('textbox', { name: 'Set 1 Added' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('textbox', { name: 'Set 2 final RIR' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('textbox', { name: 'Set 1 final RIR' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('Brace hard and pause every first rep.'),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText('Keep the chest tall and reset between reps.'),
    ).toBeInTheDocument()
    await user.clear(screen.getByRole('textbox', { name: 'Set 1 Reps' }))
    await user.type(screen.getByRole('textbox', { name: 'Set 1 Reps' }), '12')
    await user.tab()
    expect(screen.getByText('Exercise 2 of 2')).toBeInTheDocument()

    const workspace = rendered.container.querySelector('.exercise-workspace')
    expect(workspace).toBeTruthy()
    fireEvent.pointerDown(workspace!, { clientX: 24, clientY: 100 })
    fireEvent.pointerUp(workspace!, { clientX: 140, clientY: 104 })
    expect(await screen.findByText('Exercise 1 of 2')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next' }))
    rendered.unmount()
    renderTraining(['/workout'])
    expect(await screen.findByText('Exercise 2 of 2')).toBeInTheDocument()
    expect(screen.getAllByDisplayValue('12').length).toBeGreaterThan(0)
  })

  it('permanently deletes inactive templates from the library after two confirmations', async () => {
    const user = userEvent.setup()
    await seedProgram(db)
    renderTraining()

    await waitFor(() =>
      expect(screen.getAllByText('Upper Lower').length).toBeGreaterThan(0),
    )
    await user.click(screen.getByRole('button', { name: 'Delete Upper Lower' }))
    await user.click(
      within(screen.getByRole('dialog', { name: 'Remove program?' })).getByRole(
        'button',
        { name: 'Remove' },
      ),
    )
    await user.click(
      within(
        screen.getByRole('dialog', { name: 'Permanently delete program?' }),
      ).getByRole('button', { name: 'Permanently Delete' }),
    )

    await waitFor(() =>
      expect(screen.queryByText('Upper Lower')).not.toBeInTheDocument(),
    )
    // The user template is gone; the main library shows its empty state.
    expect(screen.getByText('No saved programs')).toBeInTheDocument()
  })

  it('adds a built-in program from Browse programs into the user library', async () => {
    const user = userEvent.setup()
    renderTraining()

    await screen.findByText('No saved programs')

    await user.click(screen.getByRole('button', { name: 'Browse programs' }))
    expect(
      await screen.findByText('Beginner Full Body A/B'),
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', {
        name: 'Add Beginner Full Body A/B to library',
      }),
    )
    expect(
      await screen.findByText('Program added to your library.'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Back to training' }))
    expect(
      await screen.findByText('Beginner Full Body A/B copy'),
    ).toBeInTheDocument()
  })

  it('previews a built-in program from Browse and returns with the back arrow', async () => {
    const user = userEvent.setup()
    renderTraining()

    await screen.findByText('No saved programs')
    await user.click(screen.getByRole('button', { name: 'Browse programs' }))
    await user.click(
      await screen.findByRole('button', {
        name: 'Preview Powerlifting-Focused Full Body - Four Days per Week',
      }),
    )

    // The preview sub-page lists the program's days and exercises read-only.
    expect(
      await screen.findByRole('button', {
        name: 'Back to browse programs',
      }),
    ).toBeInTheDocument()
    expect(
      await screen.findByText('Monday - Squat + Bench'),
    ).toBeInTheDocument()
    expect(
      screen
        .getByRole('button', { name: 'Back to browse programs' })
        .closest('section'),
    ).toHaveClass('subpage-enter')
    expect(screen.getByText('Barbell Back Squat')).toBeInTheDocument()
    const mondayPreview = screen
      .getByText('Monday - Squat + Bench')
      .closest('section')
    if (!mondayPreview) {
      throw new Error('Monday program preview was not found.')
    }
    expect(
      within(mondayPreview).getByText(
        /1 top set of 3, then 2 back-off sets of 3/,
      ),
    ).toBeInTheDocument()
    const squatRow = within(mondayPreview)
      .getByText('Barbell Back Squat')
      .closest('li')
    if (!squatRow) {
      throw new Error('Squat preview row was not found.')
    }
    expect(
      within(squatRow).getByText(/1 top set of 3, then 2 back-off sets of 3/),
    ).not.toHaveClass('program-preview-exercise-summary')

    await user.click(
      screen.getByRole('button', { name: 'Back to browse programs' }),
    )
    // Back on the Browse list.
    expect(
      await screen.findByRole('button', {
        name: 'Add Powerlifting-Focused Full Body - Four Days per Week to library',
      }),
    ).toBeInTheDocument()
  })

  it('closes the Browse sub-page with the Escape key', async () => {
    const user = userEvent.setup()
    renderTraining()

    await screen.findByText('No saved programs')
    await user.click(screen.getByRole('button', { name: 'Browse programs' }))
    expect(
      await screen.findByText('Beginner Full Body A/B'),
    ).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(
      await screen.findByRole('button', { name: 'Browse programs' }),
    ).toBeInTheDocument()
  })

  it('opens the full program library sub-page from Show More', async () => {
    const user = userEvent.setup()
    await seedProgram(db)
    await seedProgram(db)
    await seedProgram(db)
    await seedProgram(db)
    renderTraining()

    await waitFor(() =>
      expect(screen.getAllByText('Upper Lower').length).toBe(3),
    )
    await user.click(screen.getByRole('button', { name: 'Show More' }))

    expect(
      await screen.findByRole('button', { name: 'Back to training' }),
    ).toBeInTheDocument()
    // All four user programs are listed on the full library sub-page.
    await waitFor(() =>
      expect(screen.getAllByText('Upper Lower').length).toBe(4),
    )
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
        name: /^Upper/,
      }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Edit current cycle' }))
    const cycleEditor = await screen.findByRole('dialog', {
      name: 'Edit current cycle',
    })
    const cycleNameInput = await within(cycleEditor).findByRole('textbox', {
      name: 'Program name',
    })
    await waitFor(() => expect(cycleNameInput).toHaveValue('Upper Lower'))
    await user.clear(cycleNameInput)
    await user.tab()
    expect(screen.getByText('Program name is required.')).toBeInTheDocument()
    expect(cycleEditor).toBeInTheDocument()
    await user.type(
      within(cycleEditor).getByRole('textbox', { name: 'Program name' }),
      'Upper Lower',
    )
    await user.tab()

    const activeCycle = await db.activeProgramCycles.toCollection().first()
    expect(activeCycle?.name).toBe('Upper Lower')
    expect(activeCycle?.notes).toBe('')
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
