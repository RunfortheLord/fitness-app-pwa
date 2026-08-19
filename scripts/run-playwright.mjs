import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const previewUrl = 'http://127.0.0.1:4187'
const viteCli = resolve(rootDirectory, 'node_modules/vite/bin/vite.js')
const playwrightCli = resolve(
  rootDirectory,
  'node_modules/@playwright/test/cli.js',
)

let previewProcess

try {
  if (await isReachable(previewUrl)) {
    throw new Error(
      `Port 4187 is already serving content. Stop that process before running Playwright.`,
    )
  }

  previewProcess = spawn(
    process.execPath,
    [viteCli, 'preview', '--host', '127.0.0.1', '--port', '4187'],
    {
      cwd: rootDirectory,
      stdio: ['ignore', 'inherit', 'inherit'],
      windowsHide: true,
    },
  )
  await waitForPreview(previewProcess)

  const playwrightProcess = spawn(
    process.execPath,
    [playwrightCli, 'test', ...process.argv.slice(2)],
    {
      cwd: rootDirectory,
      env: { ...process.env, PLAYWRIGHT_REUSE_SERVER: '1' },
      stdio: 'inherit',
      windowsHide: true,
    },
  )
  const [exitCode] = await once(playwrightProcess, 'exit')
  process.exitCode = typeof exitCode === 'number' ? exitCode : 1
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  await stopChild(previewProcess)
}

async function waitForPreview(child) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Vite preview exited with code ${child.exitCode}.`)
    }
    if (await isReachable(previewUrl)) {
      return
    }
    await delay(250)
  }
  throw new Error('Vite preview did not become ready within 30 seconds.')
}

async function isReachable(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(500) })
    return response.ok
  } catch {
    return false
  }
}

async function stopChild(child) {
  if (!child || child.exitCode !== null) {
    return
  }
  child.kill()
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (child.exitCode !== null) {
      return
    }
    await delay(100)
  }
  if (child.exitCode === null) {
    child.kill('SIGKILL')
  }
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds))
}
