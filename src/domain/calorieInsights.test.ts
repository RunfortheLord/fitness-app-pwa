import { describe, expect, it } from 'vitest'

import {
  CALORIE_INSIGHTS_RANGE_DAYS,
  createCalorieInsights,
  type CalorieInsightDay,
} from '@domain/calorieInsights'

describe('createCalorieInsights', () => {
  it.each([
    ['1w', 7, '2026-06-13'],
    ['1m', 30, '2026-05-21'],
    ['3m', 90, '2026-03-22'],
  ] as const)(
    'uses an inclusive %s range of %i calendar days',
    (range, expectedDays, expectedStartDate) => {
      const insights = createCalorieInsights({
        history: [],
        range,
        today: '2026-06-19',
      })

      expect(CALORIE_INSIGHTS_RANGE_DAYS[range]).toBe(expectedDays)
      expect(insights).toMatchObject({
        range,
        startDate: expectedStartDate,
        endDate: '2026-06-19',
        summary: { daysInRange: expectedDays },
      })
    },
  )

  it('filters and sorts local-date rows from the range start through today', () => {
    const history = [
      day('2026-06-20', 2100, 2000),
      day('2026-06-19', 2000, 2000),
      day('2026-06-12', 1900, 2000),
      day('2026-06-13', 1800, 2000),
    ]

    const insights = createCalorieInsights({
      history,
      range: '1w',
      today: '2026-06-19',
    })

    expect(insights.days.map((item) => item.localDate)).toEqual([
      '2026-06-13',
      '2026-06-19',
    ])
    expect(history.map((item) => item.localDate)).toEqual([
      '2026-06-20',
      '2026-06-19',
      '2026-06-12',
      '2026-06-13',
    ])
  })

  it('separates logging consistency from eligible target comparisons', () => {
    const insights = createCalorieInsights({
      history: [
        day('2026-06-15', 1800, 2000),
        day('2026-06-16', 2200, 2000),
        day('2026-06-17', 3000, 0),
        day('2026-06-18', 0, 2000),
        day('2026-06-19', 2300, 2000),
      ],
      range: '1w',
      today: '2026-06-19',
    })

    expect(insights.summary).toEqual({
      daysLogged: 4,
      daysInRange: 7,
      consistencyPercentage: 57,
      averageLoggedCalories: 2100,
      averageTargetCalories: 2000,
      averageDailyCalorieDifference: 100,
      calorieBalance: 'surplus',
    })
  })

  it.each([
    {
      loggedCalories: 1900,
      targetCalories: 2000,
      difference: -100,
      calorieBalance: 'deficit',
    },
    {
      loggedCalories: 2100,
      targetCalories: 2000,
      difference: 100,
      calorieBalance: 'surplus',
    },
    {
      loggedCalories: 2000,
      targetCalories: 2000,
      difference: 0,
      calorieBalance: 'on_target',
    },
  ] as const)(
    'classifies $loggedCalories logged calories against a $targetCalories target as $calorieBalance',
    ({ loggedCalories, targetCalories, difference, calorieBalance }) => {
      const insights = createCalorieInsights({
        history: [day('2026-06-19', loggedCalories, targetCalories)],
        range: '1w',
        today: '2026-06-19',
      })

      expect(insights.summary).toMatchObject({
        averageDailyCalorieDifference: difference,
        calorieBalance,
      })
    },
  )

  it('leaves the average and classification unavailable without comparable days', () => {
    const insights = createCalorieInsights({
      history: [day('2026-06-18', 1500, 0), day('2026-06-19', 0, 2000)],
      range: '1w',
      today: '2026-06-19',
    })

    expect(insights.summary).toEqual({
      daysLogged: 1,
      daysInRange: 7,
      consistencyPercentage: 14,
      averageLoggedCalories: null,
      averageTargetCalories: null,
      averageDailyCalorieDifference: null,
      calorieBalance: null,
    })
  })
})

function day(
  localDate: CalorieInsightDay['localDate'],
  loggedCalories: number,
  targetCalories: number,
): CalorieInsightDay {
  return { localDate, loggedCalories, targetCalories }
}
