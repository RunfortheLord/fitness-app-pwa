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
import { formatProgramWeekLabel } from '@domain/programWeeks'
import type {
  ActiveCycleWorkoutDay,
  ActiveCycleWorkoutExercise,
  ActiveProgramCycle,
} from '@shared-types/app'

import type { CurrentCycleStructure, LoadStatus } from './types'

export function ProgramOverview({
  currentCycle,
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
    exercises: ActiveCycleWorkoutExercise[],
  ) => void
  onStartDay: (cycle: ActiveProgramCycle, day: ActiveCycleWorkoutDay) => void
}) {
  const { t } = useLanguage()
  const weekSelectRef = useRef<HTMLSelectElement>(null)
  const checkedSet = new Set(checkedDayIds)

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
          {currentCycle.days.length ? (
            <div className="program-day-grid" aria-label={t('Workout days')}>
              {currentCycle.days.map((day) => {
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
                        onSelectDay(
                          currentCycle.cycle,
                          day,
                          currentCycle.exercisesByDay[day.id] ?? [],
                        )
                      }
                    >
                      <strong>{day.name}</strong>
                      <small>
                        {(currentCycle.exercisesByDay[day.id] ?? []).length}{' '}
                        {t('exercises')}
                      </small>
                    </button>
                    <SecondaryButton
                      className="program-day-start"
                      disabled={
                        !(currentCycle.exercisesByDay[day.id] ?? []).length
                      }
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
              title="No workout days"
              message="Edit the current cycle to add days before training."
            />
          )}
        </>
      ) : null}
    </Card>
  )
}
