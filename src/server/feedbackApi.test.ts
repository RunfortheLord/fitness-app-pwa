import { describe, expect, it, vi } from 'vitest'

import { handleFeedbackSubmission, statusForFeedbackError } from './feedbackApi'

function okFetch() {
  return vi.fn<typeof fetch>(async () => ({ ok: true }) as Response)
}

describe('handleFeedbackSubmission', () => {
  it('rejects an empty message without calling the webhook', async () => {
    const fetchImpl = okFetch()
    const result = await handleFeedbackSubmission(
      { message: '   ' },
      { webhookUrl: 'https://hook.test', fetchImpl },
    )
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'invalid_request',
        message: 'Feedback message is required.',
      },
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('rejects an overly long message', async () => {
    const fetchImpl = okFetch()
    const result = await handleFeedbackSubmission(
      { message: 'x'.repeat(1801) },
      { webhookUrl: 'https://hook.test', fetchImpl },
    )
    expect(result.ok).toBe(false)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('reports not_configured when no webhook url is set', async () => {
    const fetchImpl = okFetch()
    const result = await handleFeedbackSubmission(
      { message: 'Great app' },
      { webhookUrl: undefined, fetchImpl },
    )
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'not_configured',
        message: 'Feedback is not configured yet.',
      },
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('posts a Discord/Slack compatible payload and returns ok', async () => {
    const fetchImpl = okFetch()
    const result = await handleFeedbackSubmission(
      { message: '  Please add dark mode  ', context: 'v1 · abc · prod' },
      { webhookUrl: 'https://hook.test/relay', fetchImpl },
    )

    expect(result).toEqual({ ok: true })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://hook.test/relay')
    expect(init?.method).toBe('POST')
    const body = JSON.parse(String(init?.body)) as {
      content: string
      text: string
    }
    // Both keys are sent so the relay works for Discord (content) or Slack (text).
    expect(body.content).toBe(body.text)
    expect(body.content).toContain('Please add dark mode')
    expect(body.content).toContain('v1 · abc · prod')
    // The message is trimmed before relaying.
    expect(body.content).not.toContain('  Please add dark mode  ')
  })

  it('returns relay_failed when the webhook responds with an error', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false }) as Response)
    const result = await handleFeedbackSubmission(
      { message: 'Hi' },
      { webhookUrl: 'https://hook.test', fetchImpl },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('relay_failed')
    }
  })

  it('returns relay_failed when the webhook request throws', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down')
    })
    const result = await handleFeedbackSubmission(
      { message: 'Hi' },
      { webhookUrl: 'https://hook.test', fetchImpl },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('relay_failed')
    }
  })

  it('maps error codes to HTTP statuses', () => {
    expect(statusForFeedbackError('invalid_request')).toBe(400)
    expect(statusForFeedbackError('not_configured')).toBe(503)
    expect(statusForFeedbackError('relay_failed')).toBe(502)
  })
})
