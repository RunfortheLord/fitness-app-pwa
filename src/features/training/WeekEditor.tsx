import { useEffect, useRef, useState } from 'react'
import { differenceInCalendarDays } from 'date-fns'
import {
  formatLocalDate,
  parseLocalDate,
  addLocalDays,
  type LocalDateString,
} from '@domain/dates'
import {
  BottomSheet,
  PrimaryButton,
  SecondaryButton,
  ValidationMessage,
} from '@components/ui'
import {
  copyTrainingWeek,
  weekLabel,
  setKinds,
  configuredLoad,
  type PeriodizedPlan,
  type ExercisePrescription,
  type SetPrescription,
} from '@domain/periodization'
import { prescriptionSet } from '@domain/februaryPeak'
import {
  convertToLb,
  weightInputValue,
  formatWeight,
} from '@domain/weightUnits'
import { useWeightUnit } from '@hooks/useWeightUnit'
import { periodizationRepository } from '@repositories/periodizationRepository'
import type { Exercise } from '@shared-types/app'
import type { BuilderMode } from './types'

type Props = {
  id: string
  mode: BuilderMode
  plan: PeriodizedPlan
  week: number
}

function changedFields(
  base: ExercisePrescription,
  next: ExercisePrescription,
): Partial<ExercisePrescription> {
  const fields: Partial<ExercisePrescription> = {}
  if (JSON.stringify(base.sets) !== JSON.stringify(next.sets))
    fields.sets = next.sets
  if (base.notes !== next.notes) fields.notes = next.notes
  if (base.optional !== next.optional) fields.optional = next.optional
  if (base.substitutionId !== next.substitutionId)
    fields.substitutionId = next.substitutionId
  return fields
}

function isValidPrescription(
  value: ExercisePrescription,
  maxValues: Record<string, number | null>,
) {
  return (
    value.sets.length > 0 &&
    value.sets.every(
      (group) =>
        group.count != null &&
        Number.isFinite(group.count) &&
        group.count >= 1 &&
        group.repsMin != null &&
        Number.isFinite(group.repsMin) &&
        group.repsMin >= 1 &&
        group.repsMax != null &&
        Number.isFinite(group.repsMax) &&
        group.repsMax >= group.repsMin &&
        (group.rir == null || (Number.isFinite(group.rir) && group.rir >= 0)) &&
        Number.isFinite(group.restSeconds) &&
        group.restSeconds >= 0 &&
        (group.loadMode === 'percent'
          ? group.percent != null &&
            Number.isFinite(group.percent) &&
            group.percent >= 0.1 &&
            group.percent <= 1.05
          : group.startingWeight == null ||
            (Number.isFinite(group.startingWeight) &&
              group.startingWeight >= 0)),
    ) &&
    Object.values(maxValues).every(
      (value) => value === null || (Number.isFinite(value) && value > 0),
    )
  )
}
function WeekChoices({
  plan,
  week,
  selected,
  onChange,
}: {
  plan: PeriodizedPlan
  week: number
  selected: number[]
  onChange: (weeks: number[]) => void
}) {
  return (
    <div className="week-choices">
      {plan.weeks
        .map((_, i) => i + 1)
        .filter((n) => n !== week)
        .map((n) => (
          <label className="checkbox-row" key={n}>
            <input
              type="checkbox"
              checked={selected.includes(n)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...selected, n]
                    : selected.filter((x) => x !== n),
                )
              }
            />
            {weekLabel(plan, n)}
          </label>
        ))}
    </div>
  )
}

export function WeekControls({
  id,
  mode,
  plan,
  week,
  onWeek,
  onSaved,
}: Props & { onWeek: (week: number) => void; onSaved: () => void }) {
  const [open, setOpen] = useState(false),
    [name, setName] = useState(''),
    [to, setTo] = useState<number[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const [date, setDate] = useState(plan.startDate),
    [resume, setResume] = useState(false)
  const save = async () => {
    setBusy(true)
    setError('')
    try {
      await periodizationRepository.editWeeks(id, mode, (next) => {
        next.weeks[week - 1].name = name.trim() || undefined
        next.startDate = date
        if (resume && next.pausedOn) {
          next.startDate = addLocalDays(
            date as LocalDateString,
            differenceInCalendarDays(
              parseLocalDate(formatLocalDate(new Date())),
              parseLocalDate(next.pausedOn as LocalDateString),
            ),
          )
          delete next.pausedOn
        }
        if (to.length) Object.assign(next, copyTrainingWeek(next, week, to))
      })
      onSaved()
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save week.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <div className="builder-week-selector">
        <label>
          Training week
          <select value={week} onChange={(e) => onWeek(Number(e.target.value))}>
            {plan.weeks.map((_, i) => (
              <option key={i} value={i + 1}>
                {weekLabel(plan, i + 1)}
              </option>
            ))}
          </select>
        </label>
        <SecondaryButton
          onClick={() => {
            setName(plan.weeks[week - 1].name ?? '')
            setDate(plan.startDate)
            setResume(false)
            setTo([])
            setError('')
            setOpen(true)
          }}
        >
          Week options
        </SecondaryButton>
      </div>
      <BottomSheet
        isOpen={open}
        onClose={() => setOpen(false)}
        title={`Week ${week} options`}
      >
        <div className="periodized-panel">
          <label>
            Week name
            <input
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <details className="plan-disclosure">
            <summary>Copy this week to…</summary>
            <p>Replaces the selected weeks’ exercises, sets and week names.</p>
            <WeekChoices
              plan={plan}
              week={week}
              selected={to}
              onChange={setTo}
            />
          </details>
          {plan.pausedOn ? (
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={resume}
                onChange={(e) => setResume(e.target.checked)}
              />
              Resume paused program
            </label>
          ) : null}
          <details className="plan-disclosure">
            <summary>Program dates</summary>
            <label>
              Program start date
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
          </details>
          {error && <ValidationMessage message={error} />}
          <PrimaryButton disabled={busy} onClick={() => void save()}>
            Save week
          </PrimaryButton>
        </div>
      </BottomSheet>
    </>
  )
}

export function WeekExerciseEditor({
  id,
  mode,
  plan,
  week,
  exerciseKey,
  exerciseId,
  original,
  library,
  onSaved,
  onDirty,
}: Props & {
  exerciseKey: string
  exerciseId: string
  original: ExercisePrescription
  library: Exercise[]
  onSaved: () => void
  onDirty: (dirty: boolean) => void
}) {
  const [draft, setDraft] = useState(() => structuredClone(original)),
    [to, setTo] = useState<number[]>([]),
    [maxes, setMaxes] = useState<Record<string, number | null>>({}),
    [savePhase, setSavePhase] = useState<'idle' | 'saving' | 'saved' | 'error'>(
      'idle',
    ),
    [error, setError] = useState('')
  // The prescription as it was when this editor opened. Autosaves and the
  // explicit apply-to-other-weeks action both diff against it, so an
  // autosave of this week never consumes the edits another week still needs.
  const [initialOriginal] = useState(() => structuredClone(original))
  const unit = useWeightUnit()
  const liftId = draft.substitutionId ?? exerciseId
  const lift = library.find((e) => e.id === liftId)
  const patch = (change: Partial<ExercisePrescription>) =>
    setDraft({ ...draft, ...change })
  const updateGroup = (i: number, fields: Partial<SetPrescription>) =>
    patch({
      sets: draft.sets.map((g, n) => (n === i ? { ...g, ...fields } : g)),
    })
  const draftRef = useRef(draft)
  const maxesRef = useRef(maxes)
  const saveFailedRef = useRef(false)
  const mountedRef = useRef(true)
  const saveChainRef = useRef<Promise<boolean>>(Promise.resolve(true))
  const persist = (weeksToSave: number[]): Promise<boolean> => {
    const run = async (): Promise<boolean> => {
      const current = draftRef.current,
        currentMaxes = maxesRef.current
      const fields = changedFields(initialOriginal, current)
      if (!Object.keys(fields).length && !Object.keys(currentMaxes).length)
        return true
      if (!isValidPrescription(current, currentMaxes)) return false
      if (mountedRef.current) setSavePhase('saving')
      try {
        await periodizationRepository.saveWeekExercise(
          id,
          mode,
          weeksToSave,
          exerciseKey,
          initialOriginal,
          fields,
          currentMaxes,
        )
        saveFailedRef.current = false
        if (mountedRef.current) {
          setError('')
          setSavePhase('saved')
        }
        onSaved()
        return true
      } catch (e) {
        saveFailedRef.current = true
        if (mountedRef.current) {
          setError(e instanceof Error ? e.message : 'Could not save exercise.')
          setSavePhase('error')
        }
        onDirty(true)
        return false
      }
    }
    const result = saveChainRef.current.then(run, run)
    saveChainRef.current = result
    return result
  }
  const persistRef = useRef(persist)
  useEffect(() => {
    mountedRef.current = true
    draftRef.current = draft
    maxesRef.current = maxes
    persistRef.current = persist
  })
  const hasChanges =
    Object.keys(changedFields(initialOriginal, draft)).length > 0 ||
    Object.keys(maxes).length > 0
  const valid = isValidPrescription(draft, maxes)
  // Autosave valid edits to the selected week after a short typing pause.
  // Invalid edits never save; they keep the discard prompt armed instead.
  useEffect(() => {
    onDirty(hasChanges && !valid)
    if (!hasChanges || !valid) return
    const timer = setTimeout(() => void persistRef.current([week]), 700)
    return () => clearTimeout(timer)
  }, [draft, maxes, hasChanges, valid, onDirty, week])
  // Going back closes this editor without a prompt when the edits are valid,
  // so flush any still-pending valid edits on the way out.
  useEffect(
    () => () => {
      mountedRef.current = false
      if (saveFailedRef.current) return
      const current = draftRef.current,
        currentMaxes = maxesRef.current
      const fields = changedFields(initialOriginal, current)
      if (!Object.keys(fields).length && !Object.keys(currentMaxes).length)
        return
      if (!isValidPrescription(current, currentMaxes)) return
      void periodizationRepository.saveWeekExercise(
        id,
        mode,
        [week],
        exerciseKey,
        initialOriginal,
        fields,
        currentMaxes,
      )
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const applyToSelectedWeeks = async () => {
    if (await persist([week, ...to])) setTo([])
  }
  return (
    <div
      className="periodized-panel"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null))
          void persistRef.current([week])
      }}
    >
      <div className="plan-heading">
        <p>{weekLabel(plan, week)}</p>
        <h3>{lift?.name ?? 'Exercise'}</h3>
      </div>
      {draft.sets.map((group, i) => {
        const reference = group.maxExerciseId ?? liftId,
          referenceLift = library.find((e) => e.id === reference)
        const max =
          reference in maxes ? maxes[reference] : referenceLift?.savedOneRepMax
        const load = configuredLoad(group, max, lift?.defaultWeightIncrement)
        return (
          <details
            className="plan-disclosure plan-group"
            key={i}
            open={draft.sets.length === 1 || undefined}
          >
            <summary>
              <span>
                <strong>{group.kind}</strong>
                <small>
                  {group.count} × {group.repsMin}
                  {group.repsMax !== group.repsMin
                    ? `–${group.repsMax}`
                    : ''}{' '}
                  reps{group.rir == null ? '' : ` · ${group.rir} RIR`}
                  {load != null
                    ? ` · ${formatWeight(load, unit, 'lifting')}`
                    : group.loadMode === 'percent'
                      ? ' · Enter 1RM'
                      : ''}
                </small>
              </span>
            </summary>
            <div className="plan-form">
              <label>
                Set type
                <select
                  value={group.kind}
                  onChange={(e) =>
                    updateGroup(i, {
                      kind: e.target.value as SetPrescription['kind'],
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
                  (key, j) => (
                    <label key={key}>
                      {
                        ['Sets', 'Minimum reps', 'Maximum reps', 'Target RIR'][
                          j
                        ]
                      }
                      <input
                        type="number"
                        min={key === 'rir' ? 0 : 1}
                        step={key === 'rir' ? 0.5 : 1}
                        value={group[key] ?? ''}
                        onChange={(e) =>
                          updateGroup(i, {
                            [key]:
                              e.target.value === ''
                                ? null
                                : Number(e.target.value),
                          })
                        }
                      />
                    </label>
                  ),
                )}
              </div>
              <label>
                Weight target
                <select
                  value={group.loadMode ?? 'fixed'}
                  onChange={(e) =>
                    updateGroup(i, {
                      loadMode: e.target.value as 'fixed' | 'percent',
                      percent: group.percent ?? 0.8,
                    })
                  }
                >
                  <option value="fixed">Fixed weight</option>
                  <option value="percent">Percentage of 1RM</option>
                </select>
              </label>
              {group.loadMode === 'percent' ? (
                <>
                  <label>
                    Reference lift
                    <select
                      value={reference}
                      onChange={(e) =>
                        updateGroup(i, { maxExerciseId: e.target.value })
                      }
                    >
                      {library
                        .filter(
                          (e) =>
                            e.id === reference ||
                            e.trackingMetrics.some(
                              (metric) => metric.key === 'weight',
                            ),
                        )
                        .map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <div className="periodized-fields">
                    <label>
                      Percentage (%)
                      <input
                        type="number"
                        value={
                          group.percent == null
                            ? ''
                            : Number((group.percent * 100).toFixed(3))
                        }
                        min="10"
                        max="105"
                        step="any"
                        onChange={(e) =>
                          updateGroup(i, {
                            percent:
                              e.target.value === ''
                                ? undefined
                                : Number(e.target.value) / 100,
                          })
                        }
                      />
                    </label>
                    <label>
                      Saved 1RM ({unit})
                      <input
                        type="number"
                        min="0"
                        step="any"
                        key={reference}
                        placeholder="Enter 1RM"
                        value={weightInputValue(max ?? null, unit)}
                        onChange={(e) =>
                          setMaxes({
                            ...maxes,
                            [reference]:
                              e.target.value === ''
                                ? null
                                : convertToLb(Number(e.target.value), unit),
                          })
                        }
                      />
                    </label>
                  </div>
                  <p>
                    {load == null
                      ? 'Enter a saved 1RM to calculate this target.'
                      : `Target · ${formatWeight(load, unit, 'lifting')}`}
                  </p>
                </>
              ) : (
                <label>
                  Fixed weight ({unit})
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={weightInputValue(group.startingWeight ?? null, unit)}
                    onChange={(e) =>
                      updateGroup(i, {
                        startingWeight:
                          e.target.value === ''
                            ? undefined
                            : convertToLb(Number(e.target.value), unit),
                      })
                    }
                  />
                </label>
              )}
              <label>
                Rest (seconds)
                <input
                  type="number"
                  min="0"
                  value={group.restSeconds}
                  onChange={(e) =>
                    updateGroup(i, { restSeconds: Number(e.target.value) })
                  }
                />
              </label>
              <SecondaryButton
                disabled={draft.sets.length === 1}
                onClick={() =>
                  patch({ sets: draft.sets.filter((_, n) => n !== i) })
                }
              >
                Remove group
              </SecondaryButton>
            </div>
          </details>
        )
      })}
      <SecondaryButton
        onClick={() =>
          patch({
            sets: [
              ...draft.sets,
              prescriptionSet('straight set', 1, 8, 12, null, {
                loadMode: 'fixed',
              }),
            ],
          })
        }
      >
        Add set group
      </SecondaryButton>
      <details className="plan-disclosure">
        <summary>Exercise options</summary>
        <label>
          Exercise
          <select
            value={liftId}
            onChange={(e) => patch({ substitutionId: e.target.value })}
          >
            {library
              .filter((e) => e.trackingMethodId === lift?.trackingMethodId)
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Notes
          <textarea
            value={draft.notes}
            onChange={(e) => patch({ notes: e.target.value })}
          />
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={draft.optional}
            onChange={(e) => patch({ optional: e.target.checked })}
          />
          Optional exercise
        </label>
      </details>
      <details className="plan-disclosure">
        <summary>
          Apply edits to other weeks{to.length ? ` (${to.length})` : ''}
        </summary>
        <WeekChoices plan={plan} week={week} selected={to} onChange={setTo} />
      </details>
      {error && <ValidationMessage message={error} />}
      <p className="muted" role="status">
        {savePhase === 'saving'
          ? 'Saving…'
          : hasChanges && !valid
            ? 'Enter valid set values and your changes will save automatically.'
            : 'Changes save automatically.'}
      </p>
      {to.length ? (
        <PrimaryButton onClick={() => void applyToSelectedWeeks()}>
          Apply edits to {to.length} selected week{to.length === 1 ? '' : 's'}
        </PrimaryButton>
      ) : null}
    </div>
  )
}
