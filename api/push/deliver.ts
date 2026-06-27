/// <reference types="node" />
import { Receiver } from '@upstash/qstash'
import webPush from 'web-push'

import { readWebPushTimerJob } from '../../src/server/webPushTimerApi.js'

export async function POST(request: Request) {
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
    return json({ ok: false }, 503)
  }

  const rawBody = await request.text()
  const receiver = new Receiver({ currentSigningKey, nextSigningKey })
  try {
    await receiver.verify({
      body: rawBody,
      signature,
      url: request.url,
    })
  } catch {
    return json({ ok: false }, 401)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(rawBody)
  } catch {
    return json({ ok: false }, 400)
  }
  const job = readWebPushTimerJob(parsed)
  if (!job) {
    return json({ ok: false }, 400)
  }

  try {
    await webPush.sendNotification(
      job.subscription,
      JSON.stringify({
        body: 'Rest complete. Your next set is ready.',
        tag: `rest-timer-${job.timerId}`,
        title: 'NutriFit Timer',
        url: '/workout',
      }),
      {
        TTL: 120,
        urgency: 'high',
        topic: 'nutrifit-rest-timer',
        vapidDetails: { subject, publicKey, privateKey },
      },
    )
    return json({ ok: true })
  } catch (caught: unknown) {
    const statusCode = readWebPushStatusCode(caught)
    if (statusCode === 404 || statusCode === 410) {
      return json({ ok: true, subscriptionExpired: true })
    }
    return json({ ok: false }, 502)
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

function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { 'cache-control': 'no-store' },
  })
}
