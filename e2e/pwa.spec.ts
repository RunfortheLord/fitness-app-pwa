import {
  expect,
  test,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test'

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
  await page.getByRole('button', { name: 'Exercise Library' }).click()
  await expect(
    page.getByText('Barbell Bench Press', { exact: true }),
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
  await waitForExerciseLibrary(page)
  await page.getByLabel('Create exercise').click()
  await page.getByRole('textbox', { name: 'Name' }).fill('Offline DB press')
  await fillRestInputs(page, '90')
  await page.getByRole('button', { name: 'Save exercise' }).click()
  await expect(page.getByText('Offline DB press')).toBeVisible({
    timeout: 15_000,
  })

  await page.reload()
  await waitForExerciseLibrary(page)
  await expect(page.getByText('Offline DB press')).toBeVisible()
})

test('shows and applies the update availability action', async ({ page }) => {
  await page.goto('/?pwaTest=1')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Home' }),
  ).toBeVisible()
  const signInPrompt = page.getByRole('complementary', {
    name: 'Prevent data loss',
  })
  await signInPrompt.getByRole('button', { name: 'Not now' }).click()
  await expect(signInPrompt).not.toBeVisible()

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
  ).toHaveCount(0)
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
  await waitForExerciseLibrary(page)
  await page.getByLabel('Create exercise').click()
  await page
    .getByRole('textbox', { name: 'Name' })
    .fill('Offline recovery press')
  await fillRestInputs(page, '45')
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
  await addWorkoutDay(builder, 'Offline A')
  await builder.getByRole('button', { name: 'Add exercise' }).click()
  await addPrescription(builder, 'Offline recovery press', '2')
  await closeBuilder(builder)

  await page
    .getByRole('button', { name: 'Activate Offline recovery program' })
    .click()
  await page
    .getByRole('dialog', { name: 'Activate program?' })
    .getByRole('button', { name: 'Activate' })
    .click()
  await page.getByRole('button', { name: /^Offline A/ }).click()
  await page
    .getByRole('dialog', { name: 'Offline A' })
    .getByRole('button', { name: 'Start Workout' })
    .click()

  await page.getByRole('textbox', { name: 'Set 1 Weight' }).fill('105')
  await page.getByRole('textbox', { name: 'Set 1 Reps' }).fill('8')
  await page.getByRole('button', { name: 'Complete set 1' }).click()
  await expect(page.locator('.rest-timer-toolbar')).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Set 1 Reps' })).toHaveValue(
    '8',
  )
}

async function waitForExerciseLibrary(page: Page) {
  const libraryToggle = page.getByRole('button', { name: 'Exercise Library' })
  await expect(libraryToggle).toBeVisible({ timeout: 30_000 })
  if ((await libraryToggle.getAttribute('aria-expanded')) !== 'true') {
    await libraryToggle.click()
  }
  await expect(
    page.getByText('Barbell Bench Press', { exact: true }),
  ).toBeVisible({
    timeout: 30_000,
  })
}

async function addPrescription(
  builder: Locator,
  exerciseName: string,
  sets = '3',
) {
  await builder
    .getByRole('searchbox', { name: 'Search exercises' })
    .fill(exerciseName)
  await builder.getByRole('button', { name: new RegExp(exerciseName) }).click()
  await builder.getByRole('textbox', { name: 'Sets' }).fill(sets)
  const minReps = builder.getByRole('textbox', { name: 'Min reps' })
  if (await minReps.isVisible()) {
    await minReps.fill('5')
    await builder.getByRole('textbox', { name: 'Max reps' }).fill('10')
  }
  await builder.getByRole('button', { name: 'Save prescription' }).click()
  await expect(builder.getByLabel('Prescription editor')).not.toBeVisible({
    timeout: 15_000,
  })
}

async function addWorkoutDay(builder: Locator, name: string) {
  await builder.getByRole('button', { name: 'Add workout day' }).click()
  await builder
    .getByRole('textbox', { name: 'New workout day name' })
    .fill(name)
  await builder.getByRole('button', { name: 'Save workout day' }).click()
}

async function closeBuilder(builder: Locator) {
  await builder.getByRole('button', { name: /^Back from edit/ }).click()
  await expect(builder).not.toBeVisible({ timeout: 15_000 })
}

async function fillRestInputs(page: Page, rest: string) {
  const totalSeconds = Number(rest)
  await page
    .getByRole('textbox', { name: 'Rest minutes' })
    .fill(String(Math.floor(totalSeconds / 60)))
  await page
    .getByRole('textbox', { name: 'Rest seconds' })
    .fill(String(totalSeconds % 60))
}
