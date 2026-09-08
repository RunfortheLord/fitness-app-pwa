import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { formatLocalDate } from '@domain/dates'
import { workoutRepository } from '@repositories/workoutRepository'

/**
 * Starts a program-less "quick" workout (no exercises) and opens the live
 * workout screen so the user can add exercises freely. Shared by the Training
 * header and the Home dashboard entry points.
 */
export function useStartQuickWorkout() {
  const navigate = useNavigate()
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function startQuickWorkout() {
    if (isStarting) {
      return
    }
    setIsStarting(true)
    setError(null)
    try {
      await workoutRepository.startEmptyWorkout({
        localDate: formatLocalDate(new Date()),
      })
      await navigate('/workout')
    } catch (caught) {
      // A workout is already in progress: open it rather than surfacing an
      // error, since the user's intent was to log a workout now.
      if (
        caught instanceof Error &&
        caught.message === 'An active workout already exists.'
      ) {
        await navigate('/workout')
        return
      }
      setError(
        caught instanceof Error
          ? caught.message
          : 'Quick workout could not start.',
      )
    } finally {
      setIsStarting(false)
    }
  }

  return { startQuickWorkout, isStarting, error }
}
