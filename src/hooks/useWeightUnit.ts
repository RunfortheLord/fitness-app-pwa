import { useLiveQuery } from 'dexie-react-hooks'

import { settingsRepository } from '@repositories/settingsRepository'
import type { WeightUnit } from '@shared-types/app'

/**
 * The user's current weight-unit preference, kept live so a change in Settings
 * re-renders every weight across the app at once. Defaults to pounds until
 * settings load (and for the rare case where they are missing).
 */
export function useWeightUnit(): WeightUnit {
  const unit = useLiveQuery(
    async () => (await settingsRepository.getSettings())?.weightUnit,
    [],
  )
  return unit ?? 'lb'
}
