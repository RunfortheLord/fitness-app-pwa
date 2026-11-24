import { expect, test } from './fixtures'

const programName = 'February 2027 Powerlifting Peak + Upper Body Hypertrophy'
test.setTimeout(120000)

test('previews phases, edits one week, logs a set and retains the session after reload', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-11-30T12:00:00'))
  await page.goto('/training')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Current Program' }),
  ).toBeVisible({ timeout: 45000 })
  await page
    .getByRole('button', { name: `Activate ${programName}`, exact: true })
    .click({ timeout: 30000 })
  await page.getByRole('button', { name: 'Activate', exact: true }).click()
  const program = page.locator('[aria-label="Periodized program"]').first()
  await expect(
    program.getByText('Current week 2: Strength + hypertrophy', {
      exact: true,
    }),
  ).toBeVisible({ timeout: 45000 })
  await program.getByLabel('Preview training week').selectOption('9')
  await expect(
    program.getByText('2027-01-18 – 2027-01-24 · Intensification', {
      exact: true,
    }),
  ).toBeVisible()
  await program.getByLabel('Preview training week').selectOption('14')
  for (const date of ['2027-02-22', '2027-02-24', '2027-02-27'])
    await expect(program.getByText(date, { exact: true })).toBeVisible()
  await expect(program.locator('.periodized-day')).toHaveCount(3)
  await program.getByLabel('Preview training week').selectOption('11')
  await program
    .getByRole('button', { name: 'Edit phases and weeks', exact: true })
    .click()
  await program.getByLabel('Prescription edit scope').selectOption('week')
  await program.getByLabel('Sets', { exact: true }).first().fill('2')
  await program
    .getByRole('button', { name: 'Save periodized program', exact: true })
    .click()
  await expect(program.getByRole('status')).toContainText(
    'Saved future prescriptions',
  )
  await program
    .getByRole('button', { name: 'Close periodization editor' })
    .click()
  await page.reload()
  await expect(
    program.getByText('Current week 2: Strength + hypertrophy', {
      exact: true,
    }),
  ).toBeVisible({ timeout: 45000 })
  await program.getByLabel('Preview training week').selectOption('2')
  await expect(page.locator('html')).toHaveJSProperty(
    'scrollWidth',
    await page.evaluate(() => window.innerWidth),
  )
  await program
    .getByRole('button', { name: 'Start week 2 workout', exact: true })
    .first()
    .click()
  await expect(page).toHaveURL(/\/workout/, { timeout: 45000 })
  await expect(page.getByText(/Planned: 4–6 reps · 2 RIR/).first()).toBeVisible(
    { timeout: 45000 },
  )
  await page.getByLabel('Set 1 Weight', { exact: true }).fill('185')
  await page.getByLabel('Set 1 Weight', { exact: true }).blur()
  await page.getByLabel('Set 1 Reps', { exact: true }).fill('5')
  await page.getByLabel('Set 1 Reps', { exact: true }).blur()
  // Autofill fields save asynchronously. Confirm the write completed before
  // forcing a navigation that can abort pending IndexedDB work in WebKit.
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            new Promise<boolean>((resolve, reject) => {
              const request = indexedDB.open('training-log')
              request.onerror = () => reject(request.error)
              request.onsuccess = () => {
                const database = request.result
                const rows = database
                  .transaction('workoutSets')
                  .objectStore('workoutSets')
                  .getAll()
                rows.onsuccess = () => {
                  database.close()
                  resolve(
                    rows.result.some(
                      (set) =>
                        set.setNumber === 1 &&
                        set.metricValues.weight === 185 &&
                        set.metricValues.reps === 5,
                    ),
                  )
                }
                rows.onerror = () => {
                  database.close()
                  reject(rows.error)
                }
              }
            }),
        ),
      { timeout: 30000 },
    )
    .toBe(true)
  await page.reload()
  await expect(page.getByLabel('Set 1 Weight', { exact: true })).toHaveValue(
    '185',
    { timeout: 45000 },
  )
  await expect(page.getByLabel('Set 1 Reps', { exact: true })).toHaveValue('5')
})

test('creates a second editable periodized program through the existing clone flow', async ({
  page,
}) => {
  await page.goto('/training')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Current Program' }),
  ).toBeVisible({ timeout: 45000 })
  await page
    .getByRole('button', { name: `Clone ${programName}`, exact: true })
    .click({ timeout: 30000 })
  await page
    .getByRole('button', { name: `Edit ${programName} copy`, exact: true })
    .click()
  await page
    .getByText('Advanced periodized programming (optional)', { exact: true })
    .click()
  const program = page.locator('[aria-label="Periodized program"]').first()
  await expect(program.getByLabel('Preview training week')).toBeVisible()
  await program
    .getByRole('button', { name: 'Edit phases and weeks', exact: true })
    .click()
  await program.getByLabel('Assigned start date').fill('2027-03-01')
  await program
    .getByRole('button', { name: 'Save periodized program', exact: true })
    .click()
  await expect(program.getByRole('status')).toContainText(
    'Saved future prescriptions',
  )
  await expect(
    program.getByText('2027-03-01 – 2027-06-06 · 14 weeks', { exact: true }),
  ).toBeVisible()
})
