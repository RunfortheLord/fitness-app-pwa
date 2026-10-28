/// <reference types="node" />
import { createClient } from '@supabase/supabase-js'

import { createSupabaseProviderCredentialGateway } from '../../src/server/providerCredentialGateway.js'
import {
  isAllowedAppOrigin,
  readBearerToken,
} from '../../src/server/accountDeletion.js'
import { registerAuthenticatedProviderCredential } from '../../src/server/providerCredentials.js'
import {
  createRequestObserver,
  readAnonymousClientKey,
  readBoundedJsonObject,
  readHeader,
  type ServerRequestLike,
} from '../../src/server/serverHttp.js'
import {
  createRedisServerRateLimiter,
  evaluateRateLimit,
  readRedisRateLimiterConfig,
} from '../../src/server/serverRateLimiter.js'

type VercelRequest = ServerRequestLike
type VercelResponse = {
  end(): void
  status(code: number): VercelResponse
  setHeader(name: string, value: string): void
  json(value: unknown): void
}

const MAX_BODY_BYTES = 24 * 1_024
const STORE_LIMIT = 20
const STORE_WINDOW_MS = 10 * 60 * 1_000
const supabaseUrl = process.env.SUPABASE_URL?.trim()
const supabaseAdminKey =
  process.env.SUPABASE_SECRET_KEY?.trim() ||
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
const authClient =
  supabaseUrl && supabaseAdminKey
    ? createClient(supabaseUrl, supabaseAdminKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : undefined
const credentialGateway = authClient
  ? createSupabaseProviderCredentialGateway(authClient)
  : undefined
const limiterConfig = readRedisRateLimiterConfig(process.env)
const limiter = limiterConfig
  ? createRedisServerRateLimiter(limiterConfig)
  : undefined

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const observer = createRequestObserver({
    headers: req.headers,
    method: req.method,
    route: '/api/auth/provider-credential',
  })
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Request-ID', observer.requestId)

  const requestOrigin = readHeader(req.headers, 'origin')
  if (
    !isAllowedAppOrigin({
      host: readHeader(req.headers, 'host'),
      origin: requestOrigin,
      publicAppOrigin: process.env.PUBLIC_APP_ORIGIN,
    })
  ) {
    respond(res, observer, 403, 'forbidden')
    return
  }
  if (requestOrigin) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin)
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Vary', 'Origin')
  }
  if (req.method === 'OPTIONS') {
    observer.finish({ outcome: 'preflight', status: 204 })
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') {
    respond(res, observer, 405, 'method_not_allowed')
    return
  }
  const accessToken = readBearerToken(readHeader(req.headers, 'authorization'))
  if (!accessToken) {
    respond(res, observer, 401, 'unauthorized')
    return
  }
  const body = readBoundedJsonObject(req.body, MAX_BODY_BYTES)
  if ('reason' in body) {
    respond(res, observer, 400, 'invalid_request')
    return
  }
  const rateLimit = await evaluateRateLimit({
    failClosed: true,
    key: readAnonymousClientKey(req),
    limit: STORE_LIMIT,
    limiter,
    scope: 'provider-credential-store',
    windowMs: STORE_WINDOW_MS,
  })
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds))
    respond(
      res,
      observer,
      rateLimit.available ? 429 : 503,
      rateLimit.available ? 'rate_limited' : 'service_unavailable',
    )
    return
  }
  if (!authClient) {
    respond(res, observer, 503, 'service_unavailable')
    return
  }

  const result = await registerAuthenticatedProviderCredential({
    accessToken,
    authClient,
    encryptionKey: process.env.OAUTH_TOKEN_ENCRYPTION_KEY?.trim(),
    gateway: credentialGateway,
    provider: body.data.provider,
    token: body.data.token,
    tokenType: body.data.tokenType,
  })
  observer.finish({ outcome: result.code, status: result.status })
  if (result.status === 204) {
    res.status(204).end()
    return
  }
  res.status(result.status).json({ error: { code: result.code }, ok: false })
}

function respond(
  res: VercelResponse,
  observer: ReturnType<typeof createRequestObserver>,
  status: number,
  code: string,
) {
  observer.finish({ outcome: code, status })
  res.status(status).json({ error: { code }, ok: false })
}
