import { ArrowLeft } from 'lucide-react'
import { format } from 'date-fns'
import { useState } from 'react'

import {
  Card,
  FormField,
  IconButton,
  NumericInput,
  PrimaryButton,
  SecondaryButton,
  ValidationMessage,
} from '@components/ui'
import { formatLocalDate } from '@domain/dates'
import {
  GOAL_FORMULA_VERSION,
  GOAL_RATE_RANGES,
  computeGoalPlan,
  estimateGoalDate,
  goalDirection,
  type GoalActivityLevel,
  type GoalDirection,
  type GoalSex,
  weeklyRateFromPercent,
} from '@domain/goalMacros'
import {
  formatWeight,
  weightInputValue,
  weightUnitSuffix,
} from '@domain/weightUnits'
import { useWeightUnit } from '@hooks/useWeightUnit'
import {
  settingsRepository,
  type NutritionGoalInput,
} from '@repositories/settingsRepository'
import type { BodyweightEntry, NutritionGoal } from '@shared-types/app'

import {
  ACTIVITY_OPTIONS,
  goalCurrentWeight,
  parseGoalForm,
  parseMaintenanceCalories,
  type GoalFormState,
  type GoalMaintenanceMode,
} from './goalForm'

export function SetGoalSubpage({
  entries,
  existingGoal,
  onBack,
  onCalculated,
}: {
  entries: BodyweightEntry[]
  existingGoal: NutritionGoal | null
  onBack: () => void
  onCalculated: () => void
}) {
  const weightUnit = useWeightUnit()
  const unitSuffix = weightUnitSuffix(weightUnit)
  const [step, setStep] = useState<
    'maintenanceChoice' | 'manualMaintenance' | 'basics' | 'rate'
  >('maintenanceChoice')
  const [maintenanceMode, setMaintenanceMode] = useState<GoalMaintenanceMode>(
    existingGoal?.maintenanceCalorieSource ?? 'calculated',
  )
  const [manualMaintenanceCalories, setManualMaintenanceCalories] = useState(
    existingGoal?.maintenanceCalorieSource === 'manual'
      ? String(existingGoal.maintenanceCalories)
      : '',
  )
  const [form, setForm] = useState<GoalFormState>(() => {
    const prefillWeight = goalCurrentWeight(entries)
    return {
      bodyweight: existingGoal
        ? weightInputValue(
            existingGoal.calculationWeightLb,
            weightUnit,
            'bodyweight',
          )
        : weightInputValue(prefillWeight, weightUnit, 'bodyweight'),
      heightFeet: existingGoal
        ? String(Math.floor(existingGoal.heightInches / 12))
        : '',
      heightInches: existingGoal ? String(existingGoal.heightInches % 12) : '',
      activityLevel: existingGoal?.activityLevel ?? 'moderately_active',
      goalWeight: existingGoal
        ? weightInputValue(existingGoal.goalWeightLb, weightUnit, 'bodyweight')
        : '',
      age: existingGoal ? String(existingGoal.ageYears) : '',
      sex: existingGoal?.sex ?? 'male',
    }
  })
  const initialDirection = existingGoal?.direction ?? 'maintain'
  const [direction, setDirection] = useState<GoalDirection>(initialDirection)
  const [ratePercent, setRatePercent] = useState(() => {
    if (!existingGoal || existingGoal.direction === 'maintain') {
      return 0
    }
    return Number(
      (
        (Math.abs(existingGoal.weeklyRateLb) /
          existingGoal.calculationWeightLb) *
        100
      ).toFixed(2),
    )
  })
  const [error, setError] = useState<string | null>(null)
  const parsed = parseGoalForm(
    form,
    weightUnit,
    maintenanceMode,
    manualMaintenanceCalories,
  )

  function update<Field extends keyof GoalFormState>(
    field: Field,
    value: GoalFormState[Field],
  ) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function continueToRate() {
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }
    const nextDirection = goalDirection(
      parsed.value.bodyweightLb,
      parsed.value.goalWeightLb,
    )
    setDirection(nextDirection)
    setRatePercent(
      nextDirection === 'maintain'
        ? 0
        : GOAL_RATE_RANGES[nextDirection].recommendedPercent,
    )
    setError(null)
    setStep('rate')
  }

  function chooseMaintenanceMode(mode: GoalMaintenanceMode) {
    setMaintenanceMode(mode)
    setError(null)
    setStep(mode === 'manual' ? 'manualMaintenance' : 'basics')
  }

  function continueFromManualMaintenance() {
    const parsedMaintenance = parseMaintenanceCalories(
      manualMaintenanceCalories,
    )
    if (parsedMaintenance === null) {
      setError('Enter realistic maintenance calories.')
      return
    }
    setError(null)
    setStep('basics')
  }

  function calculate() {
    if (!parsed.ok) {
      setError(parsed.error)
      setStep('basics')
      return
    }
    const input = parsed.value
    const selectedRate = weeklyRateFromPercent(
      direction,
      input.bodyweightLb,
      ratePercent,
    )
    const plan = computeGoalPlan({
      ...input,
      direction,
      weeklyRateLb: selectedRate,
    })
    const finish = estimateGoalDate({
      currentWeightLb: input.bodyweightLb,
      goalWeightLb: input.goalWeightLb,
      weeklyRateLb: plan.weeklyRateLb,
      from: new Date(),
    })
    const goal: NutritionGoalInput = {
      goalWeightLb: input.goalWeightLb,
      calculationWeightLb: input.bodyweightLb,
      heightInches: input.heightFeet * 12 + input.heightInches,
      ageYears: input.ageYears,
      sex: input.sex,
      activityLevel: input.activityLevel,
      direction: plan.direction,
      weeklyRateLb: plan.weeklyRateLb,
      maintenanceCalorieSource: maintenanceMode,
      maintenanceCalories: plan.maintenanceCalories,
      targets: plan.targets,
      estimatedFinishDate: finish ? formatLocalDate(finish) : null,
      formulaVersion: GOAL_FORMULA_VERSION,
      lastCalorieUpdate: null,
    }

    return (async () => {
      try {
        await settingsRepository.saveNutritionTargets(plan.targets)
        await settingsRepository.saveNutritionGoal(goal)
        onCalculated()
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : 'Goal could not be saved.',
        )
      }
    })()
  }

  if (step === 'rate' && parsed.ok) {
    const input = parsed.value
    const selectedRate = weeklyRateFromPercent(
      direction,
      input.bodyweightLb,
      ratePercent,
    )
    const previewPlan = computeGoalPlan({
      ...input,
      direction,
      weeklyRateLb: selectedRate,
    })
    const finish = estimateGoalDate({
      currentWeightLb: input.bodyweightLb,
      goalWeightLb: input.goalWeightLb,
      weeklyRateLb: selectedRate,
      from: new Date(),
    })
    const rateRange =
      direction === 'maintain' ? null : GOAL_RATE_RANGES[direction]
    const markerPosition = rateRange
      ? ((rateRange.recommendedPercent - rateRange.minPercent) /
          (rateRange.maxPercent - rateRange.minPercent)) *
        100
      : 0
    const directionLabel = {
      maintain: 'Maintenance',
      bulk: 'Bulking',
      cut: 'Cutting',
    }[direction]

    return (
      <Card className="subpage-enter">
        <div className="set-goal-header">
          <IconButton
            aria-label="Back to basic goal information"
            onClick={() => setStep('basics')}
          >
            <ArrowLeft aria-hidden="true" size={20} />
          </IconButton>
          <h2 className="set-goal-title">Goal Type: {directionLabel}</h2>
        </div>

        {rateRange ? (
          <>
            <div className="goal-rate-summary" aria-live="polite">
              <div>
                <span>Goal end date</span>
                <strong>
                  {finish ? format(finish, 'MMM d, yyyy') : 'No estimate'}
                </strong>
              </div>
              <div>
                <span>Daily calories</span>
                <strong>{Math.round(previewPlan.targets.calories)} kcal</strong>
              </div>
              <div>
                <span>
                  {direction === 'cut'
                    ? 'Weight loss rate'
                    : 'Weight gain rate'}
                </span>
                <strong>
                  {formatWeight(
                    Math.abs(selectedRate),
                    weightUnit,
                    'bodyweight',
                  )}
                  /week ({ratePercent.toFixed(2)}%)
                </strong>
              </div>
            </div>
            <div className="goal-rate-control">
              <label htmlFor="goal-weekly-rate">
                Weekly {direction === 'cut' ? 'loss' : 'gain'} rate
              </label>
              <div className="goal-rate-track-labels" aria-hidden="true">
                <span
                  className="goal-rate-recommended"
                  style={{ left: `${markerPosition}%` }}
                >
                  Recommended
                </span>
              </div>
              <input
                aria-describedby="goal-rate-range"
                id="goal-weekly-rate"
                max={rateRange.maxPercent}
                min={rateRange.minPercent}
                onInput={(event) =>
                  setRatePercent(Number(event.currentTarget.value))
                }
                step={rateRange.stepPercent}
                type="range"
                value={ratePercent}
              />
              <div className="goal-rate-bounds" id="goal-rate-range">
                <span>{rateRange.minPercent}% / week</span>
                <span>{rateRange.maxPercent}% / week</span>
              </div>
            </div>
          </>
        ) : (
          <div className="goal-rate-summary" aria-live="polite">
            <div>
              <span>Daily calories</span>
              <strong>{Math.round(previewPlan.targets.calories)} kcal</strong>
            </div>
            <div>
              <span>Goal end date</span>
              <strong>Ongoing maintenance</strong>
            </div>
            <div>
              <span>Weight change rate</span>
              <strong>0 {unitSuffix}/week</strong>
            </div>
          </div>
        )}

        {error ? <ValidationMessage message={error} /> : null}
        <PrimaryButton type="button" onClick={calculate}>
          Done
        </PrimaryButton>
      </Card>
    )
  }

  if (step === 'maintenanceChoice') {
    return (
      <Card className="subpage-enter">
        <div className="set-goal-header">
          <IconButton aria-label="Back to targets" onClick={onBack}>
            <ArrowLeft aria-hidden="true" size={20} />
          </IconButton>
          <h2 className="set-goal-title">
            Do you know your maintenance calories?
          </h2>
        </div>
        <div className="button-row">
          <PrimaryButton
            type="button"
            onClick={() => chooseMaintenanceMode('manual')}
          >
            Yes
          </PrimaryButton>
          <SecondaryButton
            type="button"
            onClick={() => chooseMaintenanceMode('calculated')}
          >
            Calculate my maintenance calories
          </SecondaryButton>
        </div>
      </Card>
    )
  }

  if (step === 'manualMaintenance') {
    const parsedMaintenance = parseMaintenanceCalories(
      manualMaintenanceCalories,
    )
    return (
      <Card className="subpage-enter">
        <div className="set-goal-header">
          <IconButton
            aria-label="Back to maintenance question"
            onClick={() => {
              setError(null)
              setStep('maintenanceChoice')
            }}
          >
            <ArrowLeft aria-hidden="true" size={20} />
          </IconButton>
          <h2 className="set-goal-title">Maintenance calories</h2>
        </div>
        <p className="muted">
          Enter the calories you believe maintain your current bodyweight.
        </p>
        {error ? <ValidationMessage message={error} /> : null}
        <FormField id="goal-maintenance-calories" label="Maintenance calories">
          <NumericInput
            id="goal-maintenance-calories"
            onChange={(event) =>
              setManualMaintenanceCalories(event.target.value)
            }
            value={manualMaintenanceCalories}
          />
        </FormField>
        <PrimaryButton
          disabled={parsedMaintenance === null}
          type="button"
          onClick={continueFromManualMaintenance}
        >
          Continue
        </PrimaryButton>
      </Card>
    )
  }

  return (
    <Card className="subpage-enter">
      <div className="set-goal-header">
        <IconButton
          aria-label={
            maintenanceMode === 'manual'
              ? 'Back to maintenance calories'
              : 'Back to maintenance question'
          }
          onClick={() => {
            setError(null)
            setStep(
              maintenanceMode === 'manual'
                ? 'manualMaintenance'
                : 'maintenanceChoice',
            )
          }}
        >
          <ArrowLeft aria-hidden="true" size={20} />
        </IconButton>
        <h2 className="set-goal-title">Set goal</h2>
      </div>
      <p className="muted">
        {maintenanceMode === 'manual'
          ? 'Enter your current bodyweight and the weight you want to reach.'
          : 'Enter your basic information and the weight you want to reach.'}
      </p>
      {error ? <ValidationMessage message={error} /> : null}
      <FormField
        id="goal-bodyweight"
        label={`Current body weight (${unitSuffix})`}
      >
        <NumericInput
          id="goal-bodyweight"
          onChange={(event) => update('bodyweight', event.target.value)}
          value={form.bodyweight}
        />
      </FormField>
      {maintenanceMode === 'calculated' ? (
        <>
          <FormField id="goal-height-feet" label="Height (feet)">
            <NumericInput
              id="goal-height-feet"
              onChange={(event) => update('heightFeet', event.target.value)}
              value={form.heightFeet}
            />
          </FormField>
          <FormField id="goal-height-inches" label="Height (inches)">
            <NumericInput
              id="goal-height-inches"
              onChange={(event) => update('heightInches', event.target.value)}
              value={form.heightInches}
            />
          </FormField>
          <FormField
            id="goal-activity"
            label="How active are you outside of exercise?"
          >
            <select
              className="select-input"
              id="goal-activity"
              onChange={(event) =>
                update('activityLevel', event.target.value as GoalActivityLevel)
              }
              value={form.activityLevel}
            >
              {ACTIVITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>
        </>
      ) : null}
      <FormField id="goal-target-weight" label={`Goal weight (${unitSuffix})`}>
        <NumericInput
          id="goal-target-weight"
          onChange={(event) => update('goalWeight', event.target.value)}
          value={form.goalWeight}
        />
      </FormField>
      {maintenanceMode === 'calculated' ? (
        <>
          <FormField id="goal-age" label="Age">
            <NumericInput
              id="goal-age"
              onChange={(event) => update('age', event.target.value)}
              value={form.age}
            />
          </FormField>
          <FormField id="goal-sex" label="Sex">
            <select
              className="select-input"
              id="goal-sex"
              onChange={(event) => update('sex', event.target.value as GoalSex)}
              value={form.sex}
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </FormField>
        </>
      ) : null}
      <PrimaryButton
        disabled={!parsed.ok}
        type="button"
        onClick={continueToRate}
      >
        Continue
      </PrimaryButton>
    </Card>
  )
}
