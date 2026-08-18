import { readRedisAuthRelayConfig } from './authRelay.js'
import { readRedisRateLimiterConfig } from './serverRateLimiter.js'

export type IntegrationEnvironment = Record<string, string | undefined>

export function readIntegrationHealth(environment: IntegrationEnvironment) {
  const cloudBackup = Boolean(
    environment.VITE_SUPABASE_URL && environment.VITE_SUPABASE_ANON_KEY,
  )
  return {
    accountDeletion: Boolean(
      environment.SUPABASE_URL &&
      environment.SUPABASE_SERVICE_ROLE_KEY &&
      readRedisRateLimiterConfig(environment),
    ),
    authRelay: cloudBackup && Boolean(readRedisAuthRelayConfig(environment)),
    cloudBackup,
    feedback: Boolean(
      environment.FEEDBACK_WEBHOOK_URL &&
      readRedisRateLimiterConfig(environment),
    ),
    foodSearch: Boolean(environment.USDA_FDC_API_KEY),
    distributedAiProtection: Boolean(readRedisRateLimiterConfig(environment)),
    mealAnalysis: Boolean(environment.OPENAI_API_KEY),
    supportContact: Boolean(environment.VITE_SUPPORT_EMAIL?.trim()),
    webPush: Boolean(
      environment.WEB_PUSH_PUBLIC_KEY &&
      environment.WEB_PUSH_PRIVATE_KEY &&
      environment.WEB_PUSH_SUBJECT &&
      environment.QSTASH_TOKEN &&
      environment.QSTASH_CURRENT_SIGNING_KEY &&
      environment.QSTASH_NEXT_SIGNING_KEY,
    ),
  }
}
