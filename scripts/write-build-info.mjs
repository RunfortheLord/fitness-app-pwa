import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const outputPath = join(root, 'public', 'build-info.json')

function gitShortHash() {
  const vercelSha = process.env.VERCEL_GIT_COMMIT_SHA
  if (vercelSha) {
    return vercelSha.slice(0, 7)
  }

  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
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
    },
    null,
    2,
  )}\n`,
)
