import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const distDir = new URL('../dist/', import.meta.url)
const sentinels = [
  'USDA_FDC_API_KEY_TEST_SENTINEL',
  process.env.USDA_FDC_API_KEY_TEST_SENTINEL,
].filter(Boolean)

const files = await listFiles(distDir)
const leakedFiles = []

for (const file of files) {
  const content = await readFile(file, 'utf8')
  if (sentinels.some((sentinel) => content.includes(sentinel))) {
    leakedFiles.push(file)
  }
}

if (leakedFiles.length > 0) {
  throw new Error(
    `Secret sentinel leaked into production output: ${leakedFiles.join(', ')}`,
  )
}

async function listFiles(directoryUrl) {
  const entries = await readdir(directoryUrl, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const child = new URL(
      `${entry.name}${entry.isDirectory() ? '/' : ''}`,
      directoryUrl,
    )
    if (entry.isDirectory()) {
      files.push(...(await listFiles(child)))
    } else if (
      /\.(js|css|html|json|webmanifest|map|txt|svg)$/u.test(entry.name)
    ) {
      files.push(fileURLToPath(child))
    }
  }
  return files
}
