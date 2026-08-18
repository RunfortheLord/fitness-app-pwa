/// <reference types="node" />
import { Receiver } from '@upstash/qstash'
import webPush from 'web-push'

import { readWebPushTimerJob } from '../../src/server/webPushTimerApi.js'
import { createRequestObserver } from '../../src/server/serverHttp.js'

const MAX_DELIVERY_BODY_BYTES = 8_192

export async function POST(request: Request) {
  const observer = createRequestObserver({
    method: request.method,
    route: '/api/push/deliver',
  })
  const respond = (value: unknown, status: number, outcome: string) => {
    observer.finish({ outcome, provider: 'qstash+web_push', status })
    return json(value, status, observer.requestId)
  }
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY
  const signature = request.headers.get('upstash-signature')
  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY
  const subject = process.env.WEB_PUSH_SUBJECT
  if (
    !currentSigningKey ||
    !nextSigningKey ||
    !signature ||
    !publicKey ||
    !privateKey ||
    !subject
  ) {
    return respond({ ok: false }, 503, 'not_configured')
  }

  const contentLength = Number(request.headers.get('content-length'))
  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_DELIVERY_BODY_BYTES
  ) {
    return respond({ ok: false }, 413, 'payload_too_large')
  }
  const rawBody = await request.text()
  if (new TextEncoder().encode(rawBody).byteLength > MAX_DELIVERY_BODY_BYTES) {
    return respond({ ok: false }, 413, 'payload_too_large')
  }
  const receiver = new Receiver({ currentSigningKey, nextSigningKey })
  try {
    await receiver.verify({
      body: rawBody,
      signature,
      url: request.url,
    })
  } catch {
    return respond({ ok: false }, 401, 'invalid_signature')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(rawBody)
  } catch {
    return respond({ ok: false }, 400, 'invalid_json')
  }
  const job = readWebPushTimerJob(parsed)
  if (!job) {
    return respond({ ok: false }, 400, 'invalid_job')
  }

  try {
    await webPush.sendNotification(
      job.subscription,
      JSON.stringify({
        body: 'Rest complete. Your next set is ready.',
        tag: 'nutrifit-rest-timer',
        title: 'NutriFit Timer',
        url: '/workout',
      }),
      {
        TTL: 120,
        timeout: 10_000,
        urgency: 'high',
        topic: 'nutrifit-rest-timer',
        vapidDetails: { subject, publicKey, privateKey },
      },
    )
    return respond({ ok: true }, 200, 'delivered')
  } catch (caught: unknown) {
    const statusCode = readWebPushStatusCode(caught)
    if (statusCode === 404 || statusCode === 410) {
      return respond(
        { ok: true, subscriptionExpired: true },
        200,
        'subscription_expired',
      )
    }
    return respond({ ok: false }, 502, 'delivery_failed')
  }
}

function readWebPushStatusCode(value: unknown) {
  if (
    typeof value === 'object' &&
    value !== null &&
    'statusCode' in value &&
    typeof value.statusCode === 'number'
  ) {
    return value.statusCode
  }
  return null
}

function json(value: unknown, status = 200, requestId?: string) {
  return Response.json(value, {
    status,
    headers: {
      'cache-control': 'no-store',
      ...(requestId ? { 'x-request-id': requestId } : {}),
    },
  })
}
