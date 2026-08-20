import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const legalDocumentPaths = {
  consumerHealthDataPrivacy: {
    file: 'docs/legal/CONSUMER_HEALTH_DATA_PRIVACY_POLICY.md',
    route: '/consumer-health-data-privacy',
  },
  privacy: { file: 'docs/legal/PRIVACY_POLICY.md', route: '/privacy' },
  terms: { file: 'docs/legal/TERMS_OF_USE.md', route: '/terms' },
}
const rawOrigin = process.argv[2] ?? process.env.STORE_PUBLIC_ORIGIN

if (!rawOrigin || rawOrigin === '--help') {
  console.log(
    'Usage: npm run store:verify-web -- https://your-production-origin.example',
  )
  process.exit(rawOrigin === '--help' ? 0 : 2)
}

let origin
try {
  const parsed = new URL(rawOrigin)
  if (
    parsed.protocol !== 'https:' ||
    parsed.origin !== parsed.href.replace(/\/$/u, '')
  ) {
    throw new Error('origin must be a bare HTTPS origin')
  }
  origin = parsed.origin
} catch (error) {
  console.error(`Invalid store origin: ${error.message}`)
  process.exit(2)
}

const failures = []
const results = []

async function request(path, init) {
  try {
    return await fetch(`${origin}${path}`, {
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
      ...init,
    })
  } catch (error) {
    failures.push(`${path}: request failed (${error.message})`)
    return null
  }
}

for (const path of [
  '/terms',
  '/privacy',
  '/consumer-health-data-privacy',
  '/account-deletion',
  '/support',
]) {
  const response = await request(path)
  if (!response) continue
  const contentType = response.headers.get('content-type') ?? ''
  results.push(`${path}: ${response.status}`)
  if (!response.ok || !contentType.includes('text/html')) {
    failures.push(`${path}: expected a successful HTML response`)
  }
}

const buildInfoResponse = await request('/build-info.json')
if (buildInfoResponse) {
  if (!buildInfoResponse.ok) {
    failures.push(
      `/build-info.json: expected 200, received ${buildInfoResponse.status}`,
    )
  } else {
    const buildInfo = await buildInfoResponse.json()
    for (const [name, document] of Object.entries(legalDocumentPaths)) {
      const expectedHash = createHash('sha256')
        .update(readFileSync(join(root, document.file)))
        .digest('hex')
      const deployed = buildInfo.legalDocuments?.[name]
      if (
        deployed?.route !== document.route ||
        deployed?.sha256 !== expectedHash
      ) {
        failures.push(
          `/build-info.json: ${name} does not match the current canonical document`,
        )
      }
    }
    results.push('/build-info.json: canonical legal-document hashes checked')
  }
}

const landing = await request('/')
if (landing) {
  const requiredHeaders = new Map([
    ['content-security-policy', "frame-ancestors 'none'"],
    ['strict-transport-security', 'max-age='],
    ['permissions-policy', 'camera=(self)'],
    ['x-content-type-options', 'nosniff'],
    ['x-frame-options', 'DENY'],
  ])
  for (const [name, expected] of requiredHeaders) {
    const value = landing.headers.get(name) ?? ''
    if (!value.includes(expected)) {
      failures.push(`/: ${name} is missing ${JSON.stringify(expected)}`)
    }
  }
  results.push('/: deployment security headers checked')
}

const healthResponse = await request('/api/health')
if (healthResponse) {
  if (!healthResponse.ok) {
    failures.push(
      `/api/health: expected 200, received ${healthResponse.status}`,
    )
  } else {
    const health = await healthResponse.json()
    const requiredIntegrations = [
      'accountDeletion',
      'authRelay',
      'cloudBackup',
      'distributedAiProtection',
      'foodSearch',
      'mealAnalysis',
      'supportContact',
    ]
    for (const integration of requiredIntegrations) {
      if (health.configured?.[integration] !== true) {
        failures.push(`/api/health: ${integration} is not configured`)
      }
    }
    results.push('/api/health: required integrations checked')
  }
}

const deletionResponse = await request('/api/account/delete', {
  method: 'POST',
  headers: { Origin: 'capacitor://localhost' },
})
if (deletionResponse) {
  results.push(`/api/account/delete: ${deletionResponse.status}`)
  if (deletionResponse.status !== 401) {
    failures.push(
      '/api/account/delete: unauthenticated request was not rejected',
    )
  }
}

const feedbackResponse = await request('/api/feedback', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Origin: 'https://untrusted.invalid',
  },
  body: '{}',
})
if (feedbackResponse) {
  results.push(`/api/feedback foreign origin: ${feedbackResponse.status}`)
  if (feedbackResponse.status !== 403) {
    failures.push('/api/feedback: foreign origin was not rejected')
  }
}

for (const result of results) console.log(`PASS ${result}`)

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`)
  console.error(
    `Store web verification failed with ${failures.length} blocker(s).`,
  )
  process.exit(1)
}

console.log('Store web verification passed.')
