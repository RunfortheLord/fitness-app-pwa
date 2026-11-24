import { useEffect, useState } from 'react'
import {
  BottomSheet,
  ModalConfirmationDialog,
  PrimaryButton,
  SecondaryButton,
  ValidationMessage,
} from '@components/ui'
import { addLocalDays, formatLocalDate, parseLocalDate } from '@domain/dates'
import { differenceInCalendarDays, format } from 'date-fns'
import {
  ChevronRight,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
} from 'lucide-react'
import {
  phaseNames,
  programPosition,
  prescriptionKey,
  recommendPeriodizedLoad,
  resolvePrescription,
  scheduledDate,
  setKinds,
  type ExercisePrescription,
  type PeriodizedPlan,
  type SetPrescription,
} from '@domain/periodization'
import { prescriptionSet } from '@domain/februaryPeak'
import { programRepository } from '@repositories/programRepository'
import { periodizationRepository } from '@repositories/periodizationRepository'
import { exerciseRepository } from '@repositories/exerciseRepository'
import type {
  ActiveProgramCycle,
  ProgramTemplate,
  ActiveCycleWorkoutExercise,
  TemplateWorkoutExercise,
  Exercise,
} from '@shared-types/app'
import { useWeightUnit } from '@hooks/useWeightUnit'
import { convertFromLb, convertToLb } from '@domain/weightUnits'

type Structure = {
  record: ProgramTemplate | ActiveProgramCycle
  days: { id: string; name: string; sourceTemplateDayId?: string | null }[]
  exercisesByDay: Record<
    string,
    (ActiveCycleWorkoutExercise | TemplateWorkoutExercise)[]
  >
}

function normalizePhaseRanges(plan: PeriodizedPlan) {
  for (const phase of plan.phases) {
    const weeks = plan.weeks.flatMap((week, index) =>
      week.phaseId === phase.id ? [index + 1] : [],
    )
    if (weeks.length) {
      phase.startWeek = Math.min(...weeks)
      phase.endWeek = Math.max(...weeks)
    }
  }
  return plan
}

export function PeriodizedProgramPanel({
  record,
  mode,
  onChanged,
  onClose,
}: {
  record: ProgramTemplate | ActiveProgramCycle
  mode: 'template' | 'cycle'
  onClose: () => void
  onChanged: () => void
}) {
  const weightUnit = useWeightUnit()
  const [structure, setStructure] = useState<Structure | null>(null)
  const [plan, setPlan] = useState<PeriodizedPlan | undefined>(
    record.periodization ? structuredClone(record.periodization) : undefined,
  )
  const [week, setWeek] = useState(
    record.periodization
      ? programPosition(record.periodization, formatLocalDate(new Date())).week
      : 1,
  )
  const [scope, setScope] = useState<'week' | 'phase' | 'program'>('week')
  const [selectedKey, setSelectedKey] = useState('')
  const [section, setSection] = useState<
    'week' | 'day' | 'sets' | 'schedule' | 'progress'
  >('week')
  const [dayId, setDayId] = useState('')
  const [savedPlan, setSavedPlan] = useState<PeriodizedPlan>()
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [newName, setNewName] = useState('')
  type LocalDate = ReturnType<typeof formatLocalDate>
  const [library, setLibrary] = useState<Exercise[]>([])
  const [performance, setPerformance] = useState<Awaited<
    ReturnType<typeof periodizationRepository.performance>
  > | null>(null)

  useEffect(() => {
    let alive = true
    const action =
      mode === 'template'
        ? programRepository.getTemplateStructure(record.id).then((value) => ({
            record: value.template,
            days: value.days,
            exercisesByDay: value.exercisesByDay,
          }))
        : programRepository
            .getActiveCycleStructure(record.id)
            .then((value) => ({
              record: value.cycle,
              days: value.days,
              exercisesByDay: value.exercisesByDay,
            }))
    void Promise.all([
      action,
      periodizationRepository.performance(
        mode === 'cycle' ? record.id : undefined,
      ),
      exerciseRepository.searchExercises({ includeArchived: true }),
    ])
      .then(([value, progress, exercises]) => {
        if (alive) {
          setStructure(value)
          setPerformance(progress)
          setLibrary(exercises)
          const loaded = value.record.periodization
            ? structuredClone(value.record.periodization)
            : undefined
          if (loaded)
            for (const exercise of Object.values(value.exercisesByDay).flat()) {
              const key =
                'sourceTemplateExerciseId' in exercise
                  ? prescriptionKey(exercise)
                  : exercise.id
              loaded.defaults[key] ??= {
                included: true,
                optional: false,
                progression: 'double progression',
                notes: exercise.notes,
                sets: [
                  prescriptionSet(
                    'straight set',
                    Math.max(1, exercise.targetSetCount),
                    exercise.targetRepsMin ?? 8,
                    exercise.targetRepsMax ?? exercise.targetRepsMin ?? 8,
                    exercise.targetRir,
                    {
                      startingWeight: exercise.targetWeight ?? undefined,
                      restSeconds: exercise.restSecondsOverride ?? 120,
                    },
                  ),
                ],
              }
            }
          setPlan(loaded)
          setSavedPlan(loaded)
        }
      })
      .catch((caught: unknown) => {
        if (alive)
          setError(
            caught instanceof Error
              ? caught.message
              : 'Unable to load program.',
          )
      })
    return () => {
      alive = false
    }
  }, [record.id, mode])

  const exerciseKey = (
    exercise: ActiveCycleWorkoutExercise | TemplateWorkoutExercise,
  ) =>
    'sourceTemplateExerciseId' in exercise
      ? prescriptionKey(exercise)
      : exercise.id
  const allExercises = Object.values(structure?.exercisesByDay ?? {}).flat()
  const key =
    selectedKey || (allExercises[0] ? exerciseKey(allExercises[0]) : '')
  const phase = plan?.phases.find(
    (entry) => entry.id === plan.weeks[week - 1]?.phaseId,
  )
  const prescription = plan ? resolvePrescription(plan, week, key) : undefined
  const showWeight = (weight: number) =>
    Math.round(convertFromLb(weight, weightUnit) * 10) / 10

  async function save() {
    if (!plan) return
    setBusy(true)
    setError(null)
    try {
      const saved = await periodizationRepository.savePlan(
        record.id,
        mode,
        normalizePhaseRanges(structuredClone(plan)),
      )
      setPlan(saved)
      setSavedPlan(saved)
      setMessage('Changes saved.')
      onChanged()
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Unable to save program.',
      )
    } finally {
      setBusy(false)
    }
  }

  function changePrescription(patch: Partial<ExercisePrescription>) {
    if (!plan || !phase || !prescription) return
    const next = structuredClone(plan)
    if (scope === 'program')
      next.defaults[key] = { ...next.defaults[key], ...patch }
    else if (scope === 'phase') {
      const target = next.phases.find((entry) => entry.id === phase.id)!
      target.overrides[key] = { ...target.overrides[key], ...patch }
    } else
      next.weeks[week - 1].overrides[key] = {
        ...next.weeks[week - 1].overrides[key],
        ...patch,
      }
    setPlan(next)
    setMessage('')
  }

  if (!structure || !plan)
    return (
      <BottomSheet isOpen onClose={onClose} title="Weekly plan" variant="page">
        <p role="status">{error ?? 'Loading plan…'}</p>
      </BottomSheet>
    )

  const weekStart = addLocalDays(plan.startDate as LocalDate, (week - 1) * 7)
  const displayedPrescription =
    scope === 'program'
      ? plan.defaults[key]
      : scope === 'phase'
        ? { ...plan.defaults[key], ...phase?.overrides[key] }
        : prescription
  const dirty = plan !== savedPlan
  const days = structure.days.map((day) => {
    const dayKey = day.sourceTemplateDayId ?? day.id
    const exercises = (structure.exercisesByDay[day.id] ?? []).map(
      (exercise) => ({
        exercise,
        target: resolvePrescription(plan, week, exerciseKey(exercise)),
      }),
    )
    const scheduled = exercises.filter(
      ({ target }) => target?.included && target.sets.length,
    )
    return {
      ...day,
      dayKey,
      title: phase?.dayNames?.[dayKey] ?? day.name,
      date: scheduledDate(plan, week, dayKey),
      exercises,
      scheduled,
      completed: performance?.completed.some(
        (entry) =>
          entry.programWeekNumber === week && entry.sourceDayId === day.id,
      ),
    }
  })
  const day = days.find((entry) => entry.id === dayId)
  const exercise = day?.exercises.find(
    (entry) => exerciseKey(entry.exercise) === key,
  )?.exercise
  const exerciseName = (
    entry: (typeof allExercises)[number],
    target?: ExercisePrescription,
  ) =>
    library.find((item) => item.id === target?.substitutionId)?.name ??
    entry.exerciseSnapshot.exerciseName
  const dateLabel = (date: string, pattern: string) =>
    format(parseLocalDate(date as LocalDate), pattern)
  const groupSummary = (group: SetPrescription) =>
    `${group.count} × ${group.repsMin}${group.repsMin === group.repsMax ? '' : '–' + group.repsMax}`
  function suggestedLoad(group: SetPrescription) {
    if (!exercise || !displayedPrescription) return ''
    const ownHistory =
      performance?.historyByExercise[
        displayedPrescription.substitutionId ?? exercise.exerciseId
      ] ?? []
    const history = ownHistory.length
      ? ownHistory
      : (
          performance?.historyByExercise[
            displayedPrescription.referenceExerciseId ?? ''
          ] ?? []
        ).map((set) => ({
          ...set,
          metricValues: {
            ...set.metricValues,
            weight:
              typeof set.metricValues.weight === 'number'
                ? set.metricValues.weight *
                  (displayedPrescription.referenceScale ?? 1)
                : set.metricValues.weight,
          },
        }))
    const load = recommendPeriodizedLoad(
      group,
      displayedPrescription,
      history,
      library.find((entry) => entry.id === exercise.exerciseId)
        ?.defaultWeightIncrement ?? 5,
    )
    return load == null ? '' : ` · ≈${showWeight(load)} ${weightUnit}`
  }
  function groupField(
    group: SetPrescription,
    index: number,
    field: Exclude<keyof SetPrescription, 'kind'>,
    prescriptionToEdit: ExercisePrescription,
  ) {
    return (
      <label key={field}>
        {
          {
            count: 'Sets',
            repsMin: 'Minimum reps',
            repsMax: 'Maximum reps',
            rir: 'Target RIR',
            percent: '% estimated 1RM',
            startingWeight: `Starting load (${weightUnit})`,
            restSeconds: 'Rest seconds',
          }[field]
        }
        <input
          type="number"
          step={field === 'rir' ? 0.5 : field === 'startingWeight' ? 0.5 : 1}
          value={
            group[field] == null
              ? ''
              : field === 'percent'
                ? Math.round(group[field] * 100)
                : field === 'startingWeight'
                  ? showWeight(group[field])
                  : group[field]
          }
          onChange={(event) => {
            const value =
              event.target.value === ''
                ? field === 'rir'
                  ? null
                  : undefined
                : field === 'percent'
                  ? Number(event.target.value) / 100
                  : field === 'startingWeight'
                    ? convertToLb(Number(event.target.value), weightUnit)
                    : Number(event.target.value)
            changePrescription({
              sets: prescriptionToEdit.sets.map((set, at) =>
                at === index ? { ...set, [field]: value } : set,
              ),
            })
          }}
        />
      </label>
    )
  }
  function goBack() {
    if (section === 'week') {
      if (dirty) setConfirmDiscard(true)
      else onClose()
    } else setSection(section === 'sets' ? 'day' : 'week')
  }
  function dayRow(entry: (typeof days)[number]) {
    return (
      <button
        key={entry.id}
        className="plan-list-row"
        onClick={() => {
          setDayId(entry.id)
          setSection('day')
        }}
      >
        <time className="plan-date" dateTime={entry.date}>
          <small>{dateLabel(entry.date, 'MMM')}</small>
          <strong>{dateLabel(entry.date, 'd')}</strong>
        </time>
        <span>
          <strong>{entry.title}</strong>
          <small>
            {entry.completed
              ? 'Completed'
              : entry.scheduled.length
                ? `${entry.scheduled.length} exercise${entry.scheduled.length === 1 ? '' : 's'}`
                : 'Unscheduled'}
          </small>
        </span>
        <ChevronRight aria-hidden size={18} />
      </button>
    )
  }
  function exerciseRow({
    exercise: entry,
    target,
  }: (typeof days)[number]['exercises'][number]) {
    return (
      <button
        key={entry.id}
        className="plan-list-row"
        onClick={() => {
          setSelectedKey(exerciseKey(entry))
          setScope('week')
          setSection('sets')
        }}
      >
        <span>
          <strong>{exerciseName(entry, target)}</strong>
          <small>
            {target?.included && target.sets.length
              ? [
                  target.optional ? 'Optional' : '',
                  ...target.sets.map(groupSummary),
                ]
                  .filter(Boolean)
                  .join(' · ')
              : 'Unscheduled'}
          </small>
        </span>
        <ChevronRight aria-hidden size={18} />
      </button>
    )
  }
  const title =
    section === 'week'
      ? 'Weekly plan'
      : section === 'day'
        ? 'Workout day'
        : section === 'sets'
          ? 'Exercise plan'
          : section === 'schedule'
            ? 'Schedule'
            : 'Progress'
  return (
    <BottomSheet
      key={section}
      isOpen
      onClose={goBack}
      title={title}
      variant="page"
    >
      <section aria-label="Periodized program" className="periodized-panel">
        {section === 'week' ? (
          <>
            <label className="plan-week-picker">
              <span>Training week</span>
              <select
                value={week}
                onChange={(event) => setWeek(Number(event.target.value))}
              >
                {plan.weeks.map((assigned, index) => (
                  <option key={index} value={index + 1}>
                    Week {index + 1} ·{' '}
                    {
                      plan.phases.find((entry) => entry.id === assigned.phaseId)
                        ?.name
                    }
                  </option>
                ))}
              </select>
            </label>
            <p className="plan-week-dates">
              {dateLabel(weekStart, 'MMM d')} –{' '}
              {dateLabel(addLocalDays(weekStart, 6), 'MMM d, yyyy')}
            </p>
            <div className="plan-list">
              {days.filter((entry) => entry.scheduled.length).map(dayRow)}
            </div>
            {days.some((entry) => !entry.scheduled.length) ? (
              <details className="plan-disclosure">
                <summary>Unscheduled days</summary>
                {days.filter((entry) => !entry.scheduled.length).map(dayRow)}
              </details>
            ) : null}
            <div className="plan-week-tools">
              <button
                type="button"
                aria-label="Edit schedule"
                onClick={() => setSection('schedule')}
              >
                <CalendarDays aria-hidden size={17} /> Schedule
              </button>
              <button
                type="button"
                aria-label="View progress"
                onClick={() => setSection('progress')}
              >
                <ChartNoAxesColumnIncreasing aria-hidden size={17} /> Progress
              </button>
            </div>
          </>
        ) : null}
        {section === 'day' && day ? (
          <>
            <div className="plan-heading">
              <p>
                Week {week} · {phase?.name}
              </p>
              <h3>{day.title}</h3>
            </div>
            <div className="plan-list">{day.scheduled.map(exerciseRow)}</div>
            {day.exercises.some(
              ({ target }) => !target?.included || !target.sets.length,
            ) ? (
              <details className="plan-disclosure">
                <summary>Unscheduled exercises</summary>
                {day.exercises
                  .filter(
                    ({ target }) => !target?.included || !target.sets.length,
                  )
                  .map(exerciseRow)}
              </details>
            ) : null}
            <details className="plan-disclosure">
              <summary>Workout date · {dateLabel(day.date, 'MMM d')}</summary>
              <label>
                Scheduled date
                <input
                  type="date"
                  min={weekStart}
                  max={addLocalDays(weekStart, 6)}
                  value={day.date}
                  onChange={(event) => {
                    const offset = differenceInCalendarDays(
                      parseLocalDate(event.target.value as LocalDate),
                      parseLocalDate(weekStart),
                    )
                    if (!Number.isFinite(offset) || offset < 0 || offset > 6) {
                      setError('Choose a date in this week.')
                      return
                    }
                    const next = structuredClone(plan)
                    next.weeks[week - 1].dayOffsets = {
                      ...next.weeks[week - 1].dayOffsets,
                      [day.dayKey]: offset,
                    }
                    setError(null)
                    setPlan(next)
                  }}
                />
              </label>
            </details>
          </>
        ) : null}
        {section === 'schedule' ? (
          <div className="plan-form">
            <div className="plan-heading">
              <p>
                Week {week} of {plan.weeks.length}
              </p>
              <h3>{phase?.name}</h3>
            </div>
            <label>
              Assigned start date
              <input
                type="date"
                value={plan.startDate}
                onChange={(event) =>
                  event.target.value &&
                  setPlan({ ...plan, startDate: event.target.value })
                }
              />
            </label>
            <details className="plan-disclosure">
              <summary>Schedule actions</summary>
              <div className="plan-form">
                <SecondaryButton
                  onClick={() => {
                    const next = structuredClone(plan)
                    if (next.pausedOn) {
                      const days = differenceInCalendarDays(
                        new Date(),
                        parseLocalDate(next.pausedOn as LocalDate),
                      )
                      next.startDate = addLocalDays(
                        next.startDate as LocalDate,
                        days,
                      )
                      delete next.pausedOn
                    } else next.pausedOn = formatLocalDate(new Date())
                    setPlan(next)
                  }}
                >
                  {plan.pausedOn
                    ? 'Resume and shift future dates'
                    : 'Pause program'}
                </SecondaryButton>
                <SecondaryButton
                  disabled={plan.weeks.length >= 104}
                  onClick={() => {
                    const next = structuredClone(plan)
                    next.weeks.splice(
                      week,
                      0,
                      structuredClone(next.weeks[week - 1]),
                    )
                    setPlan(normalizePhaseRanges(next))
                    setWeek(week + 1)
                  }}
                >
                  Duplicate week
                </SecondaryButton>
                <SecondaryButton
                  disabled={
                    !phase ||
                    plan.weeks.length + (phase.endWeek - phase.startWeek + 1) >
                      104
                  }
                  onClick={() => {
                    if (!phase) return
                    const next = structuredClone(plan),
                      id = crypto.randomUUID()
                    next.phases.push({
                      ...structuredClone(phase),
                      id,
                      name: `${phase.name} copy`,
                    })
                    const copies = next.weeks
                      .slice(phase.startWeek - 1, phase.endWeek)
                      .map((entry) => ({
                        ...structuredClone(entry),
                        phaseId: id,
                      }))
                    next.weeks.splice(phase.endWeek, 0, ...copies)
                    setPlan(normalizePhaseRanges(next))
                    setWeek(phase.endWeek + 1)
                  }}
                >
                  Duplicate phase
                </SecondaryButton>
              </div>
            </details>
            <label>
              Phase for this week
              <select
                value={phase?.id ?? ''}
                onChange={(event) => {
                  const next = structuredClone(plan)
                  next.weeks[week - 1].phaseId = event.target.value
                  setPlan(normalizePhaseRanges(next))
                }}
              >
                {plan.phases.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </label>
            <details className="plan-disclosure">
              <summary>New phase</summary>
              <label>
                New phase name
                <input
                  list="periodized-phase-names"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                />
              </label>
              <datalist id="periodized-phase-names">
                {phaseNames.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </datalist>
              <SecondaryButton
                disabled={!newName.trim()}
                onClick={() => {
                  const next = structuredClone(plan),
                    id = crypto.randomUUID()
                  next.phases.push({
                    id,
                    name: newName.trim(),
                    startWeek: week,
                    endWeek: week,
                    overrides: {},
                  })
                  next.weeks[week - 1].phaseId = id
                  setPlan(normalizePhaseRanges(next))
                  setNewName('')
                }}
              >
                Add phase
              </SecondaryButton>
            </details>
          </div>
        ) : null}
        {section === 'sets' ? (
          <div className="plan-form">
            <div className="plan-heading">
              <p>
                Week {week} · {phase?.name}
              </p>
              <h3>
                {exercise
                  ? exerciseName(exercise, displayedPrescription)
                  : 'Exercise'}
              </h3>
            </div>
            <label>
              Apply changes to
              <select
                value={scope}
                onChange={(event) =>
                  setScope(event.target.value as typeof scope)
                }
              >
                <option value="week">Week {week} only</option>
                <option value="phase">{phase?.name} phase</option>
                <option value="program">Program defaults</option>
              </select>
            </label>
            {displayedPrescription ? (
              <>
                {displayedPrescription.sets.map((group, index) => (
                  <details key={index} className="plan-disclosure plan-group">
                    <summary>
                      <span>
                        <strong>{group.kind}</strong>
                        <small>
                          {groupSummary(group)}
                          {group.rir == null ? '' : ` · ${group.rir} RIR`}
                          {suggestedLoad(group)}
                        </small>
                      </span>
                    </summary>
                    <div className="plan-form">
                      <label>
                        Set type
                        <select
                          value={group.kind}
                          onChange={(event) =>
                            changePrescription({
                              sets: displayedPrescription.sets.map((set, at) =>
                                at === index
                                  ? {
                                      ...set,
                                      kind: event.target
                                        .value as typeof set.kind,
                                    }
                                  : set,
                              ),
                            })
                          }
                        >
                          {setKinds.map((kind) => (
                            <option key={kind}>{kind}</option>
                          ))}
                        </select>
                      </label>
                      <div className="periodized-fields">
                        {(['count', 'repsMin', 'repsMax', 'rir'] as const).map(
                          (field) =>
                            groupField(
                              group,
                              index,
                              field,
                              displayedPrescription,
                            ),
                        )}
                      </div>
                      <details className="plan-disclosure">
                        <summary>Load and rest</summary>
                        <div className="periodized-fields">
                          {(
                            [
                              'startingWeight',
                              'percent',
                              'restSeconds',
                            ] as const
                          ).map((field) =>
                            groupField(
                              group,
                              index,
                              field,
                              displayedPrescription,
                            ),
                          )}
                        </div>
                      </details>
                      <SecondaryButton
                        onClick={() =>
                          changePrescription({
                            sets: displayedPrescription.sets.filter(
                              (_, at) => at !== index,
                            ),
                          })
                        }
                      >
                        Remove set group {index + 1}
                      </SecondaryButton>
                    </div>
                  </details>
                ))}
                <SecondaryButton
                  onClick={() =>
                    changePrescription({
                      sets: [
                        ...displayedPrescription.sets,
                        prescriptionSet('straight set', 2, 8, 12),
                      ],
                    })
                  }
                >
                  Add set group
                </SecondaryButton>
                <details className="plan-disclosure">
                  <summary>Exercise options</summary>
                  <div className="plan-form">
                    <label>
                      <input
                        type="checkbox"
                        checked={displayedPrescription.included}
                        onChange={(event) =>
                          changePrescription({ included: event.target.checked })
                        }
                      />{' '}
                      Include exercise
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={displayedPrescription.optional}
                        onChange={(event) =>
                          changePrescription({ optional: event.target.checked })
                        }
                      />{' '}
                      Optional exercise
                    </label>
                    <label>
                      Progression rule
                      <select
                        value={displayedPrescription.progression}
                        onChange={(event) =>
                          changePrescription({
                            progression: event.target
                              .value as ExercisePrescription['progression'],
                          })
                        }
                      >
                        {[
                          'double progression',
                          'capacity',
                          'hold',
                          'attempts',
                        ].map((rule) => (
                          <option key={rule}>{rule}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Exercise substitution
                      <select
                        value={displayedPrescription.substitutionId ?? ''}
                        onChange={(event) =>
                          changePrescription({
                            substitutionId: event.target.value || undefined,
                          })
                        }
                      >
                        <option value="">Original exercise</option>
                        {library.map((exercise) => (
                          <option key={exercise.id} value={exercise.id}>
                            {exercise.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Notes
                      <textarea
                        value={displayedPrescription.notes}
                        onChange={(event) =>
                          changePrescription({ notes: event.target.value })
                        }
                      />
                    </label>
                    <SecondaryButton
                      disabled={scope === 'program'}
                      onClick={() => {
                        const next = structuredClone(plan)
                        if (scope === 'week')
                          delete next.weeks[week - 1].overrides[key]
                        else if (scope === 'phase' && phase)
                          delete next.phases.find(
                            (entry) => entry.id === phase.id,
                          )!.overrides[key]
                        setPlan(next)
                      }}
                    >
                      Use inherited targets
                    </SecondaryButton>
                  </div>
                </details>
              </>
            ) : null}
          </div>
        ) : null}
        {section === 'progress' ? (
          <>
            {performance && mode === 'cycle' ? (
              <p>
                Week {week} ·
                {
                  performance.completed.filter(
                    (entry) => entry.programWeekNumber === week,
                  ).length
                }{' '}
                completed sessions
              </p>
            ) : null}
            {performance &&
            Object.keys(performance.latestPerformanceByExercise).length ? (
              <details>
                <summary>Strength and hypertrophy progress</summary>
                <p>
                  Estimated 1RM trends use completed weighted sets. Recovery
                  sessions are excluded.
                </p>
                <ul>
                  {[
                    ...new Set(allExercises.map((entry) => entry.exerciseId)),
                  ].map((id) => {
                    const points = performance.trends
                      .filter((entry) => entry.exerciseId === id)
                      .sort((a, b) => a.localDate.localeCompare(b.localDate))
                    if (!points.length) {
                      const latest = performance.latestPerformanceByExercise[id]
                      if (!latest) return null
                      const name =
                        allExercises.find((entry) => entry.exerciseId === id)
                          ?.exerciseSnapshot.exerciseName ?? 'Exercise'
                      return (
                        <li key={id}>
                          {name}:{' '}
                          {latest.sets
                            .map((set) =>
                              typeof set.metricValues.reps === 'number'
                                ? `${set.metricValues.reps} reps`
                                : 'completed set',
                            )
                            .join(', ')}{' '}
                          on {latest.date}. Full results in History.
                        </li>
                      )
                    }
                    const first = points[0],
                      last = points[points.length - 1]
                    return (
                      <li key={id}>
                        {last.exerciseName}:{' '}
                        {showWeight(first.estimatedOneRepMax ?? 0)} →{' '}
                        {showWeight(last.estimatedOneRepMax ?? 0)} {weightUnit}{' '}
                        estimated · latest {showWeight(last.weight)} ×{' '}
                        {last.repetitions} on {last.localDate}. See History for
                        charts.
                      </li>
                    )
                  })}
                </ul>
              </details>
            ) : (
              <p className="muted">Complete a workout to see progress here.</p>
            )}
          </>
        ) : null}
        {error ? <ValidationMessage message={error} /> : null}
        {dirty ? (
          <div className="periodized-save">
            <PrimaryButton disabled={busy} onClick={() => void save()}>
              {busy ? 'Saving…' : 'Save changes'}
            </PrimaryButton>
          </div>
        ) : message ? (
          <p className="plan-saved" role="status">
            {message}
          </p>
        ) : null}
      </section>
      <ModalConfirmationDialog
        isOpen={confirmDiscard}
        title="Discard plan changes?"
        confirmLabel="Discard changes"
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={onClose}
      >
        Your edits haven’t been saved.
      </ModalConfirmationDialog>
    </BottomSheet>
  )
}
