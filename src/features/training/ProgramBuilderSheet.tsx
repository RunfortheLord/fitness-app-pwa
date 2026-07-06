import { Check, Copy, Edit2, Plus, Trash2, X } from 'lucide-react'
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
import {
  hasSearchableQuery,
  searchExercises,
  type ExerciseUsageSummary,
} from '@domain/exerciseSearch'
import { useRirTracking } from '@hooks/useRirTracking'
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

import { formatEquipment } from './exerciseMetadata'
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
  const [isAddingDay, setIsAddingDay] = useState(false)
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
  const [quickAddQuery, setQuickAddQuery] = useState('')
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false)
  const [isPrescriptionDirty, setIsPrescriptionDirty] = useState(false)
  const [isDiscardPrescriptionOpen, setIsDiscardPrescriptionOpen] =
    useState(false)

  const mode: BuilderMode = target.mode
  const rirEnabled = useRirTracking()
  const trackRirEverySet = structure?.record.trackRirEverySet ?? false

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
  const quickAddResults = hasSearchableQuery(quickAddQuery)
    ? searchExercises(exercises, quickAddQuery, exerciseUsage, 5)
    : []

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

  function saveTrackRirEverySet(nextValue: boolean) {
    if (!structure || nextValue === trackRirEverySet) {
      return
    }
    run(
      mode === 'template'
        ? programRepository.updateProgramTemplate(structure.record.id, {
            trackRirEverySet: nextValue,
          })
        : programRepository.updateActiveCycle(structure.record.id, {
            trackRirEverySet: nextValue,
          }),
    )
  }

  function closePrescription() {
    if (isPrescriptionDirty) {
      setIsDiscardPrescriptionOpen(true)
      return
    }
    setEditingPrescription(null)
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
    setIsAddingDay(false)
  }

  function cancelAddDay() {
    setDayName('')
    setIsAddingDay(false)
    setError(null)
  }

  function selectDay(dayId: string) {
    saveName()
    setSelectedDayId(dayId)
    setQuickAddQuery('')
    setIsSelecting(false)
    setSelectedExerciseIds(new Set())
  }

  function quickAddExercise(exerciseId: string) {
    if (!selectedDay) {
      return
    }
    setQuickAddQuery('')
    // Same default the prescription form starts from; everything is editable
    // afterwards by tapping the row.
    const input = { exerciseId, targetSetCount: 3 }
    run(
      mode === 'template'
        ? programRepository.addTemplateExercise(selectedDay.id, input)
        : programRepository.addActiveCycleExercise(selectedDay.id, input),
    )
  }

  function duplicateExercise(exerciseId: string) {
    run(
      mode === 'template'
        ? programRepository.duplicateTemplateExercise(exerciseId)
        : programRepository.duplicateActiveCycleExercise(exerciseId),
    )
  }

  function toggleExerciseSelected(exerciseId: string) {
    setSelectedExerciseIds((current) => {
      const next = new Set(current)
      if (next.has(exerciseId)) {
        next.delete(exerciseId)
      } else {
        next.add(exerciseId)
      }
      return next
    })
  }

  function selectedIdsInDisplayOrder() {
    if (!structure || !selectedDay) {
      return []
    }
    return (structure.exercisesByDay[selectedDay.id] ?? [])
      .map((exercise) => exercise.id)
      .filter((id) => selectedExerciseIds.has(id))
  }

  function bulkMoveSelected(targetDayId: string) {
    const ids = selectedIdsInDisplayOrder()
    if (!ids.length) {
      return
    }
    setIsSelecting(false)
    setSelectedExerciseIds(new Set())
    run(
      (async () => {
        for (const id of ids) {
          await (mode === 'template'
            ? programRepository.moveTemplateExercise(id, targetDayId)
            : programRepository.moveActiveCycleExercise(id, targetDayId))
        }
      })(),
    )
  }

  function bulkDeleteSelected() {
    const ids = selectedIdsInDisplayOrder()
    setIsBulkDeleteConfirmOpen(false)
    if (!ids.length) {
      return
    }
    setIsSelecting(false)
    setSelectedExerciseIds(new Set())
    run(
      (async () => {
        for (const id of ids) {
          await (mode === 'template'
            ? programRepository.removeTemplateExercise(id)
            : programRepository.removeActiveCycleExercise(id))
        }
      })(),
    )
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
            closePrescription()
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
            onClose={closePrescription}
            onDirtyChange={setIsPrescriptionDirty}
            onSaved={() => {
              setIsPrescriptionDirty(false)
              setEditingPrescription(null)
              refresh()
            }}
            target={editingPrescription}
            trackRirEverySet={trackRirEverySet}
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

            {rirEnabled ? (
              <label className="checkbox-row">
                <input
                  checked={trackRirEverySet}
                  onChange={(event) =>
                    saveTrackRirEverySet(event.currentTarget.checked)
                  }
                  type="checkbox"
                />
                Track RIR on every set?
              </label>
            ) : null}

            <SortableArea
              getItemLabel={builderItemLabel}
              onDragEnd={handleBuilderDragEnd}
            >
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
                  {isAddingDay ? (
                    <form
                      className="program-day-add-form"
                      onSubmit={(event) => {
                        event.preventDefault()
                        addDay()
                      }}
                    >
                      <input
                        aria-label="New workout day name"
                        autoFocus
                        onChange={(event) => setDayName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') {
                            cancelAddDay()
                          }
                        }}
                        placeholder="Day name"
                        value={dayName}
                      />
                      <IconButton
                        aria-label="Save workout day"
                        disabled={!dayName.trim()}
                        type="submit"
                      >
                        <Check aria-hidden="true" size={18} />
                      </IconButton>
                      <IconButton
                        aria-label="Cancel adding workout day"
                        onClick={cancelAddDay}
                        type="button"
                      >
                        <X aria-hidden="true" size={18} />
                      </IconButton>
                    </form>
                  ) : (
                    <IconButton
                      aria-label="Add workout day"
                      className="program-day-add-button"
                      onClick={() => setIsAddingDay(true)}
                    >
                      <Plus aria-hidden="true" size={20} />
                    </IconButton>
                  )}
                </div>
              </SortableZone>

              <div className="program-builder-days">
                {selectedDay ? (
                  <div
                    className="program-builder-day"
                    key={selectedDay.id}
                    {...daySwipe}
                  >
                    {selectedDay.notes ? (
                      <small className="program-builder-day-notes">
                        {selectedDay.notes}
                      </small>
                    ) : null}
                    <div className="button-row">
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
                        Remove day
                      </SecondaryButton>
                    </div>

                    <div className="button-row">
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
                      <SecondaryButton
                        disabled={
                          !(structure.exercisesByDay[selectedDay.id] ?? [])
                            .length
                        }
                        type="button"
                        onClick={() => {
                          setIsSelecting((current) => !current)
                          setSelectedExerciseIds(new Set())
                        }}
                      >
                        {isSelecting ? 'Done' : 'Select'}
                      </SecondaryButton>
                    </div>
                    {isSelecting ? (
                      <div className="bulk-actions">
                        <span className="bulk-actions-count">
                          {selectedExerciseIds.size} selected
                        </span>
                        <select
                          aria-label="Move selected exercises to day"
                          disabled={!selectedExerciseIds.size}
                          onChange={(event) => {
                            if (event.target.value) {
                              bulkMoveSelected(event.target.value)
                            }
                          }}
                          value=""
                        >
                          <option value="">Move to…</option>
                          {structure.days
                            .filter((day) => day.id !== selectedDay.id)
                            .map((day) => (
                              <option key={day.id} value={day.id}>
                                {day.name}
                              </option>
                            ))}
                        </select>
                        <SecondaryButton
                          className="button-danger"
                          disabled={!selectedExerciseIds.size}
                          type="button"
                          onClick={() => setIsBulkDeleteConfirmOpen(true)}
                        >
                          Delete
                        </SecondaryButton>
                      </div>
                    ) : null}
                    <SortableZone
                      itemIds={(
                        structure.exercisesByDay[selectedDay.id] ?? []
                      ).map((exercise) => exercise.id)}
                    >
                      <div className="program-prescription-list">
                        {(structure.exercisesByDay[selectedDay.id] ?? []).map(
                          (prescribed) => {
                            const exerciseName =
                              prescribed.exerciseSnapshot.exerciseName
                            const exerciseRecord = exercises.find(
                              (entry) => entry.id === prescribed.exerciseId,
                            )
                            const isSelected = selectedExerciseIds.has(
                              prescribed.id,
                            )
                            return (
                              <SortableListItem
                                className={`program-prescription-row sortable-row${
                                  isSelected ? ' is-selected' : ''
                                }`}
                                disabled={isSelecting}
                                id={prescribed.id}
                                key={prescribed.id}
                              >
                                {(drag) => (
                                  <>
                                    {isSelecting ? (
                                      <span className="program-prescription-check">
                                        <input
                                          aria-label={`Select ${exerciseName}`}
                                          checked={isSelected}
                                          onChange={() =>
                                            toggleExerciseSelected(
                                              prescribed.id,
                                            )
                                          }
                                          type="checkbox"
                                        />
                                      </span>
                                    ) : (
                                      <SortableDragHandle
                                        drag={drag}
                                        label={`Reorder ${exerciseName}`}
                                      />
                                    )}
                                    <button
                                      aria-label={
                                        isSelecting
                                          ? `Select ${exerciseName}`
                                          : `Edit ${exerciseName} prescription`
                                      }
                                      className="program-prescription-body"
                                      onClick={() => {
                                        if (isSelecting) {
                                          toggleExerciseSelected(prescribed.id)
                                          return
                                        }
                                        setEditingPrescription({
                                          dayId: selectedDay.id,
                                          exercise: prescribed,
                                        })
                                      }}
                                      type="button"
                                    >
                                      <strong>{exerciseName}</strong>
                                      <small>
                                        <PrescriptionSummaryText
                                          prescribed={prescribed}
                                        />
                                      </small>
                                      {exerciseRecord ? (
                                        <span className="exercise-chip-row">
                                          <span className="exercise-chip">
                                            {formatEquipment(
                                              exerciseRecord.equipmentType,
                                            )}
                                          </span>
                                          {exerciseRecord.primaryMuscleGroups
                                            .slice(0, 2)
                                            .map((muscle) => (
                                              <span
                                                className="exercise-chip"
                                                key={muscle}
                                              >
                                                {muscle}
                                              </span>
                                            ))}
                                        </span>
                                      ) : null}
                                      {prescribed.notes ? (
                                        <small>{prescribed.notes}</small>
                                      ) : null}
                                    </button>
                                    {!isSelecting ? (
                                      <div className="row-actions">
                                        <IconButton
                                          aria-label={`Duplicate ${exerciseName} prescription`}
                                          onClick={() =>
                                            duplicateExercise(prescribed.id)
                                          }
                                        >
                                          <Copy aria-hidden="true" size={18} />
                                        </IconButton>
                                        <IconButton
                                          aria-label={`Remove ${exerciseName} prescription`}
                                          onClick={() =>
                                            removeExerciseWithUndo(prescribed)
                                          }
                                        >
                                          <Trash2
                                            aria-hidden="true"
                                            size={18}
                                          />
                                        </IconButton>
                                      </div>
                                    ) : null}
                                  </>
                                )}
                              </SortableListItem>
                            )
                          },
                        )}
                        {!(structure.exercisesByDay[selectedDay.id] ?? [])
                          .length ? (
                          <p className="muted">No prescribed exercises.</p>
                        ) : null}
                      </div>
                    </SortableZone>
                    {!isSelecting ? (
                      <div className="quick-add">
                        <FormField
                          id="quick-add-exercise"
                          label="Quick add exercise"
                        >
                          <input
                            autoComplete="off"
                            id="quick-add-exercise"
                            onChange={(event) =>
                              setQuickAddQuery(event.target.value)
                            }
                            placeholder="Search to add with 3 sets"
                            value={quickAddQuery}
                          />
                        </FormField>
                        {hasSearchableQuery(quickAddQuery) ? (
                          <div className="quick-add-results">
                            {quickAddResults.map(({ exercise }) => (
                              <button
                                className="quick-add-result"
                                key={exercise.id}
                                onClick={() => quickAddExercise(exercise.id)}
                                type="button"
                              >
                                <Plus aria-hidden="true" size={16} />
                                <span>
                                  <strong>{exercise.name}</strong>
                                  <small>
                                    {formatEquipment(exercise.equipmentType)}
                                  </small>
                                </span>
                              </button>
                            ))}
                            {!quickAddResults.length ? (
                              <p className="muted">No matching exercises.</p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
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
      <ModalConfirmationDialog
        confirmLabel="Remove Exercises"
        isOpen={isBulkDeleteConfirmOpen}
        onCancel={() => setIsBulkDeleteConfirmOpen(false)}
        onConfirm={bulkDeleteSelected}
        title="Remove selected exercises?"
      >
        <p>
          {`${selectedExerciseIds.size} selected ${
            selectedExerciseIds.size === 1 ? 'exercise' : 'exercises'
          } will be removed from this workout day.`}
        </p>
      </ModalConfirmationDialog>
      <ModalConfirmationDialog
        confirmLabel="Discard"
        isOpen={isDiscardPrescriptionOpen}
        onCancel={() => setIsDiscardPrescriptionOpen(false)}
        onConfirm={() => {
          setIsDiscardPrescriptionOpen(false)
          setIsPrescriptionDirty(false)
          setEditingPrescription(null)
        }}
        title="Discard prescription changes?"
      >
        <p>Entered prescription values will be discarded.</p>
      </ModalConfirmationDialog>
    </>
  )
}
