import { useEffect, useState } from 'react'
import {
  PrimaryButton,
  SecondaryButton,
  ValidationMessage,
} from '@components/ui'
import { addLocalDays, formatLocalDate, parseLocalDate } from '@domain/dates'
import { differenceInCalendarDays } from 'date-fns'
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
}: {
  record: ProgramTemplate | ActiveProgramCycle
  mode: 'template' | 'cycle'
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
    'schedule' | 'sets' | 'preview' | 'progress'
  >('preview')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [newName, setNewName] = useState('')
  const [startDate, setStartDate] = useState(formatLocalDate(new Date()))
  const [duration, setDuration] = useState(record.durationWeeks ?? 14)
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
  }, [record.id, record.updatedAt, mode])

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

  async function save(next = plan) {
    if (!next) return
    setBusy(true)
    setError(null)
    try {
      const saved = await periodizationRepository.savePlan(
        record.id,
        mode,
        normalizePhaseRanges(structuredClone(next)),
      )
      setPlan(saved)
      setMessage(
        'Saved future prescriptions. Completed workouts are unchanged.',
      )
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
    setMessage('Unsaved changes — save to apply.')
  }

  if (!structure)
    return <p role="status">{error ?? 'Loading periodized program…'}</p>
  if (!plan)
    return (
      <div className="periodized-panel">
        <h3>Multiweek programming</h3>
        <p>
          Start from this repeating template, then customize phases and
          individual weeks.
        </p>
        {mode === 'template' ? (
          <>
            <label>
              Start date
              <input
                aria-label="Periodized start date"
                type="date"
                value={startDate}
                onChange={(event) =>
                  setStartDate(event.target.value as typeof startDate)
                }
              />
            </label>
            <label>
              Duration in weeks
              <input
                type="number"
                min={1}
                max={104}
                value={duration}
                onChange={(event) => setDuration(Number(event.target.value))}
              />
            </label>
            <SecondaryButton
              disabled={busy || !allExercises.length}
              onClick={() => {
                setBusy(true)
                void periodizationRepository
                  .fromRepeatingTemplate(record.id, startDate, duration)
                  .then((created) => {
                    setPlan(created)
                    setWeek(1)
                    setSection('schedule')
                    onChanged()
                  })
                  .catch((caught: unknown) =>
                    setError(
                      caught instanceof Error
                        ? caught.message
                        : 'Unable to create plan.',
                    ),
                  )
                  .finally(() => setBusy(false))
              }}
            >
              Create periodized program from template
            </SecondaryButton>
            {!allExercises.length ? (
              <p className="muted">Add workout days and exercises first.</p>
            ) : null}
          </>
        ) : (
          <p>Create periodization on a saved template, then activate it.</p>
        )}
        {error ? <ValidationMessage message={error} /> : null}
      </div>
    )

  const weekStart = addLocalDays(
    plan.startDate as typeof startDate,
    (week - 1) * 7,
  )
  const displayedPrescription =
    scope === 'program'
      ? plan.defaults[key]
      : scope === 'phase'
        ? { ...plan.defaults[key], ...phase?.overrides[key] }
        : prescription
  return (
    <section aria-label="Periodized program" className="periodized-panel">
      <p className="periodized-caption">
        {plan.weeks.length} weeks · {plan.startDate} –{' '}
        {addLocalDays(
          plan.startDate as typeof startDate,
          plan.weeks.length * 7 - 1,
        )}
      </p>
      <label>
        Preview training week
        <select
          aria-label="Preview training week"
          value={week}
          onChange={(event) => setWeek(Number(event.target.value))}
        >
          {plan.weeks.map((assigned, index) => (
            <option key={index} value={index + 1}>
              Week {index + 1} ·{' '}
              {plan.phases.find((entry) => entry.id === assigned.phaseId)?.name}
            </option>
          ))}
        </select>
      </label>
      <p>
        {weekStart} – {addLocalDays(weekStart, 6)} · {phase?.name}
      </p>
      <div
        className="periodized-sections"
        role="group"
        aria-label="Periodization sections"
      >
        {(['preview', 'schedule', 'sets', 'progress'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={section === value}
            onClick={() => setSection(value)}
          >
            {
              {
                preview: 'Preview',
                schedule: 'Schedule',
                sets: 'Sets',
                progress: 'Progress',
              }[value]
            }
          </button>
        ))}
      </div>
      {section === 'schedule' ? (
        <fieldset>
          <legend>Schedule</legend>
          <label>
            Assigned start date
            <input
              type="date"
              value={plan.startDate}
              onChange={(event) =>
                setPlan({ ...plan, startDate: event.target.value })
              }
            />
          </label>
          <div className="button-row">
            <SecondaryButton
              onClick={() => {
                const next = structuredClone(plan)
                if (next.pausedOn) {
                  const days = differenceInCalendarDays(
                    new Date(),
                    parseLocalDate(next.pausedOn as typeof startDate),
                  )
                  next.startDate = addLocalDays(
                    next.startDate as typeof startDate,
                    days,
                  )
                  delete next.pausedOn
                } else next.pausedOn = formatLocalDate(new Date())
                void save(next)
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
              Duplicate selected week
            </SecondaryButton>
            <SecondaryButton
              disabled={
                !phase ||
                plan.weeks.length + (phase.endWeek - phase.startWeek + 1) > 104
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
              Duplicate selected phase
            </SecondaryButton>
          </div>
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
            Add phase at selected week
          </SecondaryButton>
        </fieldset>
      ) : null}
      {section === 'sets' ? (
        <fieldset>
          <legend>Set prescriptions</legend>
          <label>
            Edit scope
            <select
              aria-label="Prescription edit scope"
              value={scope}
              onChange={(event) => setScope(event.target.value as typeof scope)}
            >
              <option value="week">Selected week only</option>
              <option value="phase">Selected phase</option>
              <option value="program">Program defaults</option>
            </select>
          </label>
          <label>
            Exercise prescription
            <select
              value={key}
              onChange={(event) => setSelectedKey(event.target.value)}
            >
              {structure.days.map((day) => (
                <optgroup key={day.id} label={day.name}>
                  {(structure.exercisesByDay[day.id] ?? []).map((exercise) => (
                    <option key={exercise.id} value={exerciseKey(exercise)}>
                      {exercise.exerciseSnapshot.exerciseName}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          {displayedPrescription ? (
            <>
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
                  {['double progression', 'capacity', 'hold', 'attempts'].map(
                    (rule) => (
                      <option key={rule}>{rule}</option>
                    ),
                  )}
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
              {displayedPrescription.sets.map((group, index) => (
                <fieldset key={index}>
                  <legend>Set group {index + 1}</legend>
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
                                  kind: event.target.value as typeof set.kind,
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
                    {(
                      [
                        'count',
                        'repsMin',
                        'repsMax',
                        'rir',
                        'percent',
                        'startingWeight',
                        'restSeconds',
                      ] as const
                    ).map((field) => (
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
                          step={
                            field === 'rir'
                              ? 0.5
                              : field === 'startingWeight'
                                ? 0.5
                                : 1
                          }
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
                                    ? convertToLb(
                                        Number(event.target.value),
                                        weightUnit,
                                      )
                                    : Number(event.target.value)
                            changePrescription({
                              sets: displayedPrescription.sets.map((set, at) =>
                                at === index ? { ...set, [field]: value } : set,
                              ),
                            })
                          }}
                        />
                      </label>
                    ))}
                  </div>
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
                </fieldset>
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
                onClick={() => {
                  const next = structuredClone(plan)
                  if (scope === 'week')
                    delete next.weeks[week - 1].overrides[key]
                  else if (scope === 'phase' && phase)
                    delete next.phases.find((entry) => entry.id === phase.id)!
                      .overrides[key]
                  setPlan(next)
                }}
              >
                Reset selected override to inherited values
              </SecondaryButton>
            </>
          ) : null}
        </fieldset>
      ) : null}
      {section === 'preview' ? (
        <div className="periodized-timeline">
          {structure.days.map((day) => {
            const exercises = (structure.exercisesByDay[day.id] ?? []).flatMap(
              (exercise) => {
                const resolved = resolvePrescription(
                  plan,
                  week,
                  exerciseKey(exercise),
                )
                return resolved?.included && resolved.sets.length
                  ? [{ exercise, prescription: resolved }]
                  : []
              },
            )
            if (!exercises.length) return null
            const date = scheduledDate(
              plan,
              week,
              day.sourceTemplateDayId ?? day.id,
            )
            const done = performance?.completed.some(
              (entry) =>
                entry.programWeekNumber === week &&
                entry.sourceDayId === day.id,
            )
            return (
              <details className="periodized-day" key={day.id}>
                <summary>
                  <strong>
                    {phase?.dayNames?.[day.sourceTemplateDayId ?? day.id] ??
                      day.name}
                  </strong>
                  <span className="periodized-caption">
                    {date}
                    {done ? ' · Completed' : ''}
                  </span>
                </summary>
                {section === 'preview' ? (
                  <label>
                    Scheduled date for this week
                    <input
                      type="date"
                      min={weekStart}
                      max={addLocalDays(weekStart, 6)}
                      value={date}
                      onChange={(event) => {
                        const offset = differenceInCalendarDays(
                          parseLocalDate(
                            event.target.value as typeof weekStart,
                          ),
                          parseLocalDate(weekStart),
                        )
                        if (
                          !Number.isFinite(offset) ||
                          offset < 0 ||
                          offset > 6
                        ) {
                          setError(
                            'Choose a date within the selected training week.',
                          )
                          return
                        }
                        const next = structuredClone(plan),
                          dayKey = day.sourceTemplateDayId ?? day.id
                        next.weeks[week - 1].dayOffsets = {
                          ...next.weeks[week - 1].dayOffsets,
                          [dayKey]: offset,
                        }
                        setPlan(next)
                      }}
                    />
                  </label>
                ) : null}
                {exercises.map(({ exercise, prescription: selected }) => (
                  <details key={exercise.id}>
                    <summary>
                      {selected.optional ? 'Optional: ' : ''}
                      {library.find(
                        (entry) => entry.id === selected.substitutionId,
                      )?.name ?? exercise.exerciseSnapshot.exerciseName}{' '}
                      ·{' '}
                      {selected.sets.reduce(
                        (total, group) => total + group.count,
                        0,
                      )}{' '}
                      sets
                    </summary>
                    <ul>
                      {selected.sets.map((group, index) => {
                        const ownHistory =
                          performance?.historyByExercise[
                            selected.substitutionId ?? exercise.exerciseId
                          ] ?? []
                        const history = ownHistory.length
                          ? ownHistory
                          : (
                              performance?.historyByExercise[
                                selected.referenceExerciseId ?? ''
                              ] ?? []
                            ).map((set) => ({
                              ...set,
                              metricValues: {
                                ...set.metricValues,
                                weight:
                                  typeof set.metricValues.weight === 'number'
                                    ? set.metricValues.weight *
                                      (selected.referenceScale ?? 1)
                                    : set.metricValues.weight,
                              },
                            }))
                        const load = recommendPeriodizedLoad(
                          group,
                          selected,
                          history,
                          library.find(
                            (entry) => entry.id === exercise.exerciseId,
                          )?.defaultWeightIncrement ?? 5,
                        )
                        return (
                          <li key={index}>
                            {group.kind}: {group.count} × {group.repsMin}
                            {group.repsMax !== group.repsMin
                              ? `–${group.repsMax}`
                              : ''}{' '}
                            ·{' '}
                            {group.rir == null
                              ? 'Review attempt effort'
                              : `${group.rir} RIR`}
                            {load != null
                              ? ` · about ${showWeight(load)} ${weightUnit}`
                              : ' · choose load from your history'}{' '}
                            · rest {group.restSeconds}s
                          </li>
                        )
                      })}
                    </ul>
                    {selected.notes ? <p>{selected.notes}</p> : null}
                  </details>
                ))}
              </details>
            )
          })}
        </div>
      ) : null}
      {section === 'progress' ? (
        <>
          {performance && mode === 'cycle' ? (
            <p>
              Week adherence:{' '}
              {
                performance.completed.filter(
                  (entry) => entry.programWeekNumber === week,
                ).length
              }{' '}
              completed sessions. Optional sessions and illness skips do not
              create makeup work.
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
            <p className="muted">
              Completed exercise performances will appear here; reference
              strength values are not workout records.
            </p>
          )}
        </>
      ) : null}
      <div className="periodized-save">
        <PrimaryButton disabled={busy} onClick={() => void save()}>
          Save periodized program
        </PrimaryButton>
      </div>
      {message ? <p role="status">{message}</p> : null}
      {error ? <ValidationMessage message={error} /> : null}
    </section>
  )
}
