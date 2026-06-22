import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Copy,
  Dumbbell,
  Edit2,
  EyeOff,
  Filter,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
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
  filterExerciseLibrary,
  hasSearchableQuery,
  primaryMuscleLabel,
  searchExercises,
  type ExerciseTrackingCategory,
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
import { runRepository } from '@repositories/runRepository'
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
  MuscleGroup,
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
  | { type: 'deactivate'; cycle: ActiveProgramCycle }
  | { type: 'delete-first'; template: ProgramTemplate }
  | { type: 'delete-final'; template: ProgramTemplate }
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
  const [isLibraryExpanded, setIsLibraryExpanded] = useState(false)
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false)
  const [isProgramLibraryExpanded, setIsProgramLibraryExpanded] =
    useState(false)
  const [programSearchQuery, setProgramSearchQuery] = useState('')
  const [trackingCategory, setTrackingCategory] =
    useState<ExerciseTrackingCategory>('all')
  const [primaryMuscle, setPrimaryMuscle] = useState<MuscleGroup | 'all'>('all')
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

    void exerciseRepository.seedBuiltInExercises().finally(() => {
      if (isCurrent) {
        reload()
      }
    })

    return () => {
      isCurrent = false
    }
  }, [])

  useEffect(() => {
    let isCurrent = true

    void Promise.all([
      exerciseRepository.searchExercises({
        includeArchived: view === 'hidden',
        query,
      }),
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
        onDeactivate={(cycle) =>
          setProgramConfirmation({ type: 'deactivate', cycle })
        }
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
        onClone={(templateId) => {
          void programRepository.cloneProgramTemplate(templateId).then(() => {
            setMessage('Program cloned.')
            reload()
          })
        }}
        onCreateProgram={() => setSheet({ type: 'createProgram' })}
        onDelete={(template) =>
          setProgramConfirmation({ type: 'delete-first', template })
        }
        onEdit={(templateId) =>
          setSheet({
            type: 'builder',
            target: { mode: 'template', templateId },
          })
        }
        isExpanded={isProgramLibraryExpanded}
        onToggleExpanded={() =>
          setIsProgramLibraryExpanded((current) => !current)
        }
        query={programSearchQuery}
        setQuery={setProgramSearchQuery}
        templates={loadState.templates.filter(
          (template) =>
            template.id !== loadState.currentCycle?.cycle.sourceTemplateId,
        )}
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
        isExpanded={isLibraryExpanded}
        isFilterPanelOpen={isFilterPanelOpen}
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
        onToggleExpanded={() => {
          setIsLibraryExpanded((current) => {
            const next = !current
            if (!next) {
              setQuery('')
              setTrackingCategory('all')
              setPrimaryMuscle('all')
              setIsFilterPanelOpen(false)
            }
            return next
          })
        }}
        primaryMuscle={primaryMuscle}
        query={query}
        setFilterPanelOpen={setIsFilterPanelOpen}
        setPrimaryMuscle={setPrimaryMuscle}
        setQuery={setQuery}
        setTrackingCategory={(value) => {
          setTrackingCategory(value)
          if (value !== 'strength') {
            setPrimaryMuscle('all')
          }
        }}
        setView={setView}
        trackingCategory={trackingCategory}
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
          programConfirmation?.type === 'delete-first'
            ? 'Remove'
            : programConfirmation?.type === 'delete-final'
              ? 'Permanently Delete'
              : programConfirmation?.type === 'deactivate'
                ? 'Deactivate'
                : 'Activate'
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
            void programRepository.activateTemplate(id).then((activated) => {
              setLoadState((current) => ({
                ...current,
                currentCycle: {
                  cycle: activated.cycle,
                  days: activated.days,
                  exercisesByDay: groupActiveExercisesByDay(
                    activated.days,
                    activated.exercises,
                  ),
                },
                status: 'ready',
              }))
              setMessage('Program activated.')
              reload()
            })
            return
          }

          if (programConfirmation.type === 'deactivate') {
            const { id } = programConfirmation.cycle
            setProgramConfirmation(null)
            void programRepository.deactivateActiveCycle(id).then(() => {
              setLoadState((current) => ({
                ...current,
                currentCycle: undefined,
                status: 'ready',
              }))
              setMessage('Active program deactivated.')
              reload()
            })
            return
          }

          if (programConfirmation.type === 'delete-first') {
            setProgramConfirmation({
              type: 'delete-final',
              template: programConfirmation.template,
            })
            return
          }

          if (programConfirmation.type === 'delete-final') {
            const { id } = programConfirmation.template
            setProgramConfirmation(null)
            void programRepository.deleteProgramTemplate(id).then(() => {
              setMessage('Program permanently deleted.')
              reload()
            })
          }
        }}
        title={
          programConfirmation?.type === 'delete-first'
            ? 'Remove program?'
            : programConfirmation?.type === 'delete-final'
              ? 'Permanently delete program?'
              : programConfirmation?.type === 'deactivate'
                ? 'Deactivate active program?'
                : 'Activate program?'
        }
      >
        <p>
          {programConfirmation?.type === 'delete-first'
            ? `Remove ${programConfirmation.template.name} from the Program Library?`
            : programConfirmation?.type === 'delete-final'
              ? `${programConfirmation.template.name} will be permanently deleted. Completed workout history, historical program names, and historical day names are preserved.`
              : programConfirmation?.type === 'deactivate'
                ? `${programConfirmation.cycle.name} will move back to the Program Library. Completed workout history is preserved.`
                : `Activate ${programConfirmation?.template.name ?? 'this program'} as the active program. The current active program will become inactive and return to the Program Library.`}
        </p>
      </ModalConfirmationDialog>
    </PageContainer>
  )
}

function groupActiveExercisesByDay(
  days: ActiveCycleWorkoutDay[],
  exercises: ActiveCycleWorkoutExercise[],
) {
  return Object.fromEntries(
    days.map((day) => [
      day.id,
      exercises
        .filter((exercise) => exercise.dayId === day.id)
        .sort((first, second) => first.orderIndex - second.orderIndex),
    ]),
  )
}

function ProgramOverview({
  currentCycle,
  loadStatus,
  onCreateProgram,
  onDeactivate,
  onEditCycle,
  onSelectDay,
}: {
  currentCycle: LoadState['currentCycle']
  loadStatus: LoadState['status']
  onCreateProgram: () => void
  onDeactivate: (cycle: ActiveProgramCycle) => void
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
              aria-label="Edit current cycle"
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
  isExpanded,
  loadStatus,
  onActivate,
  onClone,
  onCreateProgram,
  onDelete,
  onEdit,
  onToggleExpanded,
  query,
  setQuery,
  templates,
}: {
  isExpanded: boolean
  loadStatus: LoadState['status']
  onActivate: (template: ProgramTemplate) => void
  onClone: (templateId: string) => void
  onCreateProgram: () => void
  onDelete: (template: ProgramTemplate) => void
  onEdit: (templateId: string) => void
  onToggleExpanded: () => void
  query: string
  setQuery: (query: string) => void
  templates: ProgramTemplate[]
}) {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filteredTemplates = normalizedQuery
    ? templates.filter((template) =>
        template.name.toLocaleLowerCase().includes(normalizedQuery),
      )
    : templates
  const visibleTemplates = isExpanded
    ? filteredTemplates
    : filteredTemplates.slice(0, 3)

  return (
    <>
      <SectionHeader
        title={isExpanded ? 'Full Program Library' : 'Program library'}
        action={
          <IconButton aria-label="Create program" onClick={onCreateProgram}>
            <Plus aria-hidden="true" size={20} />
          </IconButton>
        }
      />
      <Card>
        {isExpanded ? (
          <FormField id="program-library-search" label="Search programs">
            <div className="input-icon-row">
              <Search aria-hidden="true" size={18} />
              <input
                id="program-library-search"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search programs"
                type="search"
                value={query}
              />
            </div>
          </FormField>
        ) : null}
        {loadStatus === 'loading' ? (
          <LoadingState label="Loading programs" />
        ) : null}
        {loadStatus === 'ready' && !filteredTemplates.length ? (
          <EmptyState
            title={query.trim() ? 'No programs found' : 'No inactive programs'}
            message="Inactive programs appear here. The active program stays in the Active Program area."
            action={
              <SecondaryButton type="button" onClick={onCreateProgram}>
                Create program
              </SecondaryButton>
            }
          />
        ) : null}
        {loadStatus === 'ready' && filteredTemplates.length ? (
          <div className="program-library-list">
            {visibleTemplates.map((template) => (
              <div className="program-template-row" key={template.id}>
                <div>
                  <strong>{template.name}</strong>
                  <small>
                    {template.lastActiveAt
                      ? `Last active ${formatTimestamp(template.lastActiveAt)}`
                      : `Created ${formatTimestamp(template.createdAt)}`}
                  </small>
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
                    aria-label={`Delete ${template.name}`}
                    onClick={() => onDelete(template)}
                  >
                    <Trash2 aria-hidden="true" size={18} />
                  </IconButton>
                </div>
              </div>
            ))}
            {!isExpanded && templates.length > 3 ? (
              <SecondaryButton type="button" onClick={onToggleExpanded}>
                Show More
              </SecondaryButton>
            ) : null}
            {isExpanded ? (
              <SecondaryButton type="button" onClick={onToggleExpanded}>
                Show Less
              </SecondaryButton>
            ) : null}
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
  const [mergeSelection, setMergeSelection] = useState({
    sourceDayId: '',
    destinationDayId: '',
  })
  const [mergeConfirmation, setMergeConfirmation] = useState<{
    sourceDayId: string
    destinationDayId: string
  } | null>(null)
  const [selectedDayId, setSelectedDayId] = useState('')
  const [draggedDayId, setDraggedDayId] = useState<string | null>(null)

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
          setSelectedDayId((current) => current || loaded.days[0]?.id || '')
          setNameForm({
            name: loaded.template.name,
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
          setSelectedDayId((current) => current || loaded.days[0]?.id || '')
          setNameForm({ name: loaded.cycle.name })
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

  const selectedDay =
    structure?.days.find((day) => day.id === selectedDayId) ??
    structure?.days[0] ??
    null
  const selectedDayIndex =
    structure && selectedDay
      ? structure.days.findIndex((day) => day.id === selectedDay.id)
      : -1
  const daySwipe = useProgramDaySwipe({
    onNext: () => switchDayByOffset(1),
    onPrevious: () => switchDayByOffset(-1),
  })

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
          setSelectedDayId((current) =>
            loaded.days.some((day) => day.id === current)
              ? current
              : loaded.days[0]?.id || '',
          )
          setNameForm({ name: record.name })
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
          setSelectedDayId((current) =>
            loaded.days.some((day) => day.id === current)
              ? current
              : loaded.days[0]?.id || '',
          )
          setNameForm({ name: record.name })
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

  function saveName({ closeAfterSave = false } = {}) {
    if (!structure || !nameForm.name.trim()) {
      setError('Program name is required.')
      return
    }
    if (nameForm.name.trim() === structure.record.name) {
      return
    }
    const input = { name: nameForm.name.trim() }
    const action =
      mode === 'template'
        ? programRepository.updateProgramTemplate(structure.record.id, input)
        : programRepository.updateActiveCycle(structure.record.id, input)

    void action
      .then(() => {
        setError(null)
        onChanged()
        if (closeAfterSave) {
          onClose()
        } else {
          refresh()
        }
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

  function selectDay(dayId: string) {
    saveName()
    setSelectedDayId(dayId)
  }

  function switchDayByOffset(offset: -1 | 1) {
    if (!structure || selectedDayIndex < 0) {
      return
    }
    const nextIndex = selectedDayIndex + offset
    if (nextIndex < 0 || nextIndex >= structure.days.length) {
      return
    }
    selectDay(structure.days[nextIndex].id)
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

  function reorderDayByDrag(destinationDayId: string) {
    if (!structure || !draggedDayId || draggedDayId === destinationDayId) {
      setDraggedDayId(null)
      return
    }
    const ordered = structure.days.map((day) => day.id)
    const fromIndex = ordered.indexOf(draggedDayId)
    const toIndex = ordered.indexOf(destinationDayId)
    if (fromIndex < 0 || toIndex < 0) {
      setDraggedDayId(null)
      return
    }
    const [id] = ordered.splice(fromIndex, 1)
    ordered.splice(toIndex, 0, id)
    setDraggedDayId(null)
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
    if (currentIndex < 0 || dayExercises.length < 2) {
      return
    }
    const nextIndex =
      (currentIndex + direction + dayExercises.length) % dayExercises.length
    const ordered = dayExercises.map((exercise) => exercise.id)
    const [id] = ordered.splice(currentIndex, 1)
    ordered.splice(nextIndex, 0, id)
    run(
      mode === 'template'
        ? programRepository.reorderTemplateExercises(dayId, ordered)
        : programRepository.reorderActiveCycleExercises(dayId, ordered),
    )
  }

  function confirmMergeDays() {
    if (!mergeSelection.sourceDayId || !mergeSelection.destinationDayId) {
      setError('Choose source and destination days to merge.')
      return
    }
    if (mergeSelection.sourceDayId === mergeSelection.destinationDayId) {
      setError('Source and destination days must be different.')
      return
    }
    setMergeConfirmation(mergeSelection)
  }

  function mergeDaysConfirmed() {
    if (!mergeConfirmation) {
      return
    }
    const target = mergeConfirmation
    setMergeConfirmation(null)
    run(
      mode === 'template'
        ? programRepository.mergeTemplateDays(
            target.sourceDayId,
            target.destinationDayId,
          )
        : programRepository.mergeActiveCycleDays(
            target.sourceDayId,
            target.destinationDayId,
          ),
    )
    setMergeSelection({ sourceDayId: '', destinationDayId: '' })
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
            target={editingPrescription}
          />
        ) : null}
        {structure && !editingPrescription ? (
          <>
            <FormField id="builder-program-name" label="Name">
              <input
                id="builder-program-name"
                onBlur={() => saveName()}
                onChange={(event) =>
                  setNameForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                value={nameForm.name}
              />
            </FormField>

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

            {structure.days.length > 1 ? (
              <div className="program-builder-merge">
                <FormField id="merge-source-day" label="Source day">
                  <select
                    id="merge-source-day"
                    onChange={(event) =>
                      setMergeSelection((current) => ({
                        ...current,
                        sourceDayId: event.target.value,
                      }))
                    }
                    value={mergeSelection.sourceDayId}
                  >
                    <option value="">Choose source</option>
                    {structure.days.map((day) => (
                      <option key={day.id} value={day.id}>
                        {day.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField id="merge-destination-day" label="Destination day">
                  <select
                    id="merge-destination-day"
                    onChange={(event) =>
                      setMergeSelection((current) => ({
                        ...current,
                        destinationDayId: event.target.value,
                      }))
                    }
                    value={mergeSelection.destinationDayId}
                  >
                    <option value="">Choose destination</option>
                    {structure.days.map((day) => (
                      <option key={day.id} value={day.id}>
                        {day.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <SecondaryButton type="button" onClick={confirmMergeDays}>
                  Merge Days
                </SecondaryButton>
              </div>
            ) : null}

            {structure.days.length ? (
              <div className="program-day-tabs" aria-label="Program days">
                {structure.days.map((day) => (
                  <button
                    aria-current={day.id === selectedDay?.id}
                    draggable
                    key={day.id}
                    onClick={() => selectDay(day.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDragStart={() => setDraggedDayId(day.id)}
                    onDrop={() => reorderDayByDrag(day.id)}
                    type="button"
                  >
                    <span>{day.name}</span>
                    <small>
                      {(structure.exercisesByDay[day.id] ?? []).length}
                    </small>
                  </button>
                ))}
              </div>
            ) : null}

            <div className="program-builder-days">
              {selectedDay ? (
                <div
                  className="program-builder-day"
                  key={selectedDay.id}
                  {...daySwipe}
                >
                  <div>
                    <strong>Selected day</strong>
                    {selectedDay.notes ? (
                      <small>{selectedDay.notes}</small>
                    ) : null}
                  </div>
                  <div className="button-row">
                    <SecondaryButton
                      type="button"
                      onClick={() => {
                        const name = window.prompt(
                          'Workout day name',
                          selectedDay.name,
                        )
                        if (name?.trim()) {
                          run(
                            mode === 'template'
                              ? programRepository.updateTemplateDay(
                                  selectedDay.id,
                                  {
                                    name: name.trim(),
                                  },
                                )
                              : programRepository.updateActiveCycleDay(
                                  selectedDay.id,
                                  {
                                    name: name.trim(),
                                  },
                                ),
                          )
                        }
                      }}
                    >
                      Rename
                    </SecondaryButton>
                    <SecondaryButton
                      disabled={selectedDayIndex === 0}
                      type="button"
                      onClick={() => moveDay(selectedDay.id, -1)}
                    >
                      Up
                    </SecondaryButton>
                    <SecondaryButton
                      disabled={selectedDayIndex === structure.days.length - 1}
                      type="button"
                      onClick={() => moveDay(selectedDay.id, 1)}
                    >
                      Down
                    </SecondaryButton>
                    <SecondaryButton
                      type="button"
                      onClick={() =>
                        run(
                          mode === 'template'
                            ? programRepository.duplicateTemplateDay(
                                selectedDay.id,
                              )
                            : programRepository.duplicateActiveCycleDay(
                                selectedDay.id,
                              ),
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
                          id: selectedDay.id,
                          name: selectedDay.name,
                        })
                      }
                    >
                      <Trash2 aria-hidden="true" size={16} />
                      Remove
                    </SecondaryButton>
                  </div>

                  <div className="program-prescription-list">
                    {(structure.exercisesByDay[selectedDay.id] ?? []).map(
                      (prescribed) => (
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
                                  dayId: selectedDay.id,
                                  exercise: prescribed,
                                })
                              }
                            >
                              <Edit2 aria-hidden="true" size={18} />
                            </IconButton>
                            <IconButton
                              aria-label={`Move ${prescribed.exerciseSnapshot.exerciseName} up`}
                              onClick={() =>
                                moveExercise(selectedDay.id, prescribed.id, -1)
                              }
                            >
                              <ArrowUp aria-hidden="true" size={18} />
                            </IconButton>
                            <IconButton
                              aria-label={`Move ${prescribed.exerciseSnapshot.exerciseName} down`}
                              onClick={() =>
                                moveExercise(selectedDay.id, prescribed.id, 1)
                              }
                            >
                              <ArrowDown aria-hidden="true" size={18} />
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
                    {!(structure.exercisesByDay[selectedDay.id] ?? [])
                      .length ? (
                      <p className="muted">No prescribed exercises.</p>
                    ) : null}
                  </div>
                  <SecondaryButton
                    type="button"
                    onClick={() =>
                      setEditingPrescription({
                        dayId: selectedDay.id,
                        exercise: null,
                      })
                    }
                  >
                    Add exercise
                  </SecondaryButton>
                </div>
              ) : (
                <EmptyState
                  title="No workout days"
                  message="Add a workout day to begin programming exercises."
                />
              )}
            </div>
          </>
        ) : null}
        {error ? <ValidationMessage message={error} /> : null}
      </BottomSheet>
      <ModalConfirmationDialog
        confirmLabel={
          removeConfirmation?.type === 'day' ? 'Delete Day' : 'Remove'
        }
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
            ? `${removeConfirmation.name} and its programmed exercises will be permanently deleted. Completed workout history is preserved.`
            : `Remove ${removeConfirmation?.name ?? 'this exercise'} from this workout day.`}
        </p>
      </ModalConfirmationDialog>
      <ModalConfirmationDialog
        confirmLabel="Merge Days"
        isOpen={mergeConfirmation !== null}
        onCancel={() => setMergeConfirmation(null)}
        onConfirm={mergeDaysConfirmed}
        title="Merge workout days?"
      >
        <p>
          Source-day exercises will be appended to the destination day, then the
          source day will be permanently deleted. Completed workout history is
          preserved.
        </p>
      </ModalConfirmationDialog>
    </>
  )
}

function PrescriptionEditor({
  exerciseUsage,
  exercises,
  mode,
  onClose,
  target,
  onSaved,
}: {
  exerciseUsage: ExerciseUsageSummary
  exercises: Exercise[]
  mode: BuilderMode
  onClose: () => void
  onSaved: () => void
  target: {
    dayId: string
    exercise: TemplateWorkoutExercise | ActiveCycleWorkoutExercise | null
  }
}) {
  const [availableExercises, setAvailableExercises] = useState(exercises)
  const [step, setStep] = useState<'search' | 'edit' | 'create'>(
    target.exercise ? 'edit' : 'search',
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [form, setForm] = useState<PrescriptionFormState>(() =>
    target.exercise
      ? {
          exerciseId: target.exercise.exerciseId,
          targetSetCount: String(target.exercise.targetSetCount),
          targetWeight: target.exercise.targetWeight?.toString() ?? '',
          targetDurationSeconds:
            target.exercise.targetDurationSeconds?.toString() ?? '',
          targetDistance: target.exercise.targetDistance?.toString() ?? '',
          targetRepsMin: target.exercise.targetRepsMin?.toString() ?? '',
          targetRepsMax: target.exercise.targetRepsMax?.toString() ?? '',
          targetRir: target.exercise.targetRir?.toString() ?? '',
          notes: target.exercise.notes,
        }
      : emptyPrescriptionForm,
  )
  const [error, setError] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState(emptyExerciseForm)
  const [createError, setCreateError] = useState<string | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const selectedExercise =
    availableExercises.find((exercise) => exercise.id === form.exerciseId) ??
    null
  const parsed = parsePrescriptionForm(form, selectedExercise)
  const searchable = hasSearchableQuery(searchQuery)
  const results = searchable
    ? searchExercises(availableExercises, searchQuery, exerciseUsage)
    : []
  const defaultResults = defaultExerciseResults(
    availableExercises,
    exerciseUsage,
  )
  const isDirty = formIsDirty(form, target.exercise) || step === 'create'

  function update(field: keyof PrescriptionFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function selectExercise(exercise: Exercise) {
    setForm((current) => ({ ...current, exerciseId: exercise.id }))
    setStep('edit')
    setError(null)
  }

  function requestClose() {
    if (isDirty) {
      setConfirmDiscard(true)
      return
    }
    onClose()
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

  function saveCustomExercise() {
    const parsedExercise = parseExerciseForm(createForm)
    if (!parsedExercise.ok) {
      setCreateError(parsedExercise.error)
      return
    }

    void exerciseRepository
      .createExercise(parsedExercise.value)
      .then((created) => {
        setAvailableExercises((current) => [...current, created])
        selectExercise(created)
        setCreateForm(emptyExerciseForm)
        setCreateError(null)
      })
      .catch((caught: unknown) => {
        setCreateError(
          caught instanceof Error ? caught.message : 'Exercise could not save.',
        )
      })
  }

  return (
    <>
      <div className="prescription-workflow" aria-label="Prescription editor">
        <div className="nested-screen-header">
          <IconButton
            aria-label="Back to program editor"
            onClick={requestClose}
          >
            <ArrowLeft aria-hidden="true" size={18} />
          </IconButton>
          <div>
            <h3>{target.exercise ? 'Edit prescription' : 'Add exercise'}</h3>
            <p className="muted">Choose an exercise, then set the target.</p>
          </div>
        </div>

        {step === 'search' ? (
          <div className="exercise-picker">
            <FormField
              id="prescription-exercise-search"
              label="Search exercises"
            >
              <div className="input-icon-row">
                <Search aria-hidden="true" size={18} />
                <input
                  autoFocus
                  id="prescription-exercise-search"
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search at least 2 characters"
                  type="search"
                  value={searchQuery}
                />
              </div>
            </FormField>
            <p className="visually-hidden" role="status">
              {searchable
                ? `${results.length} exercise results`
                : 'Enter at least two characters to search exercises'}
            </p>
            <div className="exercise-result-list">
              {(searchable
                ? results.map((result) => result.exercise)
                : defaultResults
              ).map((exercise) => (
                <ExerciseResultButton
                  exercise={exercise}
                  key={exercise.id}
                  onSelect={() => selectExercise(exercise)}
                />
              ))}
            </div>
            {!searchable && !defaultResults.length ? (
              <EmptyState
                title="Search exercise library"
                message="Type at least two characters to search built-in and custom exercises."
              />
            ) : null}
            {searchable && !results.length ? (
              <EmptyState
                title="No exercises found"
                message="Create a custom exercise if this movement is not in the library."
              />
            ) : null}
            <SecondaryButton type="button" onClick={() => setStep('create')}>
              <Plus aria-hidden="true" size={18} />
              Create custom exercise
            </SecondaryButton>
          </div>
        ) : null}

        {step === 'create' ? (
          <div className="compact-create-exercise">
            <SecondaryButton type="button" onClick={() => setStep('search')}>
              <ArrowLeft aria-hidden="true" size={18} />
              Back to search
            </SecondaryButton>
            <FormField id="picker-exercise-name" label="Name">
              <input
                autoFocus
                id="picker-exercise-name"
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                value={createForm.name}
              />
            </FormField>
            <div className="compact-field-grid">
              <FormField id="picker-rest-minutes" label="Rest minutes">
                <NumericInput
                  id="picker-rest-minutes"
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      restMinutes: event.target.value,
                    }))
                  }
                  pattern="[0-9]*"
                  value={createForm.restMinutes}
                />
              </FormField>
              <FormField id="picker-rest-seconds" label="Rest seconds">
                <NumericInput
                  id="picker-rest-seconds"
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      restSeconds: event.target.value,
                    }))
                  }
                  pattern="[0-9]*"
                  value={createForm.restSeconds}
                />
              </FormField>
            </div>
            <FormField id="picker-tracking-method" label="Tracking preset">
              <select
                id="picker-tracking-method"
                onChange={(event) => {
                  const trackingMethodId = parseTrackingMethodId(
                    event.target.value,
                  )
                  if (trackingMethodId) {
                    setCreateForm((current) => ({
                      ...current,
                      trackingMethodId,
                    }))
                  }
                }}
                value={createForm.trackingMethodId}
              >
                {TRACKING_METHODS.map((method) => (
                  <option key={method.id} value={method.id}>
                    {method.name}
                  </option>
                ))}
              </select>
            </FormField>
            {createError ? <ValidationMessage message={createError} /> : null}
            <PrimaryButton type="button" onClick={saveCustomExercise}>
              Save and select
            </PrimaryButton>
          </div>
        ) : null}

        {step === 'edit' && selectedExercise ? (
          <div className="compact-prescription-form">
            {!target.exercise ? (
              <SecondaryButton type="button" onClick={() => setStep('search')}>
                <ArrowLeft aria-hidden="true" size={18} />
                Back to search
              </SecondaryButton>
            ) : null}
            <div className="selected-exercise-summary">
              <strong>{selectedExercise.name}</strong>
              <small>{exerciseMetadata(selectedExercise)}</small>
              <small>
                {selectedExercise.defaultRestSeconds}s rest
                {selectedExercise.defaultWeightIncrement !== null
                  ? ` - ${selectedExercise.defaultWeightIncrement} lb increment`
                  : ''}
              </small>
            </div>
            <div className="compact-field-grid">
              <FormField id="target-sets" label="Sets">
                <NumericInput
                  autoFocus
                  id="target-sets"
                  onChange={(event) =>
                    update('targetSetCount', event.target.value)
                  }
                  value={form.targetSetCount}
                />
              </FormField>
              {showsWeightTarget(selectedExercise) ? (
                <FormField
                  id="target-weight"
                  label={
                    selectedExercise.trackingMethodId === 'assisted_weight_reps'
                      ? 'Assistance target'
                      : selectedExercise.trackingMethodId ===
                          'added_weight_reps'
                        ? 'Added-weight target'
                        : 'Weight target'
                  }
                >
                  <NumericInput
                    id="target-weight"
                    onChange={(event) =>
                      update('targetWeight', event.target.value)
                    }
                    value={form.targetWeight}
                  />
                </FormField>
              ) : null}
              {selectedExercise.trackingMethodId === 'distance_duration' ? (
                <FormField id="target-distance" label="Distance target (ft)">
                  <NumericInput
                    id="target-distance"
                    onChange={(event) =>
                      update('targetDistance', event.target.value)
                    }
                    value={form.targetDistance}
                  />
                </FormField>
              ) : null}
            </div>
            {isRepetitionBased(selectedExercise) ? (
              <div className="rep-range-grid">
                <FormField id="target-reps-min" label="Min reps">
                  <NumericInput
                    id="target-reps-min"
                    onChange={(event) =>
                      update('targetRepsMin', event.target.value)
                    }
                    value={form.targetRepsMin}
                  />
                </FormField>
                <FormField id="target-reps-max" label="Max reps">
                  <NumericInput
                    id="target-reps-max"
                    onChange={(event) =>
                      update('targetRepsMax', event.target.value)
                    }
                    value={form.targetRepsMax}
                  />
                </FormField>
              </div>
            ) : null}
            <FormField id="target-rir" label="RIR">
              <NumericInput
                id="target-rir"
                onChange={(event) => update('targetRir', event.target.value)}
                value={form.targetRir}
              />
            </FormField>
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
              <SecondaryButton type="button" onClick={requestClose}>
                Cancel
              </SecondaryButton>
            </div>
          </div>
        ) : null}
      </div>
      <ModalConfirmationDialog
        confirmLabel="Discard"
        isOpen={confirmDiscard}
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false)
          onClose()
        }}
        title="Discard prescription changes?"
      >
        <p>Entered prescription values will be discarded.</p>
      </ModalConfirmationDialog>
    </>
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
  const [existingRunId, setExistingRunId] = useState<string | null>(null)
  const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false)

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
        if (message.includes('active run')) {
          void runRepository.getActiveRun().then((run) => {
            setExistingRunId(run?.id ?? null)
          })
        }
      })
  }

  function discardCurrentWorkoutAndStart() {
    if (!existingWorkoutId) {
      return
    }
    void workoutRepository
      .discardWorkout(existingWorkoutId)
      .then(() => {
        setIsDiscardConfirmOpen(false)
        setExistingWorkoutId(null)
        setError(null)
        startWorkout()
      })
      .catch((caught: unknown) => {
        setError(
          caught instanceof Error
            ? caught.message
            : 'Current workout could not be discarded.',
        )
      })
  }

  function discardCurrentRunAndStart() {
    if (!existingRunId) {
      return
    }
    void runRepository
      .discardRun(existingRunId)
      .then(() => {
        setExistingRunId(null)
        setError(null)
        startWorkout()
      })
      .catch((caught: unknown) => {
        setError(
          caught instanceof Error
            ? caught.message
            : 'Current run could not be discarded.',
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
              Resume Existing Workout
            </PrimaryButton>
            <SecondaryButton
              className="button-danger"
              type="button"
              onClick={() => setIsDiscardConfirmOpen(true)}
            >
              Discard Existing Workout and Start New Workout
            </SecondaryButton>
          </div>
        ) : existingRunId ? (
          <div className="button-row">
            <PrimaryButton
              type="button"
              onClick={() => {
                window.location.assign('/run')
              }}
            >
              Resume Active Run
            </PrimaryButton>
            <SecondaryButton
              className="button-danger"
              type="button"
              onClick={discardCurrentRunAndStart}
            >
              Discard Active Run
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
        confirmLabel="Discard Existing Workout and Start New Workout"
        isOpen={isDiscardConfirmOpen}
        onCancel={() => setIsDiscardConfirmOpen(false)}
        onConfirm={discardCurrentWorkoutAndStart}
        title="Discard existing workout?"
      >
        <p>
          This permanently discards the active workout and its recorded data so
          the selected day can start. Completed workout history is not removed.
        </p>
      </ModalConfirmationDialog>
    </>
  )
}

function ExerciseLibraryCard({
  exercises,
  isExpanded,
  isFilterPanelOpen,
  loadStatus,
  onCreateExercise,
  onEditExercise,
  onHideExercise,
  onRestoreExercise,
  onToggleExpanded,
  primaryMuscle,
  query,
  setFilterPanelOpen,
  setPrimaryMuscle,
  setQuery,
  setTrackingCategory,
  setView,
  trackingCategory,
  view,
}: {
  exercises: Exercise[]
  isExpanded: boolean
  isFilterPanelOpen: boolean
  loadStatus: LoadState['status']
  onCreateExercise: () => void
  onEditExercise: (exercise: Exercise) => void
  onHideExercise: (exercise: Exercise) => void
  onRestoreExercise: (exercise: Exercise) => void
  onToggleExpanded: () => void
  primaryMuscle: MuscleGroup | 'all'
  query: string
  setFilterPanelOpen: (isOpen: boolean) => void
  setPrimaryMuscle: (muscle: MuscleGroup | 'all') => void
  setQuery: (query: string) => void
  setTrackingCategory: (category: ExerciseTrackingCategory) => void
  setView: (view: ExerciseView) => void
  trackingCategory: ExerciseTrackingCategory
  view: ExerciseView
}) {
  const visibleExercises = filterExerciseLibrary(exercises, {
    primaryMuscle,
    query,
    trackingCategory,
  })
  const primaryMuscles = Array.from(
    new Set(
      exercises
        .filter(
          (exercise) =>
            filterExerciseLibrary([exercise], {
              primaryMuscle: 'all',
              query,
              trackingCategory: 'strength',
            }).length,
        )
        .map((exercise) => exercise.primaryMuscleGroups[0])
        .filter((muscle): muscle is MuscleGroup => Boolean(muscle)),
    ),
  ).sort((left, right) =>
    primaryMuscleLabel(left).localeCompare(primaryMuscleLabel(right)),
  )

  return (
    <Card className="exercise-library-card">
      <button
        aria-controls="exercise-library-panel"
        aria-expanded={isExpanded}
        className="card-accordion-header"
        onClick={onToggleExpanded}
        type="button"
      >
        <strong>Exercise Library</strong>
        <ChevronDown aria-hidden="true" className="accordion-chevron" />
      </button>
      {isExpanded ? (
        <div id="exercise-library-panel" className="exercise-library-panel">
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
            <div className="input-icon-row exercise-search-row">
              <Search aria-hidden="true" size={18} />
              <input
                id="exercise-search"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search your exercises"
                type="search"
                value={query}
              />
              <IconButton
                aria-expanded={isFilterPanelOpen}
                aria-label="Filters"
                onClick={() => setFilterPanelOpen(!isFilterPanelOpen)}
              >
                <Filter aria-hidden="true" size={18} />
              </IconButton>
            </div>
          </FormField>

          {isFilterPanelOpen ? (
            <div className="exercise-filter-panel">
              <div className="segmented-control" aria-label="Tracking Method">
                {(['all', 'strength', 'cardio', 'distance'] as const).map(
                  (category) => (
                    <button
                      aria-pressed={trackingCategory === category}
                      key={category}
                      onClick={() => setTrackingCategory(category)}
                      type="button"
                    >
                      {category === 'all'
                        ? 'All'
                        : category[0].toUpperCase() + category.slice(1)}
                    </button>
                  ),
                )}
              </div>
              {trackingCategory === 'strength' && primaryMuscles.length ? (
                <FormField id="primary-muscle-filter" label="Primary Muscle">
                  <select
                    id="primary-muscle-filter"
                    onChange={(event) =>
                      setPrimaryMuscle(event.currentTarget.value as MuscleGroup)
                    }
                    value={primaryMuscle}
                  >
                    <option value="all">All</option>
                    {primaryMuscles.map((muscle) => (
                      <option key={muscle} value={muscle}>
                        {primaryMuscleLabel(muscle)}
                      </option>
                    ))}
                  </select>
                </FormField>
              ) : null}
            </div>
          ) : null}

          {loadStatus === 'loading' ? (
            <LoadingState label="Loading exercises" />
          ) : null}
          {loadStatus === 'error' ? (
            <StatusMessage tone="warning">
              Exercise library could not load.
            </StatusMessage>
          ) : null}

          {loadStatus === 'ready' && visibleExercises.length ? (
            <div className="exercise-list">
              {visibleExercises.map((exercise) => (
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

          {loadStatus === 'ready' && !visibleExercises.length ? (
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
          <SecondaryButton type="button" onClick={onToggleExpanded}>
            Hide Library
          </SecondaryButton>
        </div>
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
  return (
    <div className="exercise-item">
      <span className="quick-action-icon">
        <Dumbbell aria-hidden="true" size={18} />
      </span>
      <div>
        <strong>{exercise.name}</strong>
        <small>{exerciseLibraryMetadata(exercise)}</small>
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
  exercise: Exercise | null,
):
  | { ok: true; value: CreateTemplateExerciseInput }
  | { ok: false; error: string } {
  const targetSetCount = Number(form.targetSetCount)
  const targetWeight = parseOptionalNumber(form.targetWeight)
  const targetDurationSeconds = { ok: true, value: null } as const
  const targetDistance = parseOptionalNumber(form.targetDistance)
  const targetRepsMin = parseOptionalInteger(form.targetRepsMin)
  const targetRepsMax = parseOptionalInteger(form.targetRepsMax)
  const targetRir = parseOptionalInteger(form.targetRir)

  if (!form.exerciseId || !exercise) {
    return { ok: false, error: 'Exercise selection is required.' }
  }

  if (
    !Number.isInteger(targetSetCount) ||
    targetSetCount <= 0 ||
    targetSetCount > 99
  ) {
    return { ok: false, error: 'Target sets must be a positive whole number.' }
  }

  if (!targetRepsMin.ok || !targetRepsMax.ok || !targetRir.ok) {
    return { ok: false, error: 'Optional targets must be whole numbers.' }
  }

  if (!targetWeight.ok || !targetDurationSeconds.ok || !targetDistance.ok) {
    return { ok: false, error: 'Targets must be valid positive numbers.' }
  }
  const targetWeightValue = targetWeight.value
  const targetDurationSecondsValue = targetDurationSeconds.value
  const targetDistanceValue = targetDistance.value

  if (isRepetitionBased(exercise)) {
    if (targetRepsMin.value === null || targetRepsMax.value === null) {
      return { ok: false, error: 'Minimum and maximum reps are required.' }
    }
    if (targetRepsMin.value <= 0 || targetRepsMax.value <= 0) {
      return { ok: false, error: 'Reps must be positive whole numbers.' }
    }
  }

  if (
    showsWeightTarget(exercise) &&
    targetWeightValue !== null &&
    targetWeightValue < 0
  ) {
    return { ok: false, error: 'Weight target cannot be negative.' }
  }

  if (
    exercise.trackingMethodId === 'distance_duration' &&
    (targetDistanceValue === null || targetDistanceValue <= 0)
  ) {
    return { ok: false, error: 'Distance target must be positive.' }
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
      targetWeight: targetWeightValue,
      targetDurationSeconds: targetDurationSecondsValue,
      targetDistance: targetDistanceValue,
      targetRepsMin: targetRepsMin.value,
      targetRepsMax: targetRepsMax.value,
      targetRir: targetRir.value,
      // Existing stored overrides are still honored in summaries and workout
      // creation, but new prescription edits normalize to the exercise default.
      restSecondsOverride: null,
      notes: form.notes.trim(),
    },
  }
}

function parseOptionalInteger(
  value: string,
): { ok: true; value: number | null } | { ok: false } {
  if (!value.trim()) {
    return { ok: true, value: null } as const
  }

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) {
    return { ok: false } as const
  }

  return { ok: true, value: parsed } as const
}

function parseOptionalNumber(
  value: string,
): { ok: true; value: number | null } | { ok: false } {
  if (!value.trim()) {
    return { ok: true, value: null } as const
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) {
    return { ok: false } as const
  }

  return { ok: true, value: parsed } as const
}

function prescriptionSummary(
  prescribed: TemplateWorkoutExercise | ActiveCycleWorkoutExercise,
) {
  const parts = [`${prescribed.targetSetCount} sets`]
  if (
    prescribed.targetWeight !== null &&
    prescribed.targetWeight !== undefined
  ) {
    parts.push(`${prescribed.targetWeight} lb`)
  }
  if (
    prescribed.targetDurationSeconds !== null &&
    prescribed.targetDurationSeconds !== undefined
  ) {
    parts.push(`${prescribed.targetDurationSeconds}s`)
  }
  if (
    prescribed.targetDistance !== null &&
    prescribed.targetDistance !== undefined
  ) {
    parts.push(`${prescribed.targetDistance} ft`)
  }
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

function exerciseMetadata(exercise: Exercise) {
  const trackingMethod = getTrackingMethod(exercise.trackingMethodId)
  const muscles = exercise.primaryMuscleGroups.join(', ') || 'No muscle group'
  return `${formatEquipment(exercise.equipmentType)} - ${muscles} - ${
    trackingMethod?.name ?? exercise.trackingMethodId
  }${exercise.origin === 'custom' ? ' - Custom' : ''}`
}

function exerciseLibraryMetadata(exercise: Exercise) {
  const trackingMethod = getTrackingMethod(exercise.trackingMethodId)
  const trackingLabel = trackingMethod?.name ?? exercise.trackingMethodId
  if (exercise.origin === 'built_in') {
    return `${trackingLabel} - Built-in - ${exercise.defaultRestSeconds}s rest`
  }
  return `${trackingLabel} - ${exercise.defaultRestSeconds}s rest - Custom`
}

function isRepetitionBased(exercise: Exercise) {
  return exercise.trackingMetrics.some((metric) => metric.key === 'reps')
}

function showsWeightTarget(exercise: Exercise) {
  return exercise.trackingMetrics.some((metric) =>
    ['weight', 'assistedWeight', 'addedWeight'].includes(metric.key),
  )
}

function formatEquipment(equipment: Exercise['equipmentType']) {
  return equipment
    .split('_')
    .map((part) => part.charAt(0).toLocaleUpperCase() + part.slice(1))
    .join(' ')
}

function formIsDirty(
  form: PrescriptionFormState,
  exercise: TemplateWorkoutExercise | ActiveCycleWorkoutExercise | null,
) {
  if (!exercise) {
    return (
      form.exerciseId !== '' ||
      form.targetSetCount !== emptyPrescriptionForm.targetSetCount ||
      form.targetWeight !== '' ||
      form.targetDurationSeconds !== '' ||
      form.targetDistance !== '' ||
      form.targetRepsMin !== '' ||
      form.targetRepsMax !== '' ||
      form.targetRir !== '' ||
      form.notes !== ''
    )
  }

  return (
    form.exerciseId !== exercise.exerciseId ||
    form.targetSetCount !== String(exercise.targetSetCount) ||
    form.targetWeight !== (exercise.targetWeight?.toString() ?? '') ||
    form.targetDurationSeconds !==
      (exercise.targetDurationSeconds?.toString() ?? '') ||
    form.targetDistance !== (exercise.targetDistance?.toString() ?? '') ||
    form.targetRepsMin !== (exercise.targetRepsMin?.toString() ?? '') ||
    form.targetRepsMax !== (exercise.targetRepsMax?.toString() ?? '') ||
    form.targetRir !== (exercise.targetRir?.toString() ?? '') ||
    form.notes !== exercise.notes
  )
}

function useProgramDaySwipe({
  onNext,
  onPrevious,
}: {
  onNext: () => void
  onPrevious: () => void
}) {
  const pointerStart = useRef<{ x: number; y: number } | null>(null)

  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (isInteractiveElement(event.target)) {
        return
      }
      pointerStart.current = { x: event.clientX, y: event.clientY }
    },
    onPointerUp(event: PointerEvent<HTMLElement>) {
      if (!pointerStart.current) {
        return
      }
      const deltaX = event.clientX - pointerStart.current.x
      const deltaY = event.clientY - pointerStart.current.y
      pointerStart.current = null
      if (Math.abs(deltaX) < 55 || Math.abs(deltaY) > 45) {
        return
      }
      if (deltaX < 0) {
        onNext()
      } else {
        onPrevious()
      }
    },
    onPointerCancel() {
      pointerStart.current = null
    },
  }
}

function isInteractiveElement(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    Boolean(
      target.closest('button, input, select, textarea, a, [role="button"]'),
    )
  )
}

function ExerciseResultButton({
  exercise,
  onSelect,
}: {
  exercise: Exercise
  onSelect: () => void
}) {
  return (
    <button className="exercise-result-row" onClick={onSelect} type="button">
      <strong>{exercise.name}</strong>
      <small>{exerciseMetadata(exercise)}</small>
    </button>
  )
}

function formatTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp))
}
