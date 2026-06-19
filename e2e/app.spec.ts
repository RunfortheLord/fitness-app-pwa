import { expect, test } from '@playwright/test'

const routes = [
  { path: '/', title: 'Home', nav: 'Home' },
  { path: '/nutrition', title: 'Nutrition', nav: 'Nutrition' },
  { path: '/training', title: 'Training', nav: 'Training' },
  { path: '/history', title: 'History', nav: 'History' },
  { path: '/settings', title: 'Settings' },
]

for (const viewport of [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
]) {
  test.describe(`${viewport.width} by ${viewport.height}`, () => {
    test.use({ viewport, isMobile: true, hasTouch: true })

    for (const route of routes) {
      test(`renders ${route.title} without horizontal overflow`, async ({
        page,
      }) => {
        await page.goto(route.path)

        await expect(page).toHaveTitle(/Fitness Log/)
        await expect(
          page.getByRole('heading', { level: 1, name: route.title }),
        ).toBeVisible()
        await expect(
          page.getByRole('navigation', { name: 'Primary' }),
        ).toBeVisible()

        if (route.nav) {
          await expect(
            page.getByRole('link', { name: route.nav }),
          ).toHaveAttribute('aria-current', 'page')
        }

        const horizontalOverflow = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        )
        expect(horizontalOverflow).toBe(false)
      })
    }
  })
}

test('opens the quick action bottom sheet from the center add button', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  await page.getByRole('button', { name: 'Open quick actions' }).click()
  const sheet = page.getByRole('dialog', { name: 'Quick actions' })
  await expect(sheet).toBeVisible()
  await expect(sheet.getByRole('button', { name: /Log food/ })).toBeVisible()
  await expect(
    sheet.getByRole('button', { name: /Create exercise/ }),
  ).toBeVisible()
  await expect(
    sheet.getByRole('button', { name: /Create program/ }),
  ).toBeVisible()
})

test('creates and persists a custom exercise from the Add sheet', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  await page.getByRole('button', { name: 'Open quick actions' }).click()
  await page.getByRole('button', { name: /Create exercise/ }).click()
  await expect(page).toHaveURL(/\/training/)
  await page.getByRole('textbox', { name: 'Name' }).fill('E2E Bench press')
  await page.getByRole('textbox', { name: 'Default rest time' }).fill('150')
  await page.getByLabel('Tracking preset').selectOption('weight_reps')
  await expect(page.getByText(/external weight and repetitions/)).toBeVisible()
  await page.getByRole('button', { name: 'Save exercise' }).click()

  await expect(page.getByText('E2E Bench press')).toBeVisible()
  await expect(page.getByText(/Weight \+ reps - 150s rest/)).toBeVisible()

  await page.reload()
  await expect(page.getByText('E2E Bench press')).toBeVisible()
})

test('creates, activates, manually selects, and persists a program cycle', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/training')

  await page.getByLabel('Create exercise').click()
  await page.getByRole('textbox', { name: 'Name' }).fill('E2E Squat')
  await page.getByRole('textbox', { name: 'Default rest time' }).fill('180')
  await page.getByRole('button', { name: 'Save exercise' }).click()
  await expect(page.getByText('E2E Squat')).toBeVisible()

  await page
    .getByLabel('Current active cycle')
    .getByRole('button', { name: 'Create program' })
    .click()
  await page.getByRole('textbox', { name: 'Name' }).fill('E2E Strength')
  await page.getByRole('button', { name: 'Save program' }).click()
  const builder = page.getByRole('dialog', { name: 'Edit template' })
  await expect(builder).toBeVisible()
  await builder.getByRole('textbox', { name: 'Add workout day' }).fill('Day A')
  await builder.getByRole('button', { name: 'Add day' }).click()
  await expect(builder.getByText('Day A')).toBeVisible()
  await builder.getByRole('button', { name: 'Add exercise' }).click()
  await builder.getByLabel('Exercise').selectOption({ label: 'E2E Squat' })
  await builder.getByRole('button', { name: 'Save prescription' }).click()
  await expect(builder.getByText('E2E Squat')).toBeVisible()
  await builder.getByRole('button', { name: 'Close quick actions' }).click()

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Activate E2E Strength' }).click()
  await expect(page.getByText('Program activated.')).toBeVisible()
  await page.getByRole('button', { name: /Day A/ }).click()
  const dayDetail = page.getByRole('dialog', { name: 'Day A' })
  await expect(dayDetail).toBeVisible()
  await expect(dayDetail.getByText('E2E Squat')).toBeVisible()

  await page.reload()
  await expect(
    page.getByLabel('Current active cycle').getByText('E2E Strength'),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: /Day A/ })).toBeVisible()
})

test('starts, resumes, edits, and cancels a live workout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/training')

  await page.getByLabel('Create exercise').click()
  await page.getByRole('textbox', { name: 'Name' }).fill('E2E Live press')
  await page.getByRole('textbox', { name: 'Default rest time' }).fill('45')
  await page.getByLabel('Tracking preset').selectOption('weight_reps')
  await page.getByRole('button', { name: 'Save exercise' }).click()
  await expect(page.getByText('E2E Live press')).toBeVisible()

  await page
    .getByLabel('Current active cycle')
    .getByRole('button', { name: 'Create program' })
    .click()
  await page.getByRole('textbox', { name: 'Name' }).fill('E2E Live program')
  await page.getByRole('button', { name: 'Save program' }).click()
  const builder = page.getByRole('dialog', { name: 'Edit template' })
  await builder.getByRole('textbox', { name: 'Add workout day' }).fill('Live A')
  await builder.getByRole('button', { name: 'Add day' }).click()
  await builder.getByRole('button', { name: 'Add exercise' }).click()
  await builder.getByLabel('Exercise').selectOption({ label: 'E2E Live press' })
  await builder.getByRole('textbox', { name: 'Target sets' }).fill('1')
  await builder.getByRole('button', { name: 'Save prescription' }).click()
  await builder.getByRole('button', { name: 'Close quick actions' }).click()

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Activate E2E Live program' }).click()
  await page.getByRole('button', { name: /Live A/ }).click()
  await page
    .getByRole('dialog', { name: 'Live A' })
    .getByRole('button', { name: 'Start Workout' })
    .click()

  await expect(
    page.getByRole('heading', { level: 1, name: 'Live Workout' }),
  ).toBeVisible()
  await page.getByRole('textbox', { name: 'Workout notes' }).fill('E2E note')
  await page.getByRole('textbox', { name: 'Set 1 Weight' }).fill('95')
  await page.getByRole('textbox', { name: 'Set 1 Reps' }).fill('10')
  await page.getByRole('button', { name: 'Complete set 1' }).click()
  await expect(page.getByText('Rest timer')).toBeVisible()

  await page.reload()
  await expect(
    page.getByRole('textbox', { name: 'Workout notes' }),
  ).toHaveValue('E2E note')
  await expect(page.getByRole('textbox', { name: 'Set 1 Weight' })).toHaveValue(
    '95',
  )
  await expect(page.getByRole('textbox', { name: 'Set 1 Reps' })).toHaveValue(
    '10',
  )

  await page.getByRole('button', { name: 'Workout actions' }).click()
  await page.getByRole('button', { name: /Cancel Workout/ }).click()
  await page
    .getByRole('dialog', { name: 'Cancel workout?' })
    .getByRole('button', { name: 'Cancel Workout' })
    .click()
  await expect(page).toHaveURL(/\/training/)
})

test('creates, logs, edits, deletes, and persists nutrition entries', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/nutrition')

  await page.getByRole('button', { name: 'Create food' }).click()
  await expect(page.getByRole('button', { name: 'Save food' })).toBeDisabled()
  await page.getByRole('textbox', { name: 'Name' }).fill('E2E Rice')
  await page.getByRole('textbox', { name: 'Serving quantity' }).fill('1')
  await page.getByRole('textbox', { name: 'Serving unit' }).fill('cup')
  await page.getByRole('textbox', { name: 'Calories per serving' }).fill('200')
  await page.getByRole('textbox', { name: 'Protein per serving' }).fill('4')
  await page
    .getByRole('textbox', { name: 'Carbohydrates per serving' })
    .fill('45')
  await page.getByRole('textbox', { name: 'Fat per serving' }).fill('1')
  await page.getByRole('button', { name: 'Save food' }).click()

  await page.getByRole('searchbox', { name: 'Search foods' }).fill('e2e')
  await page.getByRole('button', { name: 'Log E2E Rice' }).click()
  await page.getByRole('textbox', { name: 'Serving multiplier' }).fill('1.5')
  await expect(page.getByText(/Preview: 300 kcal/)).toBeVisible()
  await page.getByRole('button', { name: 'Log food' }).click()
  await expect(
    page.locator('.metric-value').filter({ hasText: '300 kcal' }),
  ).toBeVisible()
  await expect(page.getByText(/1.5x 1 cup .* 300 kcal/)).toBeVisible()

  await page.reload()
  await expect(
    page.locator('.metric-value').filter({ hasText: '300 kcal' }),
  ).toBeVisible()
  await expect(page.getByText(/1.5x 1 cup .* 300 kcal/)).toBeVisible()

  await page.getByRole('button', { name: 'Edit E2E Rice log' }).click()
  await page.getByRole('textbox', { name: 'Serving multiplier' }).fill('2')
  await page.getByRole('button', { name: 'Save log' }).click()
  await expect(page.getByText(/2x 1 cup .* 400 kcal/)).toBeVisible()
  await expect(
    page.locator('.metric-value').filter({ hasText: '400 kcal' }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Delete E2E Rice log' }).click()
  await page
    .getByRole('dialog', { name: 'Delete food log?' })
    .getByRole('button', { name: 'Delete' })
    .click()
  await expect(page.getByText('No foods logged')).toBeVisible()

  await page.getByRole('button', { name: 'Open quick actions' }).click()
  await page.getByRole('button', { name: /Log food/ }).click()
  await expect(page).toHaveURL(/\/nutrition/)
  await expect(
    page.getByRole('searchbox', { name: 'Search foods' }),
  ).toBeVisible()
})

test('logs, edits, deletes, switches dates, and persists bodyweight after reload', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  await page.getByRole('button', { name: 'Open quick actions' }).click()
  await page.getByRole('button', { name: /Log bodyweight/ }).click()
  await page
    .getByRole('dialog', { name: 'Log bodyweight' })
    .getByRole('textbox', { name: 'Bodyweight' })
    .fill('188.4')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(
    page.getByLabel('Bodyweight').getByText('188.4 lb'),
  ).toBeVisible()

  await page.reload()
  await expect(
    page.getByLabel('Bodyweight').getByText('188.4 lb'),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Edit bodyweight' }).click()
  const editInput = page
    .getByRole('dialog', { name: 'Log bodyweight' })
    .getByRole('textbox', { name: 'Bodyweight' })
  await expect(editInput).toHaveValue('188.4')
  await editInput.fill('189.2')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(
    page.getByLabel('Bodyweight').getByText('189.2 lb'),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Next day' }).click()
  await expect(
    page.getByLabel('Bodyweight').getByText('No entry'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Previous day' }).click()
  await expect(
    page.getByLabel('Bodyweight').getByText('189.2 lb'),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Edit bodyweight' }).click()
  await page.getByRole('button', { name: /Delete/ }).click()
  await page
    .getByRole('dialog', { name: 'Delete bodyweight?' })
    .getByRole('button', { name: 'Delete' })
    .click()
  await expect(
    page.getByLabel('Bodyweight').getByText('No entry'),
  ).toBeVisible()

  await page.reload()
  await expect(
    page.getByLabel('Bodyweight').getByText('No entry'),
  ).toBeVisible()
})

test('settings exposes local data controls and validates malformed restore files', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/settings')

  await expect(page.getByText('Pounds (lb)')).toBeVisible()
  await expect(page.getByText('Backup format version')).toBeVisible()
  await expect(
    page.getByText(
      /Backups, restore files, and CSV exports stay on this device/,
    ),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Export JSON backup' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Export CSV archive' }),
  ).toBeVisible()

  await page.locator('input[type="file"]').setInputFiles({
    name: 'bad-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{'),
  })

  await expect(page.getByLabel('Import preview')).toBeVisible()
  await expect(page.getByText(/not valid JSON/)).toBeVisible()

  await page.getByRole('button', { name: 'Clear all data' }).click()
  await expect(
    page.getByRole('dialog', { name: 'Clear all data?' }),
  ).toBeVisible()
})
