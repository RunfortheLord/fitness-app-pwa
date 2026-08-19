import { useLiveQuery } from 'dexie-react-hooks'

import { settingsRepository } from '@repositories/settingsRepository'

/**
 * Whether RIR fields and prompts should render, kept live so toggling the
 * Settings switch updates open screens immediately. Defaults to disabled
 * until settings load.
 */
export function useRirTracking(): boolean {
  const enabled = useLiveQuery(
    async () => (await settingsRepository.getSettings())?.rirTrackingEnabled,
    [],
  )
  return enabled ?? false
}
