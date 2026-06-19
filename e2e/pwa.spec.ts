import { expect, test, type BrowserContext, type Page } from '@playwright/test'

test('production manifest exposes install metadata and icons', async ({
  page,
  request,
}) => {
  const manifestResponse = await request.get('/manifest.webmanifest')
  expect(manifestResponse.ok()).toBe(true)

  const manifest = await manifestResponse.json()
  expect(manifest).toMatchObject({
    name: 'Fitness Log',
    short_name: 'Fitness',
    display: 'standalone',
    orientation: 'portrait-primary',
    theme_color: '#101011',
    background_color: '#101011',
    start_url: '/',
    scope: '/',
  })
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ sizes: '192x192', purpose: 'any' }),
      expect.objectContaining({ sizes: '512x512', purpose: 'any' }),
      expect.objectContaining({ sizes: '512x512', purpose: 'any maskable' }),
    ]),
  )

  await page.goto('/')
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    'href',
    '/apple-touch-icon.png',
  )
})

test('registers the service worker in the production build', async ({
  browserName,
  context,
  page,
}) => {
  test.skip(
    browserName !== 'chromium',
    'Service worker inspection is Chromium-only.',
  )

  await installControlledServiceWorker(page, context)

  const registrations = await page.evaluate(() =>
    navigator.serviceWorker
      .getRegistrations()
      .then((items) =>
        items.map((registration) => registration.active?.scriptURL ?? ''),
      ),
  )
  expect(registrations.some((scriptUrl) => scriptUrl.endsWith('/sw.js'))).toBe(
    true,
  )
})

test('loads cached app shell and navigates while offline', async ({
  browserName,
  context,
  page,
}) => {
  test.skip(
    browserName !== 'chromium',
    'Offline service worker coverage runs in Chromium.',
  )

  await installControlledServiceWorker(page, context)
  await expectCachedShell(page)

  await context.setOffline(true)
  await page.goto('/nutrition')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Nutrition' }),
  ).toBeVisible()
  await expect(
    page.getByText('Offline. Changes stay on this device.'),
  ).toBeVisible()

  await page.goto('/training')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Training' }),
  ).toBeVisible()

  await page.goto('/history')
  await expect(
    page.getByRole('heading', { level: 1, name: 'History' }),
  ).toBeVisible()
})

test('persists IndexedDB records created while offline', async ({
  browserName,
  context,
  page,
}) => {
  test.skip(
    browserName !== 'chromium',
    'Offline service worker coverage runs in Chromium.',
  )

  await installControlledServiceWorker(page, context)
  await context.setOffline(true)

  await page.goto('/training')
  await page.getByLabel('Create exercise').click()
  await page.getByRole('textbox', { name: 'Name' }).fill('Offline DB press')
  await page.getByRole('textbox', { name: 'Default rest time' }).fill('90')
  await page.getByRole('button', { name: 'Save exercise' }).click()
  await expect(page.getByText('Offline DB press')).toBeVisible()

  await page.reload()
  await expect(page.getByText('Offline DB press')).toBeVisible()
})

test('shows and applies the update availability action', async ({ page }) => {
  await page.goto('/?pwaTest=1')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Home' }),
  ).toBeVisible()

  await page.evaluate(() => {
    const testWindow = window as Window & {
      __fitnessLogUpdateApplied?: boolean
    }
    testWindow.__fitnessLogUpdateApplied = false
    window.dispatchEvent(
      new CustomEvent('fitness-log:pwa-update-ready', {
        detail: {
          applyUpdate: () => {
            testWindow.__fitnessLogUpdateApplied = true
          },
        },
      }),
    )
  })

  await expect(page.getByText('Update available.')).toBeVisible()
  await page.getByRole('button', { name: 'Update now' }).click()
  await expect(page.getByRole('button', { name: 'Updating' })).toBeDisabled()
  await expect
    .poll(() =>
      page.evaluate(() => {
        const testWindow = window as Window & {
          __fitnessLogUpdateApplied?: boolean
        }
        return testWindow.__fitnessLogUpdateApplied === true
      }),
    )
    .toBe(true)
  await expect(page.getByText(/close the app and open it again/)).toBeVisible()
})

test('recovers an active workout after an offline reload', async ({
  browserName,
  context,
  page,
}) => {
  test.skip(
    browserName !== 'chromium',
    'Offline service worker coverage runs in Chromium.',
  )

  await installControlledServiceWorker(page, context)
  await createActiveWorkout(page)
  await context.setOffline(true)

  await page.reload()
  await expect(
    page.getByRole('textbox', { name: 'Workout notes' }),
  ).toHaveValue('Offline active workout')
  await expect(page.getByRole('textbox', { name: 'Set 1 Weight' })).toHaveValue(
    '105',
  )
  await expect(page.getByRole('textbox', { name: 'Set 1 Reps' })).toHaveValue(
    '8',
  )
})

async function installControlledServiceWorker(
  page: Page,
  context: BrowserContext,
) {
  await context.setOffline(false)
  await page.goto('/')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Home' }),
  ).toBeVisible()

  const supportsServiceWorker = await page.evaluate(
    () => 'serviceWorker' in navigator,
  )
  expect(supportsServiceWorker).toBe(true)

  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined))

  const hasController = await page.evaluate(() =>
    Boolean(navigator.serviceWorker.controller),
  )

  if (!hasController) {
    await page.reload()
    await page.waitForFunction(
      () => navigator.serviceWorker.controller !== null,
    )
  }
}

async function expectCachedShell(page: Page) {
  const hasCachedShell = await page.evaluate(async () => {
    for (const cacheName of await caches.keys()) {
      const cache = await caches.open(cacheName)
      for (const request of await cache.keys()) {
        const response = await cache.match(request)
        if (response?.headers.get('content-type')?.includes('text/html')) {
          return true
        }
      }
    }

    return false
  })

  expect(hasCachedShell).toBe(true)
}

async function createActiveWorkout(page: Page) {
  await page.goto('/training')
  await page.getByLabel('Create exercise').click()
  await page
    .getByRole('textbox', { name: 'Name' })
    .fill('Offline recovery press')
  await page.getByRole('textbox', { name: 'Default rest time' }).fill('45')
  await page.getByLabel('Tracking preset').selectOption('weight_reps')
  await page.getByRole('button', { name: 'Save exercise' }).click()

  await page
    .getByLabel('Current active cycle')
    .getByRole('button', { name: 'Create program' })
    .click()
  await page
    .getByRole('textbox', { name: 'Name' })
    .fill('Offline recovery program')
  await page.getByRole('button', { name: 'Save program' }).click()

  const builder = page.getByRole('dialog', { name: 'Edit template' })
  await builder
    .getByRole('textbox', { name: 'Add workout day' })
    .fill('Offline A')
  await builder.getByRole('button', { name: 'Add day' }).click()
  await builder.getByRole('button', { name: 'Add exercise' }).click()
  await builder
    .getByLabel('Exercise')
    .selectOption({ label: 'Offline recovery press' })
  await builder.getByRole('textbox', { name: 'Target sets' }).fill('1')
  await builder.getByRole('button', { name: 'Save prescription' }).click()
  await builder.getByRole('button', { name: 'Close quick actions' }).click()

  page.once('dialog', (dialog) => dialog.accept())
  await page
    .getByRole('button', { name: 'Activate Offline recovery program' })
    .click()
  await page.getByRole('button', { name: /Offline A/ }).click()
  await page
    .getByRole('dialog', { name: 'Offline A' })
    .getByRole('button', { name: 'Start Workout' })
    .click()

  await page
    .getByRole('textbox', { name: 'Workout notes' })
    .fill('Offline active workout')
  await page.getByRole('textbox', { name: 'Set 1 Weight' }).fill('105')
  await page.getByRole('textbox', { name: 'Set 1 Reps' }).fill('8')
  await page.getByRole('button', { name: 'Complete set 1' }).click()
}
