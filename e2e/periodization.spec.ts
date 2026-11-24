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

async function openPeriodization(page: Page, enable = false) {
  await page
    .getByRole('button', { name: 'Edit active program', exact: true })
    .click()
  if (enable) {
    await page.getByRole('button', { name: 'Program editor settings' }).click()
    const settings = page.getByRole('dialog', {
      name: 'Program settings',
      exact: true,
    })
    await expect(settings.getByLabel('Enable periodization')).not.toBeChecked()
    await settings.getByLabel('Enable periodization').check()
  } else
    await page.getByRole('button', { name: 'Weekly plan', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Weekly plan', exact: true })
  await expect(editor.getByLabel('Training week')).toBeVisible()
  return editor
}

async function returnToTraining(page: Page) {
  await page.getByRole('button', { name: 'Back from weekly plan' }).click()
  await page.getByRole('button', { name: 'Back from program editor' }).click()
  await expect(
    page.getByRole('button', { name: 'Edit active program', exact: true }),
  ).toBeVisible()
  await expect(page.locator('[aria-label="Periodized program"]')).toHaveCount(0)
}

async function firstExercise(page: Page) {
  await page
    .getByRole('dialog', { name: 'Weekly plan', exact: true })
    .getByRole('button', { name: /Monday — Heavy Bench/ })
    .click()
  await page
    .getByRole('dialog', { name: 'Workout day', exact: true })
    .getByRole('button', { name: /Barbell Bench Press/ })
    .first()
    .click()
  const editor = page.getByRole('dialog', {
    name: 'Exercise plan',
    exact: true,
  })
  await editor.locator('.plan-group summary').first().click()
  return editor
}
async function closeExercisePlan(page: Page) {
  await page.getByRole('button', { name: 'Back from exercise plan' }).click()
  await page.getByRole('button', { name: 'Back from workout day' }).click()
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

test('keeps periodization off by default and the familiar Training and live-workout layout', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await activateProgram(page)
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
  let editor = await openPeriodization(page, true)
  await expect(editor.getByLabel('Training week')).toHaveValue('2')
  await editor.getByLabel('Training week').selectOption('9')
  await expect(editor.getByText('Jan 18 – Jan 24, 2027')).toBeVisible()
  await editor.getByLabel('Training week').selectOption('14')
  for (const date of ['2027-02-22', '2027-02-24', '2027-02-27'])
    await expect(
      editor.locator(`.plan-list time[datetime="${date}"]`),
    ).toBeVisible()
  await expect(editor.locator('.plan-list > button')).toHaveCount(3)
  await editor.getByLabel('Training week').selectOption('11')
  await expect(
    editor.getByRole('button', { name: 'Save changes' }),
  ).toHaveCount(0)
  await page.screenshot({
    path: testInfo.outputPath('periodization-editor.png'),
  })
  const exercise = await firstExercise(page)
  await expect(exercise.getByLabel('% estimated 1RM').first()).toBeHidden()
  await page.screenshot({ path: testInfo.outputPath('exercise-plan.png') })
  await exercise.getByLabel('Apply changes to').selectOption('week')
  await exercise.getByLabel('Sets', { exact: true }).first().fill('2')
  await exercise
    .getByRole('button', { name: 'Save changes', exact: true })
    .click()
  await expect(exercise.getByRole('status')).toContainText('Changes saved.')
  await closeExercisePlan(page)
  await returnToTraining(page)
  await page.reload()
  editor = await openPeriodization(page)
  await expect(editor.getByLabel('Training week')).toHaveValue('2')
  await editor.getByLabel('Training week').selectOption('11')
  await firstExercise(page)
  await expect(
    exercise.getByLabel('Sets', { exact: true }).first(),
  ).toHaveValue('2')
  await closeExercisePlan(page)
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
  await page.getByRole('button', { name: 'Program editor settings' }).click()
  const settings = page.getByRole('dialog', {
    name: 'Program settings',
    exact: true,
  })
  await expect(settings.getByLabel('Enable periodization')).not.toBeChecked()
  await settings.getByLabel('Enable periodization').check()
  await page.getByRole('button', { name: 'Edit schedule' }).click()
  const editor = page.getByRole('dialog', { name: 'Schedule', exact: true })
  await editor.getByLabel('Assigned start date').fill('2027-03-01')
  await editor
    .getByRole('button', { name: 'Save changes', exact: true })
    .click()
  await expect(editor.getByRole('status')).toContainText('Changes saved.')
  await editor.getByRole('button', { name: 'Back from schedule' }).click()
  await page.getByLabel('Training week').selectOption('1')
  await expect(page.getByText('Mar 1 – Mar 7, 2027')).toBeVisible()
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
  await openPeriodization(page, true)
  await returnToTraining(page)
  const program = page.getByRole('region', {
    name: 'Current Program',
    exact: true,
  })
  await expect(program.getByText('Week 14 · Max testing')).toBeVisible()
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
