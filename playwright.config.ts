import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  // Retry transient failures (e.g. occasional WebKit timing flakes under full
  // parallel load). Genuine failures still fail every attempt; the trace is
  // captured on the first retry for diagnosis.
  retries: process.env.CI ? 2 : 0,
  fullyParallel: true,
  workers: 4,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4187',
    trace: 'on-first-retry',
  },
  webServer: {
    // Launch Vite directly so Playwright owns the actual server process on
    // Windows and can terminate it cleanly after the suite. Wrapping it in npm
    // can orphan the child process and leave an otherwise-finished run hanging.
    command:
      'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4187',
    url: 'http://127.0.0.1:4187',
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === '1',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'iphone-sized-chromium',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'mobile-webkit',
      use: { ...devices['iPhone 15'] },
    },
  ],
})
