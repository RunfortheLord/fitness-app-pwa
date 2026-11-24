import { z } from 'zod'
import { differenceInCalendarDays } from 'date-fns'
import {
  addLocalDays,
  formatLocalDate,
  parseLocalDate,
  type LocalDateString,
} from './dates'
import type {
  ActiveCycleWorkoutExercise,
  WorkoutHistorySet,
} from '@shared-types/app'

export const phaseNames = [
  'Deload',
  'Strength + hypertrophy',
  'Strength development',
  'Intensification',
  'Peaking',
  'Taper',
  'Max testing',
] as const
export const setKinds = [
  'warm-up',
  'top set',
  'back-off',
  'straight set',
  'technique set',
  'max attempt',
] as const
export const setPrescriptionSchema = z
  .object({
    kind: z.enum(setKinds),
    count: z.number().int().min(1).max(20),
    repsMin: z.number().int().min(1).max(100),
    repsMax: z.number().int().min(1).max(100),
    rir: z.number().min(0).max(10).nullable(),
    percent: z.number().min(0.1).max(1.05).optional(),
    startingWeight: z.number().min(0).optional(),
    restSeconds: z.number().int().min(0).max(1800).default(180),
  })
  .refine(
    (value) => value.repsMax >= value.repsMin,
    'Maximum reps must be at least minimum reps.',
  )
export const exercisePrescriptionSchema = z.object({
  sets: z.array(setPrescriptionSchema).max(12),
  optional: z.boolean().default(false),
  included: z.boolean().default(true),
  substitutionId: z.string().optional(),
  progression: z
    .enum(['double progression', 'capacity', 'hold', 'attempts'])
    .default('double progression'),
  referenceMax: z.number().positive().optional(),
  referenceExerciseId: z.string().optional(),
  referenceScale: z.number().positive().max(1).optional(),
  notes: z.string().default(''),
})
// Do not reuse .partial() on defaulted fields: Zod 4 applies inner defaults,
// which would turn a week-only set edit into unrelated phase overrides.
const overrideSchema = z.object({
  sets: z.array(setPrescriptionSchema).max(12).optional(),
  optional: z.boolean().optional(),
  included: z.boolean().optional(),
  substitutionId: z.string().optional(),
  progression: z
    .enum(['double progression', 'capacity', 'hold', 'attempts'])
    .optional(),
  referenceMax: z.number().positive().optional(),
  referenceExerciseId: z.string().optional(),
  referenceScale: z.number().positive().max(1).optional(),
  notes: z.string().optional(),
})
const calendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((date) => {
    const parsed = parseLocalDate(date as LocalDateString)
    return Number.isFinite(parsed.getTime()) && formatLocalDate(parsed) === date
  }, 'Choose a valid calendar date.')
export const periodizedPlanSchema = z
  .object({
    version: z.literal(1),
    // Existing plans remain available, but scheduling requires an explicit opt-in.
    enabled: z.boolean().optional(),
    startDate: calendarDateSchema,
    pausedOn: calendarDateSchema.optional(),
    defaults: z.record(z.string(), exercisePrescriptionSchema),
    phases: z
      .array(
        z.object({
          id: z.string(),
          name: z.string().min(1),
          startWeek: z.number().int().min(1),
          endWeek: z.number().int().min(1),
          overrides: z.record(z.string(), overrideSchema).default({}),
          dayNames: z.record(z.string(), z.string()).optional(),
          dayOffsets: z
            .record(z.string(), z.number().int().min(0).max(6))
            .optional(),
        }),
      )
      .min(1),
    weeks: z
      .array(
        z.object({
          phaseId: z.string(),
          overrides: z.record(z.string(), overrideSchema).default({}),
          dayOffsets: z
            .record(z.string(), z.number().int().min(0).max(6))
            .optional(),
        }),
      )
      .min(1)
      .max(104),
    dayOffsets: z.record(z.string(), z.number().int().min(0).max(6)),
  })
  .superRefine((plan, context) => {
    plan.weeks.forEach((week, index) => {
      if (
        !plan.phases.some(
          (phase) =>
            phase.id === week.phaseId &&
            index + 1 >= phase.startWeek &&
            index + 1 <= phase.endWeek,
        )
      ) {
        context.addIssue({
          code: 'custom',
          message: `Week ${index + 1} needs a phase covering that week.`,
        })
      }
    })
  })
export type PeriodizedPlan = z.infer<typeof periodizedPlanSchema>
export type ExercisePrescription = z.infer<typeof exercisePrescriptionSchema>
export type SetPrescription = z.infer<typeof setPrescriptionSchema>

export function programPosition(plan: PeriodizedPlan, date: LocalDateString) {
  const elapsed = differenceInCalendarDays(
    parseLocalDate((plan.pausedOn ?? date) as LocalDateString),
    parseLocalDate(plan.startDate as LocalDateString),
  )
  const week = Math.max(
    1,
    Math.min(plan.weeks.length, Math.floor(elapsed / 7) + 1),
  )
  const phase = plan.phases.find(
    (phase) => phase.id === plan.weeks[week - 1].phaseId,
  )!
  return {
    week,
    phase,
    beforeStart: elapsed < 0,
    finished: elapsed >= plan.weeks.length * 7,
    paused: Boolean(plan.pausedOn),
  }
}

export function resolvePrescription(
  plan: PeriodizedPlan,
  week: number,
  key: string,
): ExercisePrescription | undefined {
  const assigned = plan.weeks[week - 1]
  const base = plan.defaults[key]
  if (!assigned || !base) return undefined
  const phase = plan.phases.find((phase) => phase.id === assigned.phaseId)
  return { ...base, ...phase?.overrides[key], ...assigned.overrides[key] }
}

export function scheduledDate(
  plan: PeriodizedPlan,
  week: number,
  dayKey: string,
) {
  const assigned = plan.weeks[week - 1]
  const phase = plan.phases.find((phase) => phase.id === assigned?.phaseId)
  const offset =
    assigned?.dayOffsets?.[dayKey] ??
    phase?.dayOffsets?.[dayKey] ??
    plan.dayOffsets[dayKey] ??
    0
  return addLocalDays(
    plan.startDate as LocalDateString,
    (week - 1) * 7 + offset,
  )
}

export function prescriptionKey(exercise: ActiveCycleWorkoutExercise) {
  return exercise.sourceTemplateExerciseId ?? exercise.id
}

export function resolvePeriodizedExercise(
  plan: PeriodizedPlan,
  week: number,
  exercise: ActiveCycleWorkoutExercise,
): ActiveCycleWorkoutExercise | null {
  const prescription = resolvePrescription(
    plan,
    week,
    prescriptionKey(exercise),
  )
  if (!prescription) return exercise
  if (!prescription.included || !prescription.sets.length) return null
  const first = prescription.sets[0]
  return {
    ...exercise,
    targetSetCount: prescription.sets.reduce(
      (total, set) => total + set.count,
      0,
    ),
    targetRepsMin: first.repsMin,
    targetRepsMax: first.repsMax,
    targetRir: first.rir,
    targetWeight: first.startingWeight ?? null,
    notes: [prescription.optional ? 'Optional.' : '', prescription.notes]
      .filter(Boolean)
      .join(' '),
  }
}

export function remapPeriodizedPlan(
  plan: PeriodizedPlan,
  ids: Map<string, string>,
): PeriodizedPlan {
  const remap = <T>(record: Record<string, T>) =>
    Object.fromEntries(
      Object.entries(record).map(([key, value]) => [
        ids.get(key) ?? key,
        structuredClone(value),
      ]),
    )
  return {
    ...structuredClone(plan),
    defaults: remap(plan.defaults),
    dayOffsets: remap(plan.dayOffsets),
    phases: plan.phases.map((phase) => ({
      ...phase,
      overrides: remap(phase.overrides),
      dayOffsets: phase.dayOffsets ? remap(phase.dayOffsets) : undefined,
      dayNames: phase.dayNames ? remap(phase.dayNames) : undefined,
    })),
    weeks: plan.weeks.map((week) => ({
      ...week,
      overrides: remap(week.overrides),
      dayOffsets: week.dayOffsets ? remap(week.dayOffsets) : undefined,
    })),
  }
}

/** High-rep, failed, incomplete, warm-up and recovery work do not establish capacity. */
export function recentCapacity(sets: WorkoutHistorySet[], fallback?: number) {
  const estimates = sets
    .filter(
      (set) =>
        set.completed &&
        set.metricValues.failed !== true &&
        !['warm-up', 'technique set'].includes(set.plannedSet?.kind ?? ''),
    )
    .flatMap((set) => {
      const weight = set.metricValues.weight,
        reps = set.metricValues.reps
      if (
        typeof weight !== 'number' ||
        typeof reps !== 'number' ||
        weight <= 0 ||
        reps < 1 ||
        reps > 10
      )
        return []
      const reserve = Math.min(3, Math.max(0, set.rir ?? 0))
      return [weight * (reps === 1 && !reserve ? 1 : 1 + (reps + reserve) / 30)]
    })
  return estimates.length ? Math.max(...estimates) : (fallback ?? null)
}

export function recommendPeriodizedLoad(
  set: SetPrescription,
  prescription: ExercisePrescription,
  history: WorkoutHistorySet[],
  increment = 5,
) {
  const step = Number.isFinite(increment) && increment > 0 ? increment : 5
  const capacity = recentCapacity(history, prescription.referenceMax)
  if (!capacity) return set.startingWeight ?? null
  const percentage =
    set.percent ?? 1 / (1 + (set.repsMin + (set.rir ?? 2)) / 30)
  let calculated = Math.floor((capacity * percentage) / step) * step
  const comparable = history
    .filter(
      (prior) =>
        prior.completed &&
        prior.plannedSet?.kind === set.kind &&
        prior.plannedSet.repsMin === set.repsMin &&
        prior.plannedSet.repsMax === set.repsMax &&
        typeof prior.metricValues.weight === 'number',
    )
    .at(-1)
  if (
    comparable &&
    typeof comparable.metricValues.weight === 'number' &&
    prescription.progression === 'capacity'
  ) {
    const lastLoad = comparable.metricValues.weight
    const completedReps = comparable.metricValues.reps
    const increaseAllowed =
      typeof completedReps === 'number' &&
      completedReps >= set.repsMax &&
      comparable.rir != null &&
      comparable.rir >= (set.rir ?? 2) &&
      comparable.metricValues.failed !== true
    calculated = Math.max(
      lastLoad - step,
      Math.min(calculated, lastLoad + (increaseAllowed ? step : 0)),
    )
  }
  // Explicit starting weights apply only until real performance is available.
  return !history.length && set.startingWeight !== undefined
    ? set.startingWeight
    : calculated
}

export function recommendNextAttempt({
  capacity,
  previousWeight,
  succeeded,
  rir,
  speed,
  fourth = false,
}: {
  capacity: number
  previousWeight?: number
  succeeded?: boolean
  rir?: number | null
  speed?: 'fast' | 'normal' | 'slow'
  fourth?: boolean
}) {
  if (!previousWeight) return Math.floor((capacity * 0.9) / 5) * 5
  if (!succeeded || speed === 'slow' || (rir != null && rir <= 0)) return null
  if (fourth && (speed !== 'fast' || rir == null || rir < 1)) return null
  return Math.floor(
    Math.min(
      previousWeight + (speed === 'fast' && (rir ?? 0) >= 2 ? 10 : 5),
      capacity * 1.025,
    ) / 5,
  ) *
    5 >
    previousWeight
    ? Math.floor(
        Math.min(
          previousWeight + (speed === 'fast' && (rir ?? 0) >= 2 ? 10 : 5),
          capacity * 1.025,
        ) / 5,
      ) * 5
    : null
}
