import { useLiveQuery } from 'dexie-react-hooks'

import { getAppMetadata } from '@repositories/appMetadataRepository'

export function useAppMetadata() {
  return useLiveQuery(() => getAppMetadata(), [])
}
