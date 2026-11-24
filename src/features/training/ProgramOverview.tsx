import { CheckSquare, Square } from 'lucide-react'
import { useEffect, useRef } from 'react'

import {
  Card,
  EmptyState,
  LoadingState,
  PrimaryButton,
  SecondaryButton,
} from '@components/ui'
import { useLanguage } from '@components/languageContextValue'
import { prescriptionKey, resolvePrescription } from '@domain/periodization'
import { formatProgramWeekLabel } from '@domain/programWeeks'
import type {
  ActiveCycleWorkoutDay,
  Exercise,
  ActiveProgramCycle,
} from '@shared-types/app'

import type { CurrentCycleStructure, LoadStatus, SelectedDay } from './types'

export function ProgramOverview({
  currentCycle,
  exerciseLibrary,
  checkedDayIds,
  weekNumber,
  onToggleDayCheck,
  onSelectWeek,
  loadStatus,
  onBrowse,
  onCreateProgram,
  onDeactivate,
  onEditCycle,
  onSelectDay,
  onStartDay,
}: {
  exerciseLibrary: Exercise[]
  currentCycle: CurrentCycleStructure | undefined
  checkedDayIds: string[]
  weekNumber: number
  onToggleDayCheck: (
    cycle: ActiveProgramCycle,
    dayId: string,
    checked: boolean,
  ) => void
  onSelectWeek: (cycle: ActiveProgramCycle, weekNumber: number) => void
  loadStatus: LoadStatus
  onBrowse: () => void
  onCreateProgram: () => void
  onDeactivate: (cycle: ActiveProgramCycle) => void
  onEditCycle: (cycleId: string) => void
  onSelectDay: (
    cycle: ActiveProgramCycle,
    day: ActiveCycleWorkoutDay,
    exercises: SelectedDay['exercises'],
  ) => void
  onStartDay: (cycle: ActiveProgramCycle, day: ActiveCycleWorkoutDay) => void
}) {
  const { t } = useLanguage()
  const weekSelectRef = useRef<HTMLSelectElement>(null)
  const checkedSet = new Set(checkedDayIds)
  const plan = currentCycle?.cycle.periodization?.enabled
    ? currentCycle.cycle.periodization
    : undefined
  const phase = plan?.phases.find(
    (item) => item.id === plan.weeks[weekNumber - 1]?.phaseId,
  )
  const days =
    currentCycle?.days.flatMap((day) => {
      const exercises = currentCycle.exercisesByDay[day.id] ?? []
      if (!plan) return [{ day, exercises }]
      const scheduled = exercises.flatMap((exercise) => {
        const target = resolvePrescription(
          plan,
          weekNumber,
          prescriptionKey(exercise),
        )
        // Exercises added after the plan was created keep their ordinary targets.
        if (!target) return [exercise]
        if (!target.included || !target.sets.length) return []
        const replacement = target.substitutionId
          ? exerciseLibrary.find((entry) => entry.id === target.substitutionId)
          : undefined
        return [
          {
            ...exercise,
            plannedGroups: target.sets,
            notes: [target.optional ? 'Optional.' : '', target.notes]
              .filter(Boolean)
              .join(' '),
            exerciseSnapshot: {
              ...exercise.exerciseSnapshot,
              exerciseName:
                replacement?.name ?? exercise.exerciseSnapshot.exerciseName,
            },
          },
        ]
      })
      return scheduled.length
        ? [
            {
              day: {
                ...day,
                name:
                  phase?.dayNames?.[day.sourceTemplateDayId ?? day.id] ??
                  day.name,
              },
              exercises: scheduled,
            },
          ]
        : []
    }) ?? []

  useEffect(() => {
    function removeTouchFocus(event: PointerEvent) {
      const select = weekSelectRef.current
      if (
        select &&
        document.activeElement === select &&
        event.target instanceof Node &&
        !select.contains(event.target)
      ) {
        select.blur()
      }
    }

    document.addEventListener('pointerdown', removeTouchFocus)
    return () => document.removeEventListener('pointerdown', removeTouchFocus)
  }, [])

  return (
    <Card aria-label={t('Current Program')}>
      {loadStatus === 'loading' ? <LoadingState label="Loading cycle" /> : null}
      {loadStatus === 'ready' && !currentCycle ? (
        <EmptyState
          title="No active cycle"
          message="Create or activate a program template to choose workout days manually."
          action={
            <div className="button-row empty-state-actions">
              <PrimaryButton type="button" onClick={onCreateProgram}>
                Create program
              </PrimaryButton>
              <SecondaryButton type="button" onClick={onBrowse}>
                Browse programs
              </SecondaryButton>
            </div>
          }
        />
      ) : null}
      {loadStatus === 'ready' && currentCycle ? (
        <>
          <h2 className="metric-value metric-value-small">
            {currentCycle.cycle.name}
          </h2>
          {currentCycle.cycle.notes ? (
            <p className="muted">{currentCycle.cycle.notes}</p>
          ) : null}
          <div className="button-row program-action-row">
            <SecondaryButton
              aria-label="Edit active program"
              type="button"
              onClick={() => onEditCycle(currentCycle.cycle.id)}
            >
              Edit active program
            </SecondaryButton>
            <SecondaryButton
              className="button-danger"
              type="button"
              onClick={() => onDeactivate(currentCycle.cycle)}
            >
              Deactivate
            </SecondaryButton>
          </div>
          {plan ? (
            <p className="muted">
              Week {weekNumber} · {phase?.name}
              {plan.pausedOn ? ' · Paused' : ''}
            </p>
          ) : (
            <label className="program-week-selector">
              <span>Program week</span>
              <select
                aria-label="Select program week"
                ref={weekSelectRef}
                onChange={(event) => {
                  onSelectWeek(currentCycle.cycle, Number(event.target.value))
                  event.currentTarget.blur()
                }}
                value={weekNumber}
              >
                {Array.from(
                  { length: currentCycle.cycle.durationWeeks ?? 10 },
                  (_, index) => index + 1,
                ).map((week) => (
                  <option key={week} value={week}>
                    {formatProgramWeekLabel(
                      week,
                      currentCycle.cycle.deloadSchedulingEnabled
                        ? currentCycle.cycle.deloadWeekNumbers
                        : [],
                    )}
                  </option>
                ))}
              </select>
            </label>
          )}
          {days.length ? (
            <div className="program-day-grid" aria-label={t('Workout days')}>
              {days.map(({ day, exercises }) => {
                const isChecked = checkedSet.has(day.id)
                return (
                  <div
                    className={`program-day-card${isChecked ? ' is-done' : ''}`}
                    key={day.id}
                  >
                    <button
                      className={`program-day-check${
                        isChecked ? ' is-checked' : ''
                      }`}
                      type="button"
                      aria-pressed={isChecked}
                      aria-label={
                        isChecked
                          ? `Mark ${day.name} not done this week`
                          : `Mark ${day.name} done this week`
                      }
                      onClick={() =>
                        onToggleDayCheck(currentCycle.cycle, day.id, !isChecked)
                      }
                    >
                      {isChecked ? (
                        <CheckSquare aria-hidden="true" size={20} />
                      ) : (
                        <Square aria-hidden="true" size={20} />
                      )}
                    </button>
                    <button
                      className="program-day-open"
                      type="button"
                      onClick={() =>
                        onSelectDay(currentCycle.cycle, day, exercises)
                      }
                    >
                      <strong>{day.name}</strong>
                      <small>
                        {exercises.length} {t('exercises')}
                      </small>
                    </button>
                    <SecondaryButton
                      className="program-day-start"
                      disabled={!exercises.length || Boolean(plan?.pausedOn)}
                      type="button"
                      onClick={() => onStartDay(currentCycle.cycle, day)}
                    >
                      Start Workout
                    </SecondaryButton>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState
              title={plan ? 'No workouts this week' : 'No workout days'}
              message={
                plan
                  ? 'Open the weekly plan to schedule a workout.'
                  : 'Edit the current cycle to add days before training.'
              }
            />
          )}
        </>
      ) : null}
    </Card>
  )
}
