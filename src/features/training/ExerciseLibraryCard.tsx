import {
  ChevronDown,
  Dumbbell,
  Edit2,
  EyeOff,
  Filter,
  RotateCcw,
  Search,
} from 'lucide-react'
import { useState } from 'react'

import {
  Card,
  EmptyState,
  FormField,
  IconButton,
  LoadingState,
  SecondaryButton,
  StatusMessage,
} from '@components/ui'
import { useLanguage } from '@components/languageContextValue'
import {
  filterExerciseLibrary,
  primaryMuscleLabel,
  type ExerciseTrackingCategory,
} from '@domain/exerciseSearch'
import type { Exercise, MuscleGroup } from '@shared-types/app'

import { exerciseLibraryMetadata, metricSummary } from './exerciseMetadata'
import type { ExerciseView, LoadStatus } from './types'

export function ExerciseLibraryCard({
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
  loadStatus: LoadStatus
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
  const { t } = useLanguage()
  const [displayLimit, setDisplayLimit] = useState(80)
  const visibleExercises = filterExerciseLibrary(exercises, {
    primaryMuscle,
    query,
    trackingCategory,
  })
  const prioritizedExercises = [...visibleExercises].sort((left, right) => {
    const customOrder =
      Number(right.origin === 'custom') - Number(left.origin === 'custom')
    if (customOrder !== 0) {
      return customOrder
    }
    const leftIsVariant = isGeneratedExerciseVariant(left)
    const rightIsVariant = isGeneratedExerciseVariant(right)
    return (
      Number(leftIsVariant) - Number(rightIsVariant) ||
      left.name.localeCompare(right.name)
    )
  })
  const displayedExercises = prioritizedExercises.slice(0, displayLimit)

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
        <strong>{t('Exercise Library')}</strong>
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
                placeholder={t('Search your exercises')}
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
              <div
                className="segmented-control"
                aria-label={t('Tracking Method')}
              >
                {(['all', 'strength', 'cardio', 'distance'] as const).map(
                  (category) => (
                    <button
                      aria-pressed={trackingCategory === category}
                      key={category}
                      onClick={() => setTrackingCategory(category)}
                      type="button"
                    >
                      {t(
                        category === 'all'
                          ? 'All'
                          : category[0].toUpperCase() + category.slice(1),
                      )}
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
                    <option value="all">{t('All')}</option>
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

          {loadStatus === 'ready' && displayedExercises.length ? (
            <div className="exercise-list">
              {displayedExercises.map((exercise) => (
                <ExerciseLibraryRow
                  exercise={exercise}
                  key={exercise.id}
                  onEdit={() => onEditExercise(exercise)}
                  onHide={() => onHideExercise(exercise)}
                  onRestore={() => onRestoreExercise(exercise)}
                />
              ))}
              {displayedExercises.length < prioritizedExercises.length ? (
                <SecondaryButton
                  type="button"
                  onClick={() => setDisplayLimit((current) => current + 80)}
                >
                  Show more exercises
                </SecondaryButton>
              ) : null}
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

function isGeneratedExerciseVariant(exercise: Exercise) {
  return /^builtin:(?:paused|tempo|three-second-eccentric)-/u.test(exercise.id)
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
