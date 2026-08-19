/// <reference types="node" />

import { createRequestObserver } from '../../src/server/serverHttp.js'

type VercelRequest = {
  method?: string
}

type VercelResponse = {
  status(code: number): VercelResponse
  setHeader(name: string, value: string): void
  json(value: unknown): void
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  const observer = createRequestObserver({
    method: req.method,
    route: '/api/push/config',
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
