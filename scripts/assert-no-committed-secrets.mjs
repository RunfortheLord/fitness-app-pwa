import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const repositoryRoot = new URL('../', import.meta.url)
const candidateFiles = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  {
    cwd: repositoryRoot,
    encoding: 'utf8',
  },
)
  .split('\0')
  .filter(Boolean)

const forbiddenPaths = candidateFiles.filter((file) => {
  const normalized = file.replaceAll('\\', '/')
  const name = path.posix.basename(normalized)
  return (
    (/^\.env(?:\..+)?$/u.test(name) && name !== '.env.example') ||
    /\.(?:p8|pem|key)$/iu.test(name)
  )
})

const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/u,
  /\bsb_secret_[A-Za-z0-9_-]{20,}\b/u,
  /\bgithub_pat_[A-Za-z0-9_]{40,}\b/u,
  /\bAKIA[A-Z0-9]{16}\b/u,
  /\bAIza[A-Za-z0-9_-]{30,}\b/u,
  /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]{30,}/u,
  /https:\/\/(?:discord(?:app)?\.com)\/api\/webhooks\/\d+\/[A-Za-z0-9._-]{20,}/u,
]

const matchedFiles = []
for (const file of candidateFiles) {
  const bytes = await readFile(
    new URL(file.replaceAll('\\', '/'), repositoryRoot),
  )
  if (bytes.includes(0)) {
    continue
  }
  const content = bytes.toString('utf8')
  if (secretPatterns.some((pattern) => pattern.test(content))) {
    matchedFiles.push(file)
  }
}

const violations = [...new Set([...forbiddenPaths, ...matchedFiles])]
if (violations.length > 0) {
  throw new Error(
    `Potential committed secret material found in: ${violations.join(', ')}`,
  )
}

console.info(
  `Checked ${candidateFiles.length} repository files for secret material.`,
)
