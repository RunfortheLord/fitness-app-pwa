import { describe, expect, it } from 'vitest'

import { readIntegrationHealth } from './integrationHealth'

describe('integration health', () => {
  it('returns configuration booleans without serializing values', () => {
    const values = {
      AI_RATE_LIMIT_HASH_SECRET: 'test-only-hash-secret-32-characters',
      FEEDBACK_WEBHOOK_URL: 'https://secret.example/hook',
      OPENAI_API_KEY: 'secret-openai-key',
      QSTASH_CURRENT_SIGNING_KEY: 'current-secret',
      QSTASH_NEXT_SIGNING_KEY: 'next-secret',
      QSTASH_TOKEN: 'qstash-secret',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-secret',
      SUPABASE_URL: 'https://project.example',
      UPSTASH_REDIS_REST_TOKEN: 'redis-secret',
      UPSTASH_REDIS_REST_URL: 'https://redis.example',
      USDA_FDC_API_KEY: 'usda-secret',
      VITE_SUPABASE_ANON_KEY: 'public-anon-key',
      VITE_SUPABASE_URL: 'https://project.example',
      VITE_SUPPORT_EMAIL: 'support@example.com',
      WEB_PUSH_PRIVATE_KEY: 'private-secret',
      WEB_PUSH_PUBLIC_KEY: 'public-value',
      WEB_PUSH_SUBJECT: 'mailto:test@example.com',
    }
    const result = readIntegrationHealth(values)

    expect(result).toEqual({
      accountDeletion: true,
      authRelay: true,
      cloudBackup: true,
      distributedAiProtection: true,
      feedback: true,
      foodSearch: true,
      mealAnalysis: true,
      supportContact: true,
      webPush: true,
    })
    const serialized = JSON.stringify(result)
    for (const value of Object.values(values)) {
      expect(serialized).not.toContain(value)
    }
  })

  it('does not report distributed protection for partial credentials', () => {
    expect(
      readIntegrationHealth({
        OPENAI_API_KEY: 'openai-key',
        UPSTASH_REDIS_REST_TOKEN: 'redis-token',
        UPSTASH_REDIS_REST_URL: 'https://redis.example',
      }),
    ).toMatchObject({
      distributedAiProtection: false,
      feedback: false,
      mealAnalysis: true,
    })
  })

  it('requires both Supabase and Redis for the installed-PWA auth relay', () => {
    expect(
      readIntegrationHealth({
        KV_REST_API_TOKEN: 'redis-token',
        KV_REST_API_URL: 'https://redis.example',
      }),
    ).toMatchObject({ authRelay: false, cloudBackup: false })
  })
})
