import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

const programName = 'February 2027 Powerlifting Peak + Upper Body Hypertrophy'
test.setTimeout(120000)

async function activateProgram(page: Page, date = '2026-11-30T12:00:00') {
  await page.clock.setFixedTime(new Date(date))
  await page.goto('/training')
  await page
    .getByRole('button', { name: `Activate ${programName}`, exact: true })
    .click({ timeout: 45000 })
  await page.getByRole('button', { name: 'Activate', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Edit active program', exact: true }),
  ).toBeVisible()
  const dismiss = page
    .getByRole('button', { name: 'Dismiss notification' })
    .first()
  if (await dismiss.isVisible()) await dismiss.click()
}

async function openEditor(page: Page) {
  await page
    .getByRole('button', { name: 'Edit active program', exact: true })
    .click()
  return page.getByRole('dialog', { name: 'Program Editor', exact: true })
}
async function returnToTraining(page: Page) {
  await page.getByRole('button', { name: 'Back from program editor' }).click()
  await expect(
    page.getByRole('button', { name: 'Edit active program', exact: true }),
  ).toBeVisible()
}
async function openSetTargets(page: Page, number: number) {
  await page.getByRole('button', { name: 'More exercise actions' }).click()
  await page.getByRole('button', { name: 'Set targets', exact: true }).click()
  const targets = page.getByRole('dialog', { name: 'Set targets', exact: true })
  await targets
    .getByRole('combobox', { name: 'Target set' })
    .selectOption({ index: number - 1 })
  return targets
}

async function startFirstDay(page: Page) {
  await page
    .getByRole('region', { name: 'Current Program', exact: true })
    .getByRole('button', { name: 'Start Workout', exact: true })
    .first()
    .click()
  await expect(page).toHaveURL(/\/workout/, { timeout: 45000 })
}

test('returns to the familiar live-workout layout when asymmetrical weeks are switched off', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await activateProgram(page)
  const editor = await openEditor(page)
  await editor.getByRole('button', { name: 'Program editor settings' }).click()
  await page.getByLabel('Asymmetrical weeks').uncheck()
  await expect(editor.getByLabel('Training week')).toHaveCount(0)
  await returnToTraining(page)
  await expect(page.getByLabel('Select program week')).toBeEnabled()
  await expect(page.locator('[aria-label="Periodized program"]')).toHaveCount(0)
  await expect(
    page.getByText('Edit phases and weeks', { exact: true }),
  ).toHaveCount(0)
  await page.screenshot({
    path: testInfo.outputPath('training-default-off.png'),
  })
  await startFirstDay(page)
  await expect(page.getByLabel('Set 1 Weight', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Set 1 targets', exact: true }),
  ).toHaveCount(0)
  await expect(page.getByText(/Planned:/)).toHaveCount(0)
  const rows = await page.locator('.set-row').evaluateAll((elements) =>
    elements.map((element) => ({
      height: element.getBoundingClientRect().height,
      text: element.textContent,
    })),
  )
  expect(rows.length).toBeGreaterThan(0)
  for (const row of rows) {
    expect(row.height).toBeCloseTo(72, 1)
    expect(row.text).not.toContain('planned load')
  }
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath('workout-default-off.png'),
  })
})

test('edits periodization only inside the program editor and logs in compact phone rows', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await activateProgram(page)
  const editor = await openEditor(page)
  // The day content rests directly on the app background; there is no grey
  // panel behind the exercise rows.
  await expect(editor.locator('.program-builder-day')).toHaveCSS(
    'background-color',
    'rgba(0, 0, 0, 0)',
  )
  await expect(editor.getByLabel('Training week')).toHaveValue('2')
  await editor.getByLabel('Training week').selectOption('9')
  await page.screenshot({
    animations: 'disabled',
    path: testInfo.outputPath('asymmetrical-editor.png'),
  })
  await editor
    .getByRole('button', {
      name: 'Edit Barbell Bench Press prescription',
      exact: true,
    })
    .click()
  await editor.locator('.plan-group summary').first().click()
  const group = editor.locator('.plan-group').first()
  await expect(
    group.getByText('Enter a saved 1RM to calculate this target.'),
  ).toBeVisible()
  await group.getByLabel('Saved 1RM (lb)').fill('250')
  await expect(group.getByText('Target · 225 lb')).toBeVisible()
  // A fresh WebKit install can still be seeding the shared exercise library.
  await expect(editor.getByText('Saved', { exact: true })).toBeVisible({
    timeout: 45000,
  })
  await page.screenshot({
    path: testInfo.outputPath('asymmetrical-weight.png'),
  })
  await expect(
    editor.getByRole('button', { name: 'Save exercise', exact: true }),
  ).toHaveCount(0)
  await group.getByLabel('Sets', { exact: true }).fill('3')
  await group.getByLabel('Sets', { exact: true }).fill('2')
  await expect(editor.getByText('Saved', { exact: true })).toBeVisible()
  await editor.getByText('Apply edits to other weeks', { exact: true }).click()
  await editor.getByLabel('Week 10 · Intensification').check()

  await editor
    .getByRole('button', { name: 'Apply to selected weeks', exact: true })
    .click()
  await expect(
    editor.getByText('Applied to selected weeks.', { exact: true }),
  ).toBeVisible()
  await editor.getByRole('button', { name: 'Back from program editor' }).click()
  await editor.getByLabel('Training week').selectOption('10')
  await editor
    .getByRole('button', {
      name: 'Edit Barbell Bench Press prescription',
      exact: true,
    })
    .click()
  await editor.locator('.plan-group summary').first().click()
  await expect(group.getByLabel('Sets', { exact: true })).toHaveValue('2')
  await editor.getByRole('button', { name: 'Back from program editor' }).click()
  await returnToTraining(page)
  await startFirstDay(page)
  await expect(page.getByLabel('Set 1 Weight', { exact: true })).toBeVisible()
  await expect(page.locator('.set-row button')).toHaveCount(
    (await page.locator('.set-row').count()) * 2,
  )
  await expect(
    page.getByRole('heading', { name: 'top set', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'back-off', exact: true }),
  ).toHaveCount(1)
  await expect(page.getByText(/Planned:/)).not.toBeVisible()
  await expect(page.locator('.set-row').first()).toHaveAttribute(
    'data-set-kind',
    'top set',
  )
  await expect(page.locator('.set-row').nth(1)).toHaveAttribute(
    'data-set-kind',
    'back-off',
  )
  const colors = await page
    .locator('.set-row')
    .evaluateAll((rows) =>
      rows.slice(0, 2).map((row) => getComputedStyle(row).borderLeftColor),
    )
  expect(colors[0]).not.toBe(colors[1])
  // Keep the existing exercise labels, tabs and horizontal swipe controls.
  for (const [direction, label] of [
    [-1, 'Exercise 2 of 7'],
    [1, 'Exercise 1 of 7'],
  ] as const) {
    const title = await page.locator('.exercise-title-block').boundingBox()
    expect(title).not.toBeNull()
    if (!title) throw new Error('Exercise title is not visible')
    const left = title.x + 20
    const right = title.x + title.width - 20
    await page.mouse.move(direction < 0 ? right : left, title.y + 12)
    await page.mouse.down()
    await page.mouse.move(direction < 0 ? left : right, title.y + 12, {
      steps: 5,
    })
    await page.mouse.up()
    await expect(page.getByText(label, { exact: true })).toBeVisible()
  }
  await expect(
    page.getByRole('region', { name: 'Exercises', exact: true }),
  ).toBeVisible()
  for (const width of [375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 })
    const boxes = await page
      .locator('.set-row')
      .first()
      .evaluate((row) => ({
        row: row.getBoundingClientRect().toJSON(),
        fields: [...row.querySelectorAll('input')].map((input) =>
          input.getBoundingClientRect().toJSON(),
        ),
        controls: [...row.querySelectorAll('button')].map((button) =>
          button.getBoundingClientRect().toJSON(),
        ),
        viewport: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }))
    expect(boxes.row.height).toBeCloseTo(56, 1)
    expect(boxes.scrollWidth).toBe(boxes.viewport)
    for (const field of boxes.fields) {
      expect(Number(field.width.toFixed(2))).toBeGreaterThanOrEqual(44)
      expect(Number(field.height.toFixed(2))).toBeGreaterThanOrEqual(44)
      expect(field.top).toBeGreaterThanOrEqual(boxes.row.top - 0.1)
      expect(field.bottom).toBeLessThanOrEqual(boxes.row.bottom + 0.1)
    }
    for (let index = 1; index < boxes.fields.length; index++)
      expect(boxes.fields[index].left).toBeGreaterThanOrEqual(
        boxes.fields[index - 1].right,
      )
    for (const control of boxes.controls) {
      expect(Number(control.width.toFixed(2))).toBeGreaterThanOrEqual(44)
      expect(Number(control.height.toFixed(2))).toBeGreaterThanOrEqual(44)
    }
    await page.screenshot({
      path: testInfo.outputPath(`workout-enabled-${width}.png`),
    })
  }
  const targets = await openSetTargets(page, 1)
  await expect(targets.getByText('4–6 reps · 2 RIR')).toBeVisible()
  await targets.getByLabel('Set 1 planned load', { exact: true }).fill('190')
  await targets.getByLabel('Set 1 planned load', { exact: true }).blur()
  await expect(targets.getByRole('status')).toContainText(
    'Saved for this workout.',
  )
  await targets.getByRole('button', { name: 'Close set targets' }).click()
  await expect(targets).toBeHidden()
  await page.getByLabel('Set 1 Weight', { exact: true }).click()
  await page.getByLabel('Set 1 Weight', { exact: true }).fill('185')
  await expect(page.getByLabel('Set 1 Weight', { exact: true })).toHaveValue(
    '185',
  )
  await page.getByLabel('Set 1 Weight', { exact: true }).blur()
  await page.getByLabel('Set 1 Reps', { exact: true }).fill('5')
  await expect(page.getByLabel('Set 1 Reps', { exact: true })).toHaveValue('5')
  await page.getByLabel('Set 1 Reps', { exact: true }).blur()
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
  await openSetTargets(page, 1)
  await expect(
    page.getByLabel('Set 1 planned load', { exact: true }),
  ).toHaveValue('190')
})

test('autosaves only the open week and keeps invalid input available for correction', async ({
  page,
}) => {
  await activateProgram(page)
  const editor = await openEditor(page)
  const select = editor.getByLabel('Training week')
  const back = editor.getByRole('button', { name: 'Back from program editor' })
  const sets = editor
    .locator('.plan-group')
    .first()
    .getByLabel('Sets', { exact: true })
  const openExercise = async (week: string) => {
    await select.selectOption(week)
    await editor
      .getByRole('button', {
        name: 'Edit Barbell Bench Press prescription',
        exact: true,
      })
      .click()
    await editor.locator('.plan-group summary').first().click()
  }
  await openExercise('9')
  // Exercise the real retry control after one failed local database write.
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'activeProgramCycles') {
        IDBObjectStore.prototype.put = put
        throw new DOMException(
          'Test storage write failed',
          'QuotaExceededError',
        )
      }
      return put.apply(this, args)
    }
  })
  await sets.fill('3')
  await expect(
    editor.getByText('Changes unsaved', { exact: true }),
  ).toBeVisible()
  await editor.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(editor.getByText('Saved', { exact: true })).toBeVisible()
  await sets.fill('0')
  await expect(
    editor.getByText('Changes unsaved', { exact: true }),
  ).toBeVisible()
  await back.click()
  const discard = page.getByRole('dialog', {
    name: 'Discard prescription changes?',
  })
  await expect(discard).toBeVisible()
  await discard.getByRole('button', { name: 'Cancel' }).click()
  await expect(sets).toHaveValue('0')
  await sets.fill('2')
  await editor.getByText('Apply edits to other weeks', { exact: true }).click()
  await editor.getByLabel('Week 10 · Intensification').check()
  await back.click()
  await openExercise('10')
  await expect(sets).toHaveValue('1')
  await back.click()
  await openExercise('9')
  await expect(sets).toHaveValue('2')
  await sets.fill('4')
  await back.click()
  await expect(select).toBeVisible()
  await page.reload()
  await openEditor(page)
  await openExercise('9')
  await expect(sets).toHaveValue('4')
})

test('creates a second editable periodized program through the existing clone flow', async ({
  page,
}) => {
  await page.goto('/training')
  await page
    .getByRole('button', { name: `Clone ${programName}`, exact: true })
    .click({ timeout: 45000 })
  await page
    .getByRole('button', { name: `Edit ${programName} copy`, exact: true })
    .click()
  const editor = page.getByRole('dialog', {
    name: 'Edit template',
    exact: true,
  })
  await editor.getByLabel('Training week').selectOption('3')
  await editor.getByRole('button', { name: 'Week options' }).click()
  const options = page.getByRole('dialog', {
    name: 'Week 3 options',
    exact: true,
  })
  await options.getByLabel('Week name').fill('Volume B')
  await options.getByText('Copy this week to…', { exact: true }).click()
  await options.getByLabel('Week 4 · Volume').check()
  await options.getByRole('button', { name: 'Save week' }).click()
  await expect(
    editor.getByLabel('Training week').locator('option[value="4"]'),
  ).toHaveText('Week 4 · Volume B')
})

test('distinguishes max attempts from ordinary sets without expanding the logging rows', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, 'standalone', {
      configurable: true,
      value: true,
    })
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X)',
    })
  })
  await activateProgram(page, '2027-02-22T12:00:00')
  await page.getByLabel('Select program week').selectOption('13')
  await page.getByLabel('Select program week').selectOption('14')
  const program = page.getByRole('region', {
    name: 'Current Program',
    exact: true,
  })
  await expect(program.getByLabel('Select program week')).toHaveValue('14')
  await expect(
    program.getByRole('button', { name: 'Start Workout', exact: true }),
  ).toHaveCount(3)
  await expect(
    program.getByText('Wednesday — Squat 1RM test', { exact: true }),
  ).toBeVisible()
  await startFirstDay(page)
  await expect(
    page.getByRole('heading', { name: 'Monday — Bench 1RM test', exact: true }),
  ).toBeVisible()
  const row = page.locator('.set-row[data-set-kind="max attempt"]').first()
  await expect(row).toHaveAttribute('data-set-kind', 'max attempt')
  await expect(
    page.getByRole('heading', { name: 'max attempt', exact: true }),
  ).toBeVisible()
  await expect(row).toHaveCSS('height', '56px')
  await expect(page.getByLabel('Set 1 Reps', { exact: true })).toHaveAttribute(
    'placeholder',
    '5',
  )
  await expect(page.getByLabel('Set 2 Reps', { exact: true })).toHaveAttribute(
    'placeholder',
    '3',
  )
  await expect(page.getByLabel('Set 3 Reps', { exact: true })).toHaveAttribute(
    'placeholder',
    '1',
  )
  await expect(page.getByLabel('Set 4 Reps', { exact: true })).toHaveAttribute(
    'placeholder',
    '1',
  )
  await expect(page.getByLabel('Set 4 bar speed')).not.toBeVisible()
  await row.scrollIntoViewIfNeeded()
  await page.screenshot({
    path: testInfo.outputPath('workout-max-attempt.png'),
  })
  await openSetTargets(page, 4)
  await expect(page.getByLabel('Set 4 bar speed')).toBeVisible()
})
