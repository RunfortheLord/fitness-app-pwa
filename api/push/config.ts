/// <reference types="node" />

import { createRequestObserver } from '../../src/server/serverHttp.js'
import { readIntegrationHealth } from '../../src/server/integrationHealth.js'

type VercelRequest = {
  method?: string
  query?: Record<string, string | string[] | undefined>
}

type VercelResponse = {
  status(code: number): VercelResponse
  setHeader(name: string, value: string): void
  json(value: unknown): void
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  const isHealthRequest = req.query?.route === 'health'
  const observer = createRequestObserver({
    method: req.method,
    route: isHealthRequest ? '/api/health' : '/api/push/config',
  })
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Request-ID', observer.requestId)

  if (req.method !== 'GET') {
    observer.finish({ outcome: 'method_not_allowed', status: 405 })
    res.status(405).json({
      ok: false,
      error: { code: 'invalid_request', message: 'Method not allowed.' },
    })
    return
  }

  if (isHealthRequest) {
    const configured = readIntegrationHealth(process.env)
    const ready =
      configured.accountDeletion &&
      configured.authRelay &&
      configured.cloudBackup &&
      configured.distributedAiProtection &&
      configured.foodSearch &&
      configured.mealAnalysis &&
      configured.providerRevocation &&
      configured.supportContact
    observer.finish({ outcome: ready ? 'ready' : 'degraded', status: 200 })
    res.status(200).json({ configured, ok: true, ready })
    return
  }

  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY
  const configured = Boolean(
    publicKey &&
    process.env.WEB_PUSH_PRIVATE_KEY &&
    process.env.WEB_PUSH_SUBJECT &&
    process.env.QSTASH_TOKEN &&
    process.env.QSTASH_CURRENT_SIGNING_KEY &&
    process.env.QSTASH_NEXT_SIGNING_KEY,
  )

  res.status(200).json({
    ok: true,
    configured,
    publicKey: configured ? publicKey : null,
  })
  observer.finish({
    outcome: configured ? 'configured' : 'not_configured',
    provider: 'web_push+qstash',
    status: 200,
  })
}
