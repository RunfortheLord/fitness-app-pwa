import { ArrowLeft, Dumbbell, Search } from 'lucide-react'
import { useEffect, useState } from 'react'

import {
  Card,
  EmptyState,
  FormField,
  IconButton,
  LoadingState,
  SecondaryButton,
  ValidationMessage,
} from '@components/ui'
import { programRepository } from '@repositories/programRepository'
import type {
  ProgramTemplate,
  ProgramTemplateDay,
  TemplateWorkoutExercise,
} from '@shared-types/app'

import type { LoadStatus } from './types'

export function BrowseProgramsPage({
  addedNames,
  loadStatus,
  onActivate,
  onAdd,
  onBack,
  onPreview,
  query,
  setQuery,
  templates,
}: {
  addedNames: Set<string>
  loadStatus: LoadStatus
  onActivate: (template: ProgramTemplate) => void
  onAdd: (templateId: string) => void
  onBack: () => void
  onPreview: (template: ProgramTemplate) => void
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

  return (
    <Card className="subpage-enter">
      <div className="set-goal-header">
        <IconButton aria-label="Back to training" onClick={onBack}>
          <ArrowLeft aria-hidden="true" size={20} />
        </IconButton>
        <h2 className="set-goal-title">Browse programs</h2>
      </div>
      <p className="muted">
        Add a built-in program to your library to activate or customize it. The
        built-in stays unchanged.
      </p>
      <FormField id="browse-programs-search" label="Search programs">
        <div className="input-icon-row">
          <Search aria-hidden="true" size={18} />
          <input
            id="browse-programs-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search programs"
            type="search"
            value={query}
          />
        </div>
      </FormField>
      {loadStatus === 'loading' ? (
        <LoadingState label="Loading programs" />
      ) : null}
      {loadStatus === 'ready' && !filteredTemplates.length ? (
        <EmptyState title="No programs found" message="Try another search." />
      ) : null}
      {loadStatus === 'ready' && filteredTemplates.length ? (
        <div className="program-library-list program-browse-list">
          {filteredTemplates.map((template) => (
            <div
              className="program-template-row program-browse-row"
              key={template.id}
            >
              <button
                aria-label={`Preview ${template.name}`}
                className="program-preview-trigger"
                type="button"
                onClick={() => onPreview(template)}
              >
                <strong>{template.name}</strong>
                <small>
                  {[template.level, template.goal].filter(Boolean).join(' · ')}
                </small>
              </button>
              <div className="row-actions">
                <IconButton
                  aria-label={`Activate ${template.name}`}
                  onClick={() => onActivate(template)}
                >
                  <Dumbbell aria-hidden="true" size={18} />
                </IconButton>
                {addedNames.has(template.name) ? (
                  <span className="program-added-tag">Added ✓</span>
                ) : (
                  <SecondaryButton
                    aria-label={`Add ${template.name} to library`}
                    type="button"
                    onClick={() => onAdd(template.id)}
                  >
                    Add to library
                  </SecondaryButton>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  )
}

function formatPreviewPrescription(exercise: TemplateWorkoutExercise) {
  const reps =
    exercise.targetRepsMin != null && exercise.targetRepsMax != null
      ? exercise.targetRepsMin === exercise.targetRepsMax
        ? `${exercise.targetRepsMin}`
        : `${exercise.targetRepsMin}–${exercise.targetRepsMax}`
      : null
  const setsAndReps = reps
    ? `${exercise.targetSetCount} × ${reps}`
    : `${exercise.targetSetCount} sets`
  const rir = exercise.targetRir != null ? `${exercise.targetRir} RIR` : null
  return [setsAndReps, rir].filter(Boolean).join(' · ')
}

export function ProgramPreviewPage({
  isAdded,
  onActivate,
  onAdd,
  onBack,
  template,
}: {
  isAdded: boolean
  onActivate: (template: ProgramTemplate) => void
  onAdd: (templateId: string) => void
  onBack: () => void
  template: ProgramTemplate
}) {
  const [structure, setStructure] = useState<{
    days: ProgramTemplateDay[]
    exercisesByDay: Record<string, TemplateWorkoutExercise[]>
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const subtitle = [template.level, template.goal].filter(Boolean).join(' · ')

  useEffect(() => {
    let isCurrent = true
    void programRepository
      .getTemplateStructure(template.id)
      .then((loaded) => {
        if (!isCurrent) {
          return
        }
        setStructure({
          days: loaded.days,
          exercisesByDay: loaded.exercisesByDay,
        })
      })
      .catch((caught: unknown) => {
        if (!isCurrent) {
          return
        }
        setError(
          caught instanceof Error ? caught.message : 'Program could not load.',
        )
      })
    return () => {
      isCurrent = false
    }
  }, [template.id])

  return (
    <Card className="subpage-enter">
      <div className="set-goal-header">
        <IconButton aria-label="Back to browse programs" onClick={onBack}>
          <ArrowLeft aria-hidden="true" size={20} />
        </IconButton>
        <h2 className="set-goal-title">{template.name}</h2>
      </div>
      {subtitle ? <p className="muted">{subtitle}</p> : null}
      {template.notes ? <p className="muted">{template.notes}</p> : null}
      <div className="row-actions">
        <SecondaryButton type="button" onClick={() => onActivate(template)}>
          Activate
        </SecondaryButton>
        {isAdded ? (
          <span className="program-added-tag">Added ✓</span>
        ) : (
          <SecondaryButton
            aria-label={`Add ${template.name} to library`}
            type="button"
            onClick={() => onAdd(template.id)}
          >
            Add to library
          </SecondaryButton>
        )}
      </div>
      {error ? <ValidationMessage message={error} /> : null}
      {!structure ? <LoadingState label="Loading program" /> : null}
      {structure
        ? structure.days.map((day) => (
            <section className="program-preview-day" key={day.id}>
              <h3>{day.name}</h3>
              <ul className="program-preview-exercises">
                {(structure.exercisesByDay[day.id] ?? []).map((exercise) => (
                  <li key={exercise.id}>
                    <span className="program-preview-exercise-name">
                      {exercise.exerciseSnapshot.exerciseName}
                    </span>
                    <small className="program-preview-exercise-summary">
                      {formatPreviewPrescription(exercise)}
                    </small>
                    {exercise.notes ? <small>{exercise.notes}</small> : null}
                  </li>
                ))}
              </ul>
            </section>
          ))
        : null}
    </Card>
  )
}
