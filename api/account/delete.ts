/// <reference types="node" />
import { createClient } from '@supabase/supabase-js'

import {
  deleteAuthenticatedAccount,
  isAllowedAppOrigin,
  readBearerToken,
} from '../../src/server/accountDeletion.js'
import {
  createRequestObserver,
  readHeader,
  type ServerRequestLike,
} from '../../src/server/serverHttp.js'
import {
  createRedisServerRateLimiter,
  readRedisRateLimiterConfig,
} from '../../src/server/serverRateLimiter.js'

type VercelRequest = ServerRequestLike
type VercelResponse = {
  end(): void
  status(code: number): VercelResponse
  setHeader(name: string, value: string): void
  json(value: unknown): void
}

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
const limiterConfig = readRedisRateLimiterConfig(process.env)
const limiter = limiterConfig
  ? createRedisServerRateLimiter(limiterConfig)
  : undefined

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const observer = createRequestObserver({
    headers: req.headers,
    method: req.method,
    route: '/api/account/delete',
  })
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Request-ID', observer.requestId)

  const requestOrigin = readHeader(req.headers, 'origin')
  const originAllowed = isAllowedAppOrigin({
    host: readHeader(req.headers, 'host'),
    origin: requestOrigin,
    publicAppOrigin: process.env.PUBLIC_APP_ORIGIN,
  })
  if (!originAllowed) {
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
  if (!authClient) {
    respond(res, observer, 503, 'service_unavailable')
    return
  }

  const result = await deleteAuthenticatedAccount({
    accessToken,
    authClient,
    limiter,
  })
  if (result.status === 200) {
    observer.finish({ outcome: result.code, status: 200 })
    res.status(200).json({
      data: { providerRevocation: result.providerRevocation },
      ok: true,
    })
    return
  }
  if ('retryAfterSeconds' in result) {
    res.setHeader('Retry-After', String(result.retryAfterSeconds))
  }
  respond(res, observer, result.status, result.code)
}

function respond(
  res: VercelResponse,
  observer: ReturnType<typeof createRequestObserver>,
  status: number,
  code: string,
) {
  observer.finish({ outcome: code, status })
  res.status(status).json({ ok: false, error: { code } })
}
