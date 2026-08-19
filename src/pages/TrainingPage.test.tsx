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
import { clearCachedTrainingPageData } from '@pages/trainingPageCache'
import { createProgramRepository } from '@repositories/programRepository'
import { settingsRepository } from '@repositories/settingsRepository'
import {
  createExerciseRepository,
  exerciseRepository,
} from '@repositories/exerciseRepository'
import { workoutRepository } from '@repositories/workoutRepository'
import { initializeAppData } from '@services/appInitializationService'
import { nativeRestTimerNotificationService } from '@services/nativeRestTimerNotificationService'
import { seedExercise, seedProgram, testLocalDate } from '@test/seedFactories'

const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
const scrollIntoViewMock = vi.fn()

beforeEach(async () => {
  scrollIntoViewMock.mockClear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: scrollIntoViewMock,
  })
  clearCachedTrainingPageData()
  await db.delete()
  await db.open()
  await initializeAppData()
  await settingsRepository.saveRirTrackingEnabled(true)
})

afterEach(async () => {
  cleanup()
  vi.restoreAllMocks()
  clearCachedTrainingPageData()
  await db.delete()
  if (originalScrollIntoView) {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: originalScrollIntoView,
    })
  } else {
    delete (HTMLElement.prototype as { scrollIntoView?: unknown })
      .scrollIntoView
  }
})

describe('TrainingPage', () => {
  it('keeps loaded dashboard data in place when returning to Training', async () => {
    const user = userEvent.setup()
    renderTraining()

    await screen.findByRole('button', { name: 'Exercise Library' })
    await user.click(screen.getByRole('button', { name: 'Exercise Library' }))
    expect(await screen.findByText('Barbell Bench Press')).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Home' }))
    vi.spyOn(exerciseRepository, 'searchExercises').mockImplementation(
      () => new Promise(() => undefined),
    )
    await user.click(screen.getByRole('link', { name: 'Training' }))
    await user.click(screen.getByRole('button', { name: 'Exercise Library' }))

    expect(screen.getByText('Barbell Bench Press')).toBeInTheDocument()
  })

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
      screen.getByRole('heading', { name: 'Current Program' }),
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
      screen.getByRole('heading', { name: 'Current Program' }),
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
    const sessionBar = firstRender.container.querySelector(
      '.live-workout-session-bar',
    )
    const exerciseWorkspace = firstRender.container.querySelector(
      '.exercise-workspace',
    )
    await waitFor(() => expect(document.body).toHaveClass('live-workout-open'))
    expect(document.documentElement).toHaveClass('live-workout-open')
    expect(
      screen.getByRole('heading', { level: 1, name: 'Upper' }),
    ).toBeInTheDocument()
    expect(firstRender.container.querySelector('.live-workout-hero')).toBeNull()
    expect(sessionBar).not.toBeNull()
    expect(exerciseWorkspace).not.toBeNull()
    expect(
      within(sessionBar as HTMLElement).getByRole('button', {
        name: 'Finish',
      }),
    ).toBeInTheDocument()
    expect(
      within(sessionBar as HTMLElement).getByRole('button', {
        name: 'Discard',
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
        name: 'Remove Exercise',
      }),
    ).toBeInTheDocument()
    expect(
      within(exerciseActions).queryByRole('button', {
        name: 'Swap Exercise',
      }),
    ).not.toBeInTheDocument()
    expect(
      within(exerciseActions).queryByRole('button', {
        name: 'Skip Exercise',
      }),
    ).not.toBeInTheDocument()
    const exerciseTitleLine = (exerciseWorkspace as HTMLElement).querySelector(
      '.exercise-title-line',
    )
    expect(exerciseTitleLine).not.toBeNull()
    expect(
      within(exerciseTitleLine as HTMLElement).getByRole('button', {
        name: 'Edit exercise notes',
      }),
    ).toBeInTheDocument()
    expect(
      (exerciseWorkspace as HTMLElement).querySelector(
        '.exercise-prescription-inline',
      ),
    ).toBeNull()
    await user.click(
      within(exerciseTitleLine as HTMLElement).getByRole('button', {
        name: 'More exercise actions',
      }),
    )
    const exerciseOptions = screen.getByRole('dialog', {
      name: 'Exercise options',
    })
    expect(exerciseOptions).toHaveClass('bottom-sheet--page')
    expect(addSetButton.inert).toBe(true)
    expect(
      (firstRender.container.querySelector('.bottom-nav') as HTMLElement).inert,
    ).toBe(true)
    expect(
      within(exerciseOptions).getByText('2 sets - 8-10 reps'),
    ).toBeVisible()
    expect(
      within(
        within(exerciseOptions).getByRole('listbox', {
          name: 'Rest minutes',
        }),
      ).getByRole('option', { name: '01' }),
    ).toHaveAttribute('aria-selected', 'true')
    expect(
      within(
        within(exerciseOptions).getByRole('listbox', {
          name: 'Rest seconds',
        }),
      ).getByRole('option', { name: '30' }),
    ).toHaveAttribute('aria-selected', 'true')
    expect(
      within(exerciseOptions).getByRole('button', { name: 'Swap Exercise' }),
    ).toBeVisible()
    expect(
      within(exerciseOptions).getByRole('button', { name: 'Skip Exercise' }),
    ).toBeVisible()
    await user.click(
      within(exerciseOptions).getByRole('button', {
        name: 'Edit current workout target',
      }),
    )
    const setsInput = within(exerciseOptions).getByLabelText('Sets')
    const minimumReps = within(exerciseOptions).getByLabelText('Minimum reps')
    const maximumReps = within(exerciseOptions).getByLabelText('Maximum reps')
    await user.clear(setsInput)
    await user.type(setsInput, '4')
    await user.clear(minimumReps)
    await user.type(minimumReps, '6')
    await user.clear(maximumReps)
    await user.type(maximumReps, '8')
    await user.click(
      within(exerciseOptions).getByRole('button', { name: 'Save target' }),
    )
    expect(
      await within(exerciseOptions).findByText('4 sets - 6-8 reps'),
    ).toBeVisible()
    await user.click(
      within(exerciseOptions).getByRole('button', {
        name: 'Back from exercise options',
      }),
    )
    expect(
      screen.queryByRole('dialog', { name: 'Exercise options' }),
    ).not.toBeInTheDocument()
    expect(addSetButton.inert).toBe(false)
    expect(
      screen.getAllByRole('button', { name: /^Complete set/ }),
    ).toHaveLength(4)
    expect(
      (exerciseWorkspace as HTMLElement).querySelector('.set-list'),
    ).not.toBeNull()

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
        '.live-workout-session-bar .live-session-rest-timer',
      ),
    ).toBeInTheDocument()
    expect(
      firstRender.container.querySelector(
        '.exercise-workspace .live-session-rest-timer',
      ),
    ).not.toBeInTheDocument()
    firstRender.unmount()
    renderTraining(['/workout'])

    await waitFor(() =>
      expect(screen.getAllByDisplayValue('185').length).toBeGreaterThan(0),
    )
    expect(screen.getAllByDisplayValue('8').length).toBeGreaterThan(0)
  })

  it('discards immediately while optional timer notification work is pending', async () => {
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
    vi.spyOn(nativeRestTimerNotificationService, 'sync').mockImplementation(
      () => new Promise(() => undefined),
    )
    vi.spyOn(nativeRestTimerNotificationService, 'cancel').mockImplementation(
      () => new Promise(() => undefined),
    )
    renderTraining(['/workout'])

    await user.type(
      await screen.findByRole('textbox', { name: 'Set 1 Weight' }),
      '185',
    )
    await user.type(screen.getByRole('textbox', { name: 'Set 1 Reps' }), '8')
    await user.click(screen.getByRole('button', { name: 'Complete set 1' }))
    await waitFor(async () =>
      expect(await db.workouts.get(started.workout.id)).toMatchObject({
        activeRestTimer: expect.objectContaining({ status: 'running' }),
      }),
    )

    await user.click(screen.getByRole('button', { name: 'Discard' }))
    await user.click(
      within(
        screen.getByRole('dialog', { name: 'Discard workout?' }),
      ).getByRole('button', { name: 'Discard Workout' }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Current Program' }),
    ).toBeInTheDocument()
    await expect(db.workouts.get(started.workout.id)).resolves.toBeUndefined()
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
      await screen.findByRole('button', { name: 'More exercise actions' }),
    )
    const settings = await screen.findByRole('dialog', {
      name: 'Exercise options',
    })
    expect(within(settings).getByText('Total workout time')).toBeVisible()
    expect(
      within(settings).getByText(
        'Changes apply immediately to the current rest timer and future sets.',
      ),
    ).toBeVisible()
    expect(
      within(settings).queryByRole('textbox', {
        name: 'Exercise default rest (seconds)',
      }),
    ).not.toBeInTheDocument()
    expect(
      within(settings).queryByRole('button', { name: 'Cancel' }),
    ).not.toBeInTheDocument()
    expect(
      within(settings).queryByRole('button', { name: 'Save' }),
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
    await waitFor(async () => {
      await expect(db.exercises.get(exercise.id)).resolves.toMatchObject({
        defaultRestSeconds: 90,
      })
      const activeExercise = await db.workoutExercises.toCollection().first()
      expect(activeExercise?.exerciseSnapshot.defaultRestSeconds).toBe(90)
      const workout = await db.workouts.toCollection().first()
      expect(workout?.activeRestTimer).toMatchObject({
        durationSeconds: 90,
        status: 'running',
      })
    })
    await user.keyboard('{Escape}')
    expect(
      screen.queryByRole('dialog', { name: 'Exercise options' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByLabelText(/Timer running: 1:(29|30)/),
    ).toBeInTheDocument()
  })

  it('completes a zero-rest set without requiring RIR or dismissing a missing timer', async () => {
    const user = userEvent.setup()
    const exercise = await createExerciseRepository(db).createExercise({
      name: 'Optional RIR press',
      defaultRestSeconds: 0,
      trackingMethodId: 'weight_reps',
      notes: '',
    })
    const program = await createProgramRepository(db).createProgramTemplate({
      name: 'Optional RIR split',
      days: [
        {
          name: 'Day',
          exercises: [
            {
              exerciseId: exercise.id,
              targetSetCount: 1,
              targetRepsMin: 6,
              targetRepsMax: 10,
              targetRir: null,
              restSecondsOverride: null,
            },
          ],
        },
      ],
    })
    const active = await createProgramRepository(db).activateTemplate(
      program.template.id,
    )
    const started = await workoutRepository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    const dismissTimer = vi.spyOn(workoutRepository, 'dismissRestTimer')
    renderTraining(['/workout'])

    await user.type(
      await screen.findByRole('textbox', { name: 'Set 1 Weight' }),
      '185',
    )
    await user.type(screen.getByRole('textbox', { name: 'Set 1 Reps' }), '8')
    expect(
      screen.getByRole('textbox', { name: 'Set 1 final RIR' }),
    ).toHaveValue('')

    await user.click(screen.getByRole('button', { name: 'Complete set 1' }))

    await waitFor(async () =>
      expect(await db.workoutSets.get(started.sets[0].id)).toMatchObject({
        completed: true,
        rir: null,
      }),
    )
    expect(dismissTimer).not.toHaveBeenCalled()
    expect(
      screen.queryByText(/Active rest timer for workout .* was not found/),
    ).not.toBeInTheDocument()
  })

  it('dismisses the penultimate-set timer when the last set is deleted', async () => {
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
    await workoutRepository.setRestTimer(started.workout.id, 90)

    renderTraining(['/workout'])
    expect(await screen.findByLabelText('Rest timer')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Delete set 2' }))

    await waitFor(() =>
      expect(
        screen.getByLabelText('Rest timer ready: 0:00'),
      ).toBeInTheDocument(),
    )
    expect(
      screen.getByRole('button', { name: 'Add 30 seconds' }),
    ).toBeDisabled()
    expect(
      (await workoutRepository.getActiveWorkout())?.activeRestTimer?.status,
    ).toBe('dismissed')
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
    const persistMetric =
      workoutRepository.updateWorkoutSetMetricAndPropagate.bind(
        workoutRepository,
      )
    let releasePersistence: () => void = () => undefined
    let releaseMetricPersistence: () => void = () => undefined
    const persistenceGate = new Promise<void>((resolve) => {
      releasePersistence = resolve
    })
    const metricPersistenceGate = new Promise<void>((resolve) => {
      releaseMetricPersistence = resolve
    })
    vi.spyOn(workoutRepository, 'updateWorkoutSet').mockImplementation(
      async (...args) => {
        await persistenceGate
        return persistSet(...args)
      },
    )
    vi.spyOn(
      workoutRepository,
      'updateWorkoutSetMetricAndPropagate',
    ).mockImplementation(async (...args) => {
      await metricPersistenceGate
      return persistMetric(...args)
    })

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

    // A late metric save used to reload the still-incomplete IndexedDB row and
    // erase the optimistic checkmark/timer while completion was still pending.
    releaseMetricPersistence()
    await waitFor(async () => {
      const savedSet = (await db.workoutSets.toArray()).find(
        (set) => set.setNumber === 1,
      )
      expect(savedSet?.metricValues).toMatchObject({ weight: 95, reps: 8 })
    })
    expect(
      screen.getByRole('button', { name: 'Mark incomplete set 1' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Rest timer')).toBeInTheDocument()

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

    await user.click(
      await screen.findByRole('button', { name: 'Edit exercise notes' }),
    )
    const notes = screen.getByRole('dialog', { name: 'Exercise notes' })
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

  it('shows an added set without waiting for a workout reload', async () => {
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
    renderTraining(['/workout'])

    await screen.findByRole('textbox', { name: 'Set 2 Weight' })
    vi.spyOn(workoutRepository, 'getActiveWorkoutStructure').mockImplementation(
      () => new Promise(() => undefined),
    )
    await user.click(screen.getByRole('button', { name: 'Add Set' }))

    expect(
      await screen.findByRole('textbox', { name: 'Set 3 Weight' }),
    ).toBeVisible()
  })

  it('keeps live set values visible while exercise navigation outruns persistence', async () => {
    const user = userEvent.setup()
    const program = await seedProgram(db)
    const active = await createProgramRepository(db).activateTemplate(
      program.template.id,
    )
    const extraExercise = await createExerciseRepository(db).createExercise({
      name: 'Navigation row',
      defaultRestSeconds: 0,
      trackingMethodId: 'reps_only',
    })
    const started = await workoutRepository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    await workoutRepository.addExercise({
      workoutId: started.workout.id,
      exerciseId: extraExercise.id,
    })
    const persistMetric =
      workoutRepository.updateWorkoutSetMetricAndPropagate.bind(
        workoutRepository,
      )
    let releasePersistence: () => void = () => undefined
    const persistenceGate = new Promise<void>((resolve) => {
      releasePersistence = resolve
    })
    vi.spyOn(
      workoutRepository,
      'updateWorkoutSetMetricAndPropagate',
    ).mockImplementation(async (...args) => {
      await persistenceGate
      return persistMetric(...args)
    })

    renderTraining(['/workout'])
    await user.type(
      await screen.findByRole('textbox', { name: 'Set 1 Weight' }),
      '185',
    )
    await user.type(screen.getByRole('textbox', { name: 'Set 1 Reps' }), '8')
    await user.click(
      screen.getByRole('button', {
        name: 'Navigation row, exercise 2 of 2',
      }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Bench press, exercise 1 of 2' }),
    )

    expect(screen.getByRole('textbox', { name: 'Set 1 Weight' })).toHaveValue(
      '185',
    )
    expect(screen.getByRole('textbox', { name: 'Set 1 Reps' })).toHaveValue('8')

    releasePersistence()
    await waitFor(async () => {
      await expect(
        db.workoutSets.get(started.sets[0].id),
      ).resolves.toMatchObject({
        metricValues: expect.objectContaining({ weight: 185, reps: 8 }),
      })
    })
  })

  it('removes a set row immediately and persists the renumbered rows', async () => {
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
    const persistDelete = workoutRepository.deleteSet.bind(workoutRepository)
    let releaseDelete: () => void = () => undefined
    const deleteGate = new Promise<void>((resolve) => {
      releaseDelete = resolve
    })
    vi.spyOn(workoutRepository, 'deleteSet').mockImplementation(
      async (setId) => {
        await deleteGate
        return persistDelete(setId)
      },
    )

    renderTraining(['/workout'])
    await screen.findByRole('textbox', { name: 'Set 2 Weight' })
    await user.click(screen.getByRole('button', { name: 'Delete set 1' }))

    expect(
      screen.queryByRole('button', { name: 'Delete set 2' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Set 1 Weight' })).toBeVisible()

    releaseDelete()
    await waitFor(async () => {
      const remaining = await db.workoutSets
        .where({ workoutExerciseId: started.exercises[0].id })
        .sortBy('setNumber')
      expect(remaining).toHaveLength(1)
      expect(remaining[0]).toMatchObject({
        id: started.sets[1].id,
        setNumber: 1,
      })
    })
  })

  it('removes the active exercise immediately without freezing on persistence', async () => {
    const user = userEvent.setup()
    const program = await seedProgram(db)
    const active = await createProgramRepository(db).activateTemplate(
      program.template.id,
    )
    const extraExercise = await createExerciseRepository(db).createExercise({
      name: 'Remaining row',
      defaultRestSeconds: 0,
      trackingMethodId: 'reps_only',
    })
    const started = await workoutRepository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    await workoutRepository.addExercise({
      workoutId: started.workout.id,
      exerciseId: extraExercise.id,
    })
    await workoutRepository.updateWorkoutSet(started.sets[0].id, {
      metricValues: { weight: 185, reps: 8 },
      completed: true,
    })
    const persistRemoval =
      workoutRepository.removeExerciseFromLiveWorkout.bind(workoutRepository)
    let releaseRemoval: () => void = () => undefined
    const removalGate = new Promise<void>((resolve) => {
      releaseRemoval = resolve
    })
    vi.spyOn(
      workoutRepository,
      'removeExerciseFromLiveWorkout',
    ).mockImplementation(async (workoutExerciseId) => {
      await removalGate
      return persistRemoval(workoutExerciseId)
    })

    renderTraining(['/workout'])
    await screen.findByRole('heading', { name: 'Bench press' })
    await user.click(screen.getByRole('button', { name: 'Remove Exercise' }))
    await user.click(
      within(
        screen.getByRole('dialog', { name: 'Remove exercise?' }),
      ).getByRole('button', { name: 'Remove Exercise' }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Remaining row' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('dialog', { name: 'Remove exercise?' }),
    ).not.toBeInTheDocument()

    releaseRemoval()
    await waitFor(async () => {
      await expect(
        db.workoutExercises.get(started.exercises[0].id),
      ).resolves.toBeUndefined()
      await expect(
        db.workoutSets
          .where({ workoutExerciseId: started.exercises[0].id })
          .count(),
      ).resolves.toBe(0)
    })
  })

  it('restores a live exercise and allows retry after removal persistence fails', async () => {
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
    vi.spyOn(
      workoutRepository,
      'removeExerciseFromLiveWorkout',
    ).mockRejectedValueOnce(new Error('Exercise removal failed.'))

    renderTraining(['/workout'])
    await screen.findByRole('heading', { name: 'Bench press' })
    await user.click(screen.getByRole('button', { name: 'Remove Exercise' }))
    await user.click(
      within(
        screen.getByRole('dialog', { name: 'Remove exercise?' }),
      ).getByRole('button', { name: 'Remove Exercise' }),
    )

    expect(await screen.findByText('Exercise removal failed.')).toBeVisible()
    expect(
      await screen.findByRole('heading', { name: 'Bench press' }),
    ).toBeInTheDocument()
    await expect(
      db.workoutExercises.get(started.exercises[0].id),
    ).resolves.toBeDefined()
  })

  it('guards workout completion against duplicate confirmation submissions', async () => {
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
    })
    const persistCompletion =
      workoutRepository.completeWorkout.bind(workoutRepository)
    let releaseCompletion: () => void = () => undefined
    const completionGate = new Promise<void>((resolve) => {
      releaseCompletion = resolve
    })
    const completeWorkout = vi
      .spyOn(workoutRepository, 'completeWorkout')
      .mockImplementation(async (...args) => {
        await completionGate
        return persistCompletion(...args)
      })

    renderTraining(['/workout'])
    await user.click(await screen.findByRole('button', { name: 'Finish' }))
    const confirm = within(
      screen.getByRole('dialog', { name: 'Finish workout?' }),
    ).getByRole('button', { name: 'Finish Workout' })
    fireEvent.click(confirm)
    fireEvent.click(confirm)

    await waitFor(() => expect(completeWorkout).toHaveBeenCalledTimes(1))
    releaseCompletion()
    expect(await screen.findByText('Date completed')).toBeInTheDocument()
  })

  it('keeps the active workout recoverable when completion fails', async () => {
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
    })
    vi.spyOn(workoutRepository, 'completeWorkout').mockRejectedValueOnce(
      new Error('Workout completion failed.'),
    )

    renderTraining(['/workout'])
    await user.click(await screen.findByRole('button', { name: 'Finish' }))
    await user.click(
      within(screen.getByRole('dialog', { name: 'Finish workout?' })).getByRole(
        'button',
        { name: 'Finish Workout' },
      ),
    )

    expect(await screen.findByText('Workout completion failed.')).toBeVisible()
    await expect(db.workouts.get(started.workout.id)).resolves.toMatchObject({
      status: 'active',
    })
    expect(screen.getByRole('button', { name: 'Finish' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Finish' }))
    await user.click(
      within(screen.getByRole('dialog', { name: 'Finish workout?' })).getByRole(
        'button',
        { name: 'Finish Workout' },
      ),
    )
    expect(await screen.findByText('Date completed')).toBeInTheDocument()
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

  it('treats skipped exercises as resolved for navigation and the finish prompt', async () => {
    const user = userEvent.setup()
    const exerciseRepository = createExerciseRepository(db)
    const skippedCarry = await exerciseRepository.createExercise({
      name: 'Skipped carry',
      defaultRestSeconds: 0,
      trackingMethodId: 'distance_duration',
      notes: '',
    })
    const finishedCarry = await exerciseRepository.createExercise({
      name: 'Finished carry',
      defaultRestSeconds: 0,
      trackingMethodId: 'distance_duration',
      notes: '',
    })
    const prescription = {
      targetSetCount: 1,
      targetDistance: 100,
      restSecondsOverride: null,
    }
    const program = await createProgramRepository(db).createProgramTemplate({
      name: 'Skip flow',
      days: [
        {
          name: 'Day',
          exercises: [
            { exerciseId: skippedCarry.id, ...prescription },
            { exerciseId: finishedCarry.id, ...prescription },
          ],
        },
      ],
    })
    const active = await createProgramRepository(db).activateTemplate(
      program.template.id,
    )
    const started = await workoutRepository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    renderTraining(['/workout'])

    expect(
      await screen.findByRole('heading', { name: 'Skipped carry' }),
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'More exercise actions' }),
    )
    await user.click(
      within(
        screen.getByRole('dialog', { name: 'Exercise options' }),
      ).getByRole('button', { name: 'Skip Exercise' }),
    )
    expect(
      await screen.findByRole('heading', { name: 'Finished carry' }),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen
          .getByRole('button', {
            name: 'Skipped carry, exercise 1 of 2',
          })
          .closest('.exercise-sort-card'),
      ).toHaveClass('is-skipped'),
    )

    await user.type(
      screen.getByRole('textbox', { name: 'Set 1 Distance' }),
      '100',
    )
    await user.click(screen.getByRole('button', { name: 'Complete set 1' }))

    const finishDialog = await screen.findByRole('dialog', {
      name: 'Finish workout?',
    })
    await user.click(
      within(finishDialog).getByRole('button', { name: 'Keep working out' }),
    )
    expect(
      screen.getByRole('heading', { name: 'Finished carry' }),
    ).toBeInTheDocument()

    await waitFor(async () => {
      const structure = await workoutRepository.getActiveWorkoutStructure()
      expect(structure?.exercises[0]).toMatchObject({ skipped: true })
      expect(
        structure?.setsByExercise[started.exercises[0].id][0],
      ).toMatchObject({ completed: false })
      expect(
        structure?.setsByExercise[started.exercises[1].id][0],
      ).toMatchObject({ completed: true })
    })
    await user.click(
      screen.getByRole('button', {
        name: 'Skipped carry, exercise 1 of 2',
      }),
    )
    expect(
      screen
        .getByRole('heading', { name: 'Skipped carry' })
        .closest('.exercise-workspace'),
    ).toHaveClass('skipped')
  })

  it('advances to the adjacent exercise after its final set and stays put when swiping back', async () => {
    const user = userEvent.setup()
    const exerciseRepository = createExerciseRepository(db)
    const firstExercise = await exerciseRepository.createExercise({
      name: 'First press',
      defaultRestSeconds: 0,
      trackingMethodId: 'weight_reps',
      notes: '',
    })
    const secondExercise = await exerciseRepository.createExercise({
      name: 'Second press',
      defaultRestSeconds: 0,
      trackingMethodId: 'weight_reps',
      notes: '',
    })
    const prescription = {
      targetSetCount: 1,
      targetRepsMin: 6,
      targetRepsMax: 8,
      targetRir: null,
      restSecondsOverride: null,
    }
    const program = await createProgramRepository(db).createProgramTemplate({
      name: 'Advance flow',
      days: [
        {
          name: 'Day',
          exercises: [
            { exerciseId: firstExercise.id, ...prescription },
            { exerciseId: secondExercise.id, ...prescription },
          ],
        },
      ],
    })
    const active = await createProgramRepository(db).activateTemplate(
      program.template.id,
    )
    const started = await workoutRepository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    const rendered = renderTraining(['/workout'])

    expect(
      await screen.findByRole('heading', { name: 'First press' }),
    ).toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: 'Set 1 Weight' }), '95')
    await user.type(screen.getByRole('textbox', { name: 'Set 1 Reps' }), '8')
    await user.type(
      screen.getByRole('textbox', { name: 'Set 1 final RIR' }),
      '2',
    )
    await user.tab()
    await waitFor(async () => {
      expect(await db.workoutSets.get(started.sets[0].id)).toMatchObject({
        metricValues: { weight: 95, reps: 8 },
        rir: 2,
      })
    })
    await user.click(screen.getByRole('button', { name: 'Complete set 1' }))

    expect(
      await screen.findByRole('heading', { name: 'Second press' }),
    ).toBeInTheDocument()
    await waitFor(async () => {
      expect(await db.workoutSets.get(started.sets[0].id)).toMatchObject({
        completed: true,
      })
    })

    const swipeArea = rendered.container.querySelector(
      '.exercise-workspace-swipe-area',
    )
    expect(swipeArea).toBeTruthy()
    fireEvent.pointerDown(swipeArea!, { clientX: 24, clientY: 100 })
    fireEvent.pointerUp(swipeArea!, { clientX: 140, clientY: 104 })

    expect(
      await screen.findByRole('heading', { name: 'First press' }),
    ).toBeInTheDocument()
    await user.tab()
    expect(
      screen.getByRole('heading', { name: 'First press' }),
    ).toBeInTheDocument()
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
      (upperDay as HTMLElement).querySelector('.program-day-card-head'),
    ).not.toBeInTheDocument()
    expect(
      within(upperDay as HTMLElement).getByRole('button', {
        name: 'Start Workout',
      }),
    ).toHaveClass('program-day-start')
    expect(
      within(upperDay as HTMLElement).getByRole('button', {
        name: 'Start Workout',
      }),
    ).toBeInTheDocument()

    await user.click(
      within(upperDay as HTMLElement).getByRole('button', { name: /^Upper/ }),
    )
    const dialog = await screen.findByRole('dialog', { name: 'Upper' })
    expect(dialog).toHaveClass('bottom-sheet--page')
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

  it('uses the compact exercise cards as drag targets instead of move buttons', async () => {
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
    const rendered = renderTraining(['/workout'])

    expect(await screen.findByText('Exercise 1 of 2')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Order press' }),
    ).toBeInTheDocument()
    const exerciseCards = rendered.container.querySelectorAll(
      '.exercise-tab-list .sortable-item',
    )
    expect(exerciseCards).toHaveLength(2)
    expect(
      rendered.container.querySelector('.exercise-navigator.card'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Exercises' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Exercises' }),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      }),
    )
    const tabList = rendered.container.querySelector('.exercise-tab-list')
    expect(tabList).not.toBeNull()
    Object.defineProperties(tabList as HTMLElement, {
      clientWidth: { configurable: true, value: 220 },
      scrollLeft: { configurable: true, value: 0, writable: true },
      scrollWidth: { configurable: true, value: 440 },
    })
    fireEvent.scroll(tabList as HTMLElement)
    expect(screen.getByRole('region', { name: 'Exercises' })).toHaveClass(
      'can-scroll-right',
    )
    ;(tabList as HTMLElement).scrollLeft = 220
    fireEvent.scroll(tabList as HTMLElement)
    expect(screen.getByRole('region', { name: 'Exercises' })).toHaveClass(
      'can-scroll-left',
    )
    expect(
      screen.getByRole('button', {
        name: 'Order press, exercise 1 of 2',
      }),
    ).not.toHaveAttribute('aria-roledescription', 'sortable')
    expect(
      screen.getByRole('button', {
        name: 'Order row, exercise 2 of 2',
      }),
    ).not.toHaveAttribute('aria-roledescription', 'sortable')
    expect(
      screen.getByRole('button', { name: 'Reorder Order press' }),
    ).toHaveAttribute('aria-roledescription', 'sortable')
    expect(
      screen.getByRole('button', { name: 'Reorder Order row' }),
    ).toHaveAttribute('aria-roledescription', 'sortable')
    expect(
      screen.queryByRole('button', { name: 'Move Earlier' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Move Later' }),
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
    const finalRir = await screen.findByRole('textbox', {
      name: 'Set 2 final RIR',
    })
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
    const firstSwipeArea = (firstWorkspace as HTMLElement).querySelector(
      '.exercise-workspace-swipe-area',
    )
    expect(firstSwipeArea).toBeTruthy()
    const setPointerCapture = vi.fn()
    const hasPointerCapture = vi.fn(() => true)
    const releasePointerCapture = vi.fn()
    Object.defineProperties(firstSwipeArea!, {
      hasPointerCapture: { value: hasPointerCapture },
      releasePointerCapture: { value: releasePointerCapture },
      setPointerCapture: { value: setPointerCapture },
    })
    const firstNotes = within(firstWorkspace as HTMLElement).getByRole(
      'button',
      { name: 'Edit exercise notes' },
    )
    const restoreNotesFocus = vi.spyOn(firstNotes, 'focus')
    expect(
      (firstWorkspace as HTMLElement)
        .querySelector('.exercise-card-header')
        ?.contains(firstNotes),
    ).toBeTruthy()
    await user.click(firstNotes)
    expect(
      within(screen.getByRole('dialog', { name: 'Exercise notes' })).getByRole(
        'textbox',
        { name: 'Exercise notes' },
      ),
    ).toHaveValue('Brace hard and pause every first rep.')
    await user.click(
      screen.getByRole('button', { name: 'Close exercise notes' }),
    )
    expect(restoreNotesFocus).toHaveBeenCalledWith({ preventScroll: true })
    expect(firstNotes).toHaveFocus()
    expect(
      screen.queryByRole('button', { name: 'Previous' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Next' }),
    ).not.toBeInTheDocument()

    fireEvent.pointerDown(firstSwipeArea!, {
      clientX: 100,
      clientY: 100,
      pointerId: 1,
    })
    expect(setPointerCapture).toHaveBeenCalledWith(1)
    fireEvent.pointerMove(firstSwipeArea!, {
      clientX: 130,
      clientY: 102,
      pointerId: 1,
    })
    expect(
      Number.parseFloat(
        (firstSwipeArea as HTMLElement).style.getPropertyValue(
          '--exercise-swipe-x',
        ),
      ),
    ).toBeCloseTo(7.2)
    fireEvent.pointerUp(firstSwipeArea!, {
      clientX: 130,
      clientY: 102,
      pointerId: 1,
    })
    expect(firstSwipeArea).toHaveStyle({ '--exercise-swipe-x': '0px' })
    expect(firstWorkspace).not.toHaveStyle({ '--exercise-swipe-x': '0px' })

    // A vertical set-list gesture must not leave horizontal navigation locked.
    fireEvent.pointerDown(firstSwipeArea!, {
      clientX: 140,
      clientY: 100,
      pointerId: 2,
    })
    fireEvent.pointerMove(firstSwipeArea!, {
      clientX: 142,
      clientY: 180,
      pointerId: 2,
    })
    fireEvent.pointerCancel(firstSwipeArea!, { pointerId: 2 })

    fireEvent.pointerDown(firstSetRir, {
      clientX: 140,
      clientY: 100,
      pointerId: 3,
    })
    expect(setPointerCapture).toHaveBeenCalledWith(3)
    fireEvent.pointerMove(firstSetRir, {
      clientX: 72,
      clientY: 103,
      pointerId: 3,
    })
    expect(firstSwipeArea).toHaveStyle({ '--exercise-swipe-x': '-68px' })
    fireEvent.pointerUp(firstSetRir, {
      clientX: 24,
      clientY: 104,
      pointerId: 3,
    })
    expect(await screen.findByText('Exercise 2 of 2')).toBeInTheDocument()
    expect(
      rendered.container.querySelector('.exercise-workspace-enter-next'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Live pull-up' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('textbox', { name: 'Set 1 Added' }),
    ).toBeInTheDocument()
    expect(
      await screen.findByRole('textbox', { name: 'Set 2 final RIR' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('textbox', { name: 'Set 1 final RIR' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('Brace hard and pause every first rep.'),
    ).not.toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Edit exercise notes' }),
    )
    expect(
      within(screen.getByRole('dialog', { name: 'Exercise notes' })).getByRole(
        'textbox',
        { name: 'Exercise notes' },
      ),
    ).toHaveValue('Keep the chest tall and reset between reps.')
    await user.click(
      screen.getByRole('button', { name: 'Close exercise notes' }),
    )
    await user.clear(screen.getByRole('textbox', { name: 'Set 1 Reps' }))
    await user.type(screen.getByRole('textbox', { name: 'Set 1 Reps' }), '12')
    await user.tab()
    expect(screen.getByText('Exercise 2 of 2')).toBeInTheDocument()

    const swipeArea = rendered.container.querySelector(
      '.exercise-workspace-swipe-area',
    )
    expect(swipeArea).toBeTruthy()
    fireEvent.pointerDown(swipeArea!, { clientX: 24, clientY: 100 })
    fireEvent.pointerUp(swipeArea!, { clientX: 140, clientY: 104 })
    expect(await screen.findByText('Exercise 1 of 2')).toBeInTheDocument()

    const firstSwipeAreaAgain = rendered.container.querySelector(
      '.exercise-workspace-swipe-area',
    )
    expect(firstSwipeAreaAgain).toBeTruthy()
    fireEvent.pointerDown(firstSwipeAreaAgain!, {
      clientX: 140,
      clientY: 100,
    })
    fireEvent.pointerUp(firstSwipeAreaAgain!, { clientX: 24, clientY: 104 })
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
      screen.queryByRole('heading', { name: 'Current Program' }),
    ).not.toBeInTheDocument()
    expect(
      await screen.findByText('Beginner Full Body A/B'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: 'Preview Bodybuilding-Biased Powerbuilding',
      }),
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

  it('previews the seven-day bodybuilding-biased schedule including rest days', async () => {
    const user = userEvent.setup()
    renderTraining()

    await screen.findByText('No saved programs')
    await user.click(screen.getByRole('button', { name: 'Browse programs' }))
    await user.click(
      await screen.findByRole('button', {
        name: 'Preview Bodybuilding-Biased Powerbuilding',
      }),
    )

    for (const dayName of [
      'Day 1 - Upper',
      'Day 2 - Lower - Heavy Squat',
      'Day 3 - Rest',
      'Day 4 - Chest / Back',
      'Day 5 - Lower - Heavy Deadlift',
      'Day 6 - Arms / Shoulders',
      'Day 7 - Rest',
    ]) {
      expect(
        await screen.findByRole('heading', { name: dayName }),
      ).toBeVisible()
    }
    expect(screen.getAllByText('No programmed exercises.')).toHaveLength(2)
    expect(screen.getByText('Cable Rear Delt Fly')).toBeVisible()
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
      name: 'Program Editor',
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

  it('selects the active week from the program card and remembers each week check-off', async () => {
    const user = userEvent.setup()
    const program = await seedProgram(db)
    const active = await createProgramRepository(db).activateTemplate(
      program.template.id,
    )
    renderTraining()

    const weekSelector = await screen.findByRole('combobox', {
      name: 'Select program week',
    })
    await user.click(
      screen.getByRole('button', { name: 'Mark Upper done this week' }),
    )
    await user.selectOptions(weekSelector, '4')
    expect(weekSelector).not.toHaveFocus()

    await waitFor(async () => {
      await expect(
        db.activeProgramCycles.get(active.cycle.id),
      ).resolves.toMatchObject({ currentWeekNumber: 4 })
    })
    await waitFor(() => expect(weekSelector).toHaveValue('4'))
    expect(
      screen.getByRole('button', { name: 'Mark Upper done this week' }),
    ).toBeInTheDocument()
    await user.selectOptions(weekSelector, '1')
    expect(
      await screen.findByRole('button', {
        name: 'Mark Upper not done this week',
      }),
    ).toBeInTheDocument()
  })

  it('shows the deload RIR field even when global RIR tracking is disabled', async () => {
    await settingsRepository.saveRirTrackingEnabled(false)
    const program = await seedProgram(db)
    const programs = createProgramRepository(db)
    const active = await programs.activateTemplate(program.template.id)
    await programs.updateActiveCycle(active.cycle.id, {
      deloadSchedulingEnabled: true,
      deloadWeekNumbers: [1],
    })
    await workoutRepository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })

    renderTraining(['/workout'])

    const rir = await screen.findByRole('textbox', {
      name: 'Set 1 final RIR',
    })
    expect(rir).toHaveAttribute('placeholder', '5')
  })

  it('enables deload scheduling in editor settings with a first-week default and ordinal labels', async () => {
    const user = userEvent.setup()
    const program = await seedProgram(db)
    const active = await createProgramRepository(db).activateTemplate(
      program.template.id,
    )
    renderTraining()

    await user.click(
      await screen.findByRole('button', { name: 'Edit active program' }),
    )
    const editor = await screen.findByRole('dialog', {
      name: 'Program Editor',
    })
    expect(
      within(editor).queryByRole('spinbutton', { name: 'Current week' }),
    ).not.toBeInTheDocument()
    expect(
      within(editor).queryByRole('group', { name: 'Schedule deload weeks' }),
    ).not.toBeInTheDocument()
    await user.click(
      within(editor).getByRole('button', { name: 'Program editor settings' }),
    )
    const settings = await screen.findByRole('dialog', {
      name: 'Program settings',
    })
    await user.click(
      within(settings).getByRole('checkbox', {
        name: 'Schedule deload weeks',
      }),
    )
    await waitFor(async () => {
      await expect(
        db.activeProgramCycles.get(active.cycle.id),
      ).resolves.toMatchObject({
        deloadSchedulingEnabled: true,
        deloadWeekNumbers: [1],
      })
    })
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Program settings' }),
      ).not.toBeInTheDocument(),
    )
    expect(
      within(editor).getByText(/Click a week number to make it a deload week/),
    ).toBeInTheDocument()
    expect(
      within(editor).getByRole('button', { name: 'Deload 1' }),
    ).toHaveAttribute('aria-pressed', 'true')
    await user.click(within(editor).getByRole('button', { name: 'Week 4' }))
    await waitFor(async () => {
      await expect(
        db.activeProgramCycles.get(active.cycle.id),
      ).resolves.toMatchObject({ deloadWeekNumbers: [1, 4] })
    })
    await user.click(
      within(editor).getByRole('button', {
        name: 'Back from program editor',
      }),
    )
    expect(
      await screen.findByRole('option', { name: 'Deload 2' }),
    ).toBeInTheDocument()
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
