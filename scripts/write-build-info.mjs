import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const outputPath = join(root, 'public', 'build-info.json')
const legalDocumentPaths = {
  consumerHealthDataPrivacy: {
    file: 'docs/legal/CONSUMER_HEALTH_DATA_PRIVACY_POLICY.md',
    route: '/consumer-health-data-privacy',
  },
  privacy: { file: 'docs/legal/PRIVACY_POLICY.md', route: '/privacy' },
  terms: { file: 'docs/legal/TERMS_OF_USE.md', route: '/terms' },
}

function legalDocuments() {
  return Object.fromEntries(
    Object.entries(legalDocumentPaths).map(([name, document]) => [
      name,
      {
        route: document.route,
        sha256: createHash('sha256')
          .update(readFileSync(join(root, document.file)))
          .digest('hex'),
      },
    ]),
  )
}

function isWorkingTreeDirty() {
  try {
    return (
      execFileSync('git', ['status', '--porcelain'], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim().length > 0
    )
  } catch {
    return false
  }
}

function gitShortHash() {
  const vercelSha = process.env.VERCEL_GIT_COMMIT_SHA
  if (vercelSha) {
    return vercelSha.slice(0, 7)
  }

  try {
    const hash = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    // Flag local builds made from uncommitted changes so a stale-looking hash
    // can never be mistaken for "nothing changed".
    return isWorkingTreeDirty() ? `${hash}-dirty` : hash
  } catch {
    return 'unknown'
  }
}

function deploymentEnvironment() {
  if (process.env.VITE_DEPLOYMENT_ENV) {
    return process.env.VITE_DEPLOYMENT_ENV
  }
  if (process.env.VERCEL_ENV === 'production') {
    return 'Production'
  }
  if (process.env.VERCEL_ENV === 'preview') {
    return 'Preview'
  }
  return 'Local build'
}

mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(
  outputPath,
  `${JSON.stringify(
    {
      gitHash: gitShortHash(),
      environment: deploymentEnvironment(),
      builtAt: new Date().toISOString(),
      legalDocuments: legalDocuments(),
    },
    null,
    2,
  )}\n`,
)
