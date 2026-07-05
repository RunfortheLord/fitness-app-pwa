import { Edit2, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import {
  SortableDragHandle,
  SortableList,
  SortableListItem,
} from '@components/SortableList'
import { pointerActivatorProps } from '@components/sortableDrag'
import {
  BottomSheet,
  EmptyState,
  FormField,
  IconButton,
  LoadingState,
  ModalConfirmationDialog,
  SecondaryButton,
  ValidationMessage,
} from '@components/ui'
import type { ExerciseUsageSummary } from '@domain/exerciseSearch'
import { programRepository } from '@repositories/programRepository'
import type {
  ActiveCycleWorkoutDay,
  ActiveCycleWorkoutExercise,
  ActiveProgramCycle,
  Exercise,
  ProgramTemplate,
  ProgramTemplateDay,
  TemplateWorkoutExercise,
} from '@shared-types/app'

import { PrescriptionEditor } from './PrescriptionEditor'
import { PrescriptionSummaryText } from './prescriptionSummary'
import {
  emptyProgramForm,
  parseDurationWeeks,
  programFormFromRecord,
} from './programForms'
import { useProgramDaySwipe } from './useProgramDaySwipe'
import type { BuilderMode, ProgramSheetTarget } from './types'

export function ProgramBuilderSheet({
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
  const [selectedDayId, setSelectedDayId] = useState('')

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
          setNameForm(programFormFromRecord(loaded.template))
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
          setNameForm(programFormFromRecord(loaded.cycle))
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
          setNameForm(programFormFromRecord(record))
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
          setNameForm(programFormFromRecord(record))
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

  function saveDuration() {
    if (!structure) {
      return
    }
    const nextWeeks = parseDurationWeeks(nameForm.durationWeeks)
    if (nextWeeks === (structure.record.durationWeeks ?? null)) {
      return
    }
    run(
      mode === 'template'
        ? programRepository.updateProgramTemplate(structure.record.id, {
            durationWeeks: nextWeeks,
          })
        : programRepository.updateActiveCycle(structure.record.id, {
            durationWeeks: nextWeeks,
          }),
    )
  }

  function saveDayName(dayId: string, nextName: string) {
    const trimmed = nextName.trim()
    if (!trimmed) {
      return
    }
    const current = structure?.days.find((day) => day.id === dayId)
    if (!current || trimmed === current.name) {
      return
    }
    run(
      mode === 'template'
        ? programRepository.updateTemplateDay(dayId, { name: trimmed })
        : programRepository.updateActiveCycleDay(dayId, { name: trimmed }),
    )
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

  function persistOptimistically(action: Promise<unknown>) {
    void action
      .then(() => {
        setError(null)
        onChanged()
      })
      .catch((caught: unknown) => {
        setError(
          caught instanceof Error ? caught.message : 'Program change failed.',
        )
        refresh()
      })
  }

  function reorderDays(orderedIds: string[]) {
    if (!structure) {
      return
    }
    const recordId = structure.record.id
    setStructure((current) =>
      current
        ? {
            ...current,
            days: orderedIds
              .map((id) => current.days.find((day) => day.id === id))
              .filter((day) => day !== undefined),
          }
        : current,
    )
    persistOptimistically(
      mode === 'template'
        ? programRepository.reorderTemplateDays(recordId, orderedIds)
        : programRepository.reorderActiveCycleDays(recordId, orderedIds),
    )
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
    reorderDays(ordered)
  }

  function reorderExercises(dayId: string, orderedIds: string[]) {
    setStructure((current) => {
      if (!current) {
        return current
      }
      const dayExercises = current.exercisesByDay[dayId] ?? []
      return {
        ...current,
        exercisesByDay: {
          ...current.exercisesByDay,
          [dayId]: orderedIds
            .map((id) => dayExercises.find((exercise) => exercise.id === id))
            .filter((exercise) => exercise !== undefined),
        },
      }
    })
    persistOptimistically(
      mode === 'template'
        ? programRepository.reorderTemplateExercises(dayId, orderedIds)
        : programRepository.reorderActiveCycleExercises(dayId, orderedIds),
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
        variant="page"
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
            <FormField id="builder-program-name" label="Program name">
              <div className="rename-field">
                <input
                  className="rename-field-input"
                  id="builder-program-name"
                  onBlur={() => saveName()}
                  onChange={(event) =>
                    setNameForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.currentTarget.blur()
                    }
                  }}
                  value={nameForm.name}
                />
                <Edit2
                  aria-hidden="true"
                  className="rename-field-icon"
                  size={16}
                />
              </div>
              <small className="rename-field-hint">Tap to rename</small>
            </FormField>

            <FormField
              id="builder-program-weeks"
              label="Program length (weeks)"
            >
              <input
                id="builder-program-weeks"
                inputMode="numeric"
                type="number"
                min={1}
                onBlur={() => saveDuration()}
                onChange={(event) =>
                  setNameForm((current) => ({
                    ...current,
                    durationWeeks: event.target.value,
                  }))
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.currentTarget.blur()
                  }
                }}
                value={nameForm.durationWeeks}
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

            {structure.days.length ? (
              <SortableList
                direction="horizontal"
                getItemLabel={(id) =>
                  structure.days.find((day) => day.id === id)?.name ?? 'Day'
                }
                itemIds={structure.days.map((day) => day.id)}
                onReorder={reorderDays}
              >
                <div className="program-day-tabs" aria-label="Program days">
                  {structure.days.map((day) => (
                    <SortableListItem id={day.id} key={day.id}>
                      {(drag) => (
                        <button
                          aria-current={day.id === selectedDay?.id}
                          onClick={() => selectDay(day.id)}
                          type="button"
                          {...pointerActivatorProps(drag)}
                        >
                          <span>{day.name}</span>
                          <small>
                            {(structure.exercisesByDay[day.id] ?? []).length}
                          </small>
                        </button>
                      )}
                    </SortableListItem>
                  ))}
                </div>
              </SortableList>
            ) : null}

            <div className="program-builder-days">
              {selectedDay ? (
                <div
                  className="program-builder-day"
                  key={selectedDay.id}
                  {...daySwipe}
                >
                  <div className="program-builder-day-head">
                    <FormField id="builder-day-name" label="Workout day name">
                      <div className="rename-field">
                        <input
                          className="rename-field-input"
                          defaultValue={selectedDay.name}
                          id="builder-day-name"
                          key={selectedDay.id}
                          onBlur={(event) =>
                            saveDayName(selectedDay.id, event.target.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.currentTarget.blur()
                            }
                          }}
                        />
                        <Edit2
                          aria-hidden="true"
                          className="rename-field-icon"
                          size={16}
                        />
                      </div>
                      <small className="rename-field-hint">Tap to rename</small>
                    </FormField>
                    {selectedDay.notes ? (
                      <small>{selectedDay.notes}</small>
                    ) : null}
                  </div>
                  <div className="button-row">
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
                  <SortableList
                    getItemLabel={(id) =>
                      (structure.exercisesByDay[selectedDay.id] ?? []).find(
                        (exercise) => exercise.id === id,
                      )?.exerciseSnapshot.exerciseName ?? 'Exercise'
                    }
                    itemIds={(
                      structure.exercisesByDay[selectedDay.id] ?? []
                    ).map((exercise) => exercise.id)}
                    onReorder={(orderedIds) =>
                      reorderExercises(selectedDay.id, orderedIds)
                    }
                  >
                    <div className="program-prescription-list">
                      {(structure.exercisesByDay[selectedDay.id] ?? []).map(
                        (prescribed) => (
                          <SortableListItem
                            className="program-prescription-row sortable-row"
                            id={prescribed.id}
                            key={prescribed.id}
                          >
                            {(drag) => (
                              <>
                                <SortableDragHandle
                                  drag={drag}
                                  label={`Reorder ${prescribed.exerciseSnapshot.exerciseName}`}
                                />
                                <div>
                                  <strong>
                                    {prescribed.exerciseSnapshot.exerciseName}
                                  </strong>
                                  <small>
                                    <PrescriptionSummaryText
                                      prescribed={prescribed}
                                    />
                                  </small>
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
                              </>
                            )}
                          </SortableListItem>
                        ),
                      )}
                      {!(structure.exercisesByDay[selectedDay.id] ?? [])
                        .length ? (
                        <p className="muted">No prescribed exercises.</p>
                      ) : null}
                    </div>
                  </SortableList>
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
    </>
  )
}
