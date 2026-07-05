import { Edit2, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import {
  SortableArea,
  SortableDragHandle,
  SortableListItem,
  SortableZone,
} from '@components/SortableList'
import { pointerActivatorProps, reorderIds } from '@components/sortableDrag'
import {
  BottomSheet,
  EmptyState,
  FormField,
  IconButton,
  LoadingState,
  ModalConfirmationDialog,
  SecondaryButton,
  Toast,
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
  const [removeDayConfirmation, setRemoveDayConfirmation] = useState<{
    id: string
    name: string
  } | null>(null)
  const [removedExercise, setRemovedExercise] = useState<
    TemplateWorkoutExercise | ActiveCycleWorkoutExercise | null
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

  function removeDayConfirmed() {
    if (!removeDayConfirmation) {
      return
    }

    const target = removeDayConfirmation
    setRemoveDayConfirmation(null)
    run(
      mode === 'template'
        ? programRepository.removeTemplateDay(target.id)
        : programRepository.removeActiveCycleDay(target.id),
    )
  }

  function removeExerciseWithUndo(
    exercise: TemplateWorkoutExercise | ActiveCycleWorkoutExercise,
  ) {
    setStructure((current) =>
      current
        ? {
            ...current,
            exercisesByDay: {
              ...current.exercisesByDay,
              [exercise.dayId]: (current.exercisesByDay[exercise.dayId] ?? [])
                .filter((entry) => entry.id !== exercise.id)
                .map((entry, orderIndex) => ({ ...entry, orderIndex })),
            },
          }
        : current,
    )
    setRemovedExercise(exercise)
    persistOptimistically(
      mode === 'template'
        ? programRepository.removeTemplateExercise(exercise.id)
        : programRepository.removeActiveCycleExercise(exercise.id),
    )
  }

  function undoRemoveExercise() {
    const exercise = removedExercise
    setRemovedExercise(null)
    if (!exercise) {
      return
    }
    const action =
      'activeCycleId' in exercise
        ? programRepository.restoreActiveCycleExercise(exercise)
        : programRepository.restoreTemplateExercise(exercise)
    void action
      .then(() => {
        setError(null)
        refresh()
      })
      .catch((caught: unknown) => {
        setError(
          caught instanceof Error
            ? caught.message
            : 'Exercise could not be restored.',
        )
      })
  }

  function moveExerciseToDay(exerciseId: string, targetDayId: string) {
    if (!structure || !selectedDay) {
      return
    }
    const sourceDayId = selectedDay.id
    const exercise = (structure.exercisesByDay[sourceDayId] ?? []).find(
      (entry) => entry.id === exerciseId,
    )
    if (!exercise) {
      return
    }
    setStructure((current) => {
      if (!current) {
        return current
      }
      const targetExercises = current.exercisesByDay[targetDayId] ?? []
      return {
        ...current,
        exercisesByDay: {
          ...current.exercisesByDay,
          [sourceDayId]: (current.exercisesByDay[sourceDayId] ?? [])
            .filter((entry) => entry.id !== exerciseId)
            .map((entry, orderIndex) => ({ ...entry, orderIndex })),
          [targetDayId]: [
            ...targetExercises,
            {
              ...exercise,
              dayId: targetDayId,
              orderIndex: targetExercises.length,
            },
          ],
        },
      }
    })
    persistOptimistically(
      mode === 'template'
        ? programRepository.moveTemplateExercise(exerciseId, targetDayId)
        : programRepository.moveActiveCycleExercise(exerciseId, targetDayId),
    )
  }

  function handleBuilderDragEnd(activeId: string, overId: string | null) {
    if (!structure || !overId || activeId === overId) {
      return
    }
    const dayIds = structure.days.map((day) => day.id)
    const activeIsDay = dayIds.includes(activeId)
    const overIsDay = dayIds.includes(overId)
    if (activeIsDay && overIsDay) {
      const next = reorderIds(dayIds, activeId, overId)
      if (next) {
        reorderDays(next)
      }
      return
    }
    if (!activeIsDay && overIsDay) {
      if (selectedDay && overId !== selectedDay.id) {
        moveExerciseToDay(activeId, overId)
      }
      return
    }
    if (!activeIsDay && selectedDay) {
      const ids = (structure.exercisesByDay[selectedDay.id] ?? []).map(
        (exercise) => exercise.id,
      )
      const next = reorderIds(ids, activeId, overId)
      if (next) {
        reorderExercises(selectedDay.id, next)
      }
    }
  }

  function builderItemLabel(id: string) {
    const day = structure?.days.find((entry) => entry.id === id)
    if (day) {
      return day.name
    }
    const exercises =
      structure && selectedDay
        ? (structure.exercisesByDay[selectedDay.id] ?? [])
        : []
    return (
      exercises.find((entry) => entry.id === id)?.exerciseSnapshot
        .exerciseName ?? 'Item'
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
              .filter((day) => day !== undefined)
              .map((day, orderIndex) => ({ ...day, orderIndex })),
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
            .filter((exercise) => exercise !== undefined)
            .map((exercise, orderIndex) => ({ ...exercise, orderIndex })),
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

            <SortableArea
              getItemLabel={builderItemLabel}
              onDragEnd={handleBuilderDragEnd}
            >
              {structure.days.length ? (
                <SortableZone
                  direction="horizontal"
                  itemIds={structure.days.map((day) => day.id)}
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
                </SortableZone>
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
                        <small className="rename-field-hint">
                          Tap to rename
                        </small>
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
                        disabled={
                          selectedDayIndex === structure.days.length - 1
                        }
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
                          setRemoveDayConfirmation({
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
                    <SortableZone
                      itemIds={(
                        structure.exercisesByDay[selectedDay.id] ?? []
                      ).map((exercise) => exercise.id)}
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
                                  <button
                                    aria-label={`Edit ${prescribed.exerciseSnapshot.exerciseName} prescription`}
                                    className="program-prescription-body"
                                    onClick={() =>
                                      setEditingPrescription({
                                        dayId: selectedDay.id,
                                        exercise: prescribed,
                                      })
                                    }
                                    type="button"
                                  >
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
                                  </button>
                                  <div className="row-actions">
                                    <IconButton
                                      aria-label={`Remove ${prescribed.exerciseSnapshot.exerciseName} prescription`}
                                      onClick={() =>
                                        removeExerciseWithUndo(prescribed)
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
                    </SortableZone>
                  </div>
                ) : (
                  <EmptyState
                    title="No workout days"
                    message="Add a workout day to begin programming exercises."
                  />
                )}
              </div>
            </SortableArea>
          </>
        ) : null}
        {error ? <ValidationMessage message={error} /> : null}
      </BottomSheet>
      <Toast
        actionLabel="Undo"
        durationMs={6000}
        message={
          removedExercise
            ? `Removed ${removedExercise.exerciseSnapshot.exerciseName}`
            : null
        }
        onAction={undoRemoveExercise}
        onDismiss={() => setRemovedExercise(null)}
        tone="neutral"
      />
      <ModalConfirmationDialog
        confirmLabel="Delete Day"
        isOpen={removeDayConfirmation !== null}
        onCancel={() => setRemoveDayConfirmation(null)}
        onConfirm={removeDayConfirmed}
        title="Remove workout day?"
      >
        <p>
          {`${removeDayConfirmation?.name ?? 'This day'} and its programmed exercises will be permanently deleted. Completed workout history is preserved.`}
        </p>
      </ModalConfirmationDialog>
    </>
  )
}
