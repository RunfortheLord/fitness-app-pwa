// Compatibility exports retain older import names while the implementation now
// calls the same-origin OpenAI-backed route and never accepts a browser API key.
export {
  analyzeMealPhoto,
  MAX_MEAL_IMAGE_BASE64_LENGTH,
  MAX_MEAL_NOTE_LENGTH,
  MAX_MEAL_PHOTOS,
  MealAnalysisError as GeminiMealAnalysisError,
} from './mealAnalysisClient'
export type {
  MealAnalysisErrorCode as GeminiMealAnalysisErrorCode,
  MealImageInput as GeminiImageInput,
} from './mealAnalysisClient'
