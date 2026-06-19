import { expect, test, type Locator, type Page } from '@playwright/test'

const routes = [
  { path: '/', title: 'Home', nav: 'Home' },
  { path: '/nutrition', title: 'Nutrition', nav: 'Nutrition' },
  { path: '/training', title: 'Training', nav: 'Training' },
  { path: '/history', title: 'History', nav: 'History' },
  { path: '/settings', title: 'Settings' },
]

for (const viewport of [
  { width: 390, height: 844 },
  { width: 393, height: 852 },
  { width: 430, height: 932 },
  { width: 1024, height: 768 },
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

test('quick action sheet traps focus and closes with Escape', async ({
  browserName,
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/')

  await page.getByRole('button', { name: 'Open quick actions' }).click()
  const sheet = page.getByRole('dialog', { name: 'Quick actions' })
  await expect(sheet).toBeVisible()

  await page.keyboard.press('Tab')
  await expect(sheet.getByRole('button', { name: /Log food/ })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(sheet).not.toBeVisible()
  if (browserName !== 'webkit') {
    await expect(
      page.getByRole('button', { name: 'Open quick actions' }),
    ).toBeFocused()
  }
})

test('creates and persists a custom exercise from the Add sheet', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  await page.getByRole('button', { name: 'Open quick actions' }).click()
  await page.getByRole('button', { name: /Create exercise/ }).click()
  await expect(page).toHaveURL(/\/training/)
  await waitForExerciseLibrary(page)
  await page.getByRole('textbox', { name: 'Name' }).fill('E2E Bench press')
  await fillRestInputs(page, '150')
  await page.getByLabel('Tracking preset').selectOption('weight_reps')
  await expect(page.getByText(/external weight and repetitions/)).toBeVisible()
  await page.getByRole('button', { name: 'Save exercise' }).click()

  await expect(page.getByText('E2E Bench press')).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByText(/Weight \+ reps - 150s rest/)).toBeVisible()

  await page.reload()
  await expect(page.getByText('E2E Bench press')).toBeVisible()
})

test('creates, activates, manually selects, and persists a program cycle', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/training')
  await waitForExerciseLibrary(page)

  await page.getByLabel('Create exercise').click()
  await page.getByRole('textbox', { name: 'Name' }).fill('E2E Squat')
  await fillRestInputs(page, '180')
  await page.getByRole('button', { name: 'Save exercise' }).click()
  await expect(page.getByText('E2E Squat')).toBeVisible({ timeout: 15_000 })

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
  await addPrescription(builder, 'E2E Squat')
  await expect(builder.getByText('E2E Squat')).toBeVisible()
  await closeBuilder(builder)

  await page.getByRole('button', { name: 'Activate E2E Strength' }).click()
  await page
    .getByRole('dialog', { name: 'Activate program?' })
    .getByRole('button', { name: 'Activate' })
    .click()
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

test('starts, resumes, edits, and cancels a live workout', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/training')
  await waitForExerciseLibrary(page)

  await page.getByLabel('Create exercise').click()
  await page.getByRole('textbox', { name: 'Name' }).fill('E2E Live press')
  await fillRestInputs(page, '45')
  await page.getByLabel('Tracking preset').selectOption('weight_reps')
  await page.getByRole('button', { name: 'Save exercise' }).click()
  await expect(page.getByText('E2E Live press')).toBeVisible({
    timeout: 15_000,
  })

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
  await addPrescription(builder, 'E2E Live press', '1')
  await closeBuilder(builder)

  await page.getByRole('button', { name: 'Activate E2E Live program' }).click()
  await page
    .getByRole('dialog', { name: 'Activate program?' })
    .getByRole('button', { name: 'Activate' })
    .click()
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
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath('live-workout-390.png'),
  })

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
  await page.getByRole('button', { name: 'Log food', exact: true }).click()
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
  await expect(page.getByLabel('Bodyweight').getByText('188.4 lb')).toBeVisible(
    { timeout: 15_000 },
  )

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

test('completes the release workflow through backup restore', async ({
  page,
}, testInfo) => {
  testInfo.setTimeout(90_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/nutrition')

  await page.getByRole('button', { name: 'Create food' }).click()
  await page.getByRole('textbox', { name: 'Name' }).fill('Audit oats')
  await page.getByRole('textbox', { name: 'Serving quantity' }).fill('1')
  await page.getByRole('textbox', { name: 'Serving unit' }).fill('cup')
  await page.getByRole('textbox', { name: 'Calories per serving' }).fill('200')
  await page.getByRole('textbox', { name: 'Protein per serving' }).fill('8')
  await page
    .getByRole('textbox', { name: 'Carbohydrates per serving' })
    .fill('30')
  await page.getByRole('textbox', { name: 'Fat per serving' }).fill('4')
  await page.getByRole('button', { name: 'Save food' }).click()
  await page.getByRole('searchbox', { name: 'Search foods' }).fill('audit')
  await page.getByRole('button', { name: 'Log Audit oats' }).click()
  await page.getByRole('textbox', { name: 'Serving multiplier' }).fill('1.25')
  await expect(page.getByText(/Preview: 250 kcal/)).toBeVisible()
  await page.getByRole('button', { name: 'Log food', exact: true }).click()
  await expect(page.getByText(/1.25x 1 cup .* 250 kcal/)).toBeVisible()

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

  await page.goto('/training')
  await waitForExerciseLibrary(page)
  await createExercise(page, 'Audit squat', '180')
  await createExercise(page, 'Audit curl', '60')
  await createExercise(page, 'Audit row', '90')

  await page
    .getByLabel('Current active cycle')
    .getByRole('button', { name: 'Create program' })
    .click()
  await page.getByRole('textbox', { name: 'Name' }).fill('Audit program')
  await page.getByRole('button', { name: 'Save program' }).click()
  const builder = page.getByRole('dialog', { name: 'Edit template' })
  await builder
    .getByRole('textbox', { name: 'Add workout day' })
    .fill('Audit A')
  await builder.getByRole('button', { name: 'Add day' }).click()
  await builder.getByRole('button', { name: 'Add exercise' }).click()
  await addPrescription(builder, 'Audit squat', '3')
  await builder.getByRole('button', { name: 'Add exercise' }).click()
  await addPrescription(builder, 'Audit curl', '1')
  await closeBuilder(builder)

  await page.getByRole('button', { name: 'Activate Audit program' }).click()
  await page
    .getByRole('dialog', { name: 'Activate program?' })
    .getByRole('button', { name: 'Activate' })
    .click()
  await page.getByRole('button', { name: /Audit A/ }).click()
  await page
    .getByRole('dialog', { name: 'Audit A' })
    .getByRole('button', { name: 'Start Workout' })
    .click()

  await expect(
    page.getByRole('heading', { level: 1, name: 'Live Workout' }),
  ).toBeVisible()
  await page.getByRole('textbox', { name: 'Set 1 Weight' }).first().fill('185')
  await page.getByRole('textbox', { name: 'Set 1 Reps' }).first().fill('8')
  await page.getByRole('button', { name: 'Complete set 1' }).first().click()
  await page.getByRole('textbox', { name: 'Set 2 Weight' }).fill('190')
  await page.getByRole('textbox', { name: 'Set 2 Reps' }).fill('7')
  await page.getByRole('button', { name: 'Complete set 2' }).click()
  await page.getByRole('textbox', { name: 'Set 3 Weight' }).fill('195')
  await page.getByRole('textbox', { name: 'Set 3 Reps' }).fill('6')
  await page.getByRole('button', { name: 'Complete set 3' }).click()
  await page.getByRole('button', { name: 'Add Set' }).first().click()
  await page.getByRole('textbox', { name: 'Set 4 Weight' }).fill('200')
  await page.getByRole('textbox', { name: 'Set 4 Reps' }).fill('5')
  await page.getByRole('button', { name: 'Complete set 4' }).click()
  await page.getByRole('button', { name: 'Replace Exercise' }).first().click()
  await page
    .getByRole('dialog', { name: 'Replace Exercise' })
    .getByLabel('Exercise', { exact: true })
    .selectOption({ label: 'Audit row' })
  await page
    .getByRole('dialog', { name: 'Replace Exercise' })
    .getByRole('button', { name: 'Replace Exercise', exact: true })
    .click()
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Skip Exercise' }).click()
  await expect(page.getByRole('button', { name: 'Unskip' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Audit curl' })).toBeVisible()
  await expect(page.getByText('Audit row')).toBeVisible()
  await expect(page.getByText('Skipped', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Previous' }).click()
  await expect(page.getByRole('textbox', { name: 'Set 4 Weight' })).toHaveValue(
    '200',
  )

  await page.getByRole('button', { name: 'Finish Workout' }).click()
  await expect(page).toHaveURL(/\/history\?workout=/)
  await expect(page.getByText('Added 4th Audit squat set')).toBeVisible()
  await expect(
    page.getByText('Replaced Audit squat with Audit row'),
  ).toBeVisible()
  await expect(page.getByText('Skipped Audit curl')).toBeVisible()
  await page
    .locator('.change-review-item', {
      hasText: 'Added 4th Audit squat set',
    })
    .locator('input[type="checkbox"]')
    .check()
  await page
    .locator('.change-review-item', {
      hasText: 'Added 4th Audit squat set',
    })
    .getByLabel('Destination')
    .selectOption('cycle_only')
  await page
    .locator('.change-review-item', {
      hasText: 'Replaced Audit squat with Audit row',
    })
    .locator('input[type="checkbox"]')
    .check()
  await page
    .locator('.change-review-item', {
      hasText: 'Replaced Audit squat with Audit row',
    })
    .getByLabel('Destination')
    .selectOption('template_only')
  await page.getByRole('button', { name: 'Apply selected' }).click()
  await expect(page.getByText('Reviewed')).toBeVisible()

  await page.goto('/settings')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export JSON backup' }).click()
  const download = await downloadPromise
  const backupPath = testInfo.outputPath(download.suggestedFilename())
  await download.saveAs(backupPath)

  await page.getByRole('button', { name: 'Clear all data' }).click()
  const clearDialog = page.getByRole('dialog', { name: 'Clear all data?' })
  await clearDialog.getByLabel('Confirmation').fill('DELETE')
  await Promise.all([
    page.waitForEvent('framenavigated'),
    clearDialog.getByRole('button', { name: 'Delete local data' }).click(),
  ])
  await page.goto('/nutrition')
  await expect(page.getByText('No recent foods')).toBeVisible()

  await page.goto('/settings')
  await page.locator('input[type="file"]').setInputFiles(backupPath)
  await expect(page.getByLabel('Import preview')).toBeVisible()
  const restoreDialog = page.getByRole('dialog', {
    name: 'Replace local data?',
  })
  await restoreDialog.getByLabel('Confirmation').fill('REPLACE')
  await Promise.all([
    page.waitForEvent('framenavigated'),
    restoreDialog.getByRole('button', { name: 'Replace data' }).click(),
  ])
  await page.goto('/history')
  await expect(page.getByRole('button', { name: /Audit A/ })).toBeVisible()
  await page.getByRole('button', { name: /Audit A/ }).click()
  await expect(page.getByRole('heading', { name: 'Audit row' })).toBeVisible()
  await expect(page.getByText('Added 4th Audit squat set')).toBeVisible()
  await page.goto('/nutrition')
  await expect(page.getByText(/1.25x 1 cup .* 250 kcal/)).toBeVisible()
})

async function createExercise(page: Page, name: string, rest: string) {
  await waitForExerciseLibrary(page)
  await page.getByLabel('Create exercise').click()
  await page.getByRole('textbox', { name: 'Name' }).fill(name)
  await fillRestInputs(page, rest)
  await page.getByLabel('Tracking preset').selectOption('weight_reps')
  await page.getByRole('button', { name: 'Save exercise' }).click()
  await expect(page.getByText(name)).toBeVisible({ timeout: 15_000 })
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
}

async function closeBuilder(builder: Locator) {
  await builder.getByRole('button', { name: /Save (template|cycle)/ }).click()
  await expect(builder).not.toBeVisible()
}

async function waitForExerciseLibrary(page: Page) {
  await expect(
    page.getByText('Barbell Bench Press', { exact: true }),
  ).toBeVisible({
    timeout: 30_000,
  })
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
