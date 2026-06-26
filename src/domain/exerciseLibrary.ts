import { getTrackingMethod } from '@domain/trackingMethods'
import type {
  Exercise,
  ExerciseEquipmentType,
  MuscleGroup,
  TrackingMethodId,
} from '@shared-types/app'

export const BUILT_IN_EXERCISE_SEED_VERSION = 7
export const BUILT_IN_EXERCISE_CREATED_AT = '2026-06-19T00:00:00.000Z'

export type BuiltInExerciseSeed = Pick<
  Exercise,
  | 'id'
  | 'name'
  | 'notes'
  | 'defaultRestSeconds'
  | 'defaultWeightIncrement'
  | 'trackingMethodId'
  | 'trackingMetrics'
  | 'primaryMuscleGroups'
  | 'secondaryMuscleGroups'
  | 'equipmentType'
  | 'recordsRepsPerSide'
  | 'origin'
  | 'seedDataVersion'
  | 'status'
  | 'createdAt'
  | 'updatedAt'
>

type SeedOptions = {
  increment?: number | null
  perSide?: boolean
  rest?: number
  secondary?: MuscleGroup[]
  tracking?: TrackingMethodId
}

const largeCompound = 180
const moderateCompound = 120
const isolation = 75
const shortIsolation = 60

function exercise(
  slug: string,
  name: string,
  equipmentType: ExerciseEquipmentType,
  primaryMuscleGroups: MuscleGroup[],
  options: SeedOptions = {},
): BuiltInExerciseSeed {
  const trackingMethodId =
    options.tracking ??
    (equipmentType === 'bodyweight' ? 'reps_only' : 'weight_reps')
  const trackingMethod = getTrackingMethod(trackingMethodId)
  if (!trackingMethod) {
    throw new Error(`Tracking method ${trackingMethodId} was not found.`)
  }

  return {
    id: `builtin:${slug}`,
    name,
    notes: '',
    defaultRestSeconds: options.rest ?? moderateCompound,
    defaultWeightIncrement:
      options.increment === undefined
        ? equipmentType === 'dumbbell'
          ? 2.5
          : trackingMethodId === 'reps_only' ||
              trackingMethodId === 'duration' ||
              trackingMethodId === 'distance_duration'
            ? null
            : 5
        : options.increment,
    trackingMethodId,
    trackingMetrics: trackingMethod.metrics,
    primaryMuscleGroups,
    secondaryMuscleGroups: options.secondary ?? [],
    equipmentType,
    recordsRepsPerSide: options.perSide ?? false,
    origin: 'built_in',
    seedDataVersion: BUILT_IN_EXERCISE_SEED_VERSION,
    status: 'active',
    createdAt: BUILT_IN_EXERCISE_CREATED_AT,
    updatedAt: BUILT_IN_EXERCISE_CREATED_AT,
  }
}

export const BUILT_IN_EXERCISES: BuiltInExerciseSeed[] = [
  exercise('barbell-bench-press', 'Barbell Bench Press', 'barbell', ['chest'], {
    rest: largeCompound,
    secondary: ['triceps', 'shoulders'],
  }),
  exercise(
    'barbell-close-grip-bench-press',
    'Close-Grip Barbell Bench Press',
    'barbell',
    ['triceps'],
    {
      rest: moderateCompound,
      secondary: ['chest', 'shoulders'],
    },
  ),
  exercise(
    'barbell-incline-bench-press',
    'Barbell Incline Bench Press',
    'barbell',
    ['chest'],
    {
      rest: largeCompound,
      secondary: ['shoulders', 'triceps'],
    },
  ),
  exercise(
    'barbell-decline-bench-press',
    'Barbell Decline Bench Press',
    'barbell',
    ['chest'],
    {
      rest: largeCompound,
      secondary: ['triceps'],
    },
  ),
  exercise(
    'barbell-overhead-press',
    'Barbell Overhead Press',
    'barbell',
    ['shoulders'],
    {
      rest: largeCompound,
      secondary: ['triceps', 'core'],
    },
  ),
  exercise(
    'barbell-push-press',
    'Barbell Push Press',
    'barbell',
    ['shoulders'],
    {
      rest: largeCompound,
      secondary: ['triceps', 'quadriceps', 'glutes'],
    },
  ),
  exercise('barbell-row', 'Barbell Row', 'barbell', ['back'], {
    rest: largeCompound,
    secondary: ['biceps', 'traps'],
  }),
  exercise('pendlay-row', 'Pendlay Row', 'barbell', ['back'], {
    rest: largeCompound,
    secondary: ['biceps', 'traps'],
  }),
  exercise('t-bar-row', 'T-Bar Row', 'barbell', ['back'], {
    rest: moderateCompound,
    secondary: ['biceps', 'traps'],
  }),
  exercise(
    'barbell-upright-row',
    'Barbell Upright Row',
    'barbell',
    ['shoulders'],
    {
      secondary: ['traps'],
    },
  ),
  exercise('barbell-shrug', 'Barbell Shrug', 'barbell', ['traps'], {
    rest: isolation,
  }),
  exercise(
    'high-bar-back-squat',
    'High-Bar Back Squat',
    'barbell',
    ['quadriceps'],
    {
      rest: largeCompound,
      secondary: ['glutes', 'hamstrings', 'core'],
    },
  ),
  exercise('low-bar-back-squat', 'Low-Bar Back Squat', 'barbell', ['glutes'], {
    rest: largeCompound,
    secondary: ['quadriceps', 'hamstrings', 'core'],
  }),
  exercise('front-squat', 'Front Squat', 'barbell', ['quadriceps'], {
    rest: largeCompound,
    secondary: ['glutes', 'core'],
  }),
  exercise('zercher-squat', 'Zercher Squat', 'barbell', ['quadriceps'], {
    rest: largeCompound,
    secondary: ['glutes', 'core', 'back'],
  }),
  exercise('barbell-lunge', 'Barbell Lunge', 'barbell', ['quadriceps'], {
    perSide: true,
    rest: moderateCompound,
    secondary: ['glutes', 'hamstrings'],
  }),
  exercise(
    'barbell-reverse-lunge',
    'Barbell Reverse Lunge',
    'barbell',
    ['glutes'],
    {
      perSide: true,
      rest: moderateCompound,
      secondary: ['quadriceps', 'hamstrings'],
    },
  ),
  exercise(
    'barbell-split-squat',
    'Barbell Split Squat',
    'barbell',
    ['quadriceps'],
    {
      perSide: true,
      rest: moderateCompound,
      secondary: ['glutes'],
    },
  ),
  exercise('barbell-hip-thrust', 'Barbell Hip Thrust', 'barbell', ['glutes'], {
    rest: moderateCompound,
    secondary: ['hamstrings'],
  }),
  exercise(
    'barbell-glute-bridge',
    'Barbell Glute Bridge',
    'barbell',
    ['glutes'],
    {
      rest: moderateCompound,
      secondary: ['hamstrings'],
    },
  ),
  exercise(
    'conventional-deadlift',
    'Conventional Deadlift',
    'barbell',
    ['back'],
    {
      rest: largeCompound,
      secondary: ['glutes', 'hamstrings', 'traps'],
    },
  ),
  exercise('sumo-deadlift', 'Sumo Deadlift', 'barbell', ['glutes'], {
    rest: largeCompound,
    secondary: ['hamstrings', 'quadriceps', 'back'],
  }),
  exercise(
    'romanian-deadlift',
    'Romanian Deadlift',
    'barbell',
    ['hamstrings'],
    {
      rest: largeCompound,
      secondary: ['glutes', 'back'],
    },
  ),
  exercise(
    'stiff-leg-deadlift',
    'Stiff-Leg Deadlift',
    'barbell',
    ['hamstrings'],
    {
      rest: moderateCompound,
      secondary: ['glutes', 'back'],
    },
  ),
  exercise(
    'barbell-good-morning',
    'Barbell Good Morning',
    'barbell',
    ['hamstrings'],
    {
      rest: moderateCompound,
      secondary: ['glutes', 'back'],
    },
  ),
  exercise('barbell-calf-raise', 'Barbell Calf Raise', 'barbell', ['calves'], {
    rest: isolation,
  }),
  exercise('barbell-curl', 'Barbell Curl', 'barbell', ['biceps'], {
    rest: isolation,
  }),
  exercise('ez-bar-curl', 'EZ-Bar Curl', 'barbell', ['biceps'], {
    rest: isolation,
    secondary: ['forearms'],
  }),
  exercise(
    'barbell-preacher-curl',
    'Barbell Preacher Curl',
    'barbell',
    ['biceps'],
    {
      rest: isolation,
    },
  ),
  exercise(
    'barbell-skull-crusher',
    'Barbell Skull Crusher',
    'barbell',
    ['triceps'],
    {
      rest: isolation,
    },
  ),
  exercise('barbell-floor-press', 'Barbell Floor Press', 'barbell', ['chest'], {
    rest: largeCompound,
    secondary: ['triceps', 'shoulders'],
  }),
  exercise('landmine-press', 'Landmine Press', 'barbell', ['shoulders'], {
    perSide: true,
    secondary: ['chest', 'triceps'],
  }),
  exercise('landmine-row', 'Landmine Row', 'barbell', ['back'], {
    secondary: ['biceps'],
  }),
  exercise('landmine-squat', 'Landmine Squat', 'barbell', ['quadriceps'], {
    secondary: ['glutes', 'core'],
  }),
  exercise('landmine-rotation', 'Landmine Rotation', 'barbell', ['core'], {
    perSide: true,
    rest: isolation,
    secondary: ['shoulders'],
  }),
  exercise('barbell-rollout', 'Barbell Rollout', 'barbell', ['core'], {
    rest: isolation,
    secondary: ['shoulders'],
  }),

  exercise(
    'dumbbell-bench-press',
    'Dumbbell Bench Press',
    'dumbbell',
    ['chest'],
    {
      rest: largeCompound,
      secondary: ['triceps', 'shoulders'],
    },
  ),
  exercise(
    'dumbbell-incline-bench-press',
    'Dumbbell Incline Bench Press',
    'dumbbell',
    ['chest'],
    {
      rest: largeCompound,
      secondary: ['shoulders', 'triceps'],
    },
  ),
  exercise(
    'dumbbell-decline-bench-press',
    'Dumbbell Decline Bench Press',
    'dumbbell',
    ['chest'],
    {
      rest: moderateCompound,
      secondary: ['triceps'],
    },
  ),
  exercise(
    'dumbbell-floor-press',
    'Dumbbell Floor Press',
    'dumbbell',
    ['chest'],
    {
      rest: moderateCompound,
      secondary: ['triceps'],
    },
  ),
  exercise('dumbbell-fly', 'Dumbbell Fly', 'dumbbell', ['chest'], {
    rest: isolation,
    secondary: ['shoulders'],
  }),
  exercise('dumbbell-pullover', 'Dumbbell Pullover', 'dumbbell', ['back'], {
    rest: isolation,
    secondary: ['chest'],
  }),
  exercise(
    'dumbbell-shoulder-press',
    'Dumbbell Shoulder Press',
    'dumbbell',
    ['shoulders'],
    {
      rest: moderateCompound,
      secondary: ['triceps'],
    },
  ),
  exercise('arnold-press', 'Arnold Press', 'dumbbell', ['shoulders'], {
    rest: moderateCompound,
    secondary: ['triceps'],
  }),
  exercise(
    'dumbbell-lateral-raise',
    'Dumbbell Lateral Raise',
    'dumbbell',
    ['shoulders'],
    {
      rest: isolation,
    },
  ),
  exercise(
    'dumbbell-front-raise',
    'Dumbbell Front Raise',
    'dumbbell',
    ['shoulders'],
    {
      rest: isolation,
    },
  ),
  exercise(
    'dumbbell-rear-delt-raise',
    'Dumbbell Rear Delt Raise',
    'dumbbell',
    ['shoulders'],
    {
      rest: isolation,
      secondary: ['traps'],
    },
  ),
  exercise(
    'dumbbell-upright-row',
    'Dumbbell Upright Row',
    'dumbbell',
    ['shoulders'],
    {
      secondary: ['traps'],
    },
  ),
  exercise('dumbbell-shrug', 'Dumbbell Shrug', 'dumbbell', ['traps'], {
    rest: isolation,
  }),
  exercise(
    'one-arm-dumbbell-row',
    'One-Arm Dumbbell Row',
    'dumbbell',
    ['back'],
    {
      perSide: true,
      rest: moderateCompound,
      secondary: ['biceps'],
    },
  ),
  exercise(
    'chest-supported-dumbbell-row',
    'Chest-Supported Dumbbell Row',
    'dumbbell',
    ['back'],
    {
      secondary: ['biceps', 'traps'],
    },
  ),
  exercise(
    'dumbbell-renegade-row',
    'Dumbbell Renegade Row',
    'dumbbell',
    ['back'],
    {
      perSide: true,
      secondary: ['core', 'shoulders'],
    },
  ),
  exercise(
    'dumbbell-goblet-squat',
    'Dumbbell Goblet Squat',
    'dumbbell',
    ['quadriceps'],
    {
      rest: moderateCompound,
      secondary: ['glutes', 'core'],
    },
  ),
  exercise(
    'dumbbell-front-squat',
    'Dumbbell Front Squat',
    'dumbbell',
    ['quadriceps'],
    {
      rest: moderateCompound,
      secondary: ['glutes'],
    },
  ),
  exercise(
    'dumbbell-split-squat',
    'Dumbbell Split Squat',
    'dumbbell',
    ['quadriceps'],
    {
      perSide: true,
      secondary: ['glutes'],
    },
  ),
  exercise(
    'dumbbell-bulgarian-split-squat',
    'Dumbbell Bulgarian Split Squat',
    'dumbbell',
    ['quadriceps'],
    {
      perSide: true,
      rest: moderateCompound,
      secondary: ['glutes'],
    },
  ),
  exercise('dumbbell-lunge', 'Dumbbell Lunge', 'dumbbell', ['quadriceps'], {
    perSide: true,
    secondary: ['glutes', 'hamstrings'],
  }),
  exercise(
    'dumbbell-reverse-lunge',
    'Dumbbell Reverse Lunge',
    'dumbbell',
    ['glutes'],
    {
      perSide: true,
      secondary: ['quadriceps', 'hamstrings'],
    },
  ),
  exercise('dumbbell-step-up', 'Dumbbell Step-Up', 'dumbbell', ['quadriceps'], {
    perSide: true,
    secondary: ['glutes'],
  }),
  exercise(
    'dumbbell-romanian-deadlift',
    'Dumbbell Romanian Deadlift',
    'dumbbell',
    ['hamstrings'],
    {
      rest: moderateCompound,
      secondary: ['glutes', 'back'],
    },
  ),
  exercise(
    'single-leg-dumbbell-romanian-deadlift',
    'Single-Leg Dumbbell Romanian Deadlift',
    'dumbbell',
    ['hamstrings'],
    {
      perSide: true,
      secondary: ['glutes', 'core'],
    },
  ),
  exercise(
    'dumbbell-hip-thrust',
    'Dumbbell Hip Thrust',
    'dumbbell',
    ['glutes'],
    {
      secondary: ['hamstrings'],
    },
  ),
  exercise(
    'dumbbell-calf-raise',
    'Dumbbell Calf Raise',
    'dumbbell',
    ['calves'],
    {
      rest: isolation,
    },
  ),
  exercise(
    'single-leg-dumbbell-calf-raise',
    'Single-Leg Dumbbell Calf Raise',
    'dumbbell',
    ['calves'],
    {
      perSide: true,
      rest: isolation,
    },
  ),
  exercise('dumbbell-curl', 'Dumbbell Curl', 'dumbbell', ['biceps'], {
    rest: isolation,
  }),
  exercise(
    'alternating-dumbbell-curl',
    'Alternating Dumbbell Curl',
    'dumbbell',
    ['biceps'],
    {
      perSide: true,
      rest: isolation,
    },
  ),
  exercise('hammer-curl', 'Hammer Curl', 'dumbbell', ['biceps'], {
    rest: isolation,
    secondary: ['forearms'],
  }),
  exercise(
    'incline-dumbbell-curl',
    'Incline Dumbbell Curl',
    'dumbbell',
    ['biceps'],
    {
      rest: isolation,
    },
  ),
  exercise('concentration-curl', 'Concentration Curl', 'dumbbell', ['biceps'], {
    perSide: true,
    rest: shortIsolation,
  }),
  exercise(
    'dumbbell-preacher-curl',
    'Dumbbell Preacher Curl',
    'dumbbell',
    ['biceps'],
    {
      rest: isolation,
    },
  ),
  exercise(
    'dumbbell-skull-crusher',
    'Dumbbell Skull Crusher',
    'dumbbell',
    ['triceps'],
    {
      rest: isolation,
    },
  ),
  exercise(
    'dumbbell-overhead-triceps-extension',
    'Dumbbell Overhead Triceps Extension',
    'dumbbell',
    ['triceps'],
    {
      rest: isolation,
    },
  ),
  exercise(
    'single-arm-dumbbell-overhead-triceps-extension',
    'Single-Arm Dumbbell Overhead Triceps Extension',
    'dumbbell',
    ['triceps'],
    {
      perSide: true,
      rest: shortIsolation,
    },
  ),
  exercise('dumbbell-kickback', 'Dumbbell Kickback', 'dumbbell', ['triceps'], {
    perSide: true,
    rest: shortIsolation,
  }),
  exercise('farmers-carry', "Farmer's Carry", 'dumbbell', ['forearms'], {
    increment: null,
    rest: moderateCompound,
    secondary: ['traps', 'core'],
    tracking: 'distance_duration',
  }),
  exercise(
    'single-arm-farmers-carry',
    'Single-Arm Farmer Carry',
    'dumbbell',
    ['core'],
    {
      increment: null,
      perSide: true,
      rest: moderateCompound,
      secondary: ['forearms', 'traps'],
      tracking: 'distance_duration',
    },
  ),

  exercise(
    'smith-machine-bench-press',
    'Smith Machine Bench Press',
    'machine',
    ['chest'],
    {
      rest: largeCompound,
      secondary: ['triceps', 'shoulders'],
    },
  ),
  exercise('machine-chest-press', 'Machine Chest Press', 'machine', ['chest'], {
    rest: moderateCompound,
    secondary: ['triceps', 'shoulders'],
  }),
  exercise(
    'machine-incline-chest-press',
    'Machine Incline Chest Press',
    'machine',
    ['chest'],
    {
      rest: moderateCompound,
      secondary: ['shoulders', 'triceps'],
    },
  ),
  exercise('pec-deck-fly', 'Pec Deck Fly', 'machine', ['chest'], {
    rest: isolation,
    secondary: ['shoulders'],
  }),
  exercise(
    'machine-shoulder-press',
    'Machine Shoulder Press',
    'machine',
    ['shoulders'],
    {
      secondary: ['triceps'],
    },
  ),
  exercise(
    'machine-lateral-raise',
    'Machine Lateral Raise',
    'machine',
    ['shoulders'],
    {
      rest: isolation,
    },
  ),
  exercise('reverse-pec-deck', 'Reverse Pec Deck', 'machine', ['shoulders'], {
    rest: isolation,
    secondary: ['traps'],
  }),
  exercise('machine-row', 'Machine Row', 'machine', ['back'], {
    secondary: ['biceps', 'traps'],
  }),
  exercise('chest-supported-row', 'Chest-Supported Row', 'machine', ['back'], {
    secondary: ['biceps', 'traps'],
  }),
  exercise('machine-high-row', 'Machine High Row', 'machine', ['back'], {
    secondary: ['biceps'],
  }),
  exercise('lat-pulldown', 'Lat Pulldown', 'machine', ['back'], {
    secondary: ['biceps'],
  }),
  exercise(
    'neutral-grip-lat-pulldown',
    'Neutral-Grip Lat Pulldown',
    'machine',
    ['back'],
    {
      secondary: ['biceps'],
    },
  ),
  exercise('machine-pullover', 'Machine Pullover', 'machine', ['back'], {
    rest: isolation,
    secondary: ['chest'],
  }),
  exercise('assisted-pull-up', 'Assisted Pull-Up', 'machine', ['back'], {
    increment: 5,
    rest: moderateCompound,
    secondary: ['biceps'],
    tracking: 'assisted_weight_reps',
  }),
  exercise('assisted-chin-up', 'Assisted Chin-Up', 'machine', ['back'], {
    increment: 5,
    rest: moderateCompound,
    secondary: ['biceps'],
    tracking: 'assisted_weight_reps',
  }),
  exercise('assisted-dip', 'Assisted Dip', 'machine', ['triceps'], {
    increment: 5,
    rest: moderateCompound,
    secondary: ['chest', 'shoulders'],
    tracking: 'assisted_weight_reps',
  }),
  exercise(
    'smith-machine-squat',
    'Smith Machine Squat',
    'machine',
    ['quadriceps'],
    {
      rest: largeCompound,
      secondary: ['glutes'],
    },
  ),
  exercise('hack-squat', 'Hack Squat', 'machine', ['quadriceps'], {
    rest: largeCompound,
    secondary: ['glutes'],
  }),
  exercise('leg-press', 'Leg Press', 'machine', ['quadriceps'], {
    rest: largeCompound,
    secondary: ['glutes', 'hamstrings'],
  }),
  exercise('single-leg-press', 'Single-Leg Press', 'machine', ['quadriceps'], {
    perSide: true,
    secondary: ['glutes'],
  }),
  exercise('leg-extension', 'Leg Extension', 'machine', ['quadriceps'], {
    rest: isolation,
  }),
  exercise(
    'leg-extension-single-leg',
    'Leg Extension (Single Leg)',
    'machine',
    ['quadriceps'],
    {
      perSide: true,
      rest: isolation,
    },
  ),
  exercise('seated-leg-curl', 'Seated Leg Curl', 'machine', ['hamstrings'], {
    rest: isolation,
  }),
  exercise('lying-leg-curl', 'Lying Leg Curl', 'machine', ['hamstrings'], {
    rest: isolation,
  }),
  exercise(
    'standing-leg-curl',
    'Standing Leg Curl',
    'machine',
    ['hamstrings'],
    {
      perSide: true,
      rest: isolation,
    },
  ),
  exercise('machine-hip-thrust', 'Machine Hip Thrust', 'machine', ['glutes'], {
    secondary: ['hamstrings'],
  }),
  exercise('glute-drive', 'Glute Drive', 'machine', ['glutes'], {
    secondary: ['hamstrings'],
  }),
  exercise(
    'hip-abduction-machine',
    'Hip Abduction Machine',
    'machine',
    ['hip abductors'],
    {
      rest: isolation,
      secondary: ['glutes'],
    },
  ),
  exercise(
    'hip-adduction-machine',
    'Hip Adduction Machine',
    'machine',
    ['hip adductors'],
    {
      rest: isolation,
    },
  ),
  exercise(
    'standing-calf-raise-machine',
    'Standing Calf Raise Machine',
    'machine',
    ['calves'],
    {
      rest: isolation,
    },
  ),
  exercise(
    'seated-calf-raise-machine',
    'Seated Calf Raise Machine',
    'machine',
    ['calves'],
    {
      rest: isolation,
    },
  ),
  exercise(
    'machine-biceps-curl',
    'Machine Biceps Curl',
    'machine',
    ['biceps'],
    {
      rest: isolation,
    },
  ),
  exercise(
    'machine-preacher-curl',
    'Machine Preacher Curl',
    'machine',
    ['biceps'],
    {
      rest: isolation,
    },
  ),
  exercise(
    'machine-triceps-extension',
    'Machine Triceps Extension',
    'machine',
    ['triceps'],
    {
      rest: isolation,
    },
  ),
  exercise('machine-ab-crunch', 'Machine Ab Crunch', 'machine', ['core'], {
    rest: isolation,
  }),
  exercise(
    'back-extension-machine',
    'Back Extension Machine',
    'machine',
    ['back'],
    {
      rest: isolation,
      secondary: ['glutes', 'hamstrings'],
    },
  ),

  exercise('seated-cable-row', 'Seated Cable Row', 'cable', ['back'], {
    secondary: ['biceps', 'traps'],
  }),
  exercise('single-arm-cable-row', 'Single-Arm Cable Row', 'cable', ['back'], {
    perSide: true,
    secondary: ['biceps'],
  }),
  exercise('wide-grip-cable-row', 'Wide-Grip Cable Row', 'cable', ['back'], {
    secondary: ['shoulders', 'traps'],
  }),
  exercise('cable-lat-pulldown', 'Cable Lat Pulldown', 'cable', ['back'], {
    secondary: ['biceps'],
  }),
  exercise(
    'straight-arm-pulldown',
    'Straight-Arm Pulldown',
    'cable',
    ['back'],
    {
      rest: isolation,
      secondary: ['triceps'],
    },
  ),
  exercise('cable-pullover', 'Cable Pullover', 'cable', ['back'], {
    rest: isolation,
    secondary: ['chest'],
  }),
  exercise('cable-face-pull', 'Cable Face Pull', 'cable', ['shoulders'], {
    rest: isolation,
    secondary: ['traps'],
  }),
  exercise(
    'cable-rear-delt-fly',
    'Cable Rear Delt Fly',
    'cable',
    ['shoulders'],
    {
      rest: isolation,
      secondary: ['traps'],
    },
  ),
  exercise(
    'cable-lateral-raise',
    'Cable Lateral Raise',
    'cable',
    ['shoulders'],
    {
      perSide: true,
      rest: isolation,
    },
  ),
  exercise('cable-front-raise', 'Cable Front Raise', 'cable', ['shoulders'], {
    perSide: true,
    rest: isolation,
  }),
  exercise('cable-upright-row', 'Cable Upright Row', 'cable', ['shoulders'], {
    secondary: ['traps'],
  }),
  exercise('cable-chest-press', 'Cable Chest Press', 'cable', ['chest'], {
    secondary: ['triceps', 'shoulders'],
  }),
  exercise(
    'single-arm-cable-chest-press',
    'Single-Arm Cable Chest Press',
    'cable',
    ['chest'],
    {
      perSide: true,
      secondary: ['triceps', 'shoulders'],
    },
  ),
  exercise('cable-fly', 'Cable Fly', 'cable', ['chest'], {
    rest: isolation,
    secondary: ['shoulders'],
  }),
  exercise(
    'low-to-high-cable-fly',
    'Low-to-High Cable Fly',
    'cable',
    ['chest'],
    {
      rest: isolation,
      secondary: ['shoulders'],
    },
  ),
  exercise(
    'high-to-low-cable-fly',
    'High-to-Low Cable Fly',
    'cable',
    ['chest'],
    {
      rest: isolation,
      secondary: ['shoulders'],
    },
  ),
  exercise('cable-crossover', 'Cable Crossover', 'cable', ['chest'], {
    rest: isolation,
    secondary: ['shoulders'],
  }),
  exercise('triceps-pushdown', 'Triceps Pushdown', 'cable', ['triceps'], {
    rest: isolation,
  }),
  exercise(
    'rope-triceps-pushdown',
    'Rope Triceps Pushdown',
    'cable',
    ['triceps'],
    {
      rest: isolation,
    },
  ),
  exercise(
    'overhead-cable-triceps-extension',
    'Overhead Cable Triceps Extension',
    'cable',
    ['triceps'],
    {
      rest: isolation,
    },
  ),
  exercise(
    'single-arm-cable-triceps-extension',
    'Single-Arm Cable Triceps Extension',
    'cable',
    ['triceps'],
    {
      perSide: true,
      rest: shortIsolation,
    },
  ),
  exercise('cable-biceps-curl', 'Cable Biceps Curl', 'cable', ['biceps'], {
    rest: isolation,
  }),
  exercise('rope-hammer-curl', 'Rope Hammer Curl', 'cable', ['biceps'], {
    rest: isolation,
    secondary: ['forearms'],
  }),
  exercise(
    'single-arm-cable-curl',
    'Single-Arm Cable Curl',
    'cable',
    ['biceps'],
    {
      perSide: true,
      rest: shortIsolation,
    },
  ),
  exercise('cable-preacher-curl', 'Cable Preacher Curl', 'cable', ['biceps'], {
    rest: isolation,
  }),
  exercise('cable-squat', 'Cable Squat', 'cable', ['quadriceps'], {
    secondary: ['glutes'],
  }),
  exercise('cable-pull-through', 'Cable Pull-Through', 'cable', ['glutes'], {
    secondary: ['hamstrings'],
  }),
  exercise(
    'cable-romanian-deadlift',
    'Cable Romanian Deadlift',
    'cable',
    ['hamstrings'],
    {
      secondary: ['glutes'],
    },
  ),
  exercise('cable-kickback', 'Cable Kickback', 'cable', ['glutes'], {
    perSide: true,
    rest: isolation,
  }),
  exercise(
    'cable-hip-abduction',
    'Cable Hip Abduction',
    'cable',
    ['hip abductors'],
    {
      perSide: true,
      rest: isolation,
      secondary: ['glutes'],
    },
  ),
  exercise(
    'cable-hip-adduction',
    'Cable Hip Adduction',
    'cable',
    ['hip adductors'],
    {
      perSide: true,
      rest: isolation,
    },
  ),
  exercise('cable-woodchop', 'Cable Woodchop', 'cable', ['core'], {
    perSide: true,
    rest: isolation,
    secondary: ['shoulders'],
  }),
  exercise('cable-pallof-press', 'Cable Pallof Press', 'cable', ['core'], {
    perSide: true,
    rest: isolation,
  }),
  exercise('cable-crunch', 'Cable Crunch', 'cable', ['core'], {
    rest: isolation,
  }),
  exercise('cable-shrug', 'Cable Shrug', 'cable', ['traps'], {
    rest: isolation,
  }),

  exercise('push-up', 'Push-Up', 'bodyweight', ['chest'], {
    rest: moderateCompound,
    secondary: ['triceps', 'shoulders'],
    tracking: 'reps_only',
  }),
  exercise('decline-push-up', 'Decline Push-Up', 'bodyweight', ['chest'], {
    secondary: ['shoulders', 'triceps'],
    tracking: 'reps_only',
  }),
  exercise('incline-push-up', 'Incline Push-Up', 'bodyweight', ['chest'], {
    secondary: ['triceps'],
    tracking: 'reps_only',
  }),
  exercise('diamond-push-up', 'Diamond Push-Up', 'bodyweight', ['triceps'], {
    secondary: ['chest', 'shoulders'],
    tracking: 'reps_only',
  }),
  exercise('pull-up', 'Pull-Up', 'bodyweight', ['back'], {
    rest: moderateCompound,
    secondary: ['biceps'],
    tracking: 'reps_only',
  }),
  exercise('scapular-pull-up', 'Scapular Pull-Up', 'bodyweight', ['back'], {
    rest: isolation,
    secondary: ['shoulders'],
    tracking: 'reps_only',
  }),
  exercise('chin-up', 'Chin-Up', 'bodyweight', ['back'], {
    rest: moderateCompound,
    secondary: ['biceps'],
    tracking: 'reps_only',
  }),
  exercise(
    'neutral-grip-pull-up',
    'Neutral-Grip Pull-Up',
    'bodyweight',
    ['back'],
    {
      rest: moderateCompound,
      secondary: ['biceps'],
      tracking: 'reps_only',
    },
  ),
  exercise('weighted-pull-up', 'Weighted Pull-Up', 'bodyweight', ['back'], {
    increment: 5,
    rest: largeCompound,
    secondary: ['biceps'],
    tracking: 'added_weight_reps',
  }),
  exercise('weighted-chin-up', 'Weighted Chin-Up', 'bodyweight', ['back'], {
    increment: 5,
    rest: largeCompound,
    secondary: ['biceps'],
    tracking: 'added_weight_reps',
  }),
  exercise('inverted-row', 'Inverted Row', 'bodyweight', ['back'], {
    secondary: ['biceps'],
    tracking: 'reps_only',
  }),
  exercise(
    'bodyweight-squat',
    'Bodyweight Squat',
    'bodyweight',
    ['quadriceps'],
    {
      secondary: ['glutes'],
      tracking: 'reps_only',
    },
  ),
  exercise('pistol-squat', 'Pistol Squat', 'bodyweight', ['quadriceps'], {
    perSide: true,
    secondary: ['glutes', 'core'],
    tracking: 'reps_only',
  }),
  exercise('split-squat', 'Split Squat', 'bodyweight', ['quadriceps'], {
    perSide: true,
    secondary: ['glutes'],
    tracking: 'reps_only',
  }),
  exercise('reverse-lunge', 'Reverse Lunge', 'bodyweight', ['glutes'], {
    perSide: true,
    secondary: ['quadriceps', 'hamstrings'],
    tracking: 'reps_only',
  }),
  exercise('walking-lunge', 'Walking Lunge', 'bodyweight', ['quadriceps'], {
    perSide: true,
    secondary: ['glutes', 'hamstrings'],
    tracking: 'reps_only',
  }),
  exercise('step-up', 'Step-Up', 'bodyweight', ['quadriceps'], {
    perSide: true,
    secondary: ['glutes'],
    tracking: 'reps_only',
  }),
  exercise('glute-bridge', 'Glute Bridge', 'bodyweight', ['glutes'], {
    secondary: ['hamstrings'],
    tracking: 'reps_only',
  }),
  exercise(
    'single-leg-glute-bridge',
    'Single-Leg Glute Bridge',
    'bodyweight',
    ['glutes'],
    {
      perSide: true,
      secondary: ['hamstrings'],
      tracking: 'reps_only',
    },
  ),
  exercise('hip-thrust', 'Hip Thrust', 'bodyweight', ['glutes'], {
    secondary: ['hamstrings'],
    tracking: 'reps_only',
  }),
  exercise(
    'single-leg-calf-raise',
    'Single-Leg Calf Raise',
    'bodyweight',
    ['calves'],
    {
      perSide: true,
      rest: isolation,
      tracking: 'reps_only',
    },
  ),
  exercise(
    'standing-calf-raise',
    'Standing Calf Raise',
    'bodyweight',
    ['calves'],
    {
      rest: isolation,
      tracking: 'reps_only',
    },
  ),
  exercise('dip', 'Dip', 'bodyweight', ['triceps'], {
    rest: moderateCompound,
    secondary: ['chest', 'shoulders'],
    tracking: 'reps_only',
  }),
  exercise('weighted-dip', 'Weighted Dip', 'bodyweight', ['triceps'], {
    increment: 5,
    rest: largeCompound,
    secondary: ['chest', 'shoulders'],
    tracking: 'added_weight_reps',
  }),
  exercise('bench-dip', 'Bench Dip', 'bodyweight', ['triceps'], {
    secondary: ['chest', 'shoulders'],
    tracking: 'reps_only',
  }),
  exercise('plank', 'Plank', 'bodyweight', ['core'], {
    increment: null,
    rest: shortIsolation,
    secondary: ['shoulders'],
    tracking: 'duration',
  }),
  exercise('side-plank', 'Side Plank', 'bodyweight', ['core'], {
    increment: null,
    perSide: true,
    rest: shortIsolation,
    secondary: ['shoulders'],
    tracking: 'duration',
  }),
  exercise('dead-bug', 'Dead Bug', 'bodyweight', ['core'], {
    perSide: true,
    rest: shortIsolation,
    tracking: 'reps_only',
  }),
  exercise('bird-dog', 'Bird Dog', 'bodyweight', ['core'], {
    perSide: true,
    rest: shortIsolation,
    secondary: ['glutes'],
    tracking: 'reps_only',
  }),
  exercise('hanging-knee-raise', 'Hanging Knee Raise', 'bodyweight', ['core'], {
    secondary: ['forearms'],
    tracking: 'reps_only',
  }),
  exercise('hanging-leg-raise', 'Hanging Leg Raise', 'bodyweight', ['core'], {
    secondary: ['forearms'],
    tracking: 'reps_only',
  }),
  exercise('sit-up', 'Sit-Up', 'bodyweight', ['core'], {
    rest: shortIsolation,
    tracking: 'reps_only',
  }),
  exercise('crunch', 'Crunch', 'bodyweight', ['core'], {
    rest: shortIsolation,
    tracking: 'reps_only',
  }),
  exercise('reverse-crunch', 'Reverse Crunch', 'bodyweight', ['core'], {
    rest: shortIsolation,
    tracking: 'reps_only',
  }),
  exercise('back-extension', 'Back Extension', 'bodyweight', ['back'], {
    rest: isolation,
    secondary: ['glutes', 'hamstrings'],
    tracking: 'added_weight_reps',
  }),
  exercise('dragon-flag', 'Dragon Flag', 'bodyweight', ['core'], {
    rest: isolation,
    secondary: ['glutes', 'hamstrings'],
    tracking: 'reps_only',
  }),
  exercise(
    'nordic-hamstring-curl',
    'Nordic Hamstring Curl',
    'bodyweight',
    ['hamstrings'],
    {
      rest: moderateCompound,
      secondary: ['glutes'],
      tracking: 'reps_only',
    },
  ),
  exercise('sissy-squat', 'Sissy Squat', 'bodyweight', ['quadriceps'], {
    tracking: 'reps_only',
  }),
  exercise('neck-flexion', 'Neck Flexion', 'bodyweight', ['traps'], {
    rest: shortIsolation,
    tracking: 'reps_only',
  }),
  exercise('neck-extension', 'Neck Extension', 'bodyweight', ['traps'], {
    rest: shortIsolation,
    tracking: 'reps_only',
  }),
  exercise(
    'neck-lateral-flexion',
    'Neck Lateral Flexion',
    'bodyweight',
    ['traps'],
    {
      perSide: true,
      rest: shortIsolation,
      tracking: 'reps_only',
    },
  ),
  exercise('dead-hang', 'Dead Hang', 'bodyweight', ['forearms'], {
    increment: null,
    rest: isolation,
    secondary: ['back'],
    tracking: 'duration',
  }),
  exercise('plate-pinch-hold', 'Plate Pinch Hold', 'dumbbell', ['forearms'], {
    rest: isolation,
    tracking: 'duration',
  }),
  exercise('sled-push', 'Sled Push', 'machine', ['quadriceps'], {
    increment: null,
    rest: moderateCompound,
    secondary: ['glutes', 'calves'],
    tracking: 'distance_duration',
  }),
  exercise('battle-ropes', 'Battle Ropes', 'bodyweight', ['shoulders'], {
    increment: null,
    rest: isolation,
    secondary: ['core'],
    tracking: 'duration',
  }),
  exercise('burpee', 'Burpee', 'bodyweight', ['quadriceps'], {
    rest: moderateCompound,
    secondary: ['chest', 'shoulders', 'glutes'],
    tracking: 'reps_only',
  }),
  exercise(
    '10-lb-medicine-ball-throws',
    '10 lb Medicine Ball Throws',
    'dumbbell',
    ['shoulders'],
    {
      increment: null,
      rest: moderateCompound,
      secondary: ['chest', 'core'],
      tracking: 'distance_duration',
    },
  ),
  exercise(
    '2-gripper-strapholds',
    '#2 Gripper Strapholds',
    'dumbbell',
    ['forearms'],
    {
      rest: 150,
      tracking: 'weight_reps',
    },
  ),
  exercise(
    '1-5-gripper-strapholds',
    '#1.5 Gripper Strapholds',
    'dumbbell',
    ['forearms'],
    {
      rest: 150,
      tracking: 'weight_reps',
    },
  ),
  exercise(
    '2-gripper-isometric-holds',
    '#2 Gripper Isometric Holds',
    'dumbbell',
    ['forearms'],
    {
      increment: null,
      rest: isolation,
      tracking: 'duration',
    },
  ),
  exercise(
    '1-5-gripper-isometric-holds',
    '#1.5 Gripper Isometric Holds',
    'dumbbell',
    ['forearms'],
    {
      increment: null,
      rest: isolation,
      tracking: 'duration',
    },
  ),
  exercise('2-gripper-closes', '#2 Gripper Closes', 'dumbbell', ['forearms'], {
    tracking: 'reps_only',
  }),
  exercise(
    '1-5-gripper-closes',
    '#1.5 Gripper Closes',
    'dumbbell',
    ['forearms'],
    {
      tracking: 'reps_only',
    },
  ),
  exercise(
    'triple-broad-jumps',
    'Triple Broad Jumps',
    'bodyweight',
    ['glutes'],
    {
      increment: null,
      rest: moderateCompound,
      secondary: ['quadriceps', 'hamstrings', 'calves'],
      tracking: 'distance_duration',
    },
  ),
  exercise('40-yd-sprints', '40 yd Sprints', 'bodyweight', ['quadriceps'], {
    increment: null,
    rest: largeCompound,
    secondary: ['glutes', 'hamstrings', 'calves'],
    tracking: 'duration',
  }),
  exercise('trap-bar-deadlift', 'Trap Bar Deadlift', 'barbell', ['glutes'], {
    rest: largeCompound,
    secondary: ['hamstrings', 'quadriceps', 'back'],
  }),
  exercise(
    'barbell-front-squat',
    'Barbell Front Squat',
    'barbell',
    ['quadriceps'],
    {
      rest: largeCompound,
      secondary: ['glutes', 'core'],
    },
  ),
  exercise('safety-bar-squat', 'Safety Bar Squat', 'barbell', ['quadriceps'], {
    rest: largeCompound,
    secondary: ['glutes', 'back'],
  }),
  exercise('box-squat', 'Box Squat', 'barbell', ['glutes'], {
    rest: largeCompound,
    secondary: ['quadriceps', 'hamstrings'],
  }),
  exercise(
    'bent-over-barbell-row',
    'Bent-Over Barbell Row',
    'barbell',
    ['back'],
    {
      rest: largeCompound,
      secondary: ['biceps', 'traps'],
    },
  ),
  exercise(
    'incline-barbell-bench-press',
    'Incline Barbell Bench Press',
    'barbell',
    ['chest'],
    {
      rest: largeCompound,
      secondary: ['shoulders', 'triceps'],
    },
  ),
  exercise('larsen-press', 'Larsen Press', 'barbell', ['chest'], {
    rest: largeCompound,
    secondary: ['triceps'],
  }),
  exercise('push-press', 'Push Press', 'barbell', ['shoulders'], {
    rest: largeCompound,
    secondary: ['triceps', 'quadriceps'],
  }),
  exercise('good-morning', 'Good Morning', 'barbell', ['hamstrings'], {
    secondary: ['glutes', 'back'],
  }),
  exercise(
    'snatch-grip-romanian-deadlift',
    'Snatch-Grip Romanian Deadlift',
    'barbell',
    ['hamstrings'],
    {
      rest: largeCompound,
      secondary: ['glutes', 'back'],
    },
  ),
  exercise(
    'swiss-bar-bench-press',
    'Swiss Bar Bench Press',
    'barbell',
    ['chest'],
    {
      rest: largeCompound,
      secondary: ['triceps'],
    },
  ),
  exercise(
    'flat-dumbbell-bench-press',
    'Flat Dumbbell Bench Press',
    'dumbbell',
    ['chest'],
    {
      rest: largeCompound,
      secondary: ['triceps', 'shoulders'],
    },
  ),
  exercise(
    'incline-dumbbell-bench-press',
    'Incline Dumbbell Bench Press',
    'dumbbell',
    ['chest'],
    {
      rest: largeCompound,
      secondary: ['shoulders', 'triceps'],
    },
  ),
  exercise(
    'bulgarian-split-squat',
    'Bulgarian Split Squat',
    'dumbbell',
    ['quadriceps'],
    {
      perSide: true,
      secondary: ['glutes'],
    },
  ),
  exercise('goblet-squat', 'Goblet Squat', 'dumbbell', ['quadriceps'], {
    secondary: ['glutes', 'core'],
  }),
  exercise(
    'dumbbell-triceps-extension',
    'Dumbbell Triceps Extension',
    'dumbbell',
    ['triceps'],
    {
      rest: isolation,
    },
  ),
  exercise(
    'dumbbell-rear-delt-fly',
    'Dumbbell Rear Delt Fly',
    'dumbbell',
    ['shoulders'],
    {
      rest: isolation,
      secondary: ['traps'],
    },
  ),
  exercise('farmers-hold', "Farmer's Hold", 'dumbbell', ['forearms'], {
    increment: null,
    secondary: ['traps', 'core'],
    tracking: 'duration',
  }),
  exercise(
    'single-arm-lat-pulldown',
    'Single-Arm Lat Pulldown',
    'cable',
    ['back'],
    {
      perSide: true,
      secondary: ['biceps'],
    },
  ),
  exercise(
    'single-arm-cable-lateral-raise',
    'Single-Arm Cable Lateral Raise',
    'cable',
    ['shoulders'],
    {
      perSide: true,
      rest: isolation,
    },
  ),
  exercise('cable-chest-fly', 'Cable Chest Fly', 'cable', ['chest'], {
    rest: isolation,
  }),
  exercise(
    'rope-triceps-pressdown',
    'Rope Triceps Pressdown',
    'cable',
    ['triceps'],
    {
      rest: isolation,
    },
  ),
  exercise(
    'straight-bar-triceps-pressdown',
    'Straight-Bar Triceps Pressdown',
    'cable',
    ['triceps'],
    {
      rest: isolation,
    },
  ),
  exercise(
    'single-arm-triceps-pressdown',
    'Single-Arm Triceps Pressdown',
    'cable',
    ['triceps'],
    {
      perSide: true,
      rest: isolation,
    },
  ),
  exercise(
    'cable-overhead-triceps-extension',
    'Cable Overhead Triceps Extension',
    'cable',
    ['triceps'],
    {
      rest: isolation,
    },
  ),
  exercise('cable-hammer-curl', 'Cable Hammer Curl', 'cable', ['biceps'], {
    rest: isolation,
    secondary: ['forearms'],
  }),
  exercise('pallof-press', 'Pallof Press', 'cable', ['core'], {
    perSide: true,
    rest: isolation,
  }),
  exercise('cable-wood-chop', 'Cable Wood Chop', 'cable', ['core'], {
    perSide: true,
    rest: isolation,
  }),
  exercise(
    'incline-machine-chest-press',
    'Incline Machine Chest Press',
    'machine',
    ['chest'],
    {
      secondary: ['shoulders', 'triceps'],
    },
  ),
  exercise('pec-deck', 'Pec Deck', 'machine', ['chest'], {
    rest: isolation,
  }),
  exercise(
    'chest-supported-machine-row',
    'Chest-Supported Machine Row',
    'machine',
    ['back'],
    {
      secondary: ['biceps'],
    },
  ),
  exercise(
    'single-leg-leg-press',
    'Single-Leg Leg Press',
    'machine',
    ['quadriceps'],
    {
      perSide: true,
      secondary: ['glutes'],
    },
  ),
  exercise('pendulum-squat', 'Pendulum Squat', 'machine', ['quadriceps'], {
    rest: largeCompound,
    secondary: ['glutes'],
  }),
  exercise('belt-squat', 'Belt Squat', 'machine', ['quadriceps'], {
    rest: largeCompound,
    secondary: ['glutes'],
  }),
  exercise('hip-abduction', 'Hip Abduction', 'machine', ['hip abductors'], {
    rest: isolation,
  }),
  exercise('hip-adduction', 'Hip Adduction', 'machine', ['hip adductors'], {
    rest: isolation,
  }),
  exercise(
    'glute-kickback-machine',
    'Glute Kickback Machine',
    'machine',
    ['glutes'],
    {
      perSide: true,
      rest: isolation,
    },
  ),
  exercise('seated-calf-raise', 'Seated Calf Raise', 'machine', ['calves'], {
    rest: isolation,
  }),
  exercise(
    'plyometric-push-up',
    'Plyometric Push-Up',
    'bodyweight',
    ['chest'],
    {
      tracking: 'reps_only',
    },
  ),
  exercise('overhand-pull-up', 'Overhand Pull-Up', 'bodyweight', ['back'], {
    tracking: 'reps_only',
    secondary: ['biceps'],
  }),
  exercise(
    'scapular-push-up',
    'Scapular Push-Up',
    'bodyweight',
    ['shoulders'],
    {
      tracking: 'reps_only',
      secondary: ['chest'],
    },
  ),
  exercise(
    'bodyweight-split-squat',
    'Bodyweight Split Squat',
    'bodyweight',
    ['quadriceps'],
    {
      perSide: true,
      tracking: 'reps_only',
      secondary: ['glutes'],
    },
  ),
  exercise('glute-ham-raise', 'Glute Ham Raise', 'bodyweight', ['hamstrings'], {
    tracking: 'reps_only',
    secondary: ['glutes'],
  }),
  exercise('hollow-body-hold', 'Hollow Body Hold', 'bodyweight', ['core'], {
    increment: null,
    tracking: 'duration',
  }),
  exercise('ab-wheel-rollout', 'Ab Wheel Rollout', 'bodyweight', ['core'], {
    tracking: 'reps_only',
    secondary: ['shoulders'],
  }),
  exercise('mountain-climber', 'Mountain Climber', 'bodyweight', ['core'], {
    tracking: 'reps_only',
  }),
  exercise('kettlebell-swing', 'Kettlebell Swing', 'dumbbell', ['glutes'], {
    secondary: ['hamstrings'],
  }),
  exercise(
    'kettlebell-goblet-squat',
    'Kettlebell Goblet Squat',
    'dumbbell',
    ['quadriceps'],
    {
      secondary: ['glutes'],
    },
  ),
  exercise('kettlebell-clean', 'Kettlebell Clean', 'dumbbell', ['shoulders'], {
    perSide: true,
    secondary: ['glutes'],
  }),
  exercise('kettlebell-press', 'Kettlebell Press', 'dumbbell', ['shoulders'], {
    perSide: true,
    secondary: ['triceps'],
  }),
  exercise(
    'kettlebell-snatch',
    'Kettlebell Snatch',
    'dumbbell',
    ['shoulders'],
    {
      perSide: true,
      secondary: ['glutes'],
    },
  ),
  exercise('turkish-get-up', 'Turkish Get-Up', 'dumbbell', ['core'], {
    perSide: true,
    secondary: ['shoulders', 'glutes'],
  }),
  exercise('band-pull-apart', 'Band Pull-Apart', 'cable', ['shoulders'], {
    rest: isolation,
    tracking: 'reps_only',
  }),
  exercise('band-face-pull', 'Band Face Pull', 'cable', ['shoulders'], {
    rest: isolation,
    tracking: 'reps_only',
  }),
  exercise(
    'band-external-rotation',
    'Band External Rotation',
    'cable',
    ['shoulders'],
    {
      perSide: true,
      rest: isolation,
      tracking: 'reps_only',
    },
  ),
  exercise(
    'banded-lateral-walk',
    'Banded Lateral Walk',
    'bodyweight',
    ['hip abductors'],
    {
      tracking: 'reps_only',
      secondary: ['glutes'],
    },
  ),
  exercise('banded-leg-curl', 'Banded Leg Curl', 'cable', ['hamstrings'], {
    tracking: 'reps_only',
  }),
  exercise('sled-pull', 'Sled Pull', 'machine', ['quadriceps'], {
    increment: null,
    secondary: ['glutes'],
    tracking: 'distance_duration',
  }),
  exercise(
    'backward-sled-drag',
    'Backward Sled Drag',
    'machine',
    ['quadriceps'],
    {
      increment: null,
      secondary: ['glutes'],
      tracking: 'distance_duration',
    },
  ),
  exercise(
    'medicine-ball-chest-pass',
    'Medicine Ball Chest Pass',
    'dumbbell',
    ['chest'],
    {
      increment: null,
      tracking: 'distance_duration',
    },
  ),
  exercise(
    'medicine-ball-overhead-throw',
    'Medicine Ball Overhead Throw',
    'dumbbell',
    ['shoulders'],
    {
      increment: null,
      tracking: 'distance_duration',
    },
  ),
  exercise(
    'medicine-ball-rotational-throw',
    'Medicine Ball Rotational Throw',
    'dumbbell',
    ['core'],
    {
      increment: null,
      perSide: true,
      tracking: 'distance_duration',
    },
  ),
  exercise('medicine-ball-slam', 'Medicine Ball Slam', 'dumbbell', ['core'], {
    tracking: 'reps_only',
    secondary: ['shoulders'],
  }),
  exercise('outdoor-run', 'Outdoor Run', 'bodyweight', ['quadriceps'], {
    increment: null,
    secondary: ['glutes', 'hamstrings', 'calves'],
    tracking: 'duration',
  }),
  exercise('treadmill-run', 'Treadmill Run', 'machine', ['quadriceps'], {
    increment: null,
    secondary: ['glutes', 'hamstrings', 'calves'],
    tracking: 'duration',
  }),
  exercise('stationary-bike', 'Stationary Bike', 'machine', ['quadriceps'], {
    increment: null,
    tracking: 'duration',
  }),
  exercise('outdoor-cycling', 'Outdoor Cycling', 'bodyweight', ['quadriceps'], {
    increment: null,
    tracking: 'duration',
  }),
  exercise('rowing-ergometer', 'Rowing Ergometer', 'machine', ['back'], {
    increment: null,
    secondary: ['quadriceps'],
    tracking: 'duration',
  }),
  exercise('stair-climber', 'Stair Climber', 'machine', ['quadriceps'], {
    increment: null,
    tracking: 'duration',
  }),
  exercise('elliptical', 'Elliptical', 'machine', ['quadriceps'], {
    increment: null,
    tracking: 'duration',
  }),
  exercise('assault-bike', 'Assault Bike', 'machine', ['quadriceps'], {
    increment: null,
    tracking: 'duration',
  }),
  exercise('ski-erg', 'Ski Erg', 'machine', ['back'], {
    increment: null,
    secondary: ['shoulders'],
    tracking: 'duration',
  }),
  exercise('jump-rope', 'Jump Rope', 'bodyweight', ['calves'], {
    increment: null,
    tracking: 'duration',
  }),
  exercise('shuttle-run', 'Shuttle Run', 'bodyweight', ['quadriceps'], {
    increment: null,
    secondary: ['glutes', 'hamstrings'],
    tracking: 'duration',
  }),
  exercise('hill-sprint', 'Hill Sprint', 'bodyweight', ['quadriceps'], {
    increment: null,
    secondary: ['glutes', 'hamstrings'],
    tracking: 'duration',
  }),
  exercise('40-yd-sprint', '40 yd Sprint', 'bodyweight', ['quadriceps'], {
    increment: null,
    secondary: ['glutes', 'hamstrings'],
    tracking: 'distance_duration',
  }),
  exercise('broad-jump', 'Broad Jump', 'bodyweight', ['glutes'], {
    increment: null,
    secondary: ['quadriceps', 'hamstrings'],
    tracking: 'distance_duration',
  }),
  exercise('triple-broad-jump', 'Triple Broad Jump', 'bodyweight', ['glutes'], {
    increment: null,
    secondary: ['quadriceps', 'hamstrings'],
    tracking: 'distance_duration',
  }),
  exercise('box-jump', 'Box Jump', 'bodyweight', ['quadriceps'], {
    increment: null,
    tracking: 'distance_duration',
  }),
  exercise('depth-jump', 'Depth Jump', 'bodyweight', ['quadriceps'], {
    increment: null,
    tracking: 'distance_duration',
  }),
  exercise('vertical-jump', 'Vertical Jump', 'bodyweight', ['quadriceps'], {
    increment: null,
    tracking: 'distance_duration',
  }),
  exercise('lateral-bound', 'Lateral Bound', 'bodyweight', ['glutes'], {
    increment: null,
    perSide: true,
    tracking: 'distance_duration',
  }),
  exercise('pogo-jump', 'Pogo Jump', 'bodyweight', ['calves'], {
    tracking: 'reps_only',
  }),
  exercise(
    'hand-gripper-crushing',
    'Hand Gripper Crushing',
    'dumbbell',
    ['forearms'],
    {
      tracking: 'reps_only',
    },
  ),
  exercise('towel-hang', 'Towel Hang', 'bodyweight', ['forearms'], {
    increment: null,
    secondary: ['back'],
    tracking: 'duration',
  }),
  exercise('wrist-roller', 'Wrist Roller', 'dumbbell', ['forearms'], {
    rest: isolation,
  }),
  exercise('seated-wrist-curl', 'Seated Wrist Curl', 'dumbbell', ['forearms'], {
    rest: isolation,
  }),
  exercise(
    'seated-wrist-extension',
    'Seated Wrist Extension',
    'dumbbell',
    ['forearms'],
    {
      rest: isolation,
    },
  ),
  exercise(
    'plate-weighted-neck-curl',
    'Plate-Weighted Neck Curl',
    'dumbbell',
    ['traps'],
    {
      rest: isolation,
    },
  ),
  exercise(
    'head-harness-neck-extension',
    'Head Harness Neck Extension',
    'dumbbell',
    ['traps'],
    {
      rest: isolation,
    },
  ),
  exercise(
    'neck-isometric-flexion',
    'Neck Isometric Flexion',
    'bodyweight',
    ['traps'],
    {
      increment: null,
      tracking: 'duration',
    },
  ),
  exercise(
    'neck-isometric-extension',
    'Neck Isometric Extension',
    'bodyweight',
    ['traps'],
    {
      increment: null,
      tracking: 'duration',
    },
  ),
  exercise(
    'neck-isometric-lateral-flexion',
    'Neck Isometric Lateral Flexion',
    'bodyweight',
    ['traps'],
    {
      increment: null,
      perSide: true,
      tracking: 'duration',
    },
  ),
  exercise('wall-slide', 'Wall Slide', 'bodyweight', ['shoulders'], {
    tracking: 'reps_only',
  }),
  exercise(
    'cable-external-rotation',
    'Cable External Rotation',
    'cable',
    ['shoulders'],
    {
      perSide: true,
      rest: isolation,
    },
  ),
  exercise('prone-y-raise', 'Prone Y-Raise', 'bodyweight', ['shoulders'], {
    tracking: 'reps_only',
    secondary: ['traps'],
  }),
  exercise(
    'chest-supported-y-raise',
    'Chest-Supported Y-Raise',
    'dumbbell',
    ['shoulders'],
    {
      rest: isolation,
      secondary: ['traps'],
    },
  ),
  exercise(
    'serratus-wall-slide',
    'Serratus Wall Slide',
    'bodyweight',
    ['shoulders'],
    {
      tracking: 'reps_only',
    },
  ),
  // Added for the built-in program library (seed version 5).
  exercise(
    'barbell-back-squat',
    'Barbell Back Squat',
    'barbell',
    ['quadriceps'],
    {
      rest: largeCompound,
      secondary: ['glutes', 'hamstrings', 'core'],
    },
  ),
  exercise(
    'paused-barbell-back-squat',
    'Paused Barbell Back Squat',
    'barbell',
    ['quadriceps'],
    {
      rest: largeCompound,
      secondary: ['glutes', 'hamstrings', 'core'],
    },
  ),
  exercise(
    'paused-barbell-bench-press',
    'Paused Barbell Bench Press',
    'barbell',
    ['chest'],
    {
      rest: largeCompound,
      secondary: ['triceps', 'shoulders'],
    },
  ),
  exercise(
    'low-incline-barbell-bench-press',
    'Low-Incline Barbell Bench Press',
    'barbell',
    ['chest'],
    {
      rest: largeCompound,
      secondary: ['shoulders', 'triceps'],
    },
  ),
  exercise(
    'low-incline-dumbbell-bench-press',
    'Low-Incline Dumbbell Bench Press',
    'dumbbell',
    ['chest'],
    {
      rest: moderateCompound,
      secondary: ['shoulders', 'triceps'],
    },
  ),
  // Added for seed version 6: a weighted-repetition core exercise.
  exercise('ghd-sit-up', 'GHD Sit-Up', 'bodyweight', ['core'], {
    increment: 5,
    rest: isolation,
    tracking: 'weight_reps',
  }),
  exercise('roman-chair-sit-up', 'Roman Chair Sit-Up', 'bodyweight', ['core'], {
    rest: isolation,
  }),
  exercise(
    'wide-grip-lat-pulldown',
    'Wide-Grip Lat Pulldown',
    'machine',
    ['back'],
    {
      rest: moderateCompound,
      secondary: ['biceps'],
    },
  ),
  exercise('cable-y-raise', 'Cable Y-Raise', 'cable', ['shoulders'], {
    rest: isolation,
    secondary: ['traps'],
  }),
]

export function validateBuiltInExercises(
  exercises: BuiltInExerciseSeed[] = BUILT_IN_EXERCISES,
) {
  const errors: string[] = []
  const ids = new Set<string>()
  const names = new Set<string>()
  const allowedMuscles = new Set<MuscleGroup>([
    'chest',
    'back',
    'shoulders',
    'biceps',
    'triceps',
    'forearms',
    'quadriceps',
    'hamstrings',
    'glutes',
    'calves',
    'core',
    'traps',
    'hip abductors',
    'hip adductors',
  ])

  for (const seed of exercises) {
    if (ids.has(seed.id)) {
      errors.push(`Duplicate exercise ID ${seed.id}.`)
    }
    ids.add(seed.id)

    const normalizedName = normalizeBuiltInExerciseName(seed.name)
    if (names.has(normalizedName)) {
      errors.push(`Duplicate exercise name ${seed.name}.`)
    }
    names.add(normalizedName)

    if (!seed.id.startsWith('builtin:')) {
      errors.push(`${seed.name} is missing the builtin ID prefix.`)
    }
    if (!seed.name.trim()) {
      errors.push(`${seed.id} is missing a display name.`)
    }
    if (!seed.primaryMuscleGroups.length) {
      errors.push(`${seed.name} is missing primary muscle groups.`)
    }
    for (const muscle of [
      ...seed.primaryMuscleGroups,
      ...seed.secondaryMuscleGroups,
    ]) {
      if (!allowedMuscles.has(muscle)) {
        errors.push(`${seed.name} has invalid muscle group ${muscle}.`)
      }
    }
    if (!getTrackingMethod(seed.trackingMethodId)) {
      errors.push(`${seed.name} has invalid tracking method.`)
    }
    if (seed.defaultRestSeconds < 0) {
      errors.push(`${seed.name} has a negative rest duration.`)
    }
    if (
      seed.defaultWeightIncrement !== null &&
      seed.defaultWeightIncrement <= 0
    ) {
      errors.push(`${seed.name} has an invalid weight increment.`)
    }
    if (
      seed.recordsRepsPerSide &&
      !seed.primaryMuscleGroups.some((muscle) =>
        [
          'quadriceps',
          'hamstrings',
          'glutes',
          'calves',
          'biceps',
          'triceps',
          'shoulders',
          'back',
          'chest',
          'core',
          'traps',
          'hip abductors',
          'hip adductors',
        ].includes(muscle),
      )
    ) {
      errors.push(`${seed.name} has invalid unilateral metadata.`)
    }
  }

  if (errors.length) {
    throw new Error(errors.join('\n'))
  }
}

export function normalizeBuiltInExerciseName(name: string) {
  return name
    .trim()
    .toLocaleLowerCase()
    .replace(/[\u2018\u2019']/gu, '')
    .replace(/[\u2010-\u2015-]/gu, ' ')
    .replace(/[^\p{L}\p{N}#]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
