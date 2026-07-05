import { format } from 'date-fns'
import { useState } from 'react'

import { Card, SecondaryButton, ValidationMessage } from '@components/ui'
import { evaluateCalorieUpdate } from '@domain/calorieAdjustment'
import { formatLocalDate } from '@domain/dates'
import { estimateGoalDate } from '@domain/goalMacros'
import { settingsRepository } from '@repositories/settingsRepository'
import { calorieHistoryService } from '@services/calorieHistoryService'
import type { BodyweightEntry, NutritionGoal } from '@shared-types/app'

import { goalCurrentWeight } from './goalForm'

export function GoalProgressCard({
  entries,
  goal,
  onUpdated,
}: {
  entries: BodyweightEntry[]
  goal: NutritionGoal
  onUpdated: (label: string) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const currentWeight = goalCurrentWeight(entries) ?? goal.calculationWeightLb
  const finish = estimateGoalDate({
    currentWeightLb: currentWeight,
    goalWeightLb: goal.goalWeightLb,
    weeklyRateLb: goal.weeklyRateLb,
    from: new Date(),
  })
  const reached = Math.abs(currentWeight - goal.goalWeightLb) < 0.5
  const finishLabel = reached
    ? "You've reached your goal weight."
    : finish
      ? `Estimated finish: ${format(finish, 'MMM d, yyyy')}`
      : 'Add more weigh-ins to estimate a finish date.'

  function updateCalories() {
    setUpdating(true)
    setError(null)
    const today = formatLocalDate(new Date())
    const refreshedFinish = (trendWeightLb: number) =>
      estimateGoalDate({
        currentWeightLb: trendWeightLb,
        goalWeightLb: goal.goalWeightLb,
        weeklyRateLb: goal.weeklyRateLb,
        from: new Date(),
      })

    void (async () => {
      try {
        const dailyCalories = await calorieHistoryService.getHistory(
          today,
          '1m',
        )
        const evaluation = evaluateCalorieUpdate({
          goal,
          entries,
          dailyCalories,
          asOf: today,
        })
        if (evaluation.status === 'insufficient_data') {
          onUpdated(
            'More body-weight data is needed before calories can be updated.',
          )
          return
        }
        if (evaluation.status === 'already_applied') {
          onUpdated('Calories are already up to date for the latest trend.')
          return
        }

        const finishDate = refreshedFinish(evaluation.trendWeightLb)
        const estimatedFinishDate = finishDate
          ? formatLocalDate(finishDate)
          : null

        if (evaluation.status === 'no_change') {
          await settingsRepository.saveNutritionGoal({
            ...goal,
            estimatedFinishDate,
            lastCalorieUpdate: {
              appliedAt: new Date().toISOString(),
              deltaKcal: 0,
              trendWeightLb: evaluation.trendWeightLb,
              observedWeeklyChangeLb: evaluation.observedWeeklyChangeLb,
              signature: evaluation.signature,
            },
          })
          onUpdated('No calorie change recommended.')
          return
        }

        await settingsRepository.saveNutritionTargets(evaluation.newTargets)
        await settingsRepository.saveNutritionGoal({
          ...goal,
          targets: evaluation.newTargets,
          maintenanceCalories: evaluation.newMaintenanceCalories,
          estimatedFinishDate,
          lastCalorieUpdate: {
            appliedAt: new Date().toISOString(),
            deltaKcal: evaluation.deltaKcal,
            trendWeightLb: evaluation.trendWeightLb,
            observedWeeklyChangeLb: evaluation.observedWeeklyChangeLb,
            signature: evaluation.signature,
          },
        })
        onUpdated(
          evaluation.deltaKcal > 0
            ? `Calories increased by ${evaluation.deltaKcal}.`
            : `Calories decreased by ${Math.abs(evaluation.deltaKcal)}.`,
        )
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : 'Calories could not update.',
        )
      } finally {
        setUpdating(false)
      }
    })()
  }

  return (
    <Card title="Goal progress">
      <p className="goal-finish-date">{finishLabel}</p>
      {error ? <ValidationMessage message={error} /> : null}
      <SecondaryButton
        disabled={updating}
        type="button"
        onClick={updateCalories}
      >
        Update Calories
      </SecondaryButton>
    </Card>
  )
}
