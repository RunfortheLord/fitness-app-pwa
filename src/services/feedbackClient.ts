// Mirrors the server's feedback error codes (kept local so the client layer does
// not import from the server proxy layer), plus client-only transport states.
export type FeedbackClientErrorCode =
  | 'invalid_request'
  | 'not_configured'
  | 'rate_limited'
  | 'relay_failed'
  | 'network'
  | 'unexpected'

export class FeedbackClientError extends Error {
  readonly code: FeedbackClientErrorCode

  constructor(code: FeedbackClientErrorCode, message: string) {
    super(message)
    this.name = 'FeedbackClientError'
    this.code = code
  }
}

type FeedbackResponse =
  | { ok: true }
  | { ok: false; error: { code: FeedbackClientErrorCode; message: string } }

/**
 * Send typed feedback to the server relay (which forwards it to the configured
 * chat webhook). The relay destination is server-side only — the client never
 * knows or needs it.
 */
export async function sendFeedback(
  message: string,
  context?: string,
): Promise<void> {
  let response: Response
  try {
    response = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message, context }),
    })
  } catch {
    throw new FeedbackClientError(
      'network',
      'You appear to be offline. Feedback needs a connection to send.',
    )
  }

  let payload: FeedbackResponse | null
  try {
    payload = (await response.json()) as FeedbackResponse
  } catch {
    payload = null
  }

  if (response.ok && payload?.ok) {
    return
  }

  if (payload && !payload.ok) {
    throw new FeedbackClientError(payload.error.code, payload.error.message)
  }

  throw new FeedbackClientError(
    'unexpected',
    'Feedback could not be sent. Please try again later.',
  )
}
