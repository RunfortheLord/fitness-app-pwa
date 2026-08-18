import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import {
  IconButton,
  ModalConfirmationDialog,
  PageContainer,
  SectionHeader,
  Toast,
} from '@components/ui'
import { useLanguage } from '@components/languageContextValue'
import { useSubpageBackGesture } from '@hooks/useSubpageBackGesture'
import { formatLocalDate } from '@domain/dates'
import { currentProgramWeek } from '@domain/programWeeks'
import type { ExerciseTrackingCategory } from '@domain/exerciseSearch'
import {
  BrowseProgramsPage,
  ProgramPreviewPage,
} from '@features/training/BrowsePrograms'
import { ExerciseFormSheet } from '@features/training/ExerciseFormSheet'
import { ExerciseLibraryCard } from '@features/training/ExerciseLibraryCard'
import { ProgramBuilderSheet } from '@features/training/ProgramBuilderSheet'
import { ProgramCreateSheet } from '@features/training/ProgramCreateSheet'
import {
  FullProgramLibraryPage,
  ProgramLibrary,
} from '@features/training/ProgramLibrary'
import { ProgramOverview } from '@features/training/ProgramOverview'
import { WorkoutDayDetailSheet } from '@features/training/WorkoutDayDetailSheet'
import type {
  ExerciseView,
  ProgramSheetTarget,
  SelectedDay,
} from '@features/training/types'
import { exerciseRepository } from '@repositories/exerciseRepository'
import { programRepository } from '@repositories/programRepository'
import { workoutRepository } from '@repositories/workoutRepository'
import type {
  ActiveCycleWorkoutDay,
  ActiveCycleWorkoutExercise,
  ActiveProgramCycle,
  Exercise,
  MuscleGroup,
  ProgramTemplate,
} from '@shared-types/app'
import {
  getCachedTrainingPageData,
  setCachedTrainingPageData,
  type TrainingPageLoadState as LoadState,
} from '@pages/trainingPageCache'

type SheetState =
  | { type: 'exercise'; exercise: Exercise | null }
  | { type: 'createProgram' }
  | { type: 'builder'; target: ProgramSheetTarget }
  | { type: 'selectedDay'; selectedDay: SelectedDay }
  | null
type ProgramConfirmation =
  | { type: 'activate'; template: ProgramTemplate }
  | { type: 'deactivate'; cycle: ActiveProgramCycle }
  | { type: 'delete-first'; template: ProgramTemplate }
  | { type: 'delete-final'; template: ProgramTemplate }
  | null

export function TrainingPage() {
  const { t } = useLanguage()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [view, setView] = useState<ExerciseView>('active')
  const [isLibraryExpanded, setIsLibraryExpanded] = useState(false)
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false)
  const programViewParam = searchParams.get('programView')
  const programView: 'main' | 'library' | 'browse' =
    programViewParam === 'library' || programViewParam === 'browse'
      ? programViewParam
      : 'main'
  const [previewTemplate, setPreviewTemplate] =
    useState<ProgramTemplate | null>(null)
  const [programSearchQuery, setProgramSearchQuery] = useState('')
  const [trackingCategory, setTrackingCategory] =
    useState<ExerciseTrackingCategory>('all')
  const [primaryMuscle, setPrimaryMuscle] = useState<MuscleGroup | 'all'>('all')
  const [sheet, setSheet] = useState<SheetState>(null)
  const [programConfirmation, setProgramConfirmation] =
    useState<ProgramConfirmation>(null)
  const [revision, setRevision] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  // Check-offs for the active cycle's current week (keyed by week so they reset
  // weekly). Loaded alongside the active cycle.
  const [weekChecks, setWeekChecks] = useState<{
    week: number
    checkedDayIds: string[]
  }>({ week: 1, checkedDayIds: [] })
  const [loadState, setLoadState] = useState<LoadState>(
    () =>
      getCachedTrainingPageData() ?? {
        exercises: [],
        templates: [],
        exerciseUsage: {},
        currentCycle: undefined,
        status: 'loading',
      },
  )
  const activeSheet =
    searchParams.get('createExercise') === '1'
      ? ({ type: 'exercise', exercise: null } satisfies SheetState)
      : searchParams.get('createProgram') === '1'
        ? ({ type: 'createProgram' } satisfies SheetState)
        : sheet
  const shouldDeferExerciseSeed =
    activeSheet?.type === 'exercise' && !activeSheet.exercise

  function setProgramView(nextView: 'main' | 'library' | 'browse') {
    const nextParams = new URLSearchParams(searchParams)
    if (nextView === 'main') {
      nextParams.delete('programView')
    } else {
      nextParams.set('programView', nextView)
    }
    setSearchParams(nextParams, { replace: true })
  }

  useEffect(() => {
    let isCurrent = true
    const seedController = new AbortController()
    const abortSeed = () => seedController.abort()
    window.addEventListener('pagehide', abortSeed)

    // A quick-action custom-exercise form must remain immediately writable.
    // Start the large first-run seed after that sheet closes.
    if (shouldDeferExerciseSeed) {
      return () => {
        isCurrent = false
        seedController.abort()
        window.removeEventListener('pagehide', abortSeed)
      }
    }

    // Seed the exercise library, then the built-in program library (which
    // references it). Seeding lazily here keeps the larger program write off the
    // app's initial load path.
    void exerciseRepository
      .seedBuiltInExercises({
        deferExpanded: true,
        signal: seedController.signal,
      })
      .then(() => {
        if (isCurrent) {
          reload()
        }
        return programRepository.seedBuiltInPrograms()
      })
      .catch(() => {
        // Seeding is idempotent and retried on the next mount, so a failure here
        // (for example a database closed/reset while this background seed was
        // still in flight) is non-fatal — swallow it rather than surfacing an
        // unhandled rejection. reload() below still reflects whatever seeded.
      })
      .finally(() => {
        if (isCurrent) {
          reload()
        }
      })

    return () => {
      isCurrent = false
      seedController.abort()
      window.removeEventListener('pagehide', abortSeed)
    }
  }, [shouldDeferExerciseSeed])

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
      .then(async ([exercises, templates, currentCycle, exerciseUsage]) => {
        if (!isCurrent) {
          return
        }

        const nextLoadState: LoadState = {
          exercises:
            view === 'hidden'
              ? exercises.filter((exercise) => exercise.status !== 'active')
              : exercises,
          templates,
          exerciseUsage,
          currentCycle,
          status: 'ready',
        }
        setCachedTrainingPageData(nextLoadState)
        setLoadState(nextLoadState)

        if (currentCycle) {
          const allChecks = await programRepository.listAllActiveCycleDayChecks(
            currentCycle.cycle.id,
          )
          const week = currentProgramWeek(
            currentCycle.cycle.currentWeekNumber,
            allChecks,
            currentCycle.days.map((day) => day.id),
          )
          if (isCurrent) {
            setWeekChecks({
              week,
              checkedDayIds: allChecks
                .filter((check) => check.checked && check.weekNumber === week)
                .map((check) => check.dayId),
            })
          }
        } else if (isCurrent) {
          setWeekChecks({ week: 1, checkedDayIds: [] })
        }
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

  // Toggle a day's check-off for the current week. No confirmation — checking
  // and unchecking are both single taps.
  function toggleDayCheck(
    cycle: ActiveProgramCycle,
    dayId: string,
    checked: boolean,
  ) {
    void programRepository
      .setActiveCycleDayCheck({
        activeCycleId: cycle.id,
        dayId,
        weekNumber: weekChecks.week,
        checked,
      })
      .then(() => reload())
      .catch(() => setMessage('Could not update the check-off.'))
  }

  function selectProgramWeek(cycle: ActiveProgramCycle, weekNumber: number) {
    void programRepository
      .updateActiveCycle(cycle.id, { currentWeekNumber: weekNumber })
      .then(() => reload())
      .catch(() => setMessage('Could not change the program week.'))
  }

  function startWorkoutDay(
    cycle: ActiveProgramCycle,
    day: ActiveCycleWorkoutDay,
  ) {
    void workoutRepository
      .startWorkout({
        activeCycleId: cycle.id,
        dayId: day.id,
        localDate: formatLocalDate(new Date()),
      })
      .then(() => {
        void navigate('/workout')
      })
      .catch((caught: unknown) => {
        setMessage(
          caught instanceof Error ? caught.message : 'Workout could not start.',
        )
      })
  }

  const activeSourceId = loadState.currentCycle?.cycle.sourceTemplateId
  const userTemplates = loadState.templates.filter(
    (template) => !template.isBuiltIn && template.id !== activeSourceId,
  )
  const builtInTemplates = loadState.templates.filter(
    (template) => template.isBuiltIn,
  )
  // Built-in programs already copied into the user's library, detected by the
  // clone's "<name> copy" naming, so Browse can show them as added.
  const addedBuiltInNames = new Set(
    loadState.templates
      .filter(
        (template) => !template.isBuiltIn && template.name.endsWith(' copy'),
      )
      .map((template) => template.name.slice(0, -' copy'.length)),
  )

  const onActivateProgram = (template: ProgramTemplate) =>
    setProgramConfirmation({ type: 'activate', template })
  const onEditProgram = (templateId: string) =>
    setSheet({ type: 'builder', target: { mode: 'template', templateId } })
  const onDeleteProgram = (template: ProgramTemplate) =>
    setProgramConfirmation({ type: 'delete-first', template })
  const onCreateProgram = () => setSheet({ type: 'createProgram' })
  const cloneProgram = (templateId: string, label: string) =>
    programRepository.cloneProgramTemplate(templateId).then(() => {
      setMessage(label)
      reload()
    })
  const leaveProgramSubpage = () => {
    setProgramView('main')
    setProgramSearchQuery('')
    setPreviewTemplate(null)
  }

  useSubpageBackGesture(programView !== 'main', leaveProgramSubpage)
  useSubpageBackGesture(previewTemplate !== null, () =>
    setPreviewTemplate(null),
  )

  return (
    <PageContainer>
      <Toast message={message} onDismiss={() => setMessage(null)} />

      {programView === 'library' ? (
        <FullProgramLibraryPage
          loadStatus={loadState.status}
          onActivate={onActivateProgram}
          onBack={leaveProgramSubpage}
          onClone={(templateId) => cloneProgram(templateId, 'Program cloned.')}
          onCreateProgram={onCreateProgram}
          onDelete={onDeleteProgram}
          onEdit={onEditProgram}
          query={programSearchQuery}
          setQuery={setProgramSearchQuery}
          templates={userTemplates}
        />
      ) : programView === 'browse' ? (
        previewTemplate ? (
          <ProgramPreviewPage
            isAdded={addedBuiltInNames.has(previewTemplate.name)}
            onActivate={(template) => {
              onActivateProgram(template)
            }}
            onAdd={(templateId) =>
              cloneProgram(templateId, 'Program added to your library.')
            }
            onBack={() => setPreviewTemplate(null)}
            template={previewTemplate}
          />
        ) : (
          <BrowseProgramsPage
            addedNames={addedBuiltInNames}
            loadStatus={loadState.status}
            onActivate={onActivateProgram}
            onAdd={(templateId) =>
              cloneProgram(templateId, 'Program added to your library.')
            }
            onBack={leaveProgramSubpage}
            onPreview={(template) => setPreviewTemplate(template)}
            query={programSearchQuery}
            setQuery={setProgramSearchQuery}
            templates={builtInTemplates}
          />
        )
      ) : (
        <>
          <div id="active-program" className="training-section-anchor">
            <ProgramOverview
              currentCycle={loadState.currentCycle}
              checkedDayIds={weekChecks.checkedDayIds}
              weekNumber={weekChecks.week}
              onToggleDayCheck={toggleDayCheck}
              onSelectWeek={selectProgramWeek}
              loadStatus={loadState.status}
              onBrowse={() => setProgramView('browse')}
              onCreateProgram={onCreateProgram}
              onDeactivate={(cycle) =>
                setProgramConfirmation({ type: 'deactivate', cycle })
              }
              onEditCycle={(cycleId) =>
                setSheet({
                  type: 'builder',
                  target: { mode: 'cycle', cycleId },
                })
              }
              onSelectDay={(cycle, day, exercises) =>
                setSheet({
                  type: 'selectedDay',
                  selectedDay: { cycle, day, exercises },
                })
              }
              onStartDay={startWorkoutDay}
            />
          </div>

          <div id="program-library" className="training-section-anchor">
            <ProgramLibrary
              loadStatus={loadState.status}
              onActivate={onActivateProgram}
              onBrowse={() => setProgramView('browse')}
              onClone={(templateId) =>
                cloneProgram(templateId, 'Program cloned.')
              }
              onCreateProgram={onCreateProgram}
              onDelete={onDeleteProgram}
              onEdit={onEditProgram}
              onShowMore={() => setProgramView('library')}
              showBrowse={
                Boolean(loadState.currentCycle) || userTemplates.length > 0
              }
              templates={userTemplates}
            />
          </div>

          <div id="exercise-library" className="training-section-anchor">
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

            <ExerciseLibraryCard
              exercises={loadState.exercises}
              isExpanded={isLibraryExpanded}
              isFilterPanelOpen={isFilterPanelOpen}
              loadStatus={loadState.status}
              onCreateExercise={() =>
                setSheet({ type: 'exercise', exercise: null })
              }
              onEditExercise={(exercise) =>
                setSheet({ type: 'exercise', exercise })
              }
              onHideExercise={(exercise) => {
                void exerciseRepository.hideExercise(exercise.id).then(() => {
                  setMessage('Exercise hidden.')
                  reload()
                })
              }}
              onRestoreExercise={(exercise) => {
                void exerciseRepository
                  .restoreExercise(exercise.id)
                  .then(() => {
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
          </div>
        </>
      )}

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
            ? t('Remove {name} from the Program Library?', {
                name: programConfirmation.template.name,
              })
            : programConfirmation?.type === 'delete-final'
              ? t(
                  '{name} will be permanently deleted. Completed workout history and historical names are preserved.',
                  { name: programConfirmation.template.name },
                )
              : programConfirmation?.type === 'deactivate'
                ? t(
                    '{name} will move back to the Program Library. Completed workout history is preserved.',
                    { name: programConfirmation.cycle.name },
                  )
                : t(
                    'Activate {name} as the active program. The current active program will return to the Program Library.',
                    {
                      name:
                        programConfirmation?.template.name ?? t('this program'),
                    },
                  )}
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
