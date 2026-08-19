/// <reference types="node" />
import { MAX_MEAL_ANALYSIS_BODY_BYTES } from '../src/domain/mealAnalysisLimits.js'
import {
  handleMealAnalysis,
  statusForMealAnalysisError,
} from '../src/server/mealAnalysisApi.js'
import {
  createRequestObserver,
  readAnonymousClientKey,
  readBoundedJsonObject,
  type ServerRequestLike,
} from '../src/server/serverHttp.js'
import {
  createRedisServerRateLimiter,
  readRedisRateLimiterConfig,
} from '../src/server/serverRateLimiter.js'

type VercelRequest = ServerRequestLike

type VercelResponse = {
  status(code: number): VercelResponse
  setHeader(name: string, value: string): void
  json(value: unknown): void
}

const redisRateLimiterConfig = readRedisRateLimiterConfig(process.env)
const rateLimiter = redisRateLimiterConfig
  ? createRedisServerRateLimiter(redisRateLimiterConfig)
  : undefined

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const observer = createRequestObserver({
    headers: req.headers,
    method: req.method,
    route: '/api/meal-analysis',
  })
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Request-ID', observer.requestId)

  if (req.method !== 'POST') {
    observer.finish({ outcome: 'method_not_allowed', status: 405 })
    res.status(405).json({
      ok: false,
      error: { code: 'invalid_request', message: 'Method not allowed.' },
    })
    return
  }

  const body = readBoundedJsonObject(req.body, MAX_MEAL_ANALYSIS_BODY_BYTES)
  if ('reason' in body) {
    const status = body.reason === 'payload_too_large' ? 413 : 400
    observer.finish({ outcome: body.reason, status })
    res.status(status).json({
      ok: false,
      error: {
        code:
          body.reason === 'payload_too_large'
            ? 'payload_too_large'
            : 'invalid_request',
        message:
          body.reason === 'payload_too_large'
            ? 'The meal photos are too large to analyze together.'
            : 'The meal analysis request is invalid.',
      },
    })
    return
  }

  const result = await handleMealAnalysis(
    { images: body.data.images, note: body.data.note },
    {
      apiKey: process.env.OPENAI_API_KEY,
      clientKey: readAnonymousClientKey(req),
      limiter: rateLimiter,
      model: process.env.OPENAI_MEAL_MODEL,
    },
  )

  if ('data' in result) {
    observer.finish({
      outcome: 'success',
      provider: 'openai',
      status: 200,
    })
    res.status(200).json(result)
    return
  }

  const status = statusForMealAnalysisError(result.error.code)
  if (result.error.retryAfterSeconds) {
    res.setHeader('Retry-After', String(result.error.retryAfterSeconds))
  }
  observer.finish({
    outcome: result.error.code,
    provider: 'openai',
    rateLimiterAvailable: !(
      result.error.code === 'provider_unavailable' &&
      result.error.retryAfterSeconds !== undefined
    ),
    status,
  })
  res.status(status).json(result)
}
