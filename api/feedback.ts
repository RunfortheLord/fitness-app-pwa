/// <reference types="node" />
import {
  handleFeedbackSubmission,
  statusForFeedbackError,
} from '../src/server/feedbackApi.js'

type VercelRequest = {
  method?: string
  body?: unknown
}

type VercelResponse = {
  status(code: number): VercelResponse
  setHeader(name: string, value: string): void
  json(value: unknown): void
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST') {
    res.status(405).json({
      ok: false,
      error: { code: 'invalid_request', message: 'Method not allowed.' },
    })
    return
  }

  const body = readBody(req.body)
  const result = await handleFeedbackSubmission(
    { message: body.message, context: body.context },
    { webhookUrl: process.env.FEEDBACK_WEBHOOK_URL },
  )

  if ('error' in result) {
    res.status(statusForFeedbackError(result.error.code)).json(result)
    return
  }

  res.status(200).json(result)
}

function readBody(body: unknown): Record<string, unknown> {
  if (typeof body === 'string') {
    try {
      const parsed: unknown = JSON.parse(body)
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : {}
    } catch {
      return {}
    }
  }
  return typeof body === 'object' && body !== null
    ? (body as Record<string, unknown>)
    : {}
}
