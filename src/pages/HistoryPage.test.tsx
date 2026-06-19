import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { db } from '@db/database'
import { createExerciseRepository } from '@repositories/exerciseRepository'
import { createFoodRepository } from '@repositories/foodRepository'
import { createProgramRepository } from '@repositories/programRepository'
import { createWorkoutRepository } from '@repositories/workoutRepository'
import { initializeAppData } from '@services/appInitializationService'
import { seedProgram, testLocalDate } from '@test/seedFactories'
import { HistoryPage } from './HistoryPage'

beforeEach(async () => {
  await db.delete()
  await db.open()
  await initializeAppData()
})

afterEach(async () => {
  await db.delete()
})

describe('HistoryPage', () => {
  it('shows a clear empty state', async () => {
    renderHistory()

    expect(await screen.findByText('No workout history')).toBeInTheDocument()
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
    expect(items[0]).toHaveTextContent('2026-06-19')
    expect(items[1]).toHaveTextContent('2026-06-17')
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

    expect(await screen.findByText('Local date')).toBeInTheDocument()
    expect(screen.getAllByText(testLocalDate)[0]).toBeInTheDocument()
    expect(screen.getByText('Program snapshot')).toBeInTheDocument()
    expect(screen.getByText('Upper Lower')).toBeInTheDocument()
    expect(screen.getByText('Workout-day snapshot')).toBeInTheDocument()
    expect(screen.getAllByText('Upper').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Workout notes')).toHaveValue('steady session')
    expect(screen.getByLabelText('Exercise notes')).toHaveValue('pause reps')
    expect(screen.getByText('Skipped: Bench press')).toBeInTheDocument()
    expect(screen.getByLabelText('Set 1 Weight')).toHaveValue('185')
    expect(screen.getByLabelText('Set 1 Reps')).toHaveValue('8')
    expect(screen.getByLabelText('Set 1 RIR')).toHaveValue('2')
    expect(screen.getByText('Skipped Bench press')).toBeInTheDocument()
    expect(screen.getByText('Selected')).toBeInTheDocument()
    expect(screen.getByText('Result')).toBeInTheDocument()
    expect(screen.getByText('Applied')).toBeInTheDocument()
  })

  it('edits workout notes, exercise notes, and recorded set values without changing reusable records', async () => {
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

    await user.clear(await screen.findByLabelText('Workout notes'))
    await user.type(screen.getByLabelText('Workout notes'), 'history note')
    await user.tab()
    await user.clear(screen.getByLabelText('Exercise notes'))
    await user.type(screen.getByLabelText('Exercise notes'), 'history exercise')
    await user.tab()
    await user.clear(screen.getByLabelText('Set 1 Weight'))
    await user.type(screen.getByLabelText('Set 1 Weight'), '155')
    await user.tab()
    await user.clear(screen.getByLabelText('Set 1 Reps'))
    await user.type(screen.getByLabelText('Set 1 Reps'), '7')
    await user.tab()

    await waitFor(async () => {
      const history = await repository.getWorkoutHistoryStructure(
        completed.history.id,
      )
      expect(history.workout.notes).toBe('history note')
      expect(history.exercises[0].notes).toBe('history exercise')
      expect(history.setsByExercise[history.exercises[0].id][0]).toMatchObject({
        metricValues: { weight: 155, reps: 7 },
      })
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

  it('deletes a historical workout only after confirmation', async () => {
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

    renderHistory(`/history?workout=${completed.history.id}`)

    await user.click(
      await screen.findByRole('button', { name: /Delete workout/ }),
    )
    await user.click(
      within(
        screen.getByRole('dialog', { name: 'Delete workout history?' }),
      ).getByRole('button', { name: 'Cancel' }),
    )
    await expect(db.workoutHistoryEntries.toArray()).resolves.toHaveLength(1)

    await user.click(screen.getByRole('button', { name: /Delete workout/ }))
    await user.click(
      within(
        screen.getByRole('dialog', { name: 'Delete workout history?' }),
      ).getByRole('button', { name: 'Delete' }),
    )

    await waitFor(async () => {
      await expect(db.workoutHistoryEntries.toArray()).resolves.toEqual([])
    })
    expect(await screen.findByText('No workout history')).toBeInTheDocument()
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

    expect(await screen.findByText('Plank')).toBeInTheDocument()
    expect(screen.getByText('Carry')).toBeInTheDocument()
    expect(screen.getAllByLabelText('Set 1 Duration')[0]).toHaveValue('45')
    expect(screen.getByLabelText('Set 1 Distance')).toHaveValue('0.25')
  })

  it('reviews detected changes without applying any destination', async () => {
    const user = userEvent.setup()
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

    expect(
      await screen.findByText('Added 3rd Bench press set'),
    ).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Save without applying' }),
    )

    await waitFor(async () => {
      await expect(
        db.detectedWorkoutChanges.get(completed.detectedChanges[0].id),
      ).resolves.toMatchObject({ status: 'rejected' })
    })
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
  render(<RouterProvider router={router} />)
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
