import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from 'react'
import { useBlocker } from 'react-router-dom'
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
  exercisePrescriptionSchema,
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

type ExerciseDraft = {
  prescription: ExercisePrescription
  maxes: Record<string, number | null>
}

function editedFields(base: ExercisePrescription, draft: ExercisePrescription) {
  const fields: Partial<ExercisePrescription> = {}
  if (JSON.stringify(base.sets) !== JSON.stringify(draft.sets))
    fields.sets = draft.sets
  if (base.notes !== draft.notes) fields.notes = draft.notes
  if (base.optional !== draft.optional) fields.optional = draft.optional
  if (base.substitutionId !== draft.substitutionId)
    fields.substitutionId = draft.substitutionId
  return fields
}

export type WeekExerciseSaveHandle = { flush: () => Promise<boolean> }

export function WeekExerciseEditor({
  id,
  mode,
  plan,
  week,
  exerciseKey,
  exerciseId,
  original,
  library,
  saveHandle,
}: Props & {
  exerciseKey: string
  exerciseId: string
  original: ExercisePrescription
  library: Exercise[]
  saveHandle: Ref<WeekExerciseSaveHandle>
}) {
  const [opening] = useState(() => structuredClone(original))
  const [entry, setEntry] = useState<ExerciseDraft>(() => ({
    prescription: opening,
    maxes: {},
  }))
  const [to, setTo] = useState<number[]>([])
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle',
  )
  const [error, setError] = useState('')
  const [applyMessage, setApplyMessage] = useState('')
  const [applying, setApplying] = useState(false)
  const form = useRef<HTMLFieldSetElement>(null)
  const latest = useRef(entry),
    saved = useRef(entry)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const queue = useRef<Promise<void>>(Promise.resolve())
  const alive = useRef(true)
  const { prescription: draft, maxes } = entry
  const unit = useWeightUnit()
  const liftId = draft.substitutionId ?? exerciseId
  const lift = library.find((e) => e.id === liftId)
  const flush = useCallback(() => {
    clearTimeout(timer.current)
    const result = queue.current.then(async () => {
      while (saved.current !== latest.current) {
        const pending = latest.current
        const base = saved.current
        try {
          const invalid =
            form.current?.querySelector<HTMLInputElement>('input:invalid')
          if (invalid)
            throw new Error(
              `${invalid.labels?.[0]?.textContent?.trim() ?? 'Number'}: ${invalid.validationMessage}`,
            )
          if (
            pending.prescription.sets.some((group) => group.restSeconds == null)
          )
            throw new Error('Enter a rest duration in seconds.')
          const validation = exercisePrescriptionSchema.safeParse(
            pending.prescription,
          )
          if (!validation.success) {
            const issue = validation.error.issues[0]
            const names: Record<string, string> = {
              count: 'Sets',
              repsMin: 'Minimum reps',
              repsMax: 'Maximum reps',
              rir: 'Target RIR',
              restSeconds: 'Rest',
              percent: 'Percentage',
              startingWeight: 'Fixed weight',
            }
            const label = names[String(issue.path.at(-1))] ?? 'Set group'
            throw new Error(`${label}: ${issue.message}`)
          }
          const changes = editedFields(base.prescription, pending.prescription)
          const weights = Object.fromEntries(
            Object.entries(pending.maxes).filter(
              ([key, value]) => base.maxes[key] !== value,
            ),
          )
          if (Object.keys(changes).length || Object.keys(weights).length) {
            await periodizationRepository.saveWeekExercise(
              id,
              mode,
              [week],
              exerciseKey,
              base.prescription,
              changes,
              weights,
            )
          }
          saved.current = pending
        } catch (caught) {
          if (pending !== latest.current) continue
          if (alive.current) {
            setStatus('error')
            setError(
              caught instanceof Error
                ? caught.message
                : 'Could not save changes.',
            )
          }
          return false
        }
      }
      if (
        alive.current &&
        (saved.current.prescription !== opening ||
          Object.keys(saved.current.maxes).length > 0)
      ) {
        setStatus('saved')
        setError('')
      }
      return true
    })
    queue.current = result.then(() => {})
    return result
  }, [id, mode, week, exerciseKey, opening])
  const change = (next: ExerciseDraft) => {
    latest.current = next
    setEntry(next)
    setStatus('saving')
    setError('')
    setApplyMessage('')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(), 450)
  }
  const patch = (fields: Partial<ExercisePrescription>) =>
    change({
      ...latest.current,
      prescription: { ...latest.current.prescription, ...fields },
    })
  const updateGroup = (i: number, fields: Partial<SetPrescription>) =>
    patch({
      sets: latest.current.prescription.sets.map((g, n) =>
        i === n ? { ...g, ...fields } : g,
      ),
    })
  const applyPending = useRef<Promise<boolean> | null>(null)
  const finish = useCallback(async () => {
    if (applyPending.current && !(await applyPending.current)) return false
    return flush()
  }, [flush])
  useImperativeHandle(saveHandle, () => ({ flush: finish }), [finish])
  const blocker = useBlocker(
    useCallback(
      () => saved.current !== latest.current || applyPending.current !== null,
      [],
    ),
  )
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    let active = true
    void finish().then((ok) => {
      if (active) {
        if (ok) blocker.proceed()
        else blocker.reset()
      }
    })
    return () => {
      active = false
    }
  }, [blocker, finish])
  useEffect(() => {
    alive.current = true
    function onHide() {
      if (
        document.visibilityState === 'hidden' &&
        latest.current !== saved.current
      )
        void flush()
    }
    function beforeUnload(event: BeforeUnloadEvent) {
      if (latest.current !== saved.current || applyPending.current) {
        void flush()
        event.preventDefault()
        event.returnValue = ''
      }
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('beforeunload', beforeUnload)
    return () => {
      alive.current = false
      clearTimeout(timer.current)
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('beforeunload', beforeUnload)
    }
  }, [flush])
  const apply = () => {
    if (applyPending.current || !to.length) return
    setApplying(true)
    setApplyMessage('')
    applyPending.current = (async () => {
      if (!(await flush())) return false
      const fields = editedFields(opening, saved.current.prescription)
      try {
        await periodizationRepository.saveWeekExercise(
          id,
          mode,
          to,
          exerciseKey,
          opening,
          fields,
          {},
          week,
        )
        setApplyMessage('Applied to selected weeks.')
        setTo([])
        return true
      } catch (caught) {
        setApplyMessage(
          caught instanceof Error ? caught.message : 'Could not apply changes.',
        )
        return false
      }
    })().finally(() => {
      applyPending.current = null
      if (alive.current) setApplying(false)
    })
  }
  return (
    <fieldset
      ref={form}
      className="periodized-panel week-exercise-form"
      disabled={applying}
      onBlur={() => {
        if (status === 'saving' && latest.current !== saved.current)
          void flush()
      }}
    >
      <div className="plan-heading">
        <p>{weekLabel(plan, week)}</p>
        <h3>{lift?.name ?? 'Exercise'}</h3>
        <small role="status" aria-live="polite">
          {status === 'saving'
            ? 'Saving…'
            : status === 'saved'
              ? 'Saved'
              : status === 'error'
                ? 'Changes unsaved'
                : ''}
        </small>
      </div>
      {error ? (
        <div>
          <ValidationMessage message={error} />
          <SecondaryButton
            onClick={() => {
              setStatus('saving')
              void flush()
            }}
          >
            Retry
          </SecondaryButton>
        </div>
      ) : null}
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
                        required={key !== 'rir'}
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
                        required
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
                        onChange={(e) => {
                          change({
                            ...latest.current,
                            maxes: {
                              ...latest.current.maxes,
                              [reference]:
                                e.target.value === ''
                                  ? null
                                  : convertToLb(Number(e.target.value), unit),
                            },
                          })
                        }}
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
                  required
                  value={group.restSeconds ?? ''}
                  onChange={(e) =>
                    updateGroup(i, {
                      restSeconds:
                        e.target.value === ''
                          ? undefined
                          : Number(e.target.value),
                    })
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
        <WeekChoices
          plan={plan}
          week={week}
          selected={to}
          onChange={(n) => {
            setTo(n)
            setApplyMessage('')
          }}
        />
        <SecondaryButton
          disabled={
            !to.length || !Object.keys(editedFields(opening, draft)).length
          }
          onClick={apply}
        >
          Apply to selected weeks
        </SecondaryButton>
        {applyMessage ? <p role="status">{applyMessage}</p> : null}
      </details>
    </fieldset>
  )
}
