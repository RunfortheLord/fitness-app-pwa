import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { App } from '@app/App'
import { db } from '@db/database'
import { HomePage } from '@pages/HomePage'
import { NutritionPage } from '@pages/NutritionPage'
import { initializeAppData } from '@services/appInitializationService'

beforeEach(async () => {
  await db.delete()
  await db.open()
  await initializeAppData()
})

afterEach(async () => {
  await db.delete()
})

describe('NutritionPage', () => {
  it('creates, searches, logs, edits, deletes, and snapshots food logs', async () => {
    const user = userEvent.setup()
    renderNutrition()

    await screen.findByText('No recent foods')
    await user.click(screen.getByRole('button', { name: 'Create food' }))
    await expectSaveFoodDisabled()
    await fillFoodForm(user, {
      name: 'Rice',
      calories: '200',
      protein: '4',
      carbs: '45',
      fat: '1',
    })
    await user.click(screen.getByRole('button', { name: 'Save food' }))

    await user.type(
      screen.getByRole('searchbox', { name: 'Search foods' }),
      'ri',
    )
    await user.click(await screen.findByRole('button', { name: 'Log Rice' }))
    await user.clear(
      screen.getByRole('textbox', { name: 'Serving multiplier' }),
    )
    await user.type(
      screen.getByRole('textbox', { name: 'Serving multiplier' }),
      '1.5',
    )
    expect(screen.getByText(/Preview: 300 kcal/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Log food' }))

    expect(await screen.findByText('300 kcal')).toBeInTheDocument()
    await expect(screen.findByText(/1.5x 1 cup/)).resolves.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Edit Rice' }))
    await user.clear(
      screen.getByRole('textbox', { name: 'Calories per serving' }),
    )
    await user.type(
      screen.getByRole('textbox', { name: 'Calories per serving' }),
      '300',
    )
    await user.click(screen.getByRole('button', { name: 'Save food' }))

    const loggedRows = await db.foodLogEntries.toArray()
    expect(loggedRows[0]).toMatchObject({
      computedCalories: 300,
      foodSnapshot: { caloriesPerServing: 200, foodName: 'Rice' },
    })

    await user.click(screen.getByRole('button', { name: 'Edit Rice log' }))
    await user.clear(
      screen.getByRole('textbox', { name: 'Serving multiplier' }),
    )
    await user.type(
      screen.getByRole('textbox', { name: 'Serving multiplier' }),
      '2',
    )
    await user.click(screen.getByRole('button', { name: 'Save log' }))
    await waitFor(async () => {
      const [entry] = await db.foodLogEntries.toArray()
      expect(entry.computedCalories).toBe(400)
    })

    await user.click(screen.getByRole('button', { name: 'Delete Rice log' }))
    await user.click(
      within(
        screen.getByRole('dialog', { name: 'Delete food log?' }),
      ).getByRole('button', { name: 'Delete' }),
    )
    await waitFor(() =>
      expect(screen.getByText('No foods logged')).toBeInTheDocument(),
    )
    await expect(db.foodLogEntries.toArray()).resolves.toEqual([])
  })

  it('saves manual targets and updates the home dashboard', async () => {
    const user = userEvent.setup()
    renderNutrition()

    await user.click(screen.getByRole('button', { name: 'Targets' }))
    await user.clear(screen.getByRole('textbox', { name: 'Calories' }))
    await user.type(screen.getByRole('textbox', { name: 'Calories' }), '1800')
    await user.clear(screen.getByRole('textbox', { name: 'Protein target' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Protein target' }),
      '160',
    )
    await user.clear(
      screen.getByRole('textbox', { name: 'Carbohydrate target' }),
    )
    await user.type(
      screen.getByRole('textbox', { name: 'Carbohydrate target' }),
      '180',
    )
    await user.clear(screen.getByRole('textbox', { name: 'Fat target' }))
    await user.type(screen.getByRole('textbox', { name: 'Fat target' }), '60')
    await user.click(screen.getByRole('button', { name: 'Save targets' }))

    expect(
      await screen.findByText('Nutrition targets saved.'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Home' }))

    expect(await screen.findByText('1800 kcal target')).toBeInTheDocument()
    expect(await screen.findByText('0 g / 160 g')).toBeInTheDocument()
  })
})

function renderNutrition() {
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
    { initialEntries: ['/nutrition'] },
  )

  render(<RouterProvider router={router} />)
}

async function expectSaveFoodDisabled() {
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Save food' })).toBeDisabled(),
  )
}

async function fillFoodForm(
  user: ReturnType<typeof userEvent.setup>,
  values: {
    calories: string
    carbs: string
    fat: string
    name: string
    protein: string
  },
) {
  await user.type(screen.getByRole('textbox', { name: 'Name' }), values.name)
  await user.type(
    screen.getByRole('textbox', { name: 'Serving quantity' }),
    '1',
  )
  await user.type(screen.getByRole('textbox', { name: 'Serving unit' }), 'cup')
  await user.type(
    screen.getByRole('textbox', { name: 'Calories per serving' }),
    values.calories,
  )
  await user.type(
    screen.getByRole('textbox', { name: 'Protein per serving' }),
    values.protein,
  )
  await user.type(
    screen.getByRole('textbox', { name: 'Carbohydrates per serving' }),
    values.carbs,
  )
  await user.type(
    screen.getByRole('textbox', { name: 'Fat per serving' }),
    values.fat,
  )
}
