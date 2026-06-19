import { describe, expect, it } from 'vitest'

import {
  hasSearchableQuery,
  normalizeExerciseSearchText,
  searchExercises,
} from '@domain/exerciseSearch'
import type { Exercise } from '@shared-types/app'

const baseExercise: Exercise = {
  id: 'exercise',
  name: 'Exercise',
  notes: '',
  defaultRestSeconds: 120,
  defaultWeightIncrement: 5,
  trackingMethodId: 'weight_reps',
  trackingMetrics: [],
  primaryMuscleGroups: ['chest'],
  secondaryMuscleGroups: [],
  equipmentType: 'barbell',
  recordsRepsPerSide: false,
  origin: 'custom',
  seedDataVersion: null,
  status: 'active',
  createdAt: '2026-06-19T00:00:00.000Z',
  updatedAt: '2026-06-19T00:00:00.000Z',
}

describe('exercise search', () => {
  it('normalizes whitespace, punctuation, and capitalization', () => {
    expect(normalizeExerciseSearchText('  Smith--Machine   BENCH! ')).toBe(
      'smith machine bench',
    )
    expect(hasSearchableQuery(' b ')).toBe(false)
    expect(hasSearchableQuery(' be ')).toBe(true)
    expect(hasSearchableQuery('   ')).toBe(false)
  })

  it('ranks exact, prefix, word-boundary, recent, common, and substring results deterministically', () => {
    const exercises = [
      exercise('one', 'Incline Bench Press'),
      exercise('two', 'Bench Press'),
      exercise('three', 'Cable Bench Fly'),
      exercise(
        'builtin:barbell-bench-press',
        'Barbell Bench Press',
        'built_in',
      ),
      exercise('four', 'Floor Press Bench Setup'),
    ]

    const results = searchExercises(exercises, 'bench', {
      three: { count: 4, lastUsedAt: '2026-06-19T01:00:00.000Z' },
    })

    expect(results.map((result) => result.exercise.name)).toEqual([
      'Bench Press',
      'Cable Bench Fly',
      'Barbell Bench Press',
      'Incline Bench Press',
      'Floor Press Bench Setup',
    ])
  })

  it('omits hidden exercises and duplicate IDs', () => {
    const results = searchExercises(
      [
        exercise('one', 'Bench Press'),
        { ...exercise('one', 'Bench Press Duplicate'), id: 'one' },
        { ...exercise('hidden', 'Hidden Bench Press'), status: 'hidden' },
      ],
      'bench',
    )

    expect(results.map((result) => result.exercise.name)).toEqual([
      'Bench Press',
    ])
  })
})

function exercise(
  id: string,
  name: string,
  origin: Exercise['origin'] = 'custom',
): Exercise {
  return {
    ...baseExercise,
    id,
    name,
    origin,
    seedDataVersion: origin === 'built_in' ? 1 : null,
  }
}
