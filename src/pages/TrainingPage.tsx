import {
  Archive,
  ArrowLeft,
  Copy,
  Dumbbell,
  Edit2,
  EyeOff,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import {
  BottomSheet,
  Card,
  EmptyState,
  FormField,
  IconButton,
  LoadingState,
  ModalConfirmationDialog,
  NumericInput,
  PageContainer,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  StatusMessage,
  ValidationMessage,
} from '@components/ui'
import { TRACKING_METHODS, getTrackingMethod } from '@domain/trackingMethods'
import { formatLocalDate } from '@domain/dates'
import {
  defaultExerciseResults,
  hasSearchableQuery,
  searchExercises,
  type ExerciseUsageSummary,
} from '@domain/exerciseSearch'
import {
  exerciseRepository,
  type CreateExerciseInput,
} from '@repositories/exerciseRepository'
import {
  programRepository,
  type CreateTemplateExerciseInput,
} from '@repositories/programRepository'
import { workoutRepository } from '@repositories/workoutRepository'
import type {
  ActiveCycleWorkoutDay,
  ActiveCycleWorkoutExercise,
  ActiveProgramCycle,
  Exercise,
  ProgramTemplate,
  ProgramTemplateDay,
  TemplateWorkoutExercise,
  TrackingMethodId,
} from '@shared-types/app'

type ExerciseView = 'active' | 'hidden'
type BuilderMode = 'template' | 'cycle'
type ProgramSheetTarget =
  | { mode: 'template'; templateId: string }
  | { mode: 'cycle'; cycleId: string }
type SelectedDay = {
  cycle: ActiveProgramCycle
  day: ActiveCycleWorkoutDay
  exercises: ActiveCycleWorkoutExercise[]
} | null
type SheetState =
  | { type: 'exercise'; exercise: Exercise | null }
  | { type: 'createProgram' }
  | { type: 'builder'; target: ProgramSheetTarget }
  | { type: 'selectedDay'; selectedDay: NonNullable<SelectedDay> }
  | null
type ProgramConfirmation =
  | { type: 'activate'; template: ProgramTemplate }
  | { type: 'archive'; template: ProgramTemplate }
  | null

type ExerciseFormState = {
  name: string
  notes: string
  restMinutes: string
  restSeconds: string
  trackingMethodId: TrackingMethodId
}

type LoadState = {
  exercises: Exercise[]
  templates: ProgramTemplate[]
  exerciseUsage: ExerciseUsageSummary
  currentCycle:
    | {
        cycle: ActiveProgramCycle
        days: ActiveCycleWorkoutDay[]
        exercisesByDay: Record<string, ActiveCycleWorkoutExercise[]>
      }
    | undefined
  status: 'loading' | 'ready' | 'error'
}

type ProgramFormState = {
  name: string
  notes: string
}

type PrescriptionFormState = {
  exerciseId: string
  targetSetCount: string
  targetWeight: string
  targetDurationSeconds: string
  targetDistance: string
  targetRepsMin: string
  targetRepsMax: string
  targetRir: string
  notes: string
}

const emptyExerciseForm: ExerciseFormState = {
  name: '',
  notes: '',
  restMinutes: '2',
  restSeconds: '0',
  trackingMethodId: 'weight_reps',
}

const emptyProgramForm: ProgramFormState = {
  name: '',
  notes: '',
}

const emptyPrescriptionForm: PrescriptionFormState = {
  exerciseId: '',
  targetSetCount: '3',
  targetWeight: '',
  targetDurationSeconds: '',
  targetDistance: '',
  targetRepsMin: '',
  targetRepsMax: '',
  targetRir: '',
  notes: '',
}

export function TrainingPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [view, setView] = useState<ExerciseView>('active')
  const [sheet, setSheet] = useState<SheetState>(null)
  const [programConfirmation, setProgramConfirmation] =
    useState<ProgramConfirmation>(null)
  const [revision, setRevision] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [loadState, setLoadState] = useState<LoadState>({
    exercises: [],
    templates: [],
    exerciseUsage: {},
    currentCycle: undefined,
    status: 'loading',
  })
  const activeSheet =
    searchParams.get('createExercise') === '1'
      ? ({ type: 'exercise', exercise: null } satisfies SheetState)
      : searchParams.get('createProgram') === '1'
        ? ({ type: 'createProgram' } satisfies SheetState)
        : sheet

  useEffect(() => {
    let isCurrent = true

    void Promise.all([
      exerciseRepository.seedBuiltInExercises().then(() =>
        exerciseRepository.searchExercises({
          includeArchived: view === 'hidden',
          query,
        }),
      ),
      programRepository.listProgramTemplates(),
      programRepository.getCurrentActiveCycleStructure(),
      programRepository.getExerciseUsageSummary(),
    ])
      .then(([exercises, templates, currentCycle, exerciseUsage]) => {
        if (!isCurrent) {
          return
        }

        setLoadState({
          exercises:
            view === 'hidden'
              ? exercises.filter((exercise) => exercise.status !== 'active')
              : exercises,
          templates,
          exerciseUsage,
          currentCycle,
          status: 'ready',
        })
      })
      .catch(() => {
        if (!isCurrent) {
          return
        }

        setLoadState((current) => ({ ...current, status: 'error' }))
      })

    return () => {
      isCurrent = false
    }
  }, [query, revision, view])

  function reload() {
    setRevision((current) => current + 1)
  }

  return (
    <PageContainer>
      <ProgramOverview
        currentCycle={loadState.currentCycle}
        loadStatus={loadState.status}
        onCreateProgram={() => setSheet({ type: 'createProgram' })}
        onEditCycle={(cycleId) =>
          setSheet({ type: 'builder', target: { mode: 'cycle', cycleId } })
        }
        onSelectDay={(cycle, day, exercises) =>
          setSheet({
            type: 'selectedDay',
            selectedDay: { cycle, day, exercises },
          })
        }
      />

      <ProgramLibrary
        loadStatus={loadState.status}
        onActivate={(template) =>
          setProgramConfirmation({ type: 'activate', template })
        }
        onArchive={(template) =>
          setProgramConfirmation({ type: 'archive', template })
        }
        onClone={(templateId) => {
          void programRepository.cloneProgramTemplate(templateId).then(() => {
            setMessage('Program cloned.')
            reload()
          })
        }}
        onCreateProgram={() => setSheet({ type: 'createProgram' })}
        onEdit={(templateId) =>
          setSheet({
            type: 'builder',
            target: { mode: 'template', templateId },
          })
        }
        templates={loadState.templates}
      />

      <SectionHeader
        title="Exercise library"
        action={
          <IconButton
            aria-label="Create exercise"
            onClick={() => setSheet({ type: 'exercise', exercise: null })}
          >
            <Plus aria-hidden="true" size={20} />
          </IconButton>
        }
      />

      {message ? <StatusMessage tone="success">{message}</StatusMessage> : null}

      <ExerciseLibraryCard
        exercises={loadState.exercises}
        loadStatus={loadState.status}
        onCreateExercise={() => setSheet({ type: 'exercise', exercise: null })}
        onEditExercise={(exercise) => setSheet({ type: 'exercise', exercise })}
        onHideExercise={(exercise) => {
          void exerciseRepository.hideExercise(exercise.id).then(() => {
            setMessage('Exercise hidden.')
            reload()
          })
        }}
        onRestoreExercise={(exercise) => {
          void exerciseRepository.restoreExercise(exercise.id).then(() => {
            setMessage('Exercise restored.')
            reload()
          })
        }}
        query={query}
        setQuery={setQuery}
        setView={setView}
        view={view}
      />

      {activeSheet?.type === 'exercise' ? (
        <ExerciseFormSheet
          exercise={activeSheet.exercise}
          isOpen
          onClose={() => {
            setSheet(null)
            if (searchParams.get('createExercise') === '1') {
              setSearchParams({}, { replace: true })
            }
          }}
          onSaved={() => {
            setMessage(
              activeSheet.exercise ? 'Exercise updated.' : 'Exercise created.',
            )
            setSheet(null)
            if (searchParams.get('createExercise') === '1') {
              setSearchParams({}, { replace: true })
            }
            reload()
          }}
        />
      ) : null}
      {activeSheet?.type === 'createProgram' ? (
        <ProgramCreateSheet
          isOpen
          onClose={() => {
            setSheet(null)
            if (searchParams.get('createProgram') === '1') {
              setSearchParams({}, { replace: true })
            }
          }}
          onCreated={(templateId) => {
            setMessage('Program created.')
            setSheet({
              type: 'builder',
              target: { mode: 'template', templateId },
            })
            if (searchParams.get('createProgram') === '1') {
              setSearchParams({}, { replace: true })
            }
            reload()
          }}
        />
      ) : null}
      {activeSheet?.type === 'builder' ? (
        <ProgramBuilderSheet
          exerciseUsage={loadState.exerciseUsage}
          exercises={loadState.exercises.filter(
            (exercise) => exercise.status === 'active',
          )}
          isOpen
          onClose={() => setSheet(null)}
          onChanged={reload}
          target={activeSheet.target}
        />
      ) : null}
      {activeSheet?.type === 'selectedDay' ? (
        <WorkoutDayDetailSheet
          isOpen
          onClose={() => setSheet(null)}
          onStarted={() => {
            setSheet(null)
            void navigate('/workout')
          }}
          selectedDay={activeSheet.selectedDay}
        />
      ) : null}
      <ModalConfirmationDialog
        confirmLabel={
          programConfirmation?.type === 'archive' ? 'Archive' : 'Activate'
        }
        isOpen={programConfirmation !== null}
        onCancel={() => setProgramConfirmation(null)}
        onConfirm={() => {
          if (!programConfirmation) {
            return
          }

          if (programConfirmation.type === 'activate') {
            const { id } = programConfirmation.template
            setProgramConfirmation(null)
            void programRepository.activateTemplate(id).then(() => {
              setMessage('Program activated.')
              reload()
            })
            return
          }

          const { id } = programConfirmation.template
          setProgramConfirmation(null)
          void programRepository.archiveProgramTemplate(id).then(() => {
            setMessage('Program archived.')
            reload()
          })
        }}
        title={
          programConfirmation?.type === 'archive'
            ? 'Archive program?'
            : 'Activate program?'
        }
      >
        <p>
          {programConfirmation?.type === 'archive'
            ? `Archive ${programConfirmation.template.name}. Completed workout history is preserved.`
            : `Activate ${programConfirmation?.template.name ?? 'this program'} as an independent current cycle.`}
        </p>
      </ModalConfirmationDialog>
    </PageContainer>
  )
}

function ProgramOverview({
  currentCycle,
  loadStatus,
  onCreateProgram,
  onEditCycle,
  onSelectDay,
}: {
  currentCycle: LoadState['currentCycle']
  loadStatus: LoadState['status']
  onCreateProgram: () => void
  onEditCycle: (cycleId: string) => void
  onSelectDay: (
    cycle: ActiveProgramCycle,
    day: ActiveCycleWorkoutDay,
    exercises: ActiveCycleWorkoutExercise[],
  ) => void
}) {
  return (
    <Card title="Current active cycle">
      {loadStatus === 'loading' ? <LoadingState label="Loading cycle" /> : null}
      {loadStatus === 'ready' && !currentCycle ? (
        <EmptyState
          title="No active cycle"
          message="Create or activate a program template to choose workout days manually."
          action={
            <PrimaryButton type="button" onClick={onCreateProgram}>
              Create program
            </PrimaryButton>
          }
        />
      ) : null}
      {loadStatus === 'ready' && currentCycle ? (
        <>
          <p className="metric-value metric-value-small">
            {currentCycle.cycle.name}
          </p>
          {currentCycle.cycle.notes ? (
            <p className="muted">{currentCycle.cycle.notes}</p>
          ) : null}
          <div className="button-row program-action-row">
            <SecondaryButton
              type="button"
              onClick={() => onEditCycle(currentCycle.cycle.id)}
            >
              Edit current cycle
            </SecondaryButton>
          </div>
          {currentCycle.days.length ? (
            <div className="program-day-grid" aria-label="Workout days">
              {currentCycle.days.map((day) => (
                <button
                  className="program-day-card"
                  key={day.id}
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
                    exercises
                  </small>
                </button>
              ))}
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

function ProgramLibrary({
  loadStatus,
  onActivate,
  onArchive,
  onClone,
  onCreateProgram,
  onEdit,
  templates,
}: {
  loadStatus: LoadState['status']
  onActivate: (template: ProgramTemplate) => void
  onArchive: (template: ProgramTemplate) => void
  onClone: (templateId: string) => void
  onCreateProgram: () => void
  onEdit: (templateId: string) => void
  templates: ProgramTemplate[]
}) {
  return (
    <>
      <SectionHeader
        title="Program library"
        action={
          <IconButton aria-label="Create program" onClick={onCreateProgram}>
            <Plus aria-hidden="true" size={20} />
          </IconButton>
        }
      />
      <Card>
        {loadStatus === 'loading' ? (
          <LoadingState label="Loading programs" />
        ) : null}
        {loadStatus === 'ready' && !templates.length ? (
          <EmptyState
            title="No program templates"
            message="Reusable templates stay separate from active cycles and workout history."
            action={
              <SecondaryButton type="button" onClick={onCreateProgram}>
                Create program
              </SecondaryButton>
            }
          />
        ) : null}
        {loadStatus === 'ready' && templates.length ? (
          <div className="program-library-list">
            {templates.map((template) => (
              <div className="program-template-row" key={template.id}>
                <div>
                  <strong>{template.name}</strong>
                  {template.notes ? <small>{template.notes}</small> : null}
                </div>
                <div className="row-actions">
                  <IconButton
                    aria-label={`Edit ${template.name}`}
                    onClick={() => onEdit(template.id)}
                  >
                    <Edit2 aria-hidden="true" size={18} />
                  </IconButton>
                  <IconButton
                    aria-label={`Activate ${template.name}`}
                    onClick={() => onActivate(template)}
                  >
                    <Dumbbell aria-hidden="true" size={18} />
                  </IconButton>
                  <IconButton
                    aria-label={`Clone ${template.name}`}
                    onClick={() => onClone(template.id)}
                  >
                    <Copy aria-hidden="true" size={18} />
                  </IconButton>
                  <IconButton
                    aria-label={`Archive ${template.name}`}
                    onClick={() => onArchive(template)}
                  >
                    <Archive aria-hidden="true" size={18} />
                  </IconButton>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </Card>
    </>
  )
}

function ProgramCreateSheet({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean
  onClose: () => void
  onCreated: (templateId: string) => void
}) {
  const [form, setForm] = useState(emptyProgramForm)
  const [error, setError] = useState<string | null>(null)
  const name = form.name.trim()

  function saveProgram() {
    if (!name) {
      setError('Program name is required.')
      return
    }

    void programRepository
      .createProgramTemplate({
        name,
        notes: form.notes.trim(),
        days: [],
      })
      .then((created) => onCreated(created.template.id))
      .catch((caught: unknown) => {
        setError(
          caught instanceof Error ? caught.message : 'Program could not save.',
        )
      })
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Create program">
      <FormField id="program-name" label="Name">
        <input
          id="program-name"
          onChange={(event) =>
            setForm((current) => ({ ...current, name: event.target.value }))
          }
          value={form.name}
        />
      </FormField>
      <FormField id="program-notes" label="Notes">
        <textarea
          id="program-notes"
          onChange={(event) =>
            setForm((current) => ({ ...current, notes: event.target.value }))
          }
          value={form.notes}
        />
      </FormField>
      {error ? <ValidationMessage message={error} /> : null}
      <PrimaryButton disabled={!name} type="button" onClick={saveProgram}>
        Save program
      </PrimaryButton>
    </BottomSheet>
  )
}

function ProgramBuilderSheet({
  exerciseUsage,
  exercises,
  isOpen,
  onChanged,
  onClose,
  target,
}: {
  exerciseUsage: ExerciseUsageSummary
  exercises: Exercise[]
  isOpen: boolean
  onChanged: () => void
  onClose: () => void
  target: ProgramSheetTarget
}) {
  const [structure, setStructure] = useState<{
    record: ProgramTemplate | ActiveProgramCycle
    days: Array<ProgramTemplateDay | ActiveCycleWorkoutDay>
    exercisesByDay: Record<
      string,
      Array<TemplateWorkoutExercise | ActiveCycleWorkoutExercise>
    >
  } | null>(null)
  const [nameForm, setNameForm] = useState(emptyProgramForm)
  const [dayName, setDayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [editingPrescription, setEditingPrescription] = useState<{
    dayId: string
    exercise: TemplateWorkoutExercise | ActiveCycleWorkoutExercise | null
  } | null>(null)
  const [removeConfirmation, setRemoveConfirmation] = useState<
    | { type: 'day'; id: string; name: string }
    | { type: 'exercise'; id: string; name: string }
    | null
  >(null)

  const mode: BuilderMode = target.mode

  useEffect(() => {
    let isCurrent = true

    if (target.mode === 'template') {
      void programRepository
        .getTemplateStructure(target.templateId)
        .then((loaded) => {
          if (!isCurrent) {
            return
          }
          setStructure({
            record: loaded.template,
            days: loaded.days,
            exercisesByDay: loaded.exercisesByDay,
          })
          setNameForm({
            name: loaded.template.name,
            notes: loaded.template.notes,
          })
        })
        .catch((caught: unknown) => {
          setError(
            caught instanceof Error
              ? caught.message
              : 'Program could not load.',
          )
        })
    } else {
      void programRepository
        .getActiveCycleStructure(target.cycleId)
        .then((loaded) => {
          if (!isCurrent) {
            return
          }
          setStructure({
            record: loaded.cycle,
            days: loaded.days,
            exercisesByDay: loaded.exercisesByDay,
          })
          setNameForm({ name: loaded.cycle.name, notes: loaded.cycle.notes })
        })
        .catch((caught: unknown) => {
          setError(
            caught instanceof Error
              ? caught.message
              : 'Program could not load.',
          )
        })
    }

    return () => {
      isCurrent = false
    }
  }, [target])

  function refresh() {
    if (target.mode === 'template') {
      void programRepository
        .getTemplateStructure(target.templateId)
        .then((loaded) => {
          const record = loaded.template
          setStructure({
            record,
            days: loaded.days,
            exercisesByDay: loaded.exercisesByDay,
          })
          setNameForm({ name: record.name, notes: record.notes })
          onChanged()
        })
    } else {
      void programRepository
        .getActiveCycleStructure(target.cycleId)
        .then((loaded) => {
          const record = loaded.cycle
          setStructure({
            record,
            days: loaded.days,
            exercisesByDay: loaded.exercisesByDay,
          })
          setNameForm({ name: record.name, notes: record.notes })
          onChanged()
        })
    }
  }

  function run(action: Promise<unknown>) {
    void action
      .then(() => {
        setError(null)
        refresh()
      })
      .catch((caught: unknown) => {
        setError(
          caught instanceof Error ? caught.message : 'Program change failed.',
        )
      })
  }

  function saveName() {
    if (!structure || !nameForm.name.trim()) {
      setError('Program name is required.')
      return
    }
    const input = { name: nameForm.name.trim(), notes: nameForm.notes.trim() }
    const action =
      mode === 'template'
        ? programRepository.updateProgramTemplate(structure.record.id, input)
        : programRepository.updateActiveCycle(structure.record.id, input)

    void action
      .then(() => {
        setError(null)
        onChanged()
        onClose()
      })
      .catch((caught: unknown) => {
        setError(
          caught instanceof Error ? caught.message : 'Program change failed.',
        )
      })
  }

  function removeConfirmed() {
    if (!removeConfirmation) {
      return
    }

    const target = removeConfirmation
    setRemoveConfirmation(null)
    if (target.type === 'day') {
      run(
        mode === 'template'
          ? programRepository.removeTemplateDay(target.id)
          : programRepository.removeActiveCycleDay(target.id),
      )
      return
    }

    run(
      mode === 'template'
        ? programRepository.removeTemplateExercise(target.id)
        : programRepository.removeActiveCycleExercise(target.id),
    )
  }

  function addDay() {
    if (!structure || !dayName.trim()) {
      setError('Workout day name is required.')
      return
    }
    run(
      mode === 'template'
        ? programRepository.addTemplateDay(structure.record.id, {
            name: dayName.trim(),
          })
        : programRepository.addActiveCycleDay(structure.record.id, {
            name: dayName.trim(),
          }),
    )
    setDayName('')
  }

  function moveDay(dayId: string, direction: -1 | 1) {
    if (!structure) {
      return
    }
    const currentIndex = structure.days.findIndex((day) => day.id === dayId)
    const nextIndex = currentIndex + direction
    if (
      currentIndex < 0 ||
      nextIndex < 0 ||
      nextIndex >= structure.days.length
    ) {
      return
    }
    const ordered = structure.days.map((day) => day.id)
    const [id] = ordered.splice(currentIndex, 1)
    ordered.splice(nextIndex, 0, id)
    run(
      mode === 'template'
        ? programRepository.reorderTemplateDays(structure.record.id, ordered)
        : programRepository.reorderActiveCycleDays(
            structure.record.id,
            ordered,
          ),
    )
  }

  function moveExercise(dayId: string, exerciseId: string, direction: -1 | 1) {
    const dayExercises = structure?.exercisesByDay[dayId] ?? []
    const currentIndex = dayExercises.findIndex(
      (exercise) => exercise.id === exerciseId,
    )
    const nextIndex = currentIndex + direction
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= dayExercises.length) {
      return
    }
    const ordered = dayExercises.map((exercise) => exercise.id)
    const [id] = ordered.splice(currentIndex, 1)
    ordered.splice(nextIndex, 0, id)
    run(
      mode === 'template'
        ? programRepository.reorderTemplateExercises(dayId, ordered)
        : programRepository.reorderActiveCycleExercises(dayId, ordered),
    )
  }

  return (
    <>
      <BottomSheet
        isOpen={isOpen}
        onClose={() => {
          if (editingPrescription) {
            setEditingPrescription(null)
            return
          }
          onClose()
        }}
        title={mode === 'template' ? 'Edit template' : 'Edit current cycle'}
      >
        {!structure ? <LoadingState label="Loading program" /> : null}
        {structure && editingPrescription ? (
          <PrescriptionEditor
            exerciseUsage={exerciseUsage}
            exercises={exercises}
            mode={mode}
            onClose={() => setEditingPrescription(null)}
            onSaved={() => {
              setEditingPrescription(null)
              refresh()
            }}
            onExerciseCreated={(exercise) => {
              exercises.push(exercise)
              onChanged()
            }}
            target={editingPrescription}
          />
        ) : null}
        {structure && !editingPrescription ? (
          <>
            <FormField id="builder-program-name" label="Name">
              <input
                id="builder-program-name"
                onChange={(event) =>
                  setNameForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                value={nameForm.name}
              />
            </FormField>
            <FormField id="builder-program-notes" label="Notes">
              <textarea
                id="builder-program-notes"
                onChange={(event) =>
                  setNameForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                value={nameForm.notes}
              />
            </FormField>
            <PrimaryButton type="button" onClick={saveName}>
              Save {mode === 'template' ? 'template' : 'cycle'}
            </PrimaryButton>

            <div className="program-builder-add">
              <FormField id="new-day-name" label="Add workout day">
                <input
                  id="new-day-name"
                  onChange={(event) => setDayName(event.target.value)}
                  placeholder="Upper, Lower, Day 1"
                  value={dayName}
                />
              </FormField>
              <SecondaryButton type="button" onClick={addDay}>
                Add day
              </SecondaryButton>
            </div>

            <div className="program-builder-days">
              {structure.days.map((day, dayIndex) => (
                <div className="program-builder-day" key={day.id}>
                  <div>
                    <strong>{day.name}</strong>
                    {day.notes ? <small>{day.notes}</small> : null}
                  </div>
                  <div className="button-row">
                    <SecondaryButton
                      type="button"
                      onClick={() => {
                        const name = window.prompt('Workout day name', day.name)
                        if (name?.trim()) {
                          run(
                            mode === 'template'
                              ? programRepository.updateTemplateDay(day.id, {
                                  name: name.trim(),
                                })
                              : programRepository.updateActiveCycleDay(day.id, {
                                  name: name.trim(),
                                }),
                          )
                        }
                      }}
                    >
                      Rename
                    </SecondaryButton>
                    <SecondaryButton
                      disabled={dayIndex === 0}
                      type="button"
                      onClick={() => moveDay(day.id, -1)}
                    >
                      Up
                    </SecondaryButton>
                    <SecondaryButton
                      disabled={dayIndex === structure.days.length - 1}
                      type="button"
                      onClick={() => moveDay(day.id, 1)}
                    >
                      Down
                    </SecondaryButton>
                    <SecondaryButton
                      type="button"
                      onClick={() =>
                        run(
                          mode === 'template'
                            ? programRepository.duplicateTemplateDay(day.id)
                            : programRepository.duplicateActiveCycleDay(day.id),
                        )
                      }
                    >
                      Duplicate
                    </SecondaryButton>
                    <SecondaryButton
                      className="button-danger"
                      type="button"
                      onClick={() =>
                        setRemoveConfirmation({
                          type: 'day',
                          id: day.id,
                          name: day.name,
                        })
                      }
                    >
                      <Trash2 aria-hidden="true" size={16} />
                      Remove
                    </SecondaryButton>
                  </div>

                  <div className="program-prescription-list">
                    {(structure.exercisesByDay[day.id] ?? []).map(
                      (prescribed, exerciseIndex, dayExercises) => (
                        <div
                          className="program-prescription-row"
                          key={prescribed.id}
                        >
                          <div>
                            <strong>
                              {prescribed.exerciseSnapshot.exerciseName}
                            </strong>
                            <small>{prescriptionSummary(prescribed)}</small>
                            {prescribed.notes ? (
                              <small>{prescribed.notes}</small>
                            ) : null}
                          </div>
                          <div className="row-actions">
                            <IconButton
                              aria-label={`Edit ${prescribed.exerciseSnapshot.exerciseName} prescription`}
                              onClick={() =>
                                setEditingPrescription({
                                  dayId: day.id,
                                  exercise: prescribed,
                                })
                              }
                            >
                              <Edit2 aria-hidden="true" size={18} />
                            </IconButton>
                            <IconButton
                              aria-label={`Move ${prescribed.exerciseSnapshot.exerciseName} up`}
                              disabled={exerciseIndex === 0}
                              onClick={() =>
                                moveExercise(day.id, prescribed.id, -1)
                              }
                            >
                              <RotateCcw aria-hidden="true" size={18} />
                            </IconButton>
                            <IconButton
                              aria-label={`Move ${prescribed.exerciseSnapshot.exerciseName} down`}
                              disabled={
                                exerciseIndex === dayExercises.length - 1
                              }
                              onClick={() =>
                                moveExercise(day.id, prescribed.id, 1)
                              }
                            >
                              <RotateCcw aria-hidden="true" size={18} />
                            </IconButton>
                            <IconButton
                              aria-label={`Remove ${prescribed.exerciseSnapshot.exerciseName} prescription`}
                              onClick={() =>
                                setRemoveConfirmation({
                                  type: 'exercise',
                                  id: prescribed.id,
                                  name: prescribed.exerciseSnapshot
                                    .exerciseName,
                                })
                              }
                            >
                              <Trash2 aria-hidden="true" size={18} />
                            </IconButton>
                          </div>
                        </div>
                      ),
                    )}
                    {!(structure.exercisesByDay[day.id] ?? []).length ? (
                      <p className="muted">No prescribed exercises.</p>
                    ) : null}
                  </div>
                  <SecondaryButton
                    type="button"
                    onClick={() =>
                      setEditingPrescription({ dayId: day.id, exercise: null })
                    }
                  >
                    Add exercise
                  </SecondaryButton>
                </div>
              ))}
            </div>
          </>
        ) : null}
        {error ? <ValidationMessage message={error} /> : null}
      </BottomSheet>
      <ModalConfirmationDialog
        confirmLabel="Remove"
        isOpen={removeConfirmation !== null}
        onCancel={() => setRemoveConfirmation(null)}
        onConfirm={removeConfirmed}
        title={
          removeConfirmation?.type === 'day'
            ? 'Remove workout day?'
            : 'Remove exercise?'
        }
      >
        <p>
          {removeConfirmation?.type === 'day'
            ? `Remove ${removeConfirmation.name} from this ${mode}.`
            : `Remove ${removeConfirmation?.name ?? 'this exercise'} from this workout day.`}
        </p>
      </ModalConfirmationDialog>
    </>
  )
}

function PrescriptionEditor({
  exercises,
  mode,
  onClose,
  onSaved,
  target,
}: {
  exercises: Exercise[]
  mode: BuilderMode
  onClose: () => void
  onSaved: () => void
  target: {
    dayId: string
    exercise: TemplateWorkoutExercise | ActiveCycleWorkoutExercise | null
  }
}) {
  const [form, setForm] = useState<PrescriptionFormState>(() =>
    target.exercise
      ? {
          exerciseId: target.exercise.exerciseId,
          targetSetCount: String(target.exercise.targetSetCount),
          targetRepsMin: target.exercise.targetRepsMin?.toString() ?? '',
          targetRepsMax: target.exercise.targetRepsMax?.toString() ?? '',
          targetRir: target.exercise.targetRir?.toString() ?? '',
          restSecondsOverride:
            target.exercise.restSecondsOverride?.toString() ?? '',
          notes: target.exercise.notes,
        }
      : {
          ...emptyPrescriptionForm,
          exerciseId: exercises[0]?.id ?? '',
        },
  )
  const [error, setError] = useState<string | null>(null)
  const parsed = parsePrescriptionForm(form)

  function update(field: keyof PrescriptionFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function save() {
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }
    const action = target.exercise
      ? mode === 'template'
        ? programRepository.updateTemplateExercise(
            target.exercise.id,
            parsed.value,
          )
        : programRepository.updateActiveCycleExercise(
            target.exercise.id,
            parsed.value,
          )
      : mode === 'template'
        ? programRepository.addTemplateExercise(target.dayId, parsed.value)
        : programRepository.addActiveCycleExercise(target.dayId, parsed.value)

    void action.then(onSaved).catch((caught: unknown) => {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Prescription could not save.',
      )
    })
  }

  return (
    <div className="inline-editor" aria-label="Prescription editor">
      <FormField id="prescription-exercise" label="Exercise">
        <select
          id="prescription-exercise"
          onChange={(event) => update('exerciseId', event.target.value)}
          value={form.exerciseId}
        >
          <option value="">Select exercise</option>
          {exercises.map((exercise) => (
            <option key={exercise.id} value={exercise.id}>
              {exercise.name}
            </option>
          ))}
        </select>
      </FormField>
      <div className="compact-field-grid">
        <FormField id="target-sets" label="Target sets">
          <NumericInput
            id="target-sets"
            onChange={(event) => update('targetSetCount', event.target.value)}
            value={form.targetSetCount}
          />
        </FormField>
        <FormField id="target-reps-min" label="Reps min">
          <NumericInput
            id="target-reps-min"
            onChange={(event) => update('targetRepsMin', event.target.value)}
            value={form.targetRepsMin}
          />
        </FormField>
        <FormField id="target-reps-max" label="Reps max">
          <NumericInput
            id="target-reps-max"
            onChange={(event) => update('targetRepsMax', event.target.value)}
            value={form.targetRepsMax}
          />
        </FormField>
        <FormField id="target-rir" label="RIR">
          <NumericInput
            id="target-rir"
            onChange={(event) => update('targetRir', event.target.value)}
            value={form.targetRir}
          />
        </FormField>
        <FormField id="rest-override" label="Rest override">
          <NumericInput
            id="rest-override"
            onChange={(event) =>
              update('restSecondsOverride', event.target.value)
            }
            value={form.restSecondsOverride}
          />
        </FormField>
      </div>
      <FormField id="prescription-notes" label="Notes">
        <textarea
          id="prescription-notes"
          onChange={(event) => update('notes', event.target.value)}
          value={form.notes}
        />
      </FormField>
      {error ? <ValidationMessage message={error} /> : null}
      <div className="button-row">
        <PrimaryButton disabled={!parsed.ok} type="button" onClick={save}>
          Save prescription
        </PrimaryButton>
        <SecondaryButton type="button" onClick={onClose}>
          Cancel
        </SecondaryButton>
      </div>
    </div>
  )
}

function WorkoutDayDetailSheet({
  isOpen,
  onClose,
  onStarted,
  selectedDay,
}: {
  isOpen: boolean
  onClose: () => void
  onStarted: () => void
  selectedDay: NonNullable<SelectedDay>
}) {
  const [error, setError] = useState<string | null>(null)
  const [existingWorkoutId, setExistingWorkoutId] = useState<string | null>(
    null,
  )
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false)

  function startWorkout() {
    void workoutRepository
      .startWorkout({
        activeCycleId: selectedDay.cycle.id,
        dayId: selectedDay.day.id,
        localDate: formatLocalDate(new Date()),
      })
      .then(onStarted)
      .catch((caught: unknown) => {
        const message =
          caught instanceof Error ? caught.message : 'Workout could not start.'
        setError(message)
        if (message.includes('active workout')) {
          void workoutRepository.getActiveWorkout().then((workout) => {
            setExistingWorkoutId(workout?.id ?? null)
          })
        }
      })
  }

  function cancelCurrentWorkout() {
    if (!existingWorkoutId) {
      return
    }
    void workoutRepository
      .cancelWorkout(existingWorkoutId)
      .then(() => {
        setIsCancelConfirmOpen(false)
        setExistingWorkoutId(null)
        setError(null)
        startWorkout()
      })
      .catch((caught: unknown) => {
        setError(
          caught instanceof Error
            ? caught.message
            : 'Current workout could not be cancelled.',
        )
      })
  }

  return (
    <>
      <BottomSheet
        isOpen={isOpen}
        onClose={onClose}
        title={selectedDay.day.name}
      >
        <p className="sheet-context">
          {selectedDay.cycle.name} stays on this day until you choose another
          one.
        </p>
        {selectedDay.day.notes ? (
          <p className="muted">{selectedDay.day.notes}</p>
        ) : null}
        {selectedDay.exercises.length ? (
          <div className="program-prescription-list">
            {selectedDay.exercises.map((exercise) => (
              <div className="program-prescription-row" key={exercise.id}>
                <div>
                  <strong>{exercise.exerciseSnapshot.exerciseName}</strong>
                  <small>{prescriptionSummary(exercise)}</small>
                  {exercise.notes ? <small>{exercise.notes}</small> : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No prescribed exercises"
            message="Edit the current cycle to add exercises before starting a workout."
          />
        )}
        {error ? <ValidationMessage message={error} /> : null}
        {existingWorkoutId ? (
          <div className="button-row">
            <PrimaryButton type="button" onClick={onStarted}>
              Resume
            </PrimaryButton>
            <SecondaryButton
              className="button-danger"
              type="button"
              onClick={() => setIsCancelConfirmOpen(true)}
            >
              Cancel Current Workout
            </SecondaryButton>
          </div>
        ) : (
          <PrimaryButton
            disabled={!selectedDay.exercises.length}
            type="button"
            onClick={startWorkout}
          >
            Start Workout
          </PrimaryButton>
        )}
      </BottomSheet>
      <ModalConfirmationDialog
        confirmLabel="Cancel current workout"
        isOpen={isCancelConfirmOpen}
        onCancel={() => setIsCancelConfirmOpen(false)}
        onConfirm={cancelCurrentWorkout}
        title="Cancel current workout?"
      >
        <p>
          This discards the active workout so the selected day can start. No
          completed workout history is removed.
        </p>
      </ModalConfirmationDialog>
    </>
  )
}

function ExerciseLibraryCard({
  exercises,
  loadStatus,
  onCreateExercise,
  onEditExercise,
  onHideExercise,
  onRestoreExercise,
  query,
  setQuery,
  setView,
  view,
}: {
  exercises: Exercise[]
  loadStatus: LoadState['status']
  onCreateExercise: () => void
  onEditExercise: (exercise: Exercise) => void
  onHideExercise: (exercise: Exercise) => void
  onRestoreExercise: (exercise: Exercise) => void
  query: string
  setQuery: (query: string) => void
  setView: (view: ExerciseView) => void
  view: ExerciseView
}) {
  return (
    <Card title={view === 'active' ? 'Active exercises' : 'Hidden exercises'}>
      <div className="button-row library-filter-row" role="group">
        <SecondaryButton
          aria-pressed={view === 'active'}
          type="button"
          onClick={() => setView('active')}
        >
          Active
        </SecondaryButton>
        <SecondaryButton
          aria-pressed={view === 'hidden'}
          type="button"
          onClick={() => setView('hidden')}
        >
          Hidden
        </SecondaryButton>
      </div>

      <FormField id="exercise-search" label="Search exercises">
        <div className="input-icon-row">
          <Search aria-hidden="true" size={18} />
          <input
            id="exercise-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your exercises"
            type="search"
            value={query}
          />
        </div>
      </FormField>

      {loadStatus === 'loading' ? (
        <LoadingState label="Loading exercises" />
      ) : null}
      {loadStatus === 'error' ? (
        <StatusMessage tone="warning">
          Exercise library could not load.
        </StatusMessage>
      ) : null}

      {loadStatus === 'ready' && exercises.length ? (
        <div className="exercise-list">
          {exercises.map((exercise) => (
            <ExerciseLibraryRow
              exercise={exercise}
              key={exercise.id}
              onEdit={() => onEditExercise(exercise)}
              onHide={() => onHideExercise(exercise)}
              onRestore={() => onRestoreExercise(exercise)}
            />
          ))}
        </div>
      ) : null}

      {loadStatus === 'ready' && !exercises.length ? (
        <EmptyState
          title={
            query.trim()
              ? 'No exercises found'
              : view === 'active'
                ? 'No exercises yet'
                : 'No hidden exercises'
          }
          message={
            view === 'active'
              ? 'Create a custom exercise to use in programs and workouts.'
              : 'Hidden custom exercises stay available for restore when needed.'
          }
          action={
            view === 'active' ? (
              <SecondaryButton type="button" onClick={onCreateExercise}>
                Create exercise
              </SecondaryButton>
            ) : undefined
          }
        />
      ) : null}
    </Card>
  )
}

function ExerciseLibraryRow({
  exercise,
  onEdit,
  onHide,
  onRestore,
}: {
  exercise: Exercise
  onEdit: () => void
  onHide: () => void
  onRestore: () => void
}) {
  const trackingMethod = getTrackingMethod(exercise.trackingMethodId)

  return (
    <div className="exercise-item">
      <span className="quick-action-icon">
        <Dumbbell aria-hidden="true" size={18} />
      </span>
      <div>
        <strong>{exercise.name}</strong>
        <small>
          {trackingMethod?.name ?? exercise.trackingMethodId} -{' '}
          {exercise.defaultRestSeconds}s rest -{' '}
          {exercise.origin === 'built_in' ? 'Built-in' : 'Custom'}
        </small>
        <small>{metricSummary(exercise)}</small>
        {exercise.notes ? <small>{exercise.notes}</small> : null}
      </div>
      <div className="row-actions">
        {exercise.status === 'archived' ? (
          <IconButton
            aria-label={`Restore ${exercise.name}`}
            onClick={onRestore}
          >
            <RotateCcw aria-hidden="true" size={18} />
          </IconButton>
        ) : null}
        {exercise.status === 'hidden' ? (
          <IconButton
            aria-label={`Restore ${exercise.name}`}
            onClick={onRestore}
          >
            <RotateCcw aria-hidden="true" size={18} />
          </IconButton>
        ) : null}
        {exercise.origin === 'custom' && exercise.status === 'active' ? (
          <>
            <IconButton aria-label={`Hide ${exercise.name}`} onClick={onHide}>
              <EyeOff aria-hidden="true" size={18} />
            </IconButton>
            <IconButton aria-label={`Edit ${exercise.name}`} onClick={onEdit}>
              <Edit2 aria-hidden="true" size={18} />
            </IconButton>
          </>
        ) : null}
      </div>
    </div>
  )
}

function ExerciseFormSheet({
  exercise,
  isOpen,
  onClose,
  onSaved,
}: {
  exercise: Exercise | null
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState(() =>
    exercise
      ? {
          name: exercise.name,
          notes: exercise.notes,
          restMinutes: String(Math.floor(exercise.defaultRestSeconds / 60)),
          restSeconds: String(exercise.defaultRestSeconds % 60),
          trackingMethodId: exercise.trackingMethodId,
        }
      : emptyExerciseForm,
  )
  const [error, setError] = useState<string | null>(null)
  const [duplicates, setDuplicates] = useState<Exercise[]>([])
  const parsed = useMemo(() => parseExerciseForm(form), [form])
  const selectedTrackingMethod = getTrackingMethod(form.trackingMethodId)

  useEffect(() => {
    let isCurrent = true

    void exerciseRepository
      .findSimilarExerciseNames(form.name, exercise?.id)
      .then((matches) => {
        if (isCurrent) {
          setDuplicates(matches)
        }
      })

    return () => {
      isCurrent = false
    }
  }, [exercise?.id, form.name])

  function update(field: keyof typeof emptyExerciseForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function normalizeRestDuration() {
    const restMinutes = Number(form.restMinutes)
    const restSeconds = Number(form.restSeconds)
    if (
      !Number.isInteger(restMinutes) ||
      restMinutes < 0 ||
      !Number.isInteger(restSeconds) ||
      restSeconds < 0
    ) {
      return
    }

    const totalSeconds = restMinutes * 60 + restSeconds
    setForm((current) => ({
      ...current,
      restMinutes: String(Math.floor(totalSeconds / 60)),
      restSeconds: String(totalSeconds % 60),
    }))
  }

  function saveExercise() {
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }

    const action = exercise
      ? exerciseRepository.updateExercise(exercise.id, parsed.value)
      : exerciseRepository.createExercise(parsed.value)

    void action.then(onSaved).catch((caught: unknown) => {
      setError(
        caught instanceof Error ? caught.message : 'Exercise could not save.',
      )
    })
  }

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={exercise ? 'Edit exercise' : 'Create exercise'}
    >
      <FormField id="exercise-name" label="Name">
        <input
          id="exercise-name"
          onChange={(event) => update('name', event.target.value)}
          value={form.name}
        />
      </FormField>
      {duplicates.length ? (
        <StatusMessage tone="warning">
          Similar exercise name already exists. You can still save this exercise
          if it is intentional.
        </StatusMessage>
      ) : null}
      <div className="compact-field-grid">
        <FormField id="exercise-rest-minutes" label="Rest minutes">
          <NumericInput
            id="exercise-rest-minutes"
            onBlur={normalizeRestDuration}
            onChange={(event) => update('restMinutes', event.target.value)}
            pattern="[0-9]*"
            value={form.restMinutes}
          />
        </FormField>
        <FormField id="exercise-rest-seconds" label="Rest seconds">
          <NumericInput
            id="exercise-rest-seconds"
            onBlur={normalizeRestDuration}
            onChange={(event) => update('restSeconds', event.target.value)}
            pattern="[0-9]*"
            value={form.restSeconds}
          />
        </FormField>
      </div>
      <FormField id="tracking-method" label="Tracking preset">
        <select
          id="tracking-method"
          onChange={(event) => {
            const trackingMethodId = parseTrackingMethodId(event.target.value)
            if (trackingMethodId) {
              update('trackingMethodId', trackingMethodId)
            }
          }}
          value={form.trackingMethodId}
        >
          {TRACKING_METHODS.map((method) => (
            <option key={method.id} value={method.id}>
              {method.name}
            </option>
          ))}
        </select>
      </FormField>
      {selectedTrackingMethod ? (
        <div className="tracking-method-panel">
          <p>{selectedTrackingMethod.explanation}</p>
          <div className="macro-row">
            {selectedTrackingMethod.metrics.map((metric) => (
              <span key={metric.key}>
                {metric.label}
                {metric.unit ? ` (${metric.unit})` : ''}
              </span>
            ))}
            <span>RIR</span>
            <span>Completed</span>
          </div>
        </div>
      ) : null}
      <FormField id="exercise-notes" label="Notes">
        <textarea
          id="exercise-notes"
          onChange={(event) => update('notes', event.target.value)}
          value={form.notes}
        />
      </FormField>
      {exercise ? (
        <p className="muted">
          Created {formatTimestamp(exercise.createdAt)} - Updated{' '}
          {formatTimestamp(exercise.updatedAt)} - {exercise.status}
        </p>
      ) : null}
      {error ? <ValidationMessage message={error} /> : null}
      <div className="button-row">
        <PrimaryButton
          disabled={!parsed.ok}
          type="button"
          onClick={saveExercise}
        >
          Save exercise
        </PrimaryButton>
      </div>
    </BottomSheet>
  )
}

function parseExerciseForm(
  form: ExerciseFormState,
): { ok: true; value: CreateExerciseInput } | { ok: false; error: string } {
  const name = form.name.trim()
  const restMinutes = Number(form.restMinutes)
  const restSeconds = Number(form.restSeconds)
  const trackingMethod = getTrackingMethod(form.trackingMethodId)

  if (!name) {
    return { ok: false, error: 'Exercise name is required.' }
  }

  if (
    !Number.isFinite(restMinutes) ||
    !Number.isInteger(restMinutes) ||
    restMinutes < 0 ||
    !Number.isFinite(restSeconds) ||
    !Number.isInteger(restSeconds) ||
    restSeconds < 0
  ) {
    return {
      ok: false,
      error: 'Default rest time must use whole minutes and seconds.',
    }
  }

  if (!trackingMethod) {
    return { ok: false, error: 'Tracking preset is required.' }
  }

  return {
    ok: true,
    value: {
      name,
      notes: form.notes.trim(),
      defaultRestSeconds: restMinutes * 60 + restSeconds,
      trackingMethodId: trackingMethod.id,
    },
  }
}

function parsePrescriptionForm(
  form: PrescriptionFormState,
):
  | { ok: true; value: CreateTemplateExerciseInput }
  | { ok: false; error: string } {
  const targetSetCount = Number(form.targetSetCount)
  const targetRepsMin = parseOptionalInteger(form.targetRepsMin)
  const targetRepsMax = parseOptionalInteger(form.targetRepsMax)
  const targetRir = parseOptionalInteger(form.targetRir)
  const restSecondsOverride = parseOptionalInteger(form.restSecondsOverride)

  if (!form.exerciseId) {
    return { ok: false, error: 'Exercise selection is required.' }
  }

  if (
    !Number.isInteger(targetSetCount) ||
    targetSetCount <= 0 ||
    targetSetCount > 99
  ) {
    return { ok: false, error: 'Target sets must be a positive whole number.' }
  }

  for (const parsed of [
    targetRepsMin,
    targetRepsMax,
    targetRir,
    restSecondsOverride,
  ]) {
    if (!parsed.ok) {
      return { ok: false, error: 'Optional targets must be whole numbers.' }
    }
  }

  if (
    targetRepsMin.ok &&
    targetRepsMax.ok &&
    targetRepsMin.value !== null &&
    targetRepsMax.value !== null &&
    targetRepsMin.value > targetRepsMax.value
  ) {
    return { ok: false, error: 'Rep minimum cannot exceed rep maximum.' }
  }

  return {
    ok: true,
    value: {
      exerciseId: form.exerciseId,
      targetSetCount,
      targetRepsMin: targetRepsMin.value,
      targetRepsMax: targetRepsMax.value,
      targetRir: targetRir.value,
      restSecondsOverride: restSecondsOverride.value,
      notes: form.notes.trim(),
    },
  }
}

function parseOptionalInteger(value: string) {
  if (!value.trim()) {
    return { ok: true, value: null } as const
  }

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) {
    return { ok: false } as const
  }

  return { ok: true, value: parsed } as const
}

function prescriptionSummary(
  prescribed: TemplateWorkoutExercise | ActiveCycleWorkoutExercise,
) {
  const parts = [`${prescribed.targetSetCount} sets`]
  if (
    prescribed.targetRepsMin !== null &&
    prescribed.targetRepsMax !== null &&
    prescribed.targetRepsMin !== prescribed.targetRepsMax
  ) {
    parts.push(`${prescribed.targetRepsMin}-${prescribed.targetRepsMax} reps`)
  } else if (prescribed.targetRepsMin !== null) {
    parts.push(`${prescribed.targetRepsMin} reps`)
  } else if (prescribed.targetRepsMax !== null) {
    parts.push(`${prescribed.targetRepsMax} reps`)
  }
  if (prescribed.targetRir !== null) {
    parts.push(`${prescribed.targetRir} RIR`)
  }
  if (prescribed.restSecondsOverride !== null) {
    parts.push(`${prescribed.restSecondsOverride}s rest`)
  }
  return parts.join(' - ')
}

function parseTrackingMethodId(value: string) {
  return TRACKING_METHODS.find((method) => method.id === value)?.id ?? null
}

function metricSummary(exercise: Exercise) {
  const metricLabels = exercise.trackingMetrics.map((metric) => metric.label)
  return [...metricLabels, 'RIR', 'Completed'].join(' - ')
}

function formatTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp))
}
