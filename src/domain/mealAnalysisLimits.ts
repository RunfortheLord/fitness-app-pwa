export const MAX_MEAL_PHOTOS = 3
export const MAX_MEAL_NOTE_LENGTH = 500
export const MAX_MEAL_IMAGE_BASE64_LENGTH = 850_000
export const MAX_MEAL_IMAGE_BASE64_TOTAL =
  MAX_MEAL_PHOTOS * MAX_MEAL_IMAGE_BASE64_LENGTH
export const MAX_MEAL_ANALYSIS_BODY_BYTES = 3_000_000
export const SUPPORTED_MEAL_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

export type MealImageMimeType = (typeof SUPPORTED_MEAL_IMAGE_TYPES)[number]
