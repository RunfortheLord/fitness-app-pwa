import { TrainingLogDatabase } from '@db/database'

export function createTestDatabase() {
  return new TrainingLogDatabase(`training-log-test-${crypto.randomUUID()}`)
}

export async function resetTestDatabase(database: TrainingLogDatabase) {
  await database.delete()
  await database.open()
}

export async function destroyTestDatabase(database: TrainingLogDatabase) {
  database.close()
  await database.delete()
}
