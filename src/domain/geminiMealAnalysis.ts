// Compatibility exports retain the pre-OpenAI internal names without changing
// persisted integration identifiers or older imports. New code should use the
// provider-neutral meal-analysis exports.
export {
  createRecipeDraftFromMealAnalysis as createRecipeDraftFromGemini,
  mealAnalysisSchema as geminiMealAnalysisSchema,
} from './mealAnalysis'
export type {
  GeneratedRecipeDraft,
  MealAnalysis as GeminiMealAnalysis,
} from './mealAnalysis'
