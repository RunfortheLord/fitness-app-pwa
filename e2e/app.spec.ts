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

        await expect(page).toHaveTitle(/Training Log/)
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
