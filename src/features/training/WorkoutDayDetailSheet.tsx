import { ArrowLeft } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import {
  EmptyState,
  IconButton,
  ModalConfirmationDialog,
  PrimaryButton,
  SecondaryButton,
  ValidationMessage,
} from '@components/ui'
import { formatLocalDate } from '@domain/dates'
import { runRepository } from '@repositories/runRepository'
import { workoutRepository } from '@repositories/workoutRepository'

import { PrescriptionSummaryText } from './prescriptionSummary'
import type { SelectedDay } from './types'

/** The selected workout day is rendered as an in-flow Training subpage. */
export function WorkoutDayDetailPage({
  onClose,
  onEdit,
  onStarted,
  selectedDay,
}: {
  onClose: () => void
  onEdit: () => void
  onStarted: () => void
  selectedDay: SelectedDay
}) {
  const [error, setError] = useState<string | null>(null)
  const [existingWorkoutId, setExistingWorkoutId] = useState<string | null>(
    null,
  )
  const [existingRunId, setExistingRunId] = useState<string | null>(null)
  const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false)
  const titleRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    document.body.classList.add('workout-day-page-open')
    titleRef.current?.focus()
    return () => document.body.classList.remove('workout-day-page-open')
  }, [])

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
      <section
        className="workout-day-page subpage-enter"
        aria-labelledby="workout-day-page-title"
      >
        <div className="workout-day-page-header">
          <IconButton aria-label="Back to Current Program" onClick={onClose}>
            <ArrowLeft aria-hidden="true" size={20} />
          </IconButton>
          <h2 id="workout-day-page-title" ref={titleRef} tabIndex={-1}>
            {selectedDay.day.name}
          </h2>
        </div>
        <p className="sheet-context">
          {selectedDay.cycle.name} stays on this day until you choose another
          one.
        </p>
        {selectedDay.day.notes ? (
          <p className="muted">{selectedDay.day.notes}</p>
        ) : null}
        <div className="button-row workout-day-page-actions">
          {!existingWorkoutId && !existingRunId ? (
            <PrimaryButton
              disabled={!selectedDay.exercises.length}
              type="button"
              onClick={startWorkout}
            >
              Start Workout
            </PrimaryButton>
          ) : null}
          <SecondaryButton type="button" onClick={onEdit}>
            Edit program
          </SecondaryButton>
        </div>
        {selectedDay.exercises.length ? (
          <div className="program-prescription-list workout-day-prescription-list">
            {selectedDay.exercises.map((exercise) => (
              <div className="program-prescription-row" key={exercise.id}>
                <div>
                  <strong>{exercise.exerciseSnapshot.exerciseName}</strong>
                  <small>
                    <PrescriptionSummaryText prescribed={exercise} />
                  </small>
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
        ) : null}
      </section>
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
