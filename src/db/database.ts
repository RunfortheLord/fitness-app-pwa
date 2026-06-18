import Dexie, { type EntityTable } from 'dexie'

import type {
  ActiveCycleWorkoutDay,
  ActiveCycleWorkoutExercise,
  ActiveProgramCycle,
  AppMetadata,
  AppliedWorkoutChange,
  BackupMetadata,
  BodyweightEntry,
  DetectedWorkoutChange,
  Exercise,
  Food,
  FoodLogEntry,
  NutritionTarget,
  ProgramTemplate,
  ProgramTemplateDay,
  TemplateWorkoutExercise,
  UserSettings,
  Workout,
  WorkoutExercise,
  WorkoutHistoryEntry,
  WorkoutHistoryExercise,
  WorkoutHistorySet,
  WorkoutSet,
} from '@shared-types/app'

export const DATABASE_SCHEMA_VERSION = 2
export const BACKUP_SCHEMA_VERSION = 1
export const DATABASE_NAME = 'training-log'

export class TrainingLogDatabase extends Dexie {
  appMetadata!: EntityTable<AppMetadata, 'id'>
  userSettings!: EntityTable<UserSettings, 'id'>
  nutritionTargets!: EntityTable<NutritionTarget, 'id'>
  foods!: EntityTable<Food, 'id'>
  foodLogEntries!: EntityTable<FoodLogEntry, 'id'>
  bodyweightEntries!: EntityTable<BodyweightEntry, 'id'>
  exercises!: EntityTable<Exercise, 'id'>
  programTemplates!: EntityTable<ProgramTemplate, 'id'>
  templateWorkoutDays!: EntityTable<ProgramTemplateDay, 'id'>
  templateWorkoutExercises!: EntityTable<TemplateWorkoutExercise, 'id'>
  activeProgramCycles!: EntityTable<ActiveProgramCycle, 'id'>
  activeCycleWorkoutDays!: EntityTable<ActiveCycleWorkoutDay, 'id'>
  activeCycleWorkoutExercises!: EntityTable<ActiveCycleWorkoutExercise, 'id'>
  workouts!: EntityTable<Workout, 'id'>
  workoutExercises!: EntityTable<WorkoutExercise, 'id'>
  workoutSets!: EntityTable<WorkoutSet, 'id'>
  workoutHistoryEntries!: EntityTable<WorkoutHistoryEntry, 'id'>
  workoutHistoryExercises!: EntityTable<WorkoutHistoryExercise, 'id'>
  workoutHistorySets!: EntityTable<WorkoutHistorySet, 'id'>
  detectedWorkoutChanges!: EntityTable<DetectedWorkoutChange, 'id'>
  appliedWorkoutChanges!: EntityTable<AppliedWorkoutChange, 'id'>
  backupMetadata!: EntityTable<BackupMetadata, 'id'>

  constructor(name = DATABASE_NAME) {
    super(name)

    this.version(1).stores({
      appMetadata: '&id',
      userSettings: '&id',
    })

    this.version(DATABASE_SCHEMA_VERSION)
      .stores({
        appMetadata: '&id',
        userSettings: '&id',
        nutritionTargets: '&id, updatedAt',
        foods: '&id, status, name, updatedAt',
        foodLogEntries: '&id, localDate, foodId, createdAt',
        bodyweightEntries: '&id, &localDate, createdAt',
        exercises: '&id, status, name, trackingMethodId, updatedAt',
        programTemplates: '&id, status, name, updatedAt',
        templateWorkoutDays: '&id, templateId, [templateId+orderIndex]',
        templateWorkoutExercises:
          '&id, templateId, dayId, exerciseId, [dayId+orderIndex]',
        activeProgramCycles: '&id, sourceTemplateId, status, activatedAt',
        activeCycleWorkoutDays:
          '&id, activeCycleId, sourceTemplateDayId, [activeCycleId+orderIndex]',
        activeCycleWorkoutExercises:
          '&id, activeCycleId, dayId, exerciseId, sourceTemplateExerciseId, [dayId+orderIndex]',
        workouts: '&id, status, localDate, sourceActiveCycleId, startedAt',
        workoutExercises: '&id, workoutId, exerciseId, [workoutId+orderIndex]',
        workoutSets:
          '&id, workoutId, workoutExerciseId, [workoutExerciseId+setNumber]',
        workoutHistoryEntries:
          '&id, localDate, sourceActiveCycleId, sourceTemplateId, completedAt',
        workoutHistoryExercises:
          '&id, workoutId, exerciseId, [workoutId+orderIndex]',
        workoutHistorySets:
          '&id, workoutId, workoutExerciseId, [workoutExerciseId+setNumber]',
        detectedWorkoutChanges: '&id, workoutId, status, type, createdAt',
        appliedWorkoutChanges: '&id, detectedChangeId, workoutId, appliedAt',
        backupMetadata: '&id, createdAt',
      })
      .upgrade(async (tx) => {
        const metadata = await tx.table<AppMetadata>('appMetadata').get('app')
        if (metadata) {
          await tx.table<AppMetadata>('appMetadata').put({
            ...metadata,
            databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
            backupSchemaVersion: BACKUP_SCHEMA_VERSION,
            updatedAt: new Date().toISOString(),
          })
        }
      })
  }
}

export const db = new TrainingLogDatabase()
