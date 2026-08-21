import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '@db/database'
import { createExerciseRepository } from '@repositories/exerciseRepository'
import { createFoodRepository } from '@repositories/foodRepository'
import { createProgramRepository } from '@repositories/programRepository'
import { createRunRepository } from '@repositories/runRepository'
import { settingsRepository } from '@repositories/settingsRepository'
import { createWorkoutRepository } from '@repositories/workoutRepository'
import { initializeAppData } from '@services/appInitializationService'
import { clearCachedHistoryPageData } from '@pages/historyPageCache'
import { seedProgram, testLocalDate } from '@test/seedFactories'
import type { BodyweightEntry } from '@shared-types/app'
import { HistoryPage } from './HistoryPage'

beforeEach(async () => {
  clearCachedHistoryPageData()
  await db.delete()
  await db.open()
  await initializeAppData()
})

afterEach(async () => {
  vi.restoreAllMocks()
  await db.delete()
})

describe('HistoryPage', () => {
  it('shows a clear empty state', async () => {
    renderHistory()

    expect(await screen.findByText('No completed activity')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Graphs' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Bodyweight' }),
    ).toBeInTheDocument()
  })

  it('shows a clear empty state for bodyweight progress', async () => {
    renderHistory('/history?view=bodyweight')

    expect(await screen.findByText('No bodyweight data')).toBeInTheDocument()
  })

  it('opens exercise graphs directly from the bodyweight graph category', async () => {
    const user = userEvent.setup()
    renderHistory('/history?view=bodyweight')

    await user.click(await screen.findByRole('button', { name: 'Exercises' }))

    expect(
      await screen.findByRole('heading', { name: 'Strength Progress' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Open exercise graphs' }),
    ).not.toBeInTheDocument()
  })

  it('shows bodyweight graph one-point and accessible selected details', async () => {
    const user = userEvent.setup()
    await db.bodyweightEntries.add({
      id: 'weight-1',
      localDate: '2026-06-19',
      weight: 188.4,
      unit: 'lb',
      notes: '',
      createdAt: '2026-06-19T12:00:00.000Z',
      updatedAt: '2026-06-19T12:00:00.000Z',
    })

    renderHistory('/history?view=bodyweight')

    expect(await screen.findByText('Bodyweight progress')).toBeInTheDocument()
    expect(await screen.findByLabelText('Graph summary')).toHaveTextContent(
      '188.4 lb',
    )
    expect(screen.getByLabelText('Graph summary')).toHaveTextContent(
      'Last recorded',
    )
    expect(screen.getByLabelText('Graph summary')).not.toHaveTextContent(
      'First',
    )
    expect(screen.getByLabelText('Graph summary')).not.toHaveTextContent(
      'Range',
    )
    expect(
      screen.getAllByText(/Add another entry to show a trend/).length,
    ).toBeGreaterThan(0)
    expect(
      screen
        .getByLabelText('Bodyweight graph')
        .querySelector('.bodyweight-trend-line'),
    ).toBeNull()

    await user.click(
      screen.getByRole('button', { name: '2026-06-19 188.4 lb' }),
    )
    expect(screen.getByText('Selected')).toBeInTheDocument()
    expect(screen.getByText(/Jun 19, 2026/)).toBeInTheDocument()
  })

  it('shows the bodyweight graph converted to kilograms when preferred', async () => {
    await settingsRepository.saveWeightUnit('kg')
    await db.bodyweightEntries.add({
      id: 'weight-kg',
      localDate: '2026-06-19',
      weight: 200,
      unit: 'lb',
      notes: '',
      createdAt: '2026-06-19T12:00:00.000Z',
      updatedAt: '2026-06-19T12:00:00.000Z',
    })

    renderHistory('/history?view=bodyweight')

    // 200 lb -> 90.7 kg shown to one decimal, with a kg axis label. The unit
    // resolves from a live query, so wait for the converted render.
    expect(await screen.findByText('Bodyweight (kg)')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByLabelText('Graph summary')).toHaveTextContent(
        '90.7 kg',
      ),
    )
    expect(screen.getByLabelText('Graph summary')).not.toHaveTextContent('lb')
  })

  it('supports range changes, multiple same-day entries, and long history without dropping records', async () => {
    const user = userEvent.setup()
    const entries = Array.from({ length: 34 }, (_, index) => {
      const day = String((index % 28) + 1).padStart(2, '0')
      return {
        id: `weight-${index}`,
        localDate: `2026-05-${day}` as BodyweightEntry['localDate'],
        weight: 180 + index,
        unit: 'lb' as const,
        notes: '',
        createdAt: `2026-05-${day}T12:00:00.000Z`,
        updatedAt: `2026-05-${day}T12:00:00.000Z`,
      }
    })
    await db.bodyweightEntries.bulkAdd([
      {
        id: 'older',
        localDate: '2025-12-01',
        weight: 200,
        unit: 'lb',
        notes: '',
        createdAt: '2025-12-01T12:00:00.000Z',
        updatedAt: '2025-12-01T12:00:00.000Z',
      },
      ...entries,
      {
        id: 'same-day-late',
        localDate: '2026-05-28',
        weight: 215,
        unit: 'lb',
        notes: '',
        createdAt: '2026-05-28T23:00:00.000Z',
        updatedAt: '2026-05-28T23:00:00.000Z',
      },
    ])

    renderHistory('/history?view=bodyweight')

    expect(await screen.findByText('Bodyweight progress')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'All' })).toBeInTheDocument()
    expect(screen.queryByText('View everything')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Dashboard filter')).not.toBeInTheDocument()
    expect(
      screen
        .getByLabelText('Bodyweight range')
        .style.getPropertyValue('--segment-count'),
    ).toBe('4')
    expect(screen.getByRole('button', { name: '3M' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await user.click(screen.getByRole('button', { name: 'All' }))
    expect(screen.getByLabelText('Graph summary')).toHaveTextContent(
      'Trend weight',
    )
    expect(screen.getByLabelText('Graph summary')).toHaveTextContent(
      'Last recorded - 2026-05-28',
    )
    expect(screen.getByLabelText('Graph summary')).not.toHaveTextContent(
      'First',
    )
    expect(screen.getByLabelText('Graph summary')).not.toHaveTextContent(
      'Range',
    )
    const graph = screen.getByLabelText('Bodyweight graph')
    expect(graph.querySelector('.bodyweight-measurement-line')).not.toBeNull()
    expect(graph.querySelector('.bodyweight-trend-line')).not.toBeNull()
    expect(graph.querySelectorAll('circle')).toHaveLength(36)

    await user.click(screen.getByRole('button', { name: '2026-05-28 215 lb' }))
    expect(screen.getAllByText('215 lb').length).toBeGreaterThan(0)
    await expect(db.bodyweightEntries.count()).resolves.toBe(36)
  })

  it('shows estimated one-repetition-maximum strength graphs from workout history', async () => {
    const user = userEvent.setup()
    const repository = createWorkoutRepository(db)
    const program = await seedProgram(db)
    const active = await createProgramRepository(db).activateTemplate(
      program.template.id,
    )
    await completeSeedWorkout(repository, active.cycle.id, active.days[0].id, {
      localDate: '2026-06-17',
      weight: 100,
      reps: 5,
    })
    await completeSeedWorkout(repository, active.cycle.id, active.days[0].id, {
      localDate: '2026-06-19',
      weight: 120,
      reps: 1,
    })

    renderHistory('/history?view=graphs')

    expect(
      await screen.findByRole('heading', { name: 'Graphs' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('Strength Progress')).toBeInTheDocument()
    expect(
      await screen.findByLabelText('Strength graph metric'),
    ).toBeInTheDocument()
    expect(
      (await screen.findAllByText(/latest estimated 1 rep max: 120 lb/i))
        .length,
    ).toBeGreaterThan(0)
    await user.click(
      screen.getByRole('button', {
        name: '2026-06-19 120 lb estimated one-repetition maximum',
      }),
    )
    expect(screen.getAllByText('Estimated 1RM').length).toBeGreaterThan(0)
    expect(screen.getAllByText('120 lb').length).toBeGreaterThan(0)
  })

  it('graphs total completed-set volume per exercise and workout', async () => {
    const user = userEvent.setup()
    const repository = createWorkoutRepository(db)
    const program = await seedProgram(db)
    const active = await createProgramRepository(db).activateTemplate(
      program.template.id,
    )
    const started = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    for (const workoutSet of started.sets) {
      await repository.updateWorkoutSet(workoutSet.id, {
        metricValues: { weight: 100, reps: 5 },
        rir: 2,
        completed: true,
      })
    }
    await repository.completeWorkout({
      workoutId: started.workout.id,
      completedAt: new Date(
        Date.parse(started.workout.startedAt) + 25 * 60 * 1000,
      ).toISOString(),
    })

    renderHistory('/history?view=graphs')

    await user.click(
      await screen.findByRole('button', { name: 'Total volume' }),
    )
    expect(screen.getByLabelText('Total volume graph')).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', {
        name: '2026-06-18 1,000 lb total volume',
      }),
    )
    expect(screen.getByText('Completed sets')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getAllByText('1,000 lb').length).toBeGreaterThan(0)
  })

  it('defaults strength graphs to the exercise completed most recently', async () => {
    const repository = createWorkoutRepository(db)
    const exerciseRepository = createExerciseRepository(db)
    const programRepository = createProgramRepository(db)
    const bench = await exerciseRepository.createExercise({
      name: 'Bench press',
      defaultRestSeconds: 120,
      trackingMethodId: 'weight_reps',
      notes: '',
    })
    const row = await exerciseRepository.createExercise({
      name: 'Cable row',
      defaultRestSeconds: 120,
      trackingMethodId: 'weight_reps',
      notes: '',
    })
    const program = await programRepository.createProgramTemplate({
      name: 'Graph program',
      days: [
        {
          name: 'Upper',
          exercises: [
            { exerciseId: bench.id, targetSetCount: 1 },
            { exerciseId: row.id, targetSetCount: 1 },
          ],
        },
      ],
    })
    const active = await programRepository.activateTemplate(program.template.id)

    await completeExerciseWorkout(
      repository,
      active.cycle.id,
      active.days[0].id,
      bench.id,
      { localDate: '2026-06-17', weight: 100 },
    )
    await completeExerciseWorkout(
      repository,
      active.cycle.id,
      active.days[0].id,
      row.id,
      { localDate: '2026-06-20', weight: 120 },
    )

    renderHistory('/history?view=graphs')

    expect(
      await screen.findByRole('heading', { name: 'Graphs' }),
    ).toBeInTheDocument()
    expect(
      await screen.findByRole('button', { name: 'Select exercise: Cable row' }),
    ).toBeInTheDocument()
  })

  it('shows calorie history with one-week, one-month, and three-month ranges', async () => {
    const user = userEvent.setup()
    renderHistory('/history?view=graphs')

    await user.click(await screen.findByRole('button', { name: 'Calories' }))

    expect(
      await screen.findByRole('img', {
        name: 'Daily calories logged and target graph',
      }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Calorie graph range')).toHaveStyle({
      '--segment-count': '3',
    })
    expect(screen.getByRole('button', { name: '1W' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await user.click(screen.getByRole('button', { name: '3M' }))
    await waitFor(() =>
      expect(
        screen
          .getByRole('img', {
            name: 'Daily calories logged and target graph',
          })
          .querySelectorAll('rect.calorie-bar'),
      ).toHaveLength(90),
    )
  })

  it('orders completed workouts by local workout date', async () => {
    const repository = createWorkoutRepository(db)
    const program = await seedProgram(db)
    const active = await createProgramRepository(db).activateTemplate(
      program.template.id,
    )
    await completeSeedWorkout(repository, active.cycle.id, active.days[0].id, {
      localDate: '2026-06-17',
      weight: 95,
    })
    await completeSeedWorkout(repository, active.cycle.id, active.days[0].id, {
      localDate: '2026-06-19',
      weight: 105,
    })

    renderHistory()

    const items = await screen.findAllByRole('button', { name: /Upper/ })
    expect(items[0]).toHaveTextContent('Jun 19, 2026')
    expect(items[1]).toHaveTextContent('Jun 17, 2026')
    expect(screen.queryByText('Local date')).not.toBeInTheDocument()
  })

  it('restores the history list scroll position after closing a day detail', async () => {
    const user = userEvent.setup()
    const repository = createWorkoutRepository(db)
    const program = await seedProgram(db)
    const active = await createProgramRepository(db).activateTemplate(
      program.template.id,
    )
    await completeSeedWorkout(repository, active.cycle.id, active.days[0].id, {
      localDate: '2026-06-17',
      weight: 95,
    })
    await completeSeedWorkout(repository, active.cycle.id, active.days[0].id, {
      localDate: '2026-06-19',
      weight: 105,
    })
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(640)
    const scrollTo = vi.spyOn(window, 'scrollTo')

    renderHistory()
    const items = await screen.findAllByRole('button', { name: /Upper/ })
    await user.click(items[1])
    expect(await screen.findByText('Date completed')).toBeInTheDocument()
    scrollTo.mockClear()

    await user.click(screen.getByRole('button', { name: 'All history' }))
    expect(
      await screen.findAllByRole('button', { name: /Upper/ }),
    ).toHaveLength(2)
    expect(scrollTo).toHaveBeenCalledWith({
      top: 640,
      left: 0,
      behavior: 'auto',
    })
  })

  it('organizes history by program and remembers the selected program', async () => {
    const user = userEvent.setup()
    const workouts = createWorkoutRepository(db)
    const programs = createProgramRepository(db)
    const first = await seedProgram(db)
    const firstActive = await programs.activateTemplate(first.template.id)
    await completeSeedWorkout(
      workouts,
      firstActive.cycle.id,
      firstActive.days[0].id,
    )

    const second = await seedProgram(db)
    await programs.updateProgramTemplate(second.template.id, {
      name: 'Second Program',
    })
    await programs.updateTemplateDay(second.days[0].id, { name: 'Pull' })
    const secondActive = await programs.activateTemplate(second.template.id)
    await completeSeedWorkout(
      workouts,
      secondActive.cycle.id,
      secondActive.days[0].id,
    )
    await settingsRepository.saveHistoryPreference({
      sortMode: 'program',
      programId: first.template.id,
    })

    const view = renderHistory()

    expect(
      await screen.findByRole('button', { name: 'All programs' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'By program' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: /Upper/ })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Pull/ }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'All programs' }))
    await user.click(
      screen.getByRole('button', { name: 'View Second Program history' }),
    )
    expect(
      await screen.findByRole('button', { name: /Pull/ }),
    ).toBeInTheDocument()
    await waitFor(async () => {
      await expect(settingsRepository.getSettings()).resolves.toMatchObject({
        historySortMode: 'program',
        historyProgramId: second.template.id,
      })
    })

    view.unmount()
    renderHistory()
    expect(
      await screen.findByRole('button', { name: /Pull/ }),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: /Upper/ }),
      ).not.toBeInTheDocument(),
    )

    await user.click(screen.getByRole('button', { name: /Pull/ }))
    expect(await screen.findByText('Date completed')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'All history' }))

    expect(
      await screen.findByRole('button', {
        name: `View ${first.template.name} history`,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'View Second Program history' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'All programs' }),
    ).not.toBeInTheDocument()
    await waitFor(async () => {
      await expect(settingsRepository.getSettings()).resolves.toMatchObject({
        historySortMode: 'program',
        historyProgramId: null,
      })
    })
  })

  it('shows runs in home history and returns details to the full history list', async () => {
    const user = userEvent.setup()
    const repository = createWorkoutRepository(db)
    const program = await seedProgram(db)
    const active = await createProgramRepository(db).activateTemplate(
      program.template.id,
    )
    await completeSeedWorkout(repository, active.cycle.id, active.days[0].id)
    await createRunRepository(db).logManualRun(
      {
        localDate: '2026-06-18',
        distanceMeters: 5000,
        elapsedSeconds: 1500,
        trackingMode: 'manual',
      },
      new Date('2026-06-18T18:00:00.000Z'),
    )

    renderHistory('/history?source=home')

    expect(
      await screen.findByRole('button', { name: /Upper/ }),
    ).toBeInTheDocument()
    const run = screen.getByRole('button', { name: /Jun 18, 2026 Run/ })
    expect(run).toHaveTextContent('Manual run')
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Graphs' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Bodyweight' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'History' }),
    ).not.toBeInTheDocument()

    await user.click(run)
    expect(await screen.findByText('Run detail')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(
      await screen.findByRole('button', { name: /Jun 18, 2026 Run/ }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Upper/ }))
    expect(await screen.findByText('Date completed')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(
      await screen.findByRole('button', { name: /Upper/ }),
    ).toBeInTheDocument()
  })

  it('shows completed runs with dedicated run detail', async () => {
    const repository = createRunRepository(db)
    const run = await repository.startRun(new Date('2026-06-19T12:00:00.000Z'))
    await db.runs.update(run.id, {
      distanceMeters: 3218.688,
      movingSeconds: 1200,
      averageMovingPaceSecondsPerMile: 600,
      hasGpsGap: true,
    })
    await db.runSplits.bulkAdd([
      {
        id: 'split-1',
        runId: run.id,
        mileNumber: 1,
        distanceMeters: 1609.344,
        elapsedSeconds: 620,
        movingSeconds: 600,
        paceSecondsPerMile: 600,
        completedAt: '2026-06-19T12:10:20.000Z',
        createdAt: '2026-06-19T12:10:20.000Z',
      },
    ])
    await db.runClassifications.add({
      id: 'classification-1',
      runId: run.id,
      type: 'walking',
      response: 'walking',
      startedAt: '2026-06-19T12:08:00.000Z',
      endedAt: null,
      createdAt: '2026-06-19T12:08:00.000Z',
    })
    await repository.finishRun(run.id, new Date('2026-06-19T12:25:00.000Z'))

    renderHistory(`/history?run=${run.id}`)

    expect(await screen.findByText('Run detail')).toBeInTheDocument()
    expect(screen.getAllByText('2.00 mi').length).toBeGreaterThan(0)
    expect(screen.getAllByText('10:00/mi').length).toBeGreaterThan(0)
    expect(screen.getByText('Mile 1')).toBeInTheDocument()
    expect(screen.getByText('walking')).toBeInTheDocument()
    expect(screen.queryByText('GPS gap')).not.toBeInTheDocument()
    expect(screen.getByText('Outdoor GPS run')).toBeInTheDocument()
  })

  it('shows each completed run as a standalone history card', async () => {
    const repository = createRunRepository(db)
    await repository.logManualRun(
      {
        localDate: '2026-06-18',
        distanceMeters: 5000,
        elapsedSeconds: 1500,
        trackingMode: 'treadmill',
      },
      new Date('2026-06-18T18:00:00.000Z'),
    )

    renderHistory()

    const runCard = await screen.findByRole('button', {
      name: /Jun 18, 2026 Run/,
    })
    expect(runCard).toHaveClass('history-item-card', 'history-run-card')
    expect(runCard).toHaveTextContent('Treadmill run')
    expect(runCard).toHaveTextContent('3.11 mi')
  })

  it('deletes a selected workout history day after confirmation', async () => {
    const user = userEvent.setup()
    const repository = createWorkoutRepository(db)
    const program = await seedProgram(db)
    const active = await createProgramRepository(db).activateTemplate(
      program.template.id,
    )
    const completed = await completeSeedWorkout(
      repository,
      active.cycle.id,
      active.days[0].id,
    )

    renderHistory()

    await user.click(await screen.findByRole('button', { name: 'Select' }))
    const workoutCard = screen.getByRole('button', { name: /Upper/ })
    await user.click(workoutCard)
    expect(workoutCard).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    const dialog = screen.getByRole('dialog', {
      name: 'Delete day permanently?',
    })
    expect(dialog).toHaveTextContent('Delete Jun 18, 2026 Upper permanently?')
    await user.click(within(dialog).getByRole('button', { name: 'Delete day' }))

    expect(await screen.findByText('No completed activity')).toBeInTheDocument()
    await expect(
      db.workoutHistoryEntries.get(completed.history.id),
    ).resolves.toBeUndefined()
    await expect(
      db.workoutHistoryExercises
        .where({ workoutId: completed.history.id })
        .count(),
    ).resolves.toBe(0)
    await expect(
      db.workoutHistorySets.where({ workoutId: completed.history.id }).count(),
    ).resolves.toBe(0)
  })

  it('deletes a selected run history day after confirmation', async () => {
    const user = userEvent.setup()
    const repository = createRunRepository(db)
    const run = await repository.logManualRun(
      {
        localDate: '2026-06-18',
        distanceMeters: 5000,
        elapsedSeconds: 1500,
        trackingMode: 'manual',
      },
      new Date('2026-06-18T18:00:00.000Z'),
    )

    renderHistory()

    await user.click(await screen.findByRole('button', { name: 'Select' }))
    const runCard = screen.getByRole('button', { name: /Jun 18, 2026 Run/ })
    await user.click(runCard)
    expect(runCard).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await user.click(
      within(
        screen.getByRole('dialog', { name: 'Delete day permanently?' }),
      ).getByRole('button', { name: 'Delete day' }),
    )

    expect(await screen.findByText('No completed activity')).toBeInTheDocument()
    await expect(db.runs.get(run.id)).resolves.toBeUndefined()
  })

  it('displays full workout detail including snapshots, timestamps, sets, skipped exercises, and changes', async () => {
    const repository = createWorkoutRepository(db)
    const program = await seedProgram(db)
    const active = await createProgramRepository(db).activateTemplate(
      program.template.id,
    )
    const started = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    await repository.updateWorkoutNotes(started.workout.id, 'steady session')
    await repository.updateWorkoutExerciseNotes(
      started.exercises[0].id,
      'pause reps',
    )
    await repository.updateWorkoutSet(started.sets[0].id, {
      metricValues: { weight: 185, reps: 8 },
      rir: 2,
      completed: true,
    })
    await repository.skipExercise(started.exercises[0].id, true)
    const completed = await repository.completeWorkout({
      workoutId: started.workout.id,
      completedAt: new Date(
        Date.parse(started.workout.startedAt) + 30 * 60 * 1000,
      ).toISOString(),
      detectedChanges: [
        {
          type: 'exercise_skipped_or_removed',
          description: 'Skipped Bench press',
          sourcePath: `cycle:${active.cycle.id};day:${active.days[0].id};exercise:${active.exercises[0].id};template:${program.template.id};templateExercise:${program.exercises[0].id}`,
          performedPath: `workout:${started.workout.id};exercise:${started.exercises[0].id}`,
        },
      ],
    })

    renderHistory(`/history?workout=${completed.history.id}`)

    expect(await screen.findByText('Date completed')).toBeInTheDocument()
    expect(screen.getByText('June 18th, 2026')).toBeInTheDocument()
    expect(screen.queryByText('Started')).not.toBeInTheDocument()
    expect(screen.queryByText('Completed')).not.toBeInTheDocument()
    expect(screen.queryByText('Program snapshot')).not.toBeInTheDocument()
    expect(screen.queryByText('Upper Lower')).not.toBeInTheDocument()
    expect(screen.queryByText('Workout-day snapshot')).not.toBeInTheDocument()
    expect(screen.getAllByText('Upper').length).toBeGreaterThan(0)
    expect(screen.queryByLabelText('Workout notes')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Bench press/ }))
    expect(screen.queryByLabelText('Exercise notes')).not.toBeInTheDocument()
    expect(screen.queryByText('pause reps')).not.toBeInTheDocument()
    expect(screen.queryByText(/weight_reps/)).not.toBeInTheDocument()
    expect(screen.getByText('Skipped: Bench press')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByText('185 lb')).toBeInTheDocument()
    expect(screen.getAllByText('8').length).toBeGreaterThan(0)
    expect(screen.getAllByText('2').length).toBeGreaterThan(0)
    expect(screen.queryByText('Skipped Bench press')).not.toBeInTheDocument()
    expect(screen.queryByText('Selected')).not.toBeInTheDocument()
    expect(screen.queryByText('Result')).not.toBeInTheDocument()
    expect(screen.queryByText('Applied')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Resume Workout/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Delete workout/ }),
    ).not.toBeInTheDocument()
  })

  it('shows recorded set values as read-only history', async () => {
    const user = userEvent.setup()
    const food = await createFoodRepository(db).createFood({
      name: 'Reusable rice',
      servingQuantity: 1,
      servingUnit: 'cup',
      servingDescription: 'cooked',
      caloriesPerServing: 200,
      proteinGramsPerServing: 4,
      carbohydrateGramsPerServing: 45,
      fatGramsPerServing: 1,
      notes: 'food notes',
    })
    const repository = createWorkoutRepository(db)
    const program = await seedProgram(db)
    const active = await createProgramRepository(db).activateTemplate(
      program.template.id,
    )
    const completed = await completeSeedWorkout(
      repository,
      active.cycle.id,
      active.days[0].id,
      { weight: 135, reps: 5, rir: 3 },
    )

    renderHistory(`/history?workout=${completed.history.id}`)

    await user.click(await screen.findByRole('button', { name: /Bench press/ }))
    expect(screen.queryByLabelText('Exercise notes')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByText('135 lb')).toBeInTheDocument()
    expect(screen.getAllByText('5').length).toBeGreaterThan(0)
    expect(screen.getAllByText('3').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Set 1 complete')).toBeInTheDocument()
    expect(screen.getByLabelText('Set 2 incomplete')).toBeInTheDocument()
    expect(screen.queryByText('Complete')).not.toBeInTheDocument()
    expect(screen.queryByText('Incomplete')).not.toBeInTheDocument()

    const history = await repository.getWorkoutHistoryStructure(
      completed.history.id,
    )
    expect(history.exercises[0].notes).toBe('')
    expect(history.setsByExercise[history.exercises[0].id][0]).toMatchObject({
      metricValues: { weight: 135, reps: 5 },
    })
    await expect(
      db.templateWorkoutExercises.get(program.exercises[0].id),
    ).resolves.toMatchObject({ targetSetCount: 2, targetRepsMin: 8 })
    await expect(
      db.activeCycleWorkoutExercises.get(active.exercises[0].id),
    ).resolves.toMatchObject({ targetSetCount: 2, targetRepsMin: 8 })
    await expect(db.foods.get(food.id)).resolves.toMatchObject({
      name: 'Reusable rice',
      notes: 'food notes',
    })
  })

  it('does not expose destructive completed workout actions in detail', async () => {
    const repository = createWorkoutRepository(db)
    const program = await seedProgram(db)
    const active = await createProgramRepository(db).activateTemplate(
      program.template.id,
    )
    const completed = await completeSeedWorkout(
      repository,
      active.cycle.id,
      active.days[0].id,
    )

    renderHistory(`/history?workout=${completed.history.id}`)

    expect(await screen.findByText('Date completed')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Delete workout/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Resume Workout/ }),
    ).not.toBeInTheDocument()
  })

  it('displays mixed tracking methods with duration and distance metrics after reload', async () => {
    const exerciseRepository = createExerciseRepository(db)
    const plank = await exerciseRepository.createExercise({
      name: 'Plank',
      defaultRestSeconds: 30,
      trackingMethodId: 'duration',
    })
    const carry = await exerciseRepository.createExercise({
      name: 'Carry',
      defaultRestSeconds: 45,
      trackingMethodId: 'distance_duration',
    })
    const program = await createProgramRepository(db).createProgramTemplate({
      name: 'Mixed metrics',
      days: [
        {
          name: 'Conditioning',
          exercises: [
            { exerciseId: plank.id, targetSetCount: 1 },
            { exerciseId: carry.id, targetSetCount: 1 },
          ],
        },
      ],
    })
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
      metricValues: { durationSeconds: 45 },
      completed: true,
    })
    await repository.updateWorkoutSet(started.sets[1].id, {
      metricValues: { distance: 0.25 },
      completed: true,
    })
    const completed = await repository.completeWorkout({
      workoutId: started.workout.id,
    })

    renderHistory(`/history?workout=${completed.history.id}`)

    expect((await screen.findAllByText('Plank')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Carry').length).toBeGreaterThan(0)
    await userEvent.click(screen.getByRole('button', { name: /Plank/ }))
    await userEvent.click(screen.getByRole('button', { name: /Carry/ }))
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByText('45')).toBeInTheDocument()
    expect(screen.getByText('0.25')).toBeInTheDocument()
  })

  it('keeps detected change review out of completed workout detail', async () => {
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
    await repository.updateWorkoutSet(started.sets[0].id, { completed: true })
    await repository.addSet(started.exercises[0].id)
    const completed = await repository.completeWorkout({
      workoutId: started.workout.id,
    })

    renderHistory(`/history?workout=${completed.history.id}`)

    expect(await screen.findByText('Date completed')).toBeInTheDocument()
    expect(
      screen.queryByText('Added 3rd Bench press set'),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Pending')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Save without applying' }),
    ).not.toBeInTheDocument()
    await expect(
      db.detectedWorkoutChanges.get(completed.detectedChanges[0].id),
    ).resolves.toMatchObject({ status: 'pending' })
    await expect(
      db.activeCycleWorkoutExercises.get(active.exercises[0].id),
    ).resolves.toMatchObject({ targetSetCount: 2 })
  })
})

function renderHistory(initialEntry = '/history') {
  const router = createMemoryRouter(
    [{ path: '/history', element: <HistoryPage /> }],
    { initialEntries: [initialEntry] },
  )
  return render(<RouterProvider router={router} />)
}

async function completeSeedWorkout(
  repository: ReturnType<typeof createWorkoutRepository>,
  activeCycleId: string,
  dayId: string,
  options: {
    localDate?: typeof testLocalDate | '2026-06-17' | '2026-06-19'
    reps?: number
    rir?: number
    weight?: number
  } = {},
) {
  const started = await repository.startWorkout({
    activeCycleId,
    dayId,
    localDate: options.localDate ?? testLocalDate,
  })
  await repository.updateWorkoutSet(started.sets[0].id, {
    metricValues: {
      weight: options.weight ?? 135,
      reps: options.reps ?? 8,
    },
    rir: options.rir ?? 2,
    completed: true,
  })
  return repository.completeWorkout({
    workoutId: started.workout.id,
    completedAt: new Date(
      Date.parse(started.workout.startedAt) + 25 * 60 * 1000,
    ).toISOString(),
  })
}

async function completeExerciseWorkout(
  repository: ReturnType<typeof createWorkoutRepository>,
  activeCycleId: string,
  dayId: string,
  exerciseId: string,
  options: {
    localDate: BodyweightEntry['localDate']
    weight: number
    reps?: number
  },
) {
  const started = await repository.startWorkout({
    activeCycleId,
    dayId,
    localDate: options.localDate,
  })
  const exercise = started.exercises.find(
    (candidate) => candidate.exerciseId === exerciseId,
  )
  const set = started.sets.find(
    (candidate) => candidate.workoutExerciseId === exercise?.id,
  )
  if (!exercise || !set) {
    throw new Error('Seed workout exercise was not found.')
  }
  await repository.updateWorkoutSet(set.id, {
    metricValues: {
      weight: options.weight,
      reps: options.reps ?? 8,
    },
    rir: 2,
    completed: true,
  })
  return repository.completeWorkout({
    workoutId: started.workout.id,
    completedAt: new Date(
      Date.parse(started.workout.startedAt) + 25 * 60 * 1000,
    ).toISOString(),
  })
}
