import { ensureAppMetadata } from '@repositories/appMetadataRepository'

export async function initializeAppData() {
  await ensureAppMetadata()
}
