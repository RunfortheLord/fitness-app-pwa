import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { addLocalDays, formatLocalDate } from '@domain/dates'
import { translate } from '@domain/localization'
import { calorieHistoryService } from '@services/calorieHistoryService'
import { LanguageContext } from '@components/languageContextValue'
import { CalorieInsightsPage } from './CalorieInsightsPage'

vi.mock('@services/calorieHistoryService', () => ({
  calorieHistoryService: {
    getHistory: vi.fn(),
  },
}))

const mockGetHistory = vi.mocked(calorieHistoryService.getHistory)

beforeEach(() => {
  mockGetHistory.mockReset()
})

describe('CalorieInsightsPage', () => {
  it('loads the selected range and displays the chart and consistent summary averages', async () => {
    mockGetHistory.mockResolvedValue(
      historyEnding('2026-06-19', 7, {
        '2026-06-18': 1800,
        '2026-06-19': 2200,
      }),
    )
    renderPage('/calories?range=1w&end=2026-06-19')

    expect(await screen.findByText('Calorie summary')).toBeInTheDocument()
    expect(mockGetHistory).toHaveBeenCalledWith('2026-06-19', '1w')
    expect(screen.getByRole('button', { name: '1W' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    const summary = screen.getByRole('region', { name: 'Calorie summary' })
    expect(within(summary).getByText('29%')).toBeInTheDocument()
    expect(within(summary).getByText('2 of 7')).toBeInTheDocument()
    expect(within(summary).getAllByText('2,000 kcal')).toHaveLength(2)
    expect(within(summary).getByText('On target')).toBeInTheDocument()

    const graph = screen.getByLabelText(
      'Daily calories logged and target graph',
    )
    expect(graph.querySelectorAll('.calorie-bar')).toHaveLength(7)
  })

  it('updates the query and reloads all 90 days when 3M is selected', async () => {
    mockGetHistory.mockImplementation(async (endDate, range) =>
      historyEnding(endDate, range === '3m' ? 90 : 7, {
        [endDate]: 2100,
      }),
    )
    const user = userEvent.setup()
    const { router } = renderPage('/calories?range=1w&end=2026-06-19')
    await screen.findByText('Calorie summary')
    expect(screen.getByText('1 of 7')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '3M' }))

    await waitFor(() =>
      expect(mockGetHistory).toHaveBeenLastCalledWith('2026-06-19', '3m'),
    )
    expect(router.state.location.search).toBe('?range=3m&end=2026-06-19')
    expect(await screen.findByRole('button', { name: '3M' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await waitFor(() =>
      expect(
        screen
          .getByLabelText('Daily calories logged and target graph')
          .querySelectorAll('.calorie-bar'),
      ).toHaveLength(90),
    )
    expect(screen.getByText('1 of 90')).toBeInTheDocument()
    expect(screen.getByText('100 kcal surplus')).toBeInTheDocument()
  })

  it('defaults invalid query values and clamps a future end date to today', async () => {
    const today = formatLocalDate(new Date())
    const future = addLocalDays(today, 1)
    mockGetHistory.mockResolvedValue([])
    renderPage(`/calories?range=year&end=${future}`)

    await waitFor(() =>
      expect(mockGetHistory).toHaveBeenCalledWith(today, '1m'),
    )
    expect(screen.getByRole('button', { name: '1M' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(await screen.findByText('No calories logged')).toBeInTheDocument()
  })

  it('shows clear loading and lets the same range retry after a failure', async () => {
    mockGetHistory.mockImplementation(() => new Promise(() => undefined))
    const first = renderPage('/calories?range=1m&end=2026-06-19')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading calorie insights',
    )
    first.dispose()

    mockGetHistory.mockReset()
    mockGetHistory
      .mockRejectedValueOnce(new Error('IndexedDB unavailable'))
      .mockResolvedValueOnce(historyEnding('2026-06-19', 30, {}))
    const user = userEvent.setup()
    renderPage('/calories?range=1m&end=2026-06-19')
    expect(
      await screen.findByText('Calorie insights could not load.'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Calorie summary')).toBeInTheDocument()
    expect(mockGetHistory).toHaveBeenCalledTimes(2)
  })

  it('does not describe a rounded fractional difference as zero surplus', async () => {
    mockGetHistory.mockResolvedValue(
      historyEnding('2026-06-19', 7, { '2026-06-19': 2000.4 }),
    )
    renderPage('/calories?range=1w&end=2026-06-19')

    expect(await screen.findByText('<1 kcal surplus')).toBeInTheDocument()
  })

  it('renders translated summary grammar and locale-aware calories in Spanish', async () => {
    mockGetHistory.mockResolvedValue(
      historyEnding('2026-06-19', 7, { '2026-06-19': 12000 }, 10000),
    )
    renderPage('/calories?range=1w&end=2026-06-19', 'es')

    const summary = await screen.findByRole('region', {
      name: 'Resumen de calorías',
    })
    expect(within(summary).getByText('1 de 7')).toBeInTheDocument()
    expect(within(summary).getByText('12.000 kcal')).toBeInTheDocument()
    expect(within(summary).getByText('10.000 kcal')).toBeInTheDocument()
    expect(within(summary).getByText('2000 kcal superávit')).toBeInTheDocument()
  })

  it('ignores a stale range response that resolves after the current range', async () => {
    const oneMonth = deferred<ReturnType<typeof historyEnding>>()
    const threeMonths = deferred<ReturnType<typeof historyEnding>>()
    mockGetHistory.mockImplementation((_endDate, range) =>
      range === '1m' ? oneMonth.promise : threeMonths.promise,
    )
    const user = userEvent.setup()
    renderPage('/calories?range=1m&end=2026-06-19')

    await user.click(screen.getByRole('button', { name: '3M' }))
    threeMonths.resolve(historyEnding('2026-06-19', 90, { '2026-06-19': 2300 }))
    expect(await screen.findByText('1 of 90')).toBeInTheDocument()
    expect(screen.getByText('300 kcal surplus')).toBeInTheDocument()

    oneMonth.resolve(historyEnding('2026-06-19', 30, { '2026-06-19': 1500 }))
    await waitFor(() =>
      expect(screen.queryByText('1 of 30')).not.toBeInTheDocument(),
    )
    expect(screen.getByText('300 kcal surplus')).toBeInTheDocument()
  })

  it('provides an accessible back action to Home', async () => {
    mockGetHistory.mockResolvedValue([])
    const user = userEvent.setup()
    renderPage('/calories')

    await user.click(screen.getByRole('button', { name: 'Back to Home' }))

    expect(await screen.findByText('Home destination')).toBeInTheDocument()
  })
})

function renderPage(initialEntry: string, language: 'en' | 'es' = 'en') {
  const router = createMemoryRouter(
    [
      { path: '/', element: <p>Home destination</p> },
      {
        path: '/calories',
        element: (
          <LanguageContext.Provider
            value={{
              language,
              setLanguage: async () => undefined,
              t: (source, replacements) =>
                translate(language, source, replacements),
            }}
          >
            <CalorieInsightsPage />
          </LanguageContext.Provider>
        ),
      },
    ],
    { initialEntries: [initialEntry] },
  )
  const view = render(<RouterProvider router={router} />)
  return { router, dispose: view.unmount }
}

function historyEnding(
  endDate: `${number}-${number}-${number}`,
  numberOfDays: number,
  loggedByDate: Record<string, number>,
  targetCalories = 2000,
) {
  const startDate = addLocalDays(endDate, -(numberOfDays - 1))
  return Array.from({ length: numberOfDays }, (_, index) => {
    const localDate = addLocalDays(startDate, index)
    return {
      localDate,
      loggedCalories: loggedByDate[localDate] ?? 0,
      targetCalories,
    }
  })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}
