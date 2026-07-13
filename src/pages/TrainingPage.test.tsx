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
    expect(
      await screen.findByText(/Reps only - 150s rest/, undefined, {
        timeout: 15_000,
      }),
    ).toBeInTheDocument()
  }, 30_000)

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

  it('creates a program, adds days and an exercise, activates it, and manually selects a day', async () => {
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
    const builder = screen.getByRole('dialog', { name: 'Edit template' })
    await addWorkoutDay(user, builder, 'Push')
    await addWorkoutDay(user, builder, 'Pull')
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

    // Day reordering is drag-only (covered by SortableList tests); the builder
    // exposes no Up/Down buttons.
    expect(
      within(builder).queryByRole('button', { name: 'Down' }),
    ).not.toBeInTheDocument()
    expect(
      within(builder).queryByRole('button', { name: 'Up' }),
    ).not.toBeInTheDocument()

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
    await addWorkoutDay(user, builder, 'Day A')
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
    // Rest is set with the scrollable minute/second wheel; click 1 min 45 sec.
    await user.click(
      within(
        within(builder).getByRole('listbox', { name: 'Rest minutes' }),
      ).getByRole('option', { name: '01' }),
    )
    await user.click(
      within(
        within(builder).getByRole('listbox', { name: 'Rest seconds' }),
      ).getByRole('option', { name: '45' }),
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

  it('adds workout days from the compact plus control without a persistent naming field', async () => {
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
    const dayTabs = await within(builder).findByLabelText('Program days')
    expect(
      within(dayTabs).getByRole('button', { name: 'Add workout day' }),
    ).toBeInTheDocument()
    expect(
      within(builder).queryByRole('textbox', { name: 'New workout day name' }),
    ).not.toBeInTheDocument()

    await addWorkoutDay(user, builder, 'Push')

    expect(
      within(builder).queryByRole('textbox', { name: 'Workout day name' }),
    ).not.toBeInTheDocument()
    expect(
      within(builder).queryByRole('textbox', { name: 'Add workout day' }),
    ).not.toBeInTheDocument()
    expect(
      within(builder).getByRole('button', { name: 'Add workout day' }),
    ).toBeInTheDocument()
    expect(
      await within(builder).findByRole('button', { name: /^Push/ }),
    ).toBeInTheDocument()
  })

  it('cancels the compact workout-day input without adding a day', async () => {
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
    const dayCountBefore = await db.templateWorkoutDays.count()
    await user.click(
      await within(builder).findByRole('button', { name: 'Add workout day' }),
    )
    await user.type(
      within(builder).getByRole('textbox', { name: 'New workout day name' }),
      'Push',
    )
    await user.click(
      within(builder).getByRole('button', {
        name: 'Cancel adding workout day',
      }),
    )

    expect(within(builder).queryByText('Push')).not.toBeInTheDocument()
    await expect(db.templateWorkoutDays.count()).resolves.toBe(dayCountBefore)
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
    await addWorkoutDay(user, builder, 'Day')
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
    const sessionBar = firstRender.container.querySelector(
      '.live-workout-session-bar',
    )
    const exerciseWorkspace = firstRender.container.querySelector(
      '.exercise-workspace',
    )
    expect(workoutHeader).not.toBeNull()
    expect(sessionBar).not.toBeNull()
    expect(exerciseWorkspace).not.toBeNull()
    expect(
      within(sessionBar as HTMLElement).getByRole('button', {
        name: 'Finish',
      }),
    ).toBeInTheDocument()
    expect(
      within(sessionBar as HTMLElement).getByRole('button', {
        name: 'Discard workout',
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
        name: 'Swap Exercise',
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

    await user.click(
      await screen.findByRole('button', { name: 'Rest timer settings' }),
    )
    const settings = await screen.findByRole('dialog', {
      name: 'Rest timer settings',
    })
    expect(
      within(settings).queryByRole('textbox', {
        name: 'Exercise default rest (seconds)',
      }),
    ).not.toBeInTheDocument()
    await user.click(
      within(
        within(settings).getByRole('listbox', { name: 'Rest minutes' }),
      ).getByRole('option', { name: '01' }),
    )
    await user.click(
      within(
        within(settings).getByRole('listbox', { name: 'Rest seconds' }),
      ).getByRole('option', { name: '30' }),
    )
    await user.click(within(settings).getByRole('button', { name: 'Save' }))

    await waitFor(async () => {
      await expect(db.exercises.get(exercise.id)).resolves.toMatchObject({
        defaultRestSeconds: 90,
      })
      const activeExercise = await db.workoutExercises.toCollection().first()
      expect(activeExercise?.exerciseSnapshot.defaultRestSeconds).toBe(90)
    })
  })

  it('checks off a set and shows timer controls before persistence finishes', async () => {
    const user = userEvent.setup()
    const exerciseRepository = createExerciseRepository(db)
    const exercise = await exerciseRepository.createExercise({
      name: 'Instant press',
      defaultRestSeconds: 60,
      trackingMethodId: 'weight_reps',
      notes: '',
    })
    const program = await createProgramRepository(db).createProgramTemplate({
      name: 'Instant split',
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
    await workoutRepository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })

    const persistSet =
      workoutRepository.updateWorkoutSet.bind(workoutRepository)
    let releasePersistence: () => void = () => undefined
    const persistenceGate = new Promise<void>((resolve) => {
      releasePersistence = resolve
    })
    vi.spyOn(workoutRepository, 'updateWorkoutSet').mockImplementation(
      async (...args) => {
        await persistenceGate
        return persistSet(...args)
      },
    )

    renderTraining(['/workout'])
    await user.type(
      await screen.findByRole('textbox', { name: 'Set 1 Weight' }),
      '95',
    )
    await user.type(screen.getByRole('textbox', { name: 'Set 1 Reps' }), '8')
    await user.click(screen.getByRole('button', { name: 'Complete set 1' }))

    expect(
      await screen.findByRole('button', { name: 'Mark incomplete set 1' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByLabelText('Rest timer')).toBeInTheDocument()

    releasePersistence()
    await waitFor(async () => {
      const savedSet = (await db.workoutSets.toArray()).find(
        (set) => set.setNumber === 1,
      )
      expect(savedSet?.completed).toBe(true)
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
        'button',
        { name: 'Finish Workout' },
      ),
    ).toBeInTheDocument()
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

  it('saves a program change that finishes persisting after the finish dialog opens', async () => {
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

    const addSet = workoutRepository.addSet.bind(workoutRepository)
    let releaseAdd: (() => void) | undefined
    let markAddStarted: (() => void) | undefined
    const addStarted = new Promise<void>((resolve) => {
      markAddStarted = resolve
    })
    vi.spyOn(workoutRepository, 'addSet').mockImplementation(
      (workoutExerciseId) =>
        new Promise((resolve, reject) => {
          markAddStarted?.()
          releaseAdd = () => {
            void addSet(workoutExerciseId).then(resolve, reject)
          }
        }),
    )
    renderTraining(['/workout'])

    await user.click(await screen.findByRole('button', { name: 'Add Set' }))
    await addStarted
    await user.click(screen.getByRole('button', { name: 'Finish' }))
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

    await expect(db.workoutHistoryEntries.count()).resolves.toBe(0)
    releaseAdd?.()

    expect(await screen.findByText('Date completed')).toBeInTheDocument()
    await expect(
      db.activeCycleWorkoutExercises.get(active.exercises[0].id),
    ).resolves.toMatchObject({ targetSetCount: 3 })
    await expect(
      db.templateWorkoutExercises.get(program.exercises[0].id),
    ).resolves.toMatchObject({ targetSetCount: 3 })
  })

  it('keeps save-to-program available for changes detected during completion', async () => {
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
  })

  it('automatically prompts to finish once every set is completed', async () => {
    const program = await seedProgram(db)
    const active = await createProgramRepository(db).activateTemplate(
      program.template.id,
    )
    const started = await workoutRepository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    for (const set of started.sets) {
      await workoutRepository.updateWorkoutSet(set.id, { completed: true })
    }

    renderTraining(['/workout'])

    const finishDialog = await screen.findByRole('dialog', {
      name: 'Finish workout?',
    })
    expect(
      within(finishDialog).getByRole('button', { name: 'Finish Workout' }),
    ).toBeInTheDocument()
    expect(
      within(finishDialog).getByRole('checkbox', {
        name: 'Save all live workout changes to my program',
      }),
    ).not.toBeChecked()
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
    const program = await seedTwoDayProgram(db)
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
    // Checked-off days darken until the whole week is done.
    expect(checked.closest('.program-day-card')).toHaveClass('is-done')

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

  it('completes the week and resets the check-offs once every day is checked', async () => {
    const user = userEvent.setup()
    const program = await seedTwoDayProgram(db)
    await createProgramRepository(db).activateTemplate(program.template.id)
    renderTraining()

    expect(await screen.findByText('Week 1')).toBeInTheDocument()
    await user.click(
      await screen.findByRole('button', { name: 'Mark Upper done this week' }),
    )
    await user.click(
      await screen.findByRole('button', { name: 'Mark Lower done this week' }),
    )

    // Checking the final day rolls the cycle into week 2 with a clean slate.
    expect(await screen.findByText('Week 2')).toBeInTheDocument()
    expect(
      await screen.findByRole('button', { name: 'Mark Upper done this week' }),
    ).toBeInTheDocument()
    expect(
      await screen.findByRole('button', { name: 'Mark Lower done this week' }),
    ).toBeInTheDocument()
  })

  it('reorders exercises during a live workout with the move buttons', async () => {
    const user = userEvent.setup()
    const exerciseRepository = createExerciseRepository(db)
    const press = await exerciseRepository.createExercise({
      name: 'Order press',
      defaultRestSeconds: 60,
      trackingMethodId: 'weight_reps',
      notes: '',
    })
    const row = await exerciseRepository.createExercise({
      name: 'Order row',
      defaultRestSeconds: 60,
      trackingMethodId: 'weight_reps',
      notes: '',
    })
    const template = {
      targetSetCount: 1,
      targetRepsMin: 6,
      targetRepsMax: 8,
      targetRir: 1,
      restSecondsOverride: null,
    }
    const program = await createProgramRepository(db).createProgramTemplate({
      name: 'Order split',
      days: [
        {
          name: 'Day',
          exercises: [
            { exerciseId: press.id, ...template },
            { exerciseId: row.id, ...template },
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
    renderTraining(['/workout'])

    expect(await screen.findByText('Exercise 1 of 2')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Order press' }),
    ).toBeInTheDocument()
    // The first exercise cannot move further forward.
    expect(screen.getByRole('button', { name: 'Move Earlier' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Move Later' }))

    // The moved exercise stays active in its new slot.
    expect(await screen.findByText('Exercise 2 of 2')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Order press' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Move Later' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Previous' }))
    expect(await screen.findByText('Exercise 1 of 2')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Order row' }),
    ).toBeInTheDocument()
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
    const finalRir = screen.getByRole('textbox', { name: 'Set 2 final RIR' })
    expect(finalRir).toBeInTheDocument()
    // The prescribed RIR target applies to the last set only.
    expect(finalRir).toHaveAttribute('placeholder', '1')
    expect(
      screen.queryByRole('textbox', { name: 'Set 1 final RIR' }),
    ).not.toBeInTheDocument()
    // Earlier sets accept an optional RIR without a target.
    const firstSetRir = screen.getByRole('textbox', { name: 'Set 1 RIR' })
    expect(firstSetRir).not.toHaveAttribute('placeholder')
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

    await user.click(
      screen.getByRole('button', { name: 'Edit active program' }),
    )
    const cycleEditor = await screen.findByRole('dialog', {
      name: 'Edit program',
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

  it('manually sets the active program week from the program editor', async () => {
    const user = userEvent.setup()
    const program = await seedProgram(db)
    const active = await createProgramRepository(db).activateTemplate(
      program.template.id,
    )
    renderTraining()

    await user.click(
      await screen.findByRole('button', { name: 'Edit active program' }),
    )
    const editor = await screen.findByRole('dialog', { name: 'Edit program' })
    const currentWeek = within(editor).getByRole('spinbutton', {
      name: 'Current week',
    })
    expect(currentWeek).toHaveValue(1)
    await user.clear(currentWeek)
    await user.type(currentWeek, '4')
    await user.tab()

    await waitFor(async () => {
      await expect(
        db.activeProgramCycles.get(active.cycle.id),
      ).resolves.toMatchObject({ currentWeekNumber: 4 })
    })
    expect(currentWeek).toHaveValue(4)
    await waitFor(() => expect(screen.getByText('Week 4')).toBeInTheDocument())
  })

  it('routes the Training bottom nav item to the live workout when a workout is active', async () => {
    const user = userEvent.setup()
    const program = await seedProgram(db)
    const active = await createProgramRepository(db).activateTemplate(
      program.template.id,
    )
    await workoutRepository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    renderTraining(['/'])

    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Training' })).toHaveAttribute(
        'href',
        '/workout',
      ),
    )
    await user.click(screen.getByRole('link', { name: 'Training' }))

    expect(
      await screen.findByRole('button', { name: 'Finish' }),
    ).toBeInTheDocument()
  })
})

// Two days so a single check-off leaves the week (and its checks) in place.
async function seedTwoDayProgram(database: typeof db) {
  const exercise = await seedExercise(database)
  const dayExercises = [
    {
      exerciseId: exercise.id,
      targetSetCount: 2,
      targetRepsMin: 8,
      targetRepsMax: 10,
      targetRir: 2,
      restSecondsOverride: 90,
    },
  ]
  return createProgramRepository(database).createProgramTemplate({
    name: 'Upper Lower Split',
    days: [
      { name: 'Upper', exercises: dayExercises },
      { name: 'Lower', exercises: dayExercises },
    ],
  })
}

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

async function addWorkoutDay(
  user: ReturnType<typeof userEvent.setup>,
  builder: HTMLElement,
  name: string,
) {
  await user.click(
    await within(builder).findByRole('button', { name: 'Add workout day' }),
  )
  await user.type(
    await within(builder).findByRole('textbox', {
      name: 'New workout day name',
    }),
    name,
  )
  await user.click(
    within(builder).getByRole('button', { name: 'Save workout day' }),
  )
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
