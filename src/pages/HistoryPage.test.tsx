import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { db } from '@db/database'
import { HistoryPage } from '@pages/HistoryPage'
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

describe('HistoryPage', () => {
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
