export type AppMetadata = {
  id: 'app'
  databaseSchemaVersion: number
  backupSchemaVersion: number
  createdAt: string
  updatedAt: string
}

export type UserSettings = {
  id: string
  weightUnit: 'lb'
  energyUnit: 'kcal'
  createdAt: string
  updatedAt: string
}
